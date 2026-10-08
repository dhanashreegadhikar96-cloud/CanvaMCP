// Canva's MCP server as Gemini tools: connect with the user's editor token, list Canva's tools,
// hand their schemas to Gemini and run the calls Gemini makes.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_URL } from "./canva-mcp-auth";

// Tools that need Canva's own widget UI, which this chat doesn't have
const SKIP_TOOLS = new Set(["request-outline-review", "generate-design-structured"]);

export class McpAuthError extends Error {}

export async function connectCanvaMcp(token: string, serverUrl: string = MCP_URL) {
  const client = new Client({ name: "nsoffice-canva-chat", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    await client.connect(transport);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/401|unauthori[sz]ed|invalid_token/i.test(message)) throw new McpAuthError(message);
    throw err;
  }
  const { tools } = await client.listTools();
  return { client, tools: tools.filter((t) => !SKIP_TOOLS.has(t.name)) };
}

/**
 * Gemini accepts a subset of JSON Schema. Keep the parts it understands and translate the rest
 * (const → enum, exclusiveMinimum → minimum), so Canva's tool definitions don't get the request rejected.
 */
export function toGeminiSchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: any = {};
  // Gemini ignores `pattern`, so keep the rule in the description (e.g. hex colours "^#[0-9A-Fa-f]{6}$")
  if (typeof schema.pattern === "string") {
    schema = { ...schema, description: `${schema.description ? schema.description + " " : ""}Must match the pattern ${schema.pattern}.` };
  }
  for (const [key, value] of Object.entries(schema)) {
    switch (key) {
      case "type":
      case "description":
      case "enum":
      case "required":
      case "minimum":
      case "maximum":
      case "minItems":
      case "maxItems":
      case "minLength":
      case "maxLength":
      case "nullable":
      case "title":
        out[key] = value;
        break;
      case "const":
        out.enum = [value];
        if (!schema.type) out.type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
        break;
      case "exclusiveMinimum":
        if (typeof value === "number" && out.minimum === undefined) out.minimum = value;
        break;
      case "items":
        out.items = toGeminiSchema(value);
        break;
      case "anyOf":
      case "oneOf":
        out.anyOf = (value as any[]).map(toGeminiSchema);
        break;
      case "properties":
        out.properties = Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, toGeminiSchema(v)]));
        break;
      default:
        // $schema, additionalProperties, pattern, format, default, … are dropped
        break;
    }
  }
  return out;
}

const PENDING = new Set(["pending", "in_progress", "polled_too_early"]);

/** The tool that reports on a background job started by `name` (e.g. create-design → get-create-design-async-job). */
function pollToolFor(name: string, available: Set<string>): string | null {
  if (/^get-.*-job$/.test(name)) return name;
  for (const candidate of [`get-${name}-async-job`, `get-${name}-job`]) if (available.has(candidate)) return candidate;
  return null;
}

/**
 * Run a Canva MCP tool, and if it starts a background job (status "pending" with a continuation token),
 * wait for the job here, as Canva's polling_policy says, instead of making the model poll over and over.
 * Returns the final job result, or the last status after `timeoutMs`.
 */
export async function callCanvaMcpToolWaiting(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  available: Set<string>,
  timeoutMs = 180_000,
) {
  let result = await callCanvaMcpTool(client, name, args);
  const pollTool = pollToolFor(name, available);
  const deadline = Date.now() + timeoutMs;

  while (!result.isError && pollTool && Date.now() < deadline) {
    let job: any;
    try {
      job = JSON.parse(result.text);
    } catch {
      break; // not a job status
    }
    if (!job?.job_id || !job.continuation_token || !PENDING.has(job.status)) break;
    const waitSeconds = Math.min(Math.max(Number(job.polling_policy?.wait_seconds) || 5, 2), 30);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    result = await callCanvaMcpTool(client, pollTool, {
      job_id: job.job_id,
      continuation_token: job.continuation_token,
      user_intent: typeof args.user_intent === "string" ? args.user_intent : "Wait for the design to finish",
    });
  }
  return result;
}

/** Run one Canva MCP tool; returns its text output (images are noted, not embedded). */
export async function callCanvaMcpTool(client: Client, name: string, args: Record<string, unknown>) {
  const result: any = await client.callTool({ name, arguments: args });
  const parts: string[] = [];
  for (const item of result.content ?? []) {
    if (item.type === "text") parts.push(item.text);
    else if (item.type === "image") parts.push("[preview image returned by Canva]");
    else if (item.type === "resource") parts.push(JSON.stringify(item.resource).slice(0, 2000));
  }
  if (result.structuredContent && parts.length === 0) parts.push(JSON.stringify(result.structuredContent));
  let text = parts.join("\n");
  if (text.length > 40_000) text = text.slice(0, 40_000) + "\n…(truncated)";
  return { text, isError: Boolean(result.isError) };
}
