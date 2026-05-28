import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, type LogEntry } from '@/lib/logger';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info() outputs valid JSON line with correct fields', () => {
    const entry = logger.info('test message');

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as LogEntry;

    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test message');
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry).toMatchObject({ level: 'info', message: 'test message' });
  });

  it('warn() outputs to console.warn', () => {
    logger.warn('warning message');

    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('warning message');
  });

  it('error() outputs to console.error', () => {
    logger.error('error message');

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('error message');
  });

  it('includes extra fields in output', () => {
    logger.info('with extras', { request_id: 'abc-123', user_id: 'user-1' });

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    expect(parsed.request_id).toBe('abc-123');
    expect(parsed.user_id).toBe('user-1');
  });

  it('includes request_id when passed in extra', () => {
    const entry = logger.error('something failed', {
      request_id: 'req-uuid-here',
      error_code: 'AUTH_FAIL',
    });

    expect(entry.request_id).toBe('req-uuid-here');
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(parsed.request_id).toBe('req-uuid-here');
    expect(parsed.error_code).toBe('AUTH_FAIL');
  });

  it('timestamp is a valid ISO 8601 string', () => {
    logger.info('timestamp check');

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    const date = new Date(parsed.timestamp);
    expect(date.getTime()).not.toBeNaN();
    expect(parsed.timestamp).toBe(date.toISOString());
  });
});
