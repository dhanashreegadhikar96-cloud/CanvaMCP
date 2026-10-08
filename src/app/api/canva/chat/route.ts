import { GoogleGenAI, Type } from "@google/genai";
import { cookies } from "next/headers";
import * as canva from "@/lib/canva";
import { getAccessToken, refreshErrors } from "@/lib/canva-auth";
import { PORTAL_MCP_URL, getMcpAccessToken, lastRefreshError, usePortalApp } from "@/lib/canva-mcp-auth";
import {
  McpAuthError,
  RATE_LIMIT_RETRY_SECONDS,
  callCanvaMcpToolWaiting,
  connectCanvaMcp,
  isQuotaExhausted,
  isRateLimited,
  limitResetAt,
  toGeminiSchema,
} from "@/lib/canva-mcp";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "gemini-2.5-flash";
// With the Canva editor (MCP) connected: its tool schemas are large and nested, and Flash fills them in
// wrongly (checked with scripts/check-gemini-schema.mts); Pro produces valid edit operations.
const EDITOR_MODEL = "gemini-2.5-pro";

const EDITOR_INSTRUCTION = `You are the Canva connector inside NSOffice.AI, connected to the user's Canva account through \
Canva's own tools. People chat with you to find, create, edit and export their designs.

Use the tools to do what the user asks rather than describing how they could do it. Follow each tool's description \
(they come from Canva), including when to ask the user before saving.

Background jobs: when a tool starts a job (for example creating a design), the app waits for it and gives you the final \
result. Don't poll and don't write "still working" messages; answer once, when you have the result.

Changing an existing design (text, fonts, colours, boxes, arrows, layout) is possible: never tell the user you can't \
edit a design. The steps:
- start-editing-transaction on the design: it returns the transaction ID and the pages, with page IDs, page size and \
each element's locator ID. Use get-design-content if you need more detail.
- perform-editing-operations to change it: replace_text / find_and_replace_text for wording, format_text for font size, \
weight, colour and alignment, recolor_element, position_element / resize_element for layout, delete_element, and \
the ones below for new content. Check the operations the tool actually offers: if none changes what the user asked \
for (e.g. the font family), say so plainly and offer the closest option (size, weight, colour) or a new version.
- After applying, describe what changed and ask the user to confirm; then commit-editing-transaction to save \
(or cancel-editing-transaction if they don't want it).

Building slide content (boxes, text, arrows, diagrams):
- Make real Canva elements: insert_shape for boxes (an SVG path such as a rectangle \
"M0,0 H100 V100 H0 Z" with view_box 100x100, scaled by width/height; use corner_rounding for rounded boxes), \
add_text for labels placed inside or next to shapes, and arrows as insert_shape paths (a shaft plus a head, e.g. \
"M0,40 H80 V20 L100,50 L80,80 V60 H0 Z" with view_box 100x100). Lay elements out on a grid inside the page size so \
nothing overlaps; keep text inside its box.
- Colours are hex codes like #2563EB, never colour names.
- For a new slide in an existing presentation use the add_page operation, then add elements to that page.
- For a brand-new diagram slide, create a blank presentation first (create-design), then edit it as above.

Usage limits: creating designs with Canva AI counts against the user's Canva limits (a per-minute rate \
limit, and an AI allowance that resets later). To save it: for small changes, edit the existing design instead of \
generating a new one, and create each design once (never "try again" with another generation). If a tool reports \
a rate limit, quota or credit error, don't retry it or work around it with another design-creation tool. Tell the \
user exactly what Canva said, quoting its message and any reset time or remaining amount, and say whether it's a \
short wait (rate limit) or the AI allowance (quota). Then offer what still works: editing, exporting, organising, \
or starting from a blank design and adding elements.

Never mention tool or function names to the user. Keep replies concise and friendly, and include the Canva link for \
designs you mention when you have one, as a Markdown link [Title](url).`;
const MAX_TURNS = 8; // tool rounds per message (e.g. generate a slide, then insert it)

