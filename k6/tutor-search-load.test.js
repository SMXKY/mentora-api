/**
 * Module 10 — Tutor Discovery & Search load test (k6).
 *
 * A real load test (unlike tutor-search-flow.test.js's single-VU
 * functional pass) — the explicit CI requirement is 100 concurrent
 * search requests with p95 response time under 500ms.
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. Seeded fixtures: ts-node k6/support/seed-tutor-search-fixtures.ts
 *      (npm run test:k6:tutor-search:load does both steps for you)
 */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const seed = JSON.parse(open("./fixtures/tutor-search-seed.json"));

export const options = {
  vus: 100,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
};

const QUERIES = [
  () => `/api/v1/search/tutors?cityId=${seed.cityId}`,
  () => `/api/v1/search/tutors?subjectId=${seed.subjectId}`,
  () => `/api/v1/search/tutors?q=Maths&cityId=${seed.cityId}`,
  () => `/api/v1/search/tutors?subjectId=${seed.subjectId}&levelId=${seed.levelId}&cityId=${seed.cityId}`,
];

export default function () {
  const path = QUERIES[Math.floor(Math.random() * QUERIES.length)]();
  const res = http.get(`${BASE_URL}${path}`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.1);
}
