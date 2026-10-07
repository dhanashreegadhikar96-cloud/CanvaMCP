// One-off check: does Gemini accept a Canva MCP tool schema after toGeminiSchema()?
// Usage: npx tsx scripts/check-gemini-schema.mts <schema.json>
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { toGeminiSchema } from "../src/lib/canva-mcp";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const schema = JSON.parse(readFileSync(process.argv[2], "utf8"));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const res = await ai.models.generateContent({
  model: process.env.CHECK_MODEL || "gemini-2.5-flash",
  contents: [{
    role: "user",
    parts: [{ text: "Transaction T1, page P1 is 1920x1080. Add a blue rounded box at left 100, top 100, 400x200 with the text 'Super Admin' inside it. Don't commit." }],
  }],
  config: { tools: [{ functionDeclarations: [{ name: "edit-design", description: "Edit a Canva design", parametersJsonSchema: toGeminiSchema(schema) }] }] },
});
const call = res.candidates?.[0]?.content?.parts?.find((p) => p.functionCall)?.functionCall;
console.log(call ? JSON.stringify(call, null, 1).slice(0, 1500) : "NO CALL: " + res.text);
