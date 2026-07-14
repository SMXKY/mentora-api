/**
 * Post-deploy smoke test runner — idempotently runs every k6 suite that's
 * safe against a real production deployment (NODE_ENV=production) in one
 * command.
 *
 * Excluded on purpose: account-lifecycle-flow, notification-flow,
 * profiles-flow, permissionModule — all four register accounts through
 * real email OTP and read the code back via GET /auth/dev/otp, a route
 * that's compiled out entirely when NODE_ENV=production (src/modules/auth/
 * auth.route.ts). There is no way to read a real OTP by script in prod, so
 * these stay staging/dev-only (run them individually there instead).
 *
 * Every suite here is idempotent by construction: every seed script
 * upserts (findFirst-then-create-or-update) rather than blind-inserting,
 * so re-running this against the same environment never fails on "account
 * already exists" — it just resets the test fixtures to a known state and
 * re-runs. Safe to run after every deploy.
 *
 * Usage:
 *   BASE_URL=https://api.mentora.example \
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... \
 *   npx ts-node k6/support/run-production-suite.ts
 *
 * Exit code is 0 only if every suite's k6 checks passed. Continues past a
 * failing suite (logs it) so one broken suite doesn't hide the rest of the
 * report — the exit code is still nonzero if anything failed.
 */
import { spawnSync } from "child_process";
import path from "path";

// Always run with cwd === repo root, never k6/ — the seed scripts rely on
// dotenv/config's default of loading ".env" relative to process.cwd(). Run
// from k6/ instead and DATABASE_URL silently never loads, so Prisma's PG
// driver falls back to connecting as the OS user with no database name
// (surfaces as a confusing "database <username> does not exist" error).
// This mirrors exactly how the individual npm scripts already invoke these
// (e.g. "ts-node k6/support/seed-kyc-test-tutor.ts && k6 run k6/kyc-flow.test.js").
const ROOT = path.join(__dirname, "..", "..");

interface Suite {
  name: string;
  seed?: string; // path relative to repo root, run with ts-node first
  script: string; // path relative to repo root, run with `k6 run`
}

const SUITES: Suite[] = [
  {
    name: "media",
    seed: "k6/support/seed-media-test-user.ts",
    script: "k6/media-http-flow.test.js",
  },
  {
    name: "materials",
    seed: "k6/support/seed-materials-test-tutor.ts",
    script: "k6/materials-flow.test.js",
  },
  {
    name: "kyc (single tutor)",
    seed: "k6/support/seed-kyc-test-tutor.ts",
    script: "k6/kyc-flow.test.js",
  },
  {
    name: "kyc (bulk queue)",
    seed: "k6/support/seed-kyc-bulk-tutors.ts",
    script: "k6/kyc-bulk-queue.test.js",
  },
  {
    name: "kyc (real files, storage adapter)",
    seed: "k6/support/seed-kyc-real-tutors.ts",
    script: "k6/kyc-real-files-flow.test.js",
  },
];

function run(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function main(): void {
  if (!process.env.BASE_URL) {
    console.log(
      JSON.stringify({
        event: "production_suite_warning",
        message: "BASE_URL not set — k6 scripts default to http://localhost:8080, not your deployment.",
      })
    );
  }
  if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
    console.error(
      JSON.stringify({
        event: "production_suite_aborted",
        reason: "SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD must be set in the environment.",
      })
    );
    process.exit(1);
  }

  const results: Array<{ suite: string; seedOk: boolean | null; k6Ok: boolean }> = [];

  for (const suite of SUITES) {
    console.log(`\n${"=".repeat(70)}\n▶ ${suite.name}\n${"=".repeat(70)}`);

    let seedOk: boolean | null = null;
    if (suite.seed) {
      seedOk = run("npx", ["ts-node", suite.seed]);
      if (!seedOk) {
        console.error(
          JSON.stringify({ event: "suite_seed_failed", suite: suite.name })
        );
        results.push({ suite: suite.name, seedOk, k6Ok: false });
        continue;
      }
    }

    const k6Ok = run("k6", ["run", suite.script]);
    results.push({ suite: suite.name, seedOk, k6Ok });
  }

  console.log(`\n${"=".repeat(70)}\nSUMMARY\n${"=".repeat(70)}`);
  let anyFailed = false;
  for (const r of results) {
    const status = r.k6Ok ? "PASS" : "FAIL";
    if (!r.k6Ok) anyFailed = true;
    console.log(`  [${status}] ${r.suite}`);
  }

  process.exit(anyFailed ? 1 : 0);
}

main();
