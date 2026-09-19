/**
 * Production entrypoint for container hosts (Railway / Render / Fly / Docker).
 *
 * Seeds the demo data ONLY on first boot (when the SQLite file does not exist
 * yet), then starts Next. `scripts/seed.mjs` wipes and recreates the data, so
 * it must never run against an existing database — this guard is what makes
 * restarts safe on a persistent volume.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const dbPath = path.join(dataDir, "audit.db");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on("error", reject);
  });
}

if (!existsSync(dbPath)) {
  console.log("[start] no database found at", dbPath, "— seeding demo data");
  await run(process.execPath, [path.join(root, "scripts", "seed.mjs")]);
} else {
  console.log("[start] database present at", dbPath, "— skipping seed");
}

// Start Next directly (serves .next-build via scripts/run-next.mjs). Spawning
// node rather than npm keeps signal handling clean in containers and avoids
// the Windows npm.cmd spawn quirk.
const server = spawn(
  process.execPath,
  [path.join(root, "scripts", "run-next.mjs"), "start"],
  { stdio: "inherit", env: process.env }
);
server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
