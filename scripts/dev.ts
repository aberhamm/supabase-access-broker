import net from 'node:net';
import { spawn } from 'node:child_process';

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
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
  // Priority:
  // 1) DEV_PORT (explicit)
  // 2) PORT (explicit)
  // 3) Default to 3050, increment if unavailable
  const explicit = toInt(process.env.DEV_PORT) ?? toInt(process.env.PORT);
  const basePort = explicit ?? 3050;

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
    `[dev] Starting Next.js on http://localhost:${port} (base=${basePort}${explicit ? ', explicit' : port !== basePort ? ', incremented' : ''})`
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