const SYSTEM_INSTRUCTION = `You are the Canva connector inside NSOffice.AI. People chat with you to work in their Canva account: \
find and open designs, create designs and folders, organise designs into folders, and export files.

Use the Canva tools to do what the user asks rather than describing how they could do it. When a request is \
ambiguous (for example, several designs match), show the best matches and ask which one they meant. Before \
moving something the user didn't clearly name, confirm first.

What the tools can and can't do:
- "Make me a presentation/doc about …": use generate_design with a detailed brief (subject, purpose, wording, tone, \
visual direction). Generation takes up to a minute or two. Just go ahead: never ask the user for slide titles or other \
details you can reasonably write yourself.
- Outlines are optional. Only pass one when you have real slide titles (from the user, or written by you); every \
section needs a non-empty title. Otherwise leave the outline out and put everything in the brief.
- When the user gives you content for slides or a doc (text, steps, bullet points), use it: put their exact wording in \
the brief (say it must be used as written) and, for presentations, turn it into outline sections (title + points). \
"Create a slide with this content" means generate a presentation with that slide.
- "Add a slide/page to my existing presentation": first generate_design a presentation with just the new slide(s), then \
edit_pages with action "insert" to copy its pages into the existing design (source_design_id = the new design, \
to_after_page = where it goes; leave it out to add at the end). If it's unclear which existing design they mean, ask. \
The generated design also stays in their projects; mention that.
- Blank designs: create_design. Presentation, doc, whiteboard and email are built-in types. For anything else \
(Instagram post, poster, flyer, banner, etc.) use a custom size in pixels, e.g. Instagram post 1080x1080, \
Instagram story 1080x1920, A4 poster 2480x3508, flyer 1275x1650, YouTube thumbnail 1280x720.
- Changing an existing design:
  - Text and images: only elements marked as data fields in Canva can be changed. Call get_design_fields first; \
if it returns fields, use update_design_fields with those exact names. If it returns none, explain that the elements \
need to be marked as data fields in Canva first (Apps > Bulk create / data autofill, which needs Canva Pro or Teams), \
or offer to open the design's edit link.
  - Pages: edit_pages inserts pages from another design, moves pages or deletes pages (page numbers start at 1). \
Confirm before deleting pages.
  - Size/format: resize_design makes a resized copy (needs Canva Pro; free accounts get a few trial uses).
- import_design_from_url turns a public file link (PDF, PPTX, DOCX…) into a new Canva design.
- Folders: there's no folder search. To find a folder, list the top level (folder_id "root") and look through it.
- Exports return download links that expire after 24 hours.
- You can't delete designs, edit elements that aren't data fields, or use brand templates. Say so plainly if asked.

Usage limits: creating designs with Canva AI counts against the user's Canva limits (a per-minute rate \
limit, and an AI allowance that resets later). To save it: for small changes, edit the existing design instead of \
generating a new one, and create each design once (never "try again" with another generation). If a tool reports \
a rate limit, quota or credit error, don't retry it or work around it with another design-creation tool. Tell the \
user exactly what Canva said, quoting its message and any reset time or remaining amount, and say whether it's a \
short wait (rate limit) or the AI allowance (quota). Then offer what still works: editing, exporting, organising, \
or starting from a blank design and adding elements.

Never mention tool or function names to the user; describe what you can do in plain words.

Keep replies concise and friendly. After a tool call, say what happened in a sentence or two and list the relevant items. \
Include the Canva link (edit or view URL) for every design you mention when available, as a Markdown link [Title](url). \
Use plain Markdown: short paragraphs, bullet lists, bold and links.`;

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; is_error: boolean; text: string }
  | { type: "done"; messages: unknown[] }
  | { type: "error"; message: string; connect?: boolean } // connect: the user needs to (re)connect Canva
  // App-written notice shown in the reply (e.g. Canva usage limits), independent of the model's wording
  | { type: "notice"; tone: "info" | "warning"; title: string; text: string; resetAt?: string };

