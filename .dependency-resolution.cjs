const path = require("node:path");
const { paths } = require("./tsconfig.app.json").compilerOptions;

// Dependency-cruiser's supported resolver configuration reads the same aliases
// as the compiler, without loading TypeScript's removed JavaScript API.
module.exports = {
  resolve: {
    alias: Object.fromEntries(
      Object.entries(paths).map(([key, values]) => [
        key.replace(/\/\*$/, ""),
        path.resolve(__dirname, values[0].replace(/\/\*$/, "")),
      ])
    ),
  },
};
