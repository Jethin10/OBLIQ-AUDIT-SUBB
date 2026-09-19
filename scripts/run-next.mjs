import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];

if (!new Set(["build", "start"]).has(command)) {
  console.error("Usage: node scripts/run-next.mjs <build|start>");
  process.exit(2);
}

const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

const child = spawn(process.execPath, [nextBin, command, ...process.argv.slice(3)], {
  env: { ...process.env, NEXT_DIST_DIR: ".next-build" },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
