/**
 * Media HTTP route end-to-end flow (k6) — hits /api/v1/media directly
 * with real multipart uploads against the running dev server. No mocked
 * storage: bytes land in the adapter selected by the server's NODE_ENV.
 *
 * Prerequisites:
 *   1. Dev server running with real .env credentials:  npm run dev
 *   2. Seeded test user + fixtures:  ts-node k6/support/seed-media-test-user.ts
 *      (npm run test:k6:media does both steps.)
 *
 * Covers: single upload, multi-file upload, replace, delete, oversized
 * rejection, disallowed-extension rejection, quota-exceeded rejection
 * (the seed script grants this user a 30KB quota to make that case real).
 */
import http from "k6/http";
import { check, fail } from "k6";
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const EMAIL = "k6.media@mentora.test";
const PASSWORD = "K6MediaTest#12345";

const tinyPng = open("./fixtures/tiny.png", "b");
const quotaBusterPng = open("./fixtures/quota-buster.png", "b");
const oversizedPng = open("./fixtures/oversized.png", "b");
const notAllowedTxt = open("./fixtures/not-allowed.txt", "b");

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1.0"],
  },
};

function login() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { "login 200": (r) => r.status === 200 });
  const body = res.json();
  if (!body || !body.data || !body.data.token) {
    fail(
      `login failed (status ${res.status}) — did you run the seed script? (npm run test:k6:media runs it for you)`
    );
  }
  return body.data.token;
}

function multipart(token, fd) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${fd.boundary}`,
    },
  };
}

function uploadFiles(token, files, fileCategory) {
  const fd = new FormData();
  for (const [name, data, type] of files) {
    fd.append("files", http.file(data, name, type));
  }
  fd.append("fileCategory", fileCategory);
  return http.post(`${BASE_URL}/api/v1/media`, fd.body(), multipart(token, fd));
}

export default function () {
  const token = login();

  // ── 1. Single file upload ──
  const single = uploadFiles(
    token,
    [["avatar.png", tinyPng, "image/png"]],
    "PROFILE_PHOTO"
  );
  check(single, {
    "single upload 201": (r) => r.status === 201,
    "single upload returns fileId": (r) =>
      r.status === 201 && !!r.json().data[0].fileId,
  });
  if (single.status !== 201) fail("single upload failed — aborting flow");
  const fileId1 = single.json().data[0].fileId;

  // ── 2. Multiple files in one request ──
  const multi = uploadFiles(
    token,
    [
      ["a.png", tinyPng, "image/png"],
      ["b.png", tinyPng, "image/png"],
    ],
    "PROFILE_PHOTO"
  );
  check(multi, {
    "multi upload 201": (r) => r.status === 201,
    "multi upload returns 2 results in order": (r) => {
      if (r.status !== 201) return false;
      const data = r.json().data;
      return data.length === 2 && data[0].id === "0" && data[1].id === "1";
    },
  });
  const fileId2 = multi.status === 201 ? multi.json().data[0].fileId : null;

  // ── 3. Resolve a live file URL ──
  const urlRes = http.get(`${BASE_URL}/api/v1/media/${fileId1}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(urlRes, {
    "get url 200": (r) => r.status === 200,
    "url points at the category folder": (r) =>
      r.status === 200 && r.json().data.url.includes("profile-photos/"),
  });

  // ── 4. Replace ──
  const fdReplace = new FormData();
  fdReplace.append("file", http.file(tinyPng, "replacement.png", "image/png"));
  const replace = http.put(
    `${BASE_URL}/api/v1/media/${fileId1}`,
    fdReplace.body(),
    multipart(token, fdReplace)
  );
  check(replace, {
    "replace 200": (r) => r.status === 200,
    "replace returns a new fileId": (r) =>
      r.status === 200 && r.json().data.fileId !== fileId1,
  });

  // The replaced (old) file id is soft-deleted — its URL must now 404.
  const goneUrl = http.get(`${BASE_URL}/api/v1/media/${fileId1}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(goneUrl, { "replaced file url is 404": (r) => r.status === 404 });

  // ── 5. Delete ──
  const del = http.del(`${BASE_URL}/api/v1/media/${fileId2}`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(del, { "delete 200": (r) => r.status === 200 });
  const delAgain = http.del(`${BASE_URL}/api/v1/media/${fileId2}`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(delAgain, { "second delete of same file is 404": (r) => r.status === 404 });

  // ── 6. Oversized file (over the 5MB PROFILE_PHOTO cap) → 400/413 ──
  const oversized = uploadFiles(
    token,
    [["huge.png", oversizedPng, "image/png"]],
    "PROFILE_PHOTO"
  );
  check(oversized, {
    "oversized rejected with 400/413": (r) =>
      r.status === 400 || r.status === 413,
  });

  // ── 7. Disallowed extension → 400 ──
  const badExt = uploadFiles(
    token,
    [["notes.txt", notAllowedTxt, "text/plain"]],
    "PROFILE_PHOTO"
  );
  check(badExt, { "disallowed extension rejected with 400": (r) => r.status === 400 });

  // ── 8. Quota exceeded (40KB file vs this user's 30KB quota) → 400 ──
  const quota = uploadFiles(
    token,
    [["quota.png", quotaBusterPng, "image/png"]],
    "PROFILE_PHOTO"
  );
  check(quota, { "quota exceeded rejected with 400": (r) => r.status === 400 });

  // ── 9. Unauthenticated request is rejected ──
  const fdAnon = new FormData();
  fdAnon.append("files", http.file(tinyPng, "anon.png", "image/png"));
  fdAnon.append("fileCategory", "PROFILE_PHOTO");
  const anon = http.post(`${BASE_URL}/api/v1/media`, fdAnon.body(), {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${fdAnon.boundary}`,
    },
  });
  check(anon, { "unauthenticated upload is 401": (r) => r.status === 401 });
}
