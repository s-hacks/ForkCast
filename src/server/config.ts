import "server-only";
import { z } from "zod";
import { parseStartTimes } from "./domain/dates";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    APP_ORIGIN: z.string().url(),
    SHELTER_TIMEZONE: z.string().min(1).default("America/Chicago"),
    SESSION_SECRET: z.string().min(32),
    MEAL_START_TIMES: z.string().regex(/^\d{2}:\d{2},\d{2}:\d{2},\d{2}:\d{2}$/).default("07:00,11:30,17:00"),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production" && !v.APP_ORIGIN.startsWith("https://") && process.env.ALLOW_INSECURE_ORIGIN !== "true") {
      ctx.addIssue({ code: "custom", path: ["APP_ORIGIN"], message: "APP_ORIGIN must use https in production" });
    }
  });

export type AppConfig = z.infer<typeof schema> & { startTimes: ReturnType<typeof parseStartTimes> };
let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const r = schema.safeParse(env);
  if (!r.success) {
    const names = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${names}`);
  }
  return { ...r.data, startTimes: parseStartTimes(r.data.MEAL_START_TIMES) };
}

export function config(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}
