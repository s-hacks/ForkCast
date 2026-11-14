/** Minimal structured JSON logger (stdout/stderr) for hosted log ingestion. */
type Level = "info" | "warn" | "error";
function write(level: Level, msg: string, ctx: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx });
  if (level === "error") console.error(line);
  else console.log(line);
}
export const log = {
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => write("error", m, c),
};
