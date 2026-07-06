import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const clean = args.includes("--clean");

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("[dev] Building workspace packages...");
run("pnpm", ["--filter", "@onepara/shared", "build"]);
run("pnpm", ["--filter", "@onepara/db", "build"]);

const env = { ...process.env };
if (clean) {
  env.DEV_CLEAN = "1";
}

console.log("[dev] Starting API + Web (Turbopack, auto-recover)...");
const child = spawn(
  "pnpm",
  ["exec", "turbo", "dev", "--filter=@onepara/api", "--filter=@onepara/web"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env,
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});
