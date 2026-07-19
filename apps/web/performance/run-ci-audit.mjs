// Cross-platform CI performance audit wrapper.
// Owns a dedicated loopback preview process/port, runs five Lighthouse
// measurements + budget assertions, always terminates the exact child tree,
// and performs a bounded same-origin known-route status smoke (external links
// and rendered-DOM link traversal are non-gating).

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const clientDir = join(webRoot, "build", "client");
const requireFromWeb = createRequire(join(webRoot, "package.json"));
const vitePackageDir = dirname(requireFromWeb.resolve("vite/package.json"));
const viteCli = join(vitePackageDir, "bin", "vite.js");
const projectManifestPath = join(
  webRoot,
  "src",
  "content",
  "generated",
  "project-manifest.json"
);

const FORBIDDEN_PORTS = new Set([5173, 5199, 8000, 8123]);
const DEFAULT_PORT = 5398;
const PREVIEW_WAIT_MS = 90_000;
const PREVIEW_POLL_MS = 250;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePort() {
  const raw = process.env.PERF_PREVIEW_PORT?.trim() || String(DEFAULT_PORT);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PERF_PREVIEW_PORT must be an integer 1-65535 (got ${JSON.stringify(raw)}).`
    );
  }
  if (FORBIDDEN_PORTS.has(port)) {
    throw new Error(
      `PERF_PREVIEW_PORT ${port} is reserved for local verification/dev and must not be used by CI audit.`
    );
  }
  return port;
}

function isPortFree(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function waitForPreview(url, timeoutMs = PREVIEW_WAIT_MS) {
  const started = Date.now();
  let lastError = "no response";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(PREVIEW_POLL_MS);
  }
  throw new Error(`Timed out waiting for preview at ${url} (${lastError}).`);
}

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    // Negative PID targets the process group when spawned detached.
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function confirmPortClosed(port, host = "127.0.0.1", attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isPortFree(port, host)) return true;
    await delay(100);
  }
  return isPortFree(port, host);
}

function startPreview(port) {
  const args = [
    "preview",
    "--outDir",
    "build/client",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ];
  const child = spawn(process.execPath, [viteCli, ...args], {
    cwd: webRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    // New process group on POSIX so cleanup can signal the whole tree.
    detached: process.platform !== "win32",
  });

  let output = "";
  const append = (chunk) => {
    output += chunk.toString();
    if (output.length > 16_000) {
      output = output.slice(-16_000);
    }
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);

  return {
    child,
    getOutput: () => output,
  };
}

function knownRoutePaths() {
  const manifest = JSON.parse(readFileSync(projectManifestPath, "utf8"));
  if (!Array.isArray(manifest.projects)) {
    throw new Error("Generated project manifest must contain a projects array.");
  }
  const paths = ["/", "/playground"];
  for (const project of manifest.projects) {
    if (typeof project?.id !== "string" || !project.id.trim()) {
      throw new Error("Generated project manifest contains an invalid project id.");
    }
    paths.push(`/projects/${encodeURIComponent(project.id)}`);
  }
  return paths;
}

async function smokeKnownRoutes(baseUrl) {
  const paths = knownRoutePaths();
  const failures = [];
  const checked = [];

  for (const path of paths) {
    const target = new URL(path, baseUrl).toString();
    try {
      const response = await fetch(target, { redirect: "follow" });
      checked.push({ path, status: response.status });
      if (response.status >= 400) {
        failures.push(`${path} -> HTTP ${response.status}`);
      }
    } catch (error) {
      failures.push(
        `${path} -> ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { checked, failures };
}

function runNodeScript(scriptRelative, env = {}) {
  const result = spawnSync(process.execPath, [join(webRoot, scriptRelative)], {
    cwd: webRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${scriptRelative} exited with status ${result.status ?? "null"}.`);
  }
}

async function main() {
  const port = resolvePort();
  const baseUrl = `http://127.0.0.1:${port}/`;

  if (!existsSync(clientDir) || !existsSync(join(clientDir, "index.html"))) {
    throw new Error(
      "build/client/index.html not found. Run a production build before npm run perf:ci-audit."
    );
  }

  if (!(await isPortFree(port))) {
    throw new Error(
      `PERF_PREVIEW_PORT ${port} is already in use on 127.0.0.1. Refusing to attach to an existing listener.`
    );
  }

  console.log(`Starting owned preview on ${baseUrl}`);
  const preview = startPreview(port);
  const { child } = preview;
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    killProcessTree(child.pid);
    const closed = await confirmPortClosed(port);
    if (!closed) {
      killProcessTree(child.pid);
      if (process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          try {
            process.kill(child.pid, "SIGKILL");
          } catch {
            // ignore
          }
        }
      }
    }
    const confirmed = await confirmPortClosed(port);
    if (!confirmed) {
      throw new Error(
        `Preview cleanup failed: port ${port} still occupied after terminating pid ${child.pid}.`
      );
    }
    console.log(`Preview cleanup confirmed (port ${port} closed).`);
  };

  try {
    child.once("exit", (code, signal) => {
      if (!cleaned) {
        console.error(
          `Preview exited early (code=${code}, signal=${signal}). Output tail:\n${preview.getOutput()}`
        );
      }
    });

    await waitForPreview(baseUrl);

    const routeSmoke = await smokeKnownRoutes(baseUrl);
    console.log(
      `Same-origin known-route smoke checked ${routeSmoke.checked.length} path(s).`
    );
    if (routeSmoke.failures.length > 0) {
      throw new Error(
        `Same-origin known-route smoke failed:\n- ${routeSmoke.failures.join("\n- ")}`
      );
    }
    console.log(
      "Rendered-DOM and external link traversal are non-gating; the residual boundary is documented in performance/budgets.json linkCoverage."
    );

    runNodeScript("performance/run-lighthouse.mjs", {
      LIGHTHOUSE_URL: baseUrl,
    });
    runNodeScript("performance/assert-budgets.mjs");
  } finally {
    await cleanup();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
