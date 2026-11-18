import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const targetUrl = process.env.TARGET_URL;
const port = Number(process.env.LOAD_TEST_PORT ?? 3101);
const url = targetUrl ?? `http://127.0.0.1:${port}/health/live`;
const durationMs = Number(process.env.LOAD_TEST_DURATION_MS ?? 30_000);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 50);
const minRps = Number(process.env.LOAD_TEST_MIN_RPS ?? 200);
const maxP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 250);

let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Load test target did not become ready: ${url}`);
}

async function run() {
  if (!targetUrl) {
    const script = fileURLToPath(new URL('./load-test-server.mjs', import.meta.url));
    server = spawn(process.execPath, [script], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  }
  await waitForServer();

  const latencies = [];
  let failures = 0;
  const endAt = Date.now() + durationMs;

  async function worker() {
    while (Date.now() < endAt) {
      const startedAt = performance.now();
      try {
        const response = await fetch(url);
        await response.arrayBuffer();
        if (!response.ok) {
          failures += 1;
        }
      } catch {
        failures += 1;
      }
      latencies.push(performance.now() - startedAt);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  latencies.sort((a, b) => a - b);
  const p95 = latencies.length === 0 ? Number.POSITIVE_INFINITY : latencies[Math.floor(latencies.length * 0.95)];
  const rps = latencies.length / (durationMs / 1000);
  const result = {
    target: url,
    durationMs,
    concurrency,
    requests: latencies.length,
    failures,
    rps: Number(rps.toFixed(1)),
    p95Ms: Number(p95.toFixed(1)),
    targetRps: minRps,
    targetP95Ms: maxP95Ms,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (failures > 0 || rps < minRps || p95 > maxP95Ms) {
    process.exitCode = 1;
  }
}

try {
  await run();
} finally {
  if (server) {
    server.kill('SIGTERM');
  }
}