/** The notice to show for a Canva limit in a tool result, if any. */
function limitNotice(toolResult: string): Extract<StreamEvent, { type: "notice" }> | null {
  if (isQuotaExhausted(toolResult)) {
    return {
      type: "notice",
      tone: "warning",
      title: "Canva AI allowance used up",
      text:
        "Creating new designs with Canva AI is paused for this account until the allowance resets. " +
        "You can still edit, export and organise your designs, or start from a blank design. " +
        "Canva Pro and Teams include a larger allowance.",
      resetAt: limitResetAt(toolResult),
    };
  }
  if (isRateLimited(toolResult)) {
    return {
      type: "notice",
      tone: "warning",
      title: "Canva's limit for now",
      text: "Too many requests to Canva in a short time. Try again in about a minute. You can still edit, export or organise designs.",
      resetAt: limitResetAt(toolResult),
    };
  }
  return null;
}

const FUNCTION_DECLARATIONS = [
  {
    name: "search_designs",
    description: "Search the user's Canva designs by keyword (title or content), or list recent designs when no query is given.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search terms. Leave out to list designs." },
        limit: { type: Type.NUMBER, description: "How many designs to return (1-100, default 10)" },
        sort_by: {
          type: Type.STRING,
          enum: ["relevance", "modified_descending", "modified_ascending", "title_ascending", "title_descending"],
          description: "Order. Use modified_descending for 'latest' or 'most recent'.",
        },
        ownership: { type: Type.STRING, enum: ["any", "owned", "shared"], description: "Whose designs (default any)" },
      },
    },
  },
  {
    name: "read_design",
    description: "Get a design's details (title, page count, thumbnail, edit and view links) by its design ID.",
    parameters: {
      type: Type.OBJECT,
      properties: { design_id: { type: Type.STRING, description: "The Canva design ID" } },
      required: ["design_id"],
    },
  },
  {
    name: "create_design",
    description:
      "Create a new blank Canva design. Use design_type for presentation, doc, whiteboard or email; for any other format set design_type to custom and give width and height in pixels.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Title of the new design" },
        design_type: { type: Type.STRING, enum: ["presentation", "doc", "whiteboard", "email", "custom"] },
        width: { type: Type.NUMBER, description: "Width in pixels (custom only, 40-8000)" },
        height: { type: Type.NUMBER, description: "Height in pixels (custom only, 40-8000)" },
      },
      required: ["title", "design_type"],
    },
  },
  {
    name: "list_folder_items",
    description: "List what's in a Canva folder (designs, folders, images). Use folder_id 'root' for the top level of the user's projects.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        folder_id: { type: Type.STRING, description: "Folder ID, or 'root' (default)" },
        item_types: {
          type: Type.ARRAY,
          items: { type: Type.STRING, enum: ["design", "folder", "image"] },
          description: "Which kinds of items to list (default all three)",
        },
      },
    },
  },
  {
    name: "create_folder",
    description: "Create a new Canva folder.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Folder name" },
        parent_folder_id: { type: Type.STRING, description: "Parent folder ID, or 'root' for the top level (default)" },
      },
      required: ["name"],
    },
  },
  {
    name: "move_item_to_folder",
    description: "Move a design, folder or image into another folder ('root' moves it to the top level).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: { type: Type.STRING, description: "ID of the design, folder or image to move" },
        to_folder_id: { type: Type.STRING, description: "Destination folder ID, or 'root'" },
      },
      required: ["item_id", "to_folder_id"],
    },
  },
  {
    name: "generate_design",
    description: "Generate a new Canva presentation or doc from a text brief (Canva AI). Takes up to a couple of minutes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        brief: {
          type: Type.STRING,
          description: "What to make: subject, purpose, required wording, tone and visual direction (up to 5000 characters)",
        },
        design_type: { type: Type.STRING, enum: ["presentation", "doc"], description: "Default presentation" },
        outline: {
          type: Type.ARRAY,
          description: "Optional slide-by-slide outline (presentations only)",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              points: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["title"],
          },
        },
      },
      required: ["brief"],
    },
  },
  {
    name: "get_design_fields",
    description: "List the editable data fields (text/image elements marked for autofill) in an existing design.",
    parameters: {
      type: Type.OBJECT,
      properties: { design_id: { type: Type.STRING } },
      required: ["design_id"],
    },
  },
  {
    name: "update_design_fields",
    description:
      "Change data fields in an existing design in place. Use field names from get_design_fields. Text fields take text; image fields take an asset_id.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        design_id: { type: Type.STRING },
        fields: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Field name exactly as returned by get_design_fields" },
              text: { type: Type.STRING, description: "New text (text fields)" },
              asset_id: { type: Type.STRING, description: "Canva image asset ID (image fields)" },
            },
            required: ["name"],
          },
        },
      },
      required: ["design_id", "fields"],
    },
  },
  {
    name: "edit_pages",
    description:
      "Change the pages of an existing design (design_id): insert pages copied from another design, move pages, or delete pages. Page numbers start at 1.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        design_id: { type: Type.STRING, description: "The design to change" },
        action: { type: Type.STRING, enum: ["insert", "move", "delete"] },
        page_numbers: {
          type: Type.ARRAY,
          items: { type: Type.NUMBER },
          description: "move/delete: the pages in design_id. insert: which pages of the source design to copy (leave out for all)",
        },
        source_design_id: { type: Type.STRING, description: "insert only: the design to copy pages from" },
        to_after_page: {
          type: Type.NUMBER,
          description: "insert/move: put the pages after this page (0 = at the start; leave out for insert to add at the end)",
        },
      },
      required: ["design_id", "action"],
    },
  },
  {
    name: "resize_design",
    description: "Make a resized copy of a design, as a built-in type or a custom size in pixels.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        design_id: { type: Type.STRING },
        design_type: { type: Type.STRING, enum: ["presentation", "doc", "whiteboard", "email", "custom"] },
        width: { type: Type.NUMBER, description: "Custom only, 40-8000" },
        height: { type: Type.NUMBER, description: "Custom only, 40-8000" },
      },
      required: ["design_id", "design_type"],
    },
  },
  {
    name: "import_design_from_url",
    description: "Turn a publicly reachable file (PDF, PPTX, DOCX, Keynote, etc.) into a new Canva design.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: "Public link to the file" },
        title: { type: Type.STRING, description: "Title for the new design" },
      },
      required: ["url", "title"],
    },
  },
  {
    name: "export_design",
    description: "Export a design and return download links (valid for 24 hours).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        design_id: { type: Type.STRING, description: "ID of the design to export" },
        format: { type: Type.STRING, enum: [...canva.EXPORT_FORMATS], description: "File type (default pdf)" },
      },
      required: ["design_id"],
    },
  },
];

