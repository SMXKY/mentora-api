/**
 * Notification module end-to-end flow (k6).
 *
 * Prerequisites:
 *   - Dev server running locally with real .env credentials:  npm run dev
 *   - NODE_ENV must NOT be production (uses the /auth/dev/otp peek route).
 *
 * Run:  npm run test:k6:notifications
 *   or: k6 run k6/notification-flow.test.js
 *
 * Covers:
 *   1. Fresh user registered through the real OTP flow — triggers a real
 *      ACCOUNT_CREATED notification (in-app + real email via the provider).
 *   2. Real Socket.IO protocol connection (engine.io v4 over WebSocket):
 *      auth handshake, initial unread count, sync replay delivering
 *      ACCOUNT_CREATED to the client.
 *   3. Scoped HTTP API: list / unread-count / mark-read / mark-all-read all
 *      touch ONLY the caller's own data; a second user gets 404 on the
 *      first user's notification ids.
 *   4. A real email through the existing forgot-password flow.
 *
 * Push and WhatsApp are intentionally excluded — no device token or
 * opted-in number exists for a throwaway account.
 */
import http from "k6/http";
import ws from "k6/ws";
import { check, sleep, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const WS_BASE = BASE_URL.replace(/^http/, "ws");
// Overridable so the team can point registration emails at a real inbox.
const EMAIL_BASE = __ENV.K6_EMAIL_BASE || "smookeymykomhr+k6notif";
const EMAIL_DOMAIN = __ENV.K6_EMAIL_DOMAIN || "gmail.com";
const PASSWORD = "K6TestUser#12345";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1.0"],
  },
};

const jsonHeaders = { "Content-Type": "application/json" };

