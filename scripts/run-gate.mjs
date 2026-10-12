import { spawnSync } from "node:child_process";

/** All arguments are passed directly, including filenames containing spaces. */
export function runGate(command, args, options = {}) {
  if (command === "npm" && process.platform === "win32") {
    // cmd scripts require cmd.exe; this avoids Node's shell:true argument warning.
    if (!args.every((arg) => /^[\w:-]+$/.test(arg))) {
      throw new Error("Unsafe npm gate argument");
    }
    return spawnSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `npm ${args.join(" ")}`],
      options
    );
  }
  return spawnSync(command, args, options);
}
