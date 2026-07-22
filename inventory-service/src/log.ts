/**
 * log.ts — structured JSON-line logging (SVC-030): {level, ts, event, ...detail}.
 */
type Level = 'info' | 'warn' | 'error';

function emit(level: Level, event: string, detail?: Record<string, unknown>): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    event,
    ...(detail ?? {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, detail?: Record<string, unknown>) => emit('info', event, detail),
  warn: (event: string, detail?: Record<string, unknown>) => emit('warn', event, detail),
  error: (event: string, detail?: Record<string, unknown>) => emit('error', event, detail),
};
