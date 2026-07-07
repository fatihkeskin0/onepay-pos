import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const webRoot = path.join(root, "apps/web");
const nextDir = path.join(webRoot, ".next");
const PORT = 3105;
const API_PORT = Number(process.env.API_PORT ?? 4105);
const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/health`;

const FATAL_PATTERNS = [
  /Cannot find module '\.\/\d+\.js'/,
  /Cannot find module '\.\/chunks\/\d+\.js'/,
  /ENOENT.*[\\/]\.next[\\/]/,
  /Failed to find server action/,
  /Cannot find module.*webpack-runtime/,
  /windows imports are not implemented/i,
];

let child = null;
let apiChild = null;
let spawnedApi = false;
let restarting = false;
let restartCount = 0;
const MAX_RESTARTS = 8;
const RESTART_COOLDOWN_MS = 2000;

function cleanNext() {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("[web-dev] Cleared apps/web/.next");
  }
}

function killProcess(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { stdio: "ignore", shell: true });
    } else {
      proc.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
}

function killChild() {
  killProcess(child);
}

function killApiChild() {
  if (!spawnedApi) return;
  killProcess(apiChild);
  apiChild = null;
  spawnedApi = false;
}

async function isApiUp() {
  try {
    const res = await fetch(API_HEALTH_URL, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForApi(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i += 1) {
    if (await isApiUp()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function startApi() {
  apiChild = spawn("pnpm", ["--filter", "@onepara/api", "dev"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  spawnedApi = true;

  apiChild.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGKILL") return;
    if (code && code !== 0 && !restarting) {
      console.error(`[web-dev] API exited with code ${code}`);
    }
  });
}

async function ensureApi() {
  // Turbo starts API and web in parallel — wait before spawning a duplicate API.
  for (let i = 0; i < 30; i += 1) {
    if (await isApiUp()) {
      console.log(`[web-dev] API already running on :${API_PORT}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("[web-dev] API not running — building @onepara/db and starting API...");
  spawnSync("pnpm", ["--filter", "@onepara/db", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  startApi();

  const ready = await waitForApi();
  if (!ready) {
    console.error(`[web-dev] API did not become ready on :${API_PORT}. Check DATABASE_URL / Redis.`);
    process.exit(1);
  }

  console.log(`[web-dev] API ready on :${API_PORT}`);
}

function startNext(clean = false) {
  if (clean) cleanNext();

  child = spawn("pnpm", ["exec", "next", "dev", "--turbo", "-p", String(PORT)], {
    cwd: webRoot,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: { ...process.env, FORCE_COLOR: "1", NEXT_TELEMETRY_DISABLED: "1" },
  });

  const onData = (chunk) => {
    const text = chunk.toString();
    if (FATAL_PATTERNS.some((pattern) => pattern.test(text))) {
      void restart("Stale Next.js dev cache detected");
    }
  };

  child.stdout?.on("data", (buf) => {
    process.stdout.write(buf);
    onData(buf);
  });

  child.stderr?.on("data", (buf) => {
    process.stderr.write(buf);
    onData(buf);
  });

  child.on("exit", (code, signal) => {
    if (restarting) return;
    if (signal === "SIGTERM" || signal === "SIGKILL") return;
    if (code && code !== 0) {
      process.exit(code);
    }
  });
}

async function restart(reason) {
  if (restarting) return;
  restartCount += 1;
  if (restartCount > MAX_RESTARTS) {
    console.error("[web-dev] Max auto-restarts reached. Run: pnpm dev:clean");
    process.exit(1);
  }

  restarting = true;
  console.warn(`\n[web-dev] ${reason} — auto-recover ${restartCount}/${MAX_RESTARTS}\n`);
  killChild();
  await new Promise((resolve) => setTimeout(resolve, RESTART_COOLDOWN_MS));
  restarting = false;
  startNext(true);
}

async function healthCheck() {
  if (restarting || !child) return;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (res.status >= 500) {
      await restart(`Health check returned ${res.status}`);
    }
  } catch {
    /* still booting */
  }
}

const cleanOnStart = process.argv.includes("--clean") || process.env.DEV_CLEAN === "1";

console.log("[web-dev] Ensuring @onepara/shared is built...");
spawnSync("pnpm", ["--filter", "@onepara/shared", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

await ensureApi();
startNext(cleanOnStart);
const healthTimer = setInterval(() => {
  void healthCheck();
}, 30000);

function shutdown() {
  clearInterval(healthTimer);
  killChild();
  killApiChild();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