/** Development only: append what happened to .canva-debug.log in the project folder (never the token). */
async function debugLog(entry: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(".canva-debug.log", JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  } catch {
    // logging must never break the chat
  }
}

/** Run one tool. Canva errors come back as { error } for the model, except an expired connection, which is thrown. */
async function executeCanvaTool(name: string, args: Record<string, any>, token: string): Promise<string> {
  const result = await runCanvaTool(name, args, token).catch((err) => {
    debugLog({ tool: name, args, thrown: err instanceof Error ? err.message : String(err), status: err?.status });
    throw err;
  });
  debugLog({ tool: name, args, result: result.length > 2000 ? result.slice(0, 2000) + "…" : result });
  return result;
}

async function runCanvaTool(name: string, args: Record<string, any>, token: string): Promise<string> {
  try {
    let result: unknown;
    switch (name) {
      case "search_designs":
        result = await canva.searchDesigns(token, {
          query: args.query,
          limit: args.limit,
          sortBy: args.sort_by,
          ownership: args.ownership,
        });
        break;
      case "read_design":
        result = await canva.getDesign(token, args.design_id);
        break;
      case "create_design":
        result = await canva.createDesign(
          token,
          args.title,
          canva.PRESET_DESIGN_TYPES.includes(args.design_type)
            ? { preset: args.design_type }
            : { width: Number(args.width) || 1080, height: Number(args.height) || 1080 },
        );
        break;
      case "list_folder_items":
        result = await canva.listFolderItems(token, args.folder_id || "root", args.item_types?.length ? args.item_types : undefined);
        break;
      case "create_folder":
        result = await canva.createFolder(token, args.name, args.parent_folder_id || "root");
        break;
      case "move_item_to_folder":
        result = await canva.moveItemToFolder(token, args.item_id, args.to_folder_id);
        break;
      case "generate_design":
        result = await canva.generateDesign(
          token,
          args.brief,
          args.design_type === "doc" ? "doc" : "presentation",
          Array.isArray(args.outline) ? args.outline : undefined,
        );
        break;
      case "get_design_fields":
        result = await canva.getDesignFields(token, args.design_id);
        break;
      case "update_design_fields": {
        const data: Record<string, canva.FieldValue> = {};
        for (const f of Array.isArray(args.fields) ? args.fields : []) {
          if (!f?.name) continue;
          if (f.asset_id) data[f.name] = { type: "image", asset_id: f.asset_id };
          else if (typeof f.text === "string") data[f.name] = { type: "text", text: f.text };
        }
        if (Object.keys(data).length === 0) throw new Error("No field values given. Use get_design_fields for the names.");
        result = await canva.updateDesignFields(token, args.design_id, data);
        break;
      }
      case "edit_pages": {
        const pages = (Array.isArray(args.page_numbers) ? args.page_numbers : []).map(Number).filter((n: number) => n >= 1);
        const after = args.to_after_page === undefined || args.to_after_page === null ? undefined : Math.max(0, Number(args.to_after_page) || 0);
        let operation: canva.PageOperation;
        if (args.action === "insert") {
          if (!args.source_design_id) throw new Error("Say which design to copy pages from (source_design_id).");
          operation = {
            type: "insert_pages",
            source: { type: "design", design_id: args.source_design_id, ...(pages.length ? { page_numbers: pages } : {}) },
            ...(after !== undefined ? { after_page_number: after } : {}),
          };
        } else {
          if (pages.length === 0) throw new Error("Give the page numbers to change (starting at 1).");
          operation =
            args.action === "delete"
              ? { type: "delete_pages", page_numbers: pages }
              : { type: "move_pages", from_page_numbers: pages, to_after_page_number: after ?? 0 };
        }
        result = await canva.editPages(token, args.design_id, [operation]);
        break;
      }
      case "resize_design":
        result = await canva.resizeDesign(
          token,
          args.design_id,
          canva.PRESET_DESIGN_TYPES.includes(args.design_type)
            ? { preset: args.design_type }
            : { width: Number(args.width) || 1080, height: Number(args.height) || 1080 },
        );
        break;
      case "import_design_from_url":
        result = await canva.importDesignFromUrl(token, args.url, args.title || "Imported design");
        break;
      case "export_design":
        result = await canva.exportDesign(token, args.design_id, canva.EXPORT_FORMATS.includes(args.format) ? args.format : "pdf");
        break;
      default:
        throw new Error(`Unknown Canva tool: ${name}`);
    }
    return JSON.stringify(result);
  } catch (err) {
    if (err instanceof canva.CanvaApiError && err.status === 401) throw err;
    return JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
      ...(err instanceof canva.CanvaApiError ? { status: err.status } : {}),
    });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const body = (await request.json()) as { messages?: any[] };
  const history = body.messages ?? [];

  // From "Connect Canva" (httpOnly cookies), renewed here when it has expired
  const canvaToken = await getAccessToken(cookieStore);
  // Canva's MCP tools (incl. the design editor). With the Developer Portal app ("Canva MCP" on, and
  // CANVA_MCP_USE_PORTAL_APP=true) the same Canva sign-in token works on Canva's MCP server; otherwise
  // the separate self-registered editor sign-in is used.
  const portal = usePortalApp();
  const mcpToken = portal ? canvaToken : await getMcpAccessToken(cookieStore);
  const mcpServer = portal ? PORTAL_MCP_URL : undefined;

  const apiKey = process.env.GEMINI_API_KEY;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Stream closed by client
        }
      };

      debugLog({
        request: typeof history[history.length - 1]?.content === "string" ? history[history.length - 1].content.slice(0, 200) : "(structured)",
        rest: Boolean(canvaToken),
        editor: Boolean(mcpToken),
      });
      if (!apiKey) {
        send({
          type: "error",
          message: "GEMINI_API_KEY is not configured on the server. Please add it to .env.local.",
        });
        controller.close();
        return;
      }

      if (!canvaToken && !mcpToken) {
        debugLog({
          stopped: "no usable Canva token",
          restRenewError: refreshErrors.rest,
          editorRenewError: lastRefreshError.mcp,
          restCookie: cookieStore.has("canva_access_token") || cookieStore.has("canva_refresh_token"),
          editorCookie: cookieStore.has("canva_mcp_access") || cookieStore.has("canva_mcp_refresh"),
        });
        send({ type: "error", message: "Connect your Canva account to get started.", connect: true });
        controller.close();
        return;
      }

      if (history.length === 0) {
        send({ type: "error", message: "Send a message to start." });
        controller.close();
        return;
      }

      let mcp: Awaited<ReturnType<typeof connectCanvaMcp>> | null = null;
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Editor connected: Canva's MCP tools and Gemini Pro. Otherwise: the REST tools and Gemini Flash.
        let model = MODEL;
        let systemInstruction = SYSTEM_INSTRUCTION;
        let declarations: any[] = FUNCTION_DECLARATIONS;
        let maxTurns = MAX_TURNS;
        let execute = (name: string, args: Record<string, any>) => executeCanvaTool(name, args, canvaToken!);
        if (mcpToken) {
          mcp = await connectCanvaMcp(mcpToken, mcpServer);
          const client = mcp.client;
          model = EDITOR_MODEL;
          systemInstruction = EDITOR_INSTRUCTION;
          maxTurns = 16; // open the design, several edits, then answer
          declarations = mcp.tools.map((t) => ({
            name: t.name,
            description: (t.description ?? "").slice(0, 4000),
            parametersJsonSchema: toGeminiSchema(t.inputSchema),
          }));
          debugLog({ editorServer: mcpServer ?? "mcp.canva.com", editorTools: mcp.tools.map((t) => t.name) });
          const available = new Set(mcp.tools.map((t) => t.name));
          execute = async (name, args) => {
            const { text, isError } = await callCanvaMcpToolWaiting(client, name, args, available, undefined, () =>
              send({
                type: "notice",
                tone: "info",
                title: "Canva is busy",
                text: `Too many requests in a short time. Waiting ${RATE_LIMIT_RETRY_SECONDS} seconds, then trying again…`,
              }),
            );
            debugLog({ editorTool: name, args, isError, result: text.slice(0, 2000) });
            return isError ? JSON.stringify({ error: text }) : text;
          };
        }

        // Build message contents for Gemini. Earlier turns come back exactly as we returned them
        // ({ role, parts }, including tool calls and results), so Gemini still knows design IDs
        // from previous answers. The user's new message is plain { role, content }.
        const contents: any[] = [];
        for (const msg of history) {
          if (Array.isArray(msg.parts)) {
            contents.push({ role: msg.role, parts: msg.parts });
            continue;
          }
          const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
          const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          contents.push({ role, parts: [{ text }] });
        }
        const turnStart = contents.length;

        let currentTurn = 0;

        let textRound = 0; // the round that last sent text
        const noticesShown = new Set<string>(); // one limit notice of each kind per reply
        while (currentTurn < maxTurns) {
          currentTurn++;

          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: declarations }],
            },
          });

          const candidate = response.candidates?.[0];
          if (!candidate?.content) {
            break;
          }

          const modelParts = candidate.content.parts || [];
          const functionCalls = modelParts.filter((p) => "functionCall" in p && p.functionCall);

          let hasTool = false;
          const toolResponseParts: any[] = [];

          for (const part of modelParts) {
            if ("text" in part && part.text) {
              // Text from a new round (after a tool call) starts a new paragraph instead of running on
              const gap = textRound !== 0 && textRound !== currentTurn ? "\n\n" : "";
              textRound = currentTurn;
              send({ type: "text", text: gap + part.text });
            }

            if ("functionCall" in part && part.functionCall) {
              hasTool = true;
              const call = part.functionCall;
              const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              const toolName = call.name || "unknown_tool";
              const args = (call.args as Record<string, any>) || {};

              send({ type: "tool_start", id: callId, name: toolName });
              send({ type: "tool_use", id: callId, name: toolName, input: args });

              const toolResultStr = await execute(toolName, args);
              const isError = toolResultStr.includes('"error":');
              const notice = isError ? limitNotice(toolResultStr) : null;
              if (notice && !noticesShown.has(notice.title)) {
                noticesShown.add(notice.title);
                send(notice);
              }

              send({
                type: "tool_result",
                tool_use_id: callId,
                is_error: isError,
                text: toolResultStr,
              });

              let parsedResponse = {};
              try {
                parsedResponse = JSON.parse(toolResultStr);
              } catch {
                parsedResponse = { response: toolResultStr };
              }

              toolResponseParts.push({
                functionResponse: {
                  name: toolName,
                  response: parsedResponse,
                },
              });
            }
          }

          // Add model response to history
          contents.push({
            role: "model",
            parts: modelParts,
          });

          if (hasTool && toolResponseParts.length > 0) {
            // Add tool response to history and loop again so Gemini answers
            contents.push({
              role: "user",
              parts: toolResponseParts,
            });
          } else {
            break; // no more tool calls: the model has answered
          }
        }

        const lastUser = history[history.length - 1];
        const reply = contents
          .slice(turnStart)
          .filter((c) => c.role === "model")
          .flatMap((c) => c.parts.map((p: any) => p.text || ""))
          .join("");
        debugLog({ user: typeof lastUser?.content === "string" ? lastUser.content : "(structured)", reply: reply.slice(0, 1000), rounds: currentTurn });

        // Everything this turn added (tool calls, tool results, the answer) goes back into the conversation
        send({ type: "done", messages: contents.slice(turnStart) });
      } catch (err) {
        debugLog({ chatError: err instanceof Error ? err.message : String(err), status: (err as any)?.status });
        if (err instanceof canva.CanvaApiError && err.status === 401) {
          send({ type: "error", message: "Your Canva connection has expired. Connect again to continue.", connect: true });
        } else if (err instanceof McpAuthError || (mcp && /401|unauthori[sz]ed|invalid_token/i.test(String((err as any)?.message)))) {
          const detail = String((err as any)?.message ?? "").slice(0, 300);
          send({
            type: "error",
            message: portal
              ? `Canva's MCP server didn't accept your Canva sign-in. Disconnect and connect Canva again. (Canva said: ${detail})`
              : "Your Canva editor connection has expired. Connect the editor again to continue.",
            connect: true,
          });
        } else {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "Error communicating with Gemini and Canva.",
          });
        }
      } finally {
        await mcp?.client.close().catch(() => undefined);
        try {
          controller.close();
        } catch {
          // Closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