function authHeaders(token) {
  return { headers: { ...jsonHeaders, Authorization: `Bearer ${token}` } };
}

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status})`);
  return body;
}

/** Registers a fresh user through the real email OTP flow. */
function registerUser(tag) {
  const email = `${EMAIL_BASE}.${tag}.${Date.now()}@${EMAIL_DOMAIN}`;

  // The OTP email is a real send — retry briefly if the provider's
  // per-second rate limit rejects it.
  let reqOtp;
  for (let attempt = 0; attempt < 4; attempt++) {
    reqOtp = http.post(
      `${BASE_URL}/api/v1/auth/register/email/request-otp`,
      JSON.stringify({ email }),
      { headers: jsonHeaders }
    );
    if (reqOtp.status === 200) break;
    sleep(5 + attempt * 5);
  }
  check(reqOtp, { [`${tag}: request-otp 200`]: (r) => r.status === 200 });

  const peek = http.get(
    `${BASE_URL}/api/v1/auth/dev/otp?identity=${encodeURIComponent(email)}`
  );
  check(peek, { [`${tag}: dev otp peek 200`]: (r) => r.status === 200 });
  const code = mustJson(peek, "otp peek").data.code;

  const verify = http.post(
    `${BASE_URL}/api/v1/auth/register/email/verify-otp`,
    JSON.stringify({ email, code }),
    { headers: jsonHeaders }
  );
  check(verify, { [`${tag}: verify-otp 200`]: (r) => r.status === 200 });
  const registrationToken = mustJson(verify, "verify-otp").data
    .registrationToken;

  const complete = http.post(
    `${BASE_URL}/api/v1/auth/register/complete`,
    JSON.stringify({
      registrationToken,
      role: "Student",
      password: PASSWORD,
      confirmPassword: PASSWORD,
    }),
    { headers: jsonHeaders }
  );
  check(complete, {
    [`${tag}: register complete 201`]: (r) => r.status === 201,
  });
  const token = mustJson(complete, "register complete").data.token;

  return { email, token };
}

/** Polls unread-count until it is at least `min` (ACCOUNT_CREATED landed). */
function waitForUnread(token, min, tag) {
  for (let i = 0; i < 15; i++) {
    const res = http.get(
      `${BASE_URL}/api/v1/notifications/unread-count`,
      authHeaders(token)
    );
    if (res.status === 200 && res.json().data.unread >= min) return true;
    sleep(1);
  }
  fail(`${tag}: unread-count never reached ${min} — ACCOUNT_CREATED not delivered`);
}

/**
 * Connects over the REAL Socket.IO protocol (engine.io v4, websocket
 * transport): open packet "0{...}", auth connect "40{token}", ack "40{sid}",
 * events "42[event,payload]", ping "2"/pong "3".
 */
function socketFlow(token, tag) {
  let gotCount = false;
  let gotAccountCreated = false;
  let connected = false;

  const res = ws.connect(
    `${WS_BASE}/socket.io/?EIO=4&transport=websocket`,
    {},
    (socket) => {
      socket.on("message", (msg) => {
        if (msg.startsWith("0")) {
          // engine.io open → send Socket.IO CONNECT with auth payload
          socket.send(`40${JSON.stringify({ token })}`);
        } else if (msg === "2") {
          socket.send("3"); // engine.io ping → pong
        } else if (msg.startsWith("40")) {
          connected = true;
          // Ask the server to replay everything since epoch — must include
          // this fresh account's ACCOUNT_CREATED notification.
          socket.send(
            `42${JSON.stringify([
              "notification:sync",
              { since: "1970-01-01T00:00:00.000Z" },
            ])}`
          );
        } else if (msg.startsWith("42")) {
          const [event, payload] = JSON.parse(msg.substring(2));
          if (event === "notification:count") gotCount = true;
          if (event === "notification:new" && payload.type === "ACCOUNT_CREATED")
            gotAccountCreated = true;
          if (gotCount && gotAccountCreated) socket.close();
        } else if (msg.startsWith("44")) {
          socket.close(); // connect_error — auth rejected
        }
      });
      socket.setTimeout(() => socket.close(), 20000);
    }
  );

  check(res, { [`${tag}: websocket upgraded (101)`]: (r) => r && r.status === 101 });
  check(null, {
    [`${tag}: socket.io authenticated connect`]: () => connected,
    [`${tag}: received unread count over socket`]: () => gotCount,
    [`${tag}: received ACCOUNT_CREATED over socket`]: () => gotAccountCreated,
  });
}

export default function () {
  // ── 1. Two fresh users through the real registration flow ──
  // Paced: each registration sends real emails (OTP + welcome) and
  // free-tier providers rate-limit sends per second.
  const userA = registerUser("userA");
  sleep(5);
  const userB = registerUser("userB");

  // ── 2. ACCOUNT_CREATED lands for A (written sync, dispatched async) ──
  waitForUnread(userA.token, 1, "userA");

  const listA = http.get(
    `${BASE_URL}/api/v1/notifications`,
    authHeaders(userA.token)
  );
  check(listA, { "userA: list 200": (r) => r.status === 200 });
  const itemsA = mustJson(listA, "userA list").data;
  const accountCreatedA = itemsA.find((n) => n.type === "ACCOUNT_CREATED");
  check(null, {
    "userA: list contains ACCOUNT_CREATED": () => !!accountCreatedA,
    "userA: list is scoped to one recipient only": () =>
      itemsA.length > 0 &&
      itemsA.every((n) => n.recipientId === itemsA[0].recipientId),
  });
  if (!accountCreatedA) fail("userA has no ACCOUNT_CREATED notification");

  // ── 3. Real Socket.IO connection receives it ──
  socketFlow(userA.token, "userA");

  // ── 4. Cross-user scoping: B must never see or mutate A's data ──
  const crossGet = http.get(
    `${BASE_URL}/api/v1/notifications/${accountCreatedA.id}`,
    authHeaders(userB.token)
  );
  check(crossGet, {
    "userB: GET of A's notification is 404": (r) => r.status === 404,
  });

  const crossRead = http.patch(
    `${BASE_URL}/api/v1/notifications/${accountCreatedA.id}/read`,
    null,
    authHeaders(userB.token)
  );
  check(crossRead, {
    "userB: mark-read of A's notification is 404": (r) => r.status === 404,
  });

  const listB = http.get(
    `${BASE_URL}/api/v1/notifications`,
    authHeaders(userB.token)
  );
  check(listB, {
    "userB: list 200": (r) => r.status === 200,
    "userB: list never contains A's notification": (r) =>
      !r.json().data.some((n) => n.id === accountCreatedA.id),
  });

  // ── 5. Read flows on A's own data ──
  const markRead = http.patch(
    `${BASE_URL}/api/v1/notifications/${accountCreatedA.id}/read`,
    null,
    authHeaders(userA.token)
  );
  check(markRead, { "userA: mark-read own 200": (r) => r.status === 200 });

  const markAll = http.patch(
    `${BASE_URL}/api/v1/notifications/read-all`,
    null,
    authHeaders(userA.token)
  );
  check(markAll, { "userA: read-all 200": (r) => r.status === 200 });

  const unreadAfter = http.get(
    `${BASE_URL}/api/v1/notifications/unread-count`,
    authHeaders(userA.token)
  );
  check(unreadAfter, {
    "userA: unread is 0 after read-all": (r) =>
      r.status === 200 && r.json().data.unread === 0,
  });

  // B's unread must be untouched by A's read-all.
  const unreadB = http.get(
    `${BASE_URL}/api/v1/notifications/unread-count`,
    authHeaders(userB.token)
  );
  check(unreadB, {
    "userB: unread unaffected by A's read-all": (r) =>
      r.status === 200 && r.json().data.unread >= 1,
  });

  // ── 6. Real email through the existing forgot-password flow ──
  // The registration steps above already sent several real emails; free-tier
  // providers rate-limit per second, so pace this and retry briefly.
  let forgotOk = false;
  for (let attempt = 0; attempt < 5 && !forgotOk; attempt++) {
    sleep(5 + attempt * 5);
    const forgot = http.post(
      `${BASE_URL}/api/v1/auth/forgot-password`,
      JSON.stringify({ identity: userA.email }),
      { headers: jsonHeaders }
    );
    forgotOk = forgot.status === 200;
  }
  check(null, {
    "userA: forgot-password 200 (real email sent)": () => forgotOk,
  });
}
