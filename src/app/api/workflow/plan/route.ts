import { GoogleGenAI } from "@google/genai";
import { GeminiLimitError, generateWithRetry } from "@/lib/gemini";
import { PLAN_SCHEMA, planPrompt, type WireframePlan, type WorkflowRequest } from "@/lib/brand/plan";

// Step 1 of the Brand Studio workflow: turn a short request into a brand-aligned wireframe plan
// (content hierarchy, copy, user flow, image prompts). No Canva call and no Canva AI allowance used.

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "gemini-2.5-flash";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });

  const req = (await request.json()) as Partial<WorkflowRequest>;
  if (!req.name?.trim() || !req.goal?.trim()) {
    return Response.json({ error: "Give the program or feature a name and a goal." }, { status: 400 });
  }
  const full: WorkflowRequest = {
    deliverable: req.deliverable === "feature" || req.deliverable === "visuals" ? req.deliverable : "landing",
    name: req.name.trim().slice(0, 200),
    goal: req.goal.trim().slice(0, 1000),
    personaIds: Array.isArray(req.personaIds) ? req.personaIds.slice(0, 6) : [],
    journeyId: req.journeyId ?? "apply",
    keyMessages: (req.keyMessages ?? "").slice(0, 2000),
    primaryCta: (req.primaryCta ?? "").slice(0, 80),
    language: (req.language ?? "English").slice(0, 40),
  };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithRetry(ai, {
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: planPrompt(full) }] }],
      config: { responseMimeType: "application/json", responseSchema: PLAN_SCHEMA },
    });
    const plan = JSON.parse(response.text ?? "") as WireframePlan;
    return Response.json({ plan });
  } catch (err) {
    const status = err instanceof GeminiLimitError ? 429 : 502;
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't make the plan." }, { status });
  }
}
