/**
 * Module 8.5 — Learning Materials end-to-end flow (k6).
 *
 * Prerequisites:
 *   1. Dev server running with real .env credentials: npm run dev
 *   2. Seeded tutor (complete profile + ACTIVE KYC) + fixtures:
 *      ts-node k6/support/seed-materials-test-tutor.ts
 *      (npm run test:k6:materials does both steps for you)
 *   3. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set — the super admin role
 *      carries every materials.* and platform.config.* permission.
 *
 * Covers the tutor lifecycle (collection -> section -> file/written-note
 * materials -> lesson plan -> reorder -> storage stats -> self-delete) and
 * the admin surface (download-policy toggle, moderation removal + the
 * resulting tutor notification, collection suspend).
 */
import http from "k6/http";
import encoding from "k6/encoding";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const seed = JSON.parse(open("./fixtures/materials-seed.json"));
const TUTOR_EMAIL = seed.email;
const TUTOR_PASSWORD = "K6MaterialsTutorTest#12345";

const image = open("./fixtures/materials-image.png", "b");
const pdf = open("./fixtures/materials-document.pdf", "b");
const audio = open("./fixtures/materials-audio.mp3", "b");

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1.0"] },
};

const json = (token) => ({
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
});
// No Content-Type override for multipart — k6 sets its own boundary header.
const multipart = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status}, body: ${res.body})`);
  return body;
}

function login(identifier, password, isAdmin) {
  return http.post(
    `${BASE_URL}/api/v1/auth/${isAdmin ? "admin" : "user"}/login`,
    JSON.stringify({ identifier, password }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function loginOrFail(identifier, password, label, isAdmin) {
  const res = login(identifier, password, isAdmin);
  check(res, { [`${label}: login 200`]: (r) => r.status === 200 });
  if (res.status !== 200) fail(`${label}: could not log in — did you run the seed script?`);
  return mustJson(res, label).data.token;
}

function getUserId(token) {
  const payload = token.split(".")[1];
  const decoded = JSON.parse(encoding.b64decode(payload, "rawurl", "s"));
  return decoded.id;
}

export default function () {
  const tutorToken = loginOrFail(TUTOR_EMAIL, TUTOR_PASSWORD, "tutor");
  const me = `${BASE_URL}/api/v1/materials/me`;

  // ── Collection ──
  const createCollection = http.post(
    `${me}/collections`,
    JSON.stringify({
      name: "GCE A-Level Physics 2020-2024",
      description: "Complete notes and past papers",
      subjectId: seed.subjectId,
      levelId: seed.levelId,
    }),
    json(tutorToken)
  );
  check(createCollection, { "create collection 201": (r) => r.status === 201 });
  const collectionId = mustJson(createCollection, "create collection").data.id;

  // ── Section ──
  const createSection = http.post(
    `${me}/collections/${collectionId}/sections`,
    JSON.stringify({ name: "Chapter 1 — Mechanics", isFreePreview: true }),
    json(tutorToken)
  );
  check(createSection, { "create section 201": (r) => r.status === 201 });
  const sectionId = mustJson(createSection, "create section").data.id;

  // ── File-backed materials ──
  const uploadDoc = http.post(
    `${me}/collections/${collectionId}/materials`,
    {
      name: "Mechanics notes",
      materialType: "DOCUMENT",
      sectionId,
      file: http.file(pdf, "mechanics.pdf", "application/pdf"),
    },
    multipart(tutorToken)
  );
  check(uploadDoc, { "upload PDF material 201": (r) => r.status === 201 });
  const docMaterialId = mustJson(uploadDoc, "upload doc").data.id;

  const uploadImage = http.post(
    `${me}/collections/${collectionId}/materials`,
    {
      name: "Free body diagram",
      materialType: "IMAGE",
      sectionId,
      file: http.file(image, "diagram.png", "image/png"),
    },
    multipart(tutorToken)
  );
  check(uploadImage, { "upload image material 201": (r) => r.status === 201 });

  const uploadAudio = http.post(
    `${me}/collections/${collectionId}/materials`,
    {
      name: "Oral exam practice",
      materialType: "AUDIO",
      file: http.file(audio, "practice.mp3", "audio/mpeg"),
    },
    multipart(tutorToken)
  );
  check(uploadAudio, { "upload audio material 201": (r) => r.status === 201 });

  // ── Written note ──
  const writtenNoteDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Newton's second law: F = ma" }],
      },
    ],
  };
  const createNote = http.post(
    `${me}/collections/${collectionId}/materials/written-note`,
    JSON.stringify({ name: "Quick summary", sectionId, contentJson: writtenNoteDoc }),
    json(tutorToken)
  );
  check(createNote, { "create written note 201": (r) => r.status === 201 });
  const noteId = mustJson(createNote, "create note").data.id;

  const badNote = http.post(
    `${me}/collections/${collectionId}/materials/written-note`,
    JSON.stringify({
      name: "Malicious note",
      contentJson: { type: "doc", content: [{ type: "html", content: [] }] },
    }),
    json(tutorToken)
  );
  check(badNote, { "written note with disallowed node type rejected": (r) => r.status === 400 });

  const updateNote = http.patch(
    `${me}/collections/${collectionId}/materials/${noteId}/content`,
    JSON.stringify({
      contentJson: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Updated summary" }] }],
      },
    }),
    json(tutorToken)
  );
  check(updateNote, { "update written note content 200": (r) => r.status === 200 });

  // ── Reorder ──
  const reorderMaterials = http.patch(
    `${me}/collections/${collectionId}/materials/reorder`,
    JSON.stringify({ orderedIds: [noteId, docMaterialId] }),
    json(tutorToken)
  );
  check(reorderMaterials, { "reorder materials 200": (r) => r.status === 200 });

  const reorderCollections = http.patch(
    `${me}/collections/reorder`,
    JSON.stringify({ orderedIds: [collectionId] }),
    json(tutorToken)
  );
  check(reorderCollections, { "reorder collections 200": (r) => r.status === 200 });

  // ── Lesson plan ──
  const createPlan = http.post(
    `${me}/collections/${collectionId}/lesson-plan`,
    JSON.stringify({ title: "A-Level Physics curriculum" }),
    json(tutorToken)
  );
  check(createPlan, { "create lesson plan 201": (r) => r.status === 201 });

  const createTopicUnlinked = http.post(
    `${me}/collections/${collectionId}/lesson-plan/topics`,
    JSON.stringify({ title: "Topic 2: Waves — coming soon" }),
    json(tutorToken)
  );
  check(createTopicUnlinked, { "create unlinked topic 201": (r) => r.status === 201 });

  const createTopicLinked = http.post(
    `${me}/collections/${collectionId}/lesson-plan/topics`,
    JSON.stringify({ title: "Topic 1: Mechanics", sectionId }),
    json(tutorToken)
  );
  check(createTopicLinked, { "create linked topic 201": (r) => r.status === 201 });

  const getPlan = http.get(`${me}/collections/${collectionId}/lesson-plan`, json(tutorToken));
  check(getPlan, {
    "get lesson plan 200": (r) => r.status === 200,
    "unlinked topic is coming_soon": (r) =>
      mustJson(r, "get plan").data.topics.some(
        (t) => t.title.includes("Waves") && t.status === "coming_soon"
      ),
    "linked topic (with materials) is available": (r) =>
      mustJson(r, "get plan").data.topics.some(
        (t) => t.title.includes("Mechanics") && t.status === "available"
      ),
  });

  // ── Stats & storage ──
  const stats = http.get(`${me}/collections/${collectionId}/stats`, json(tutorToken));
  check(stats, { "collection stats 200": (r) => r.status === 200 });

  const storage = http.get(`${me}/storage`, json(tutorToken));
  check(storage, {
    "storage usage 200": (r) => r.status === 200,
    "storage usage reflects uploads": (r) => Number(mustJson(r, "storage").data.usedBytes) > 0,
  });

  // ── Tutor self-delete ──
  const deleteAudio = http.del(
    `${me}/collections/${collectionId}/materials/${
      mustJson(uploadAudio, "upload audio").data.id
    }`,
    null,
    json(tutorToken)
  );
  check(deleteAudio, { "tutor deletes own material 200": (r) => r.status === 200 });

  // ── Admin: downloadability policy ──
  const adminToken = loginOrFail(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "admin", true);
  const admin = `${BASE_URL}/api/v1/admin/materials`;

  const getPolicy = http.get(`${admin}/download-policy`, json(adminToken));
  check(getPolicy, {
    "get download policy 200": (r) => r.status === 200,
    "defaults to true for every type": (r) => {
      const p = mustJson(r, "policy").data;
      return p.VIDEO === true && p.AUDIO === true && p.DOCUMENT === true && p.IMAGE === true;
    },
  });

  const putPolicy = http.put(
    `${admin}/download-policy`,
    JSON.stringify({ VIDEO: false }),
    json(adminToken)
  );
  check(putPolicy, {
    "update download policy 200": (r) => r.status === 200,
    "video toggled off, others untouched": (r) => {
      const p = mustJson(r, "policy update").data;
      return p.VIDEO === false && p.AUDIO === true;
    },
  });

  // ── Admin: moderation removal + tutor notification ──
  const removeMaterial = http.post(
    `${admin}/materials/${docMaterialId}/remove`,
    JSON.stringify({
      reasonCode: "POLICY_VIOLATION",
      reviewNote: "Contains content that violates platform policy on unauthorized reproduction.",
    }),
    json(adminToken)
  );
  check(removeMaterial, { "admin removes material 200": (r) => r.status === 200 });

  const collectionAfterRemoval = http.get(
    `${me}/collections/${collectionId}`,
    json(tutorToken)
  );
  check(collectionAfterRemoval, {
    "removed material no longer in tutor's collection": (r) => {
      const c = mustJson(r, "collection after removal").data;
      const allMaterials = [...c.materials, ...c.sections.flatMap((s) => s.materials)];
      return !allMaterials.some((m) => m.id === docMaterialId);
    },
  });

  const tutorNotifications = http.get(`${BASE_URL}/api/v1/notifications`, json(tutorToken));
  check(tutorNotifications, {
    "tutor was notified of the removal": (r) =>
      mustJson(r, "notifications").data.some((n) => n.type === "MATERIAL_REMOVED"),
  });

  const tutorUserId = getUserId(tutorToken);
  const moderationHistory = http.get(
    `${admin}/tutors/${tutorUserId}/moderation-history`,
    json(adminToken)
  );
  check(moderationHistory, {
    "moderation history reachable": (r) => r.status === 200,
    "moderation history contains the removal": (r) =>
      mustJson(r, "moderation history").data.some(
        (entry) => entry.decision === "REMOVED" && entry.materialId === docMaterialId
      ),
  });

  // ── Admin: suspend the collection ──
  const suspendCollection = http.post(
    `${admin}/collections/${collectionId}/suspend`,
    JSON.stringify({
      reasonCode: "OTHER",
      reviewNote: "Temporary suspension pending manual review of the whole collection.",
    }),
    json(adminToken)
  );
  check(suspendCollection, { "admin suspends collection 200": (r) => r.status === 200 });

  const collectionAfterSuspend = http.get(
    `${me}/collections/${collectionId}`,
    json(tutorToken)
  );
  check(collectionAfterSuspend, {
    "collection is unpublished after suspend": (r) =>
      mustJson(r, "collection after suspend").data.isPublished === false,
  });
}
