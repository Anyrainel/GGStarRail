/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-is-framework-free",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        path: [
          "^src/(components|contexts|hooks|pages|providers|stores)/",
          "^(react|react-dom|react-router-dom|zustand)$",
        ],
      },
    },
    {
      name: "providers-do-not-own-ui-or-state",
      severity: "error",
      from: { path: "^src/providers/" },
      to: { path: "^src/(components|contexts|pages|stores)/" },
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
      to: { path: ["^node:", "^(fs|path|os|crypto|http|https|stream)$"] },
    },
    {
      name: "worker-is-standalone",
      severity: "error",
      from: { path: "^worker/" },
      to: { path: "^src/" },
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
    exclude: { path: ["node_modules", "dist", "coverage", "\\.d\\.ts$"] },
  },
};
