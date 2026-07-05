/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { types: ["node", "jest"] } }],
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/src/generated/"],
  // jest's resolver picks pg-cloudflare's workerd build, which cannot run
  // under Node — map it to the package's own empty shim (what Node's
  // "default" export condition resolves to outside jest).
  moduleNameMapper: {
    "^pg-cloudflare$": "<rootDir>/node_modules/pg-cloudflare/dist/empty.js",
  },
  testTimeout: 120000,
};
