// Gemini calls with rate-limit handling. Gemini answers 429 (RESOURCE_EXHAUSTED) when the key's
// per-minute limit is reached, and 503 (UNAVAILABLE) when the model is overloaded. Both usually pass
// within a minute, so wait (using the delay Google suggests, if any) and try again instead of failing.
import type { GoogleGenAI } from "@google/genai";

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

export class GeminiLimitError extends Error {
  readonly daily: boolean;
  constructor(message: string, daily: boolean) {
    super(message);
    this.daily = daily;
  }
}

const MAX_ATTEMPTS = 4;

function status(err: unknown): number | undefined {
  const s = (err as any)?.status ?? (err as any)?.code;
  if (typeof s === "number") return s;
  const m = String((err as any)?.message ?? "").match(/"code"\s*:\s*(\d{3})|\b(429|503)\b/);
  return m ? Number(m[1] ?? m[2]) : undefined;
}

/** Seconds Google asks us to wait ("retryDelay": "34s"), if it said. */
function suggestedDelay(err: unknown): number | undefined {
  const m = String((err as any)?.message ?? "").match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/);
  return m ? Math.ceil(Number(m[1])) : undefined;
}

/** A per-day quota: waiting a minute won't help. */
function isDaily(err: unknown): boolean {
  return /per ?day|PerDay|daily/i.test(String((err as any)?.message ?? ""));
}

/**
 * ai.models.generateContent, retried on 429/503 up to MAX_ATTEMPTS times.
 * onWait is called before each wait (e.g. to tell the user); throws GeminiLimitError when it gives up.
 */
export async function generateWithRetry(ai: GoogleGenAI, params: GenerateParams, onWait?: (seconds: number) => void) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const code = status(err);
      if (code !== 429 && code !== 503) throw err;
      const daily = code === 429 && isDaily(err);
      if (daily || attempt >= MAX_ATTEMPTS) {
        throw new GeminiLimitError(
          daily
            ? "The Gemini API key has used its daily limit for this model. It resets at midnight Pacific time; a paid Gemini plan (billing enabled on the key's Google Cloud project) removes this limit."
            : code === 503
              ? "Gemini is overloaded right now. Try again in a minute."
              : "The Gemini API key is over its per-minute limit. Wait a minute and try again; a paid Gemini plan raises the limit.",
          daily,
        );
      }
      const seconds = Math.min(suggestedDelay(err) ?? 15 * attempt, 60);
      onWait?.(seconds);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
  }
}
