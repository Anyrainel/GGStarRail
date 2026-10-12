/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "ui-primitives-are-independent",
      severity: "error",
      from: { path: "^src/components/ui/" },
      to: {
        path: "^src/",
        pathNot: ["^src/components/ui/", "^src/lib/utils\\.ts$"],
      },
    },
    {
      name: "stores-do-not-own-ui",
      severity: "error",
      from: { path: "^src/stores/" },
      to: { path: "^src/(components|pages|hooks|contexts)/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "production-has-no-test-dependencies",
      severity: "error",
      from: { path: "^(src|worker)/" },
      to: {
        path: [
          "^tests/",
          "(^|node_modules/)(vitest|@vitest|@testing-library|@playwright)(/|$)",
          "^node:test$",
        ],
      },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "domain-is-framework-free",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        path: [
          "^src/(components|contexts|hooks|pages|providers|stores)/",
          "(^|node_modules/)(react|react-dom|react-router-dom|zustand)(/|$)",
        ],
      },
    },
    {
      name: "providers-do-not-own-ui-or-state",
      severity: "error",
      from: { path: "^src/providers/" },
      // A pure format migration is shared by persistence and account import.
      to: {
        path: "^src/(components|contexts|pages|stores)/",
        pathNot: "^src/stores/migration/account\\.ts$",
      },
    },
    {
      name: "persisted-state-cannot-see-hoyolab-auth",
      severity: "error",
      from: { path: "^src/(stores|lib/backup)" },
      to: { path: "^src/providers/hoyolab/" },
    },
    {
      name: "browser-has-no-node-builtins",
      severity: "error",
      from: { path: "^src/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "worker-is-standalone",
      severity: "error",
      from: { path: "^worker/" },
      to: { path: ["^src/", "^tests/", "^scripts/"] },
    },
    {
      name: "browser-cannot-import-worker-or-tooling",
      severity: "error",
      from: { path: "^src/" },
      to: { path: ["^worker/", "^scripts/"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.app.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types", "typings"],
    },
    // Keep imported package nodes visible to framework/test-dependency rules.
    // doNotFollow stops traversal into their internals.
    exclude: { path: ["dist", "coverage", "\\.d\\.ts$"] },
  },
};
