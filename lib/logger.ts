/**
 * Structured JSON logger — edge-runtime compatible.
 *
 * Outputs one JSON object per line (JSON Lines format) to stdout/stderr.
 * Compatible with Datadog, CloudWatch, Sentry, and any log aggregator
 * that can parse structured JSON.
 *
 * No Node-only modules (no `fs`, no `path`, no `process.stdout.write`).
 * Uses only `console.log` / `console.error` which are available in all
 * JS runtimes including Vercel Edge, Cloudflare Workers, and Deno.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  request_id?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, extra?: Record<string, unknown>): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  return entry;
}

export const logger = {
  info(message: string, extra?: Record<string, unknown>): LogEntry {
    return emit('info', message, extra);
  },

  warn(message: string, extra?: Record<string, unknown>): LogEntry {
    return emit('warn', message, extra);
  },

  error(message: string, extra?: Record<string, unknown>): LogEntry {
    return emit('error', message, extra);
  },
};
