import net from 'node:net';
import { spawn } from 'node:child_process';

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function hashString(input: string): number {
  // Simple deterministic hash (djb2-ish)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash) >>> 0;
}

function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function pickPort(basePort: number): Promise<number> {
  let port = basePort;
  // Keep it in a reasonable dev range
  const maxPort = 65535;
  while (port <= maxPort) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
    port++;
  }
  throw new Error(`No free port found starting from ${basePort}`);
}

async function main() {
  const cwd = process.cwd();

  // Priority:
  // 1) DEV_PORT (explicit)
  // 2) PORT (explicit)
  // 3) Stable per-project base in 3100-3599
  const explicit = toInt(process.env.DEV_PORT) ?? toInt(process.env.PORT);
  const stableBase = 3100 + (hashString(cwd) % 500);
  const basePort = explicit ?? stableBase;

  const port = await pickPort(basePort);

  const env = {
    ...process.env,
    PORT: String(port),
    // Keep auth redirects aligned with the actual dev origin unless explicitly set.
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${port}`,
  };

  // Pass-through args to next dev (e.g. --turbo flags)
  const nextArgs = ['dev', '--turbopack', '--port', String(port), ...process.argv.slice(2)];

  // Helpful log without being noisy
  // eslint-disable-next-line no-console
  console.log(
    `[dev] Starting Next.js on http://localhost:${port} (base=${basePort}${explicit ? ', explicit' : ', stable'})`
  );

  const child = spawn('next', nextArgs, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[dev] Failed to start dev server:', err);
  process.exit(1);
});
