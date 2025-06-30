export default {
  preset: "ts-jest/presets/default-esm",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "./tsconfig.json",
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/src/**/*.test.ts"],
  testEnvironment: "node",
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  extensionsToTreatAsEsm: [".ts"],
  transformIgnorePatterns: ["/node_modules/(?!(linkedom|jsdom)/)"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.d.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
};
