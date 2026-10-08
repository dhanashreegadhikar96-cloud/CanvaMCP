// Canva REST API client (https://api.canva.com/rest/v1) for the chat's tools.
// Request and response shapes follow Canva's OpenAPI spec: https://www.canva.dev/sources/connect/api/latest/api.yml

const BASE_URL = "https://api.canva.com/rest/v1";

export interface CanvaDesign {
  id: string;
  title?: string;
  urls?: { edit_url?: string; view_url?: string };
  thumbnail?: { url?: string; width?: number; height?: number };
  page_count?: number;
  created_at?: number;
  updated_at?: number;
}

export interface CanvaFolder {
  id: string;
  name: string;
  created_at?: number;
  updated_at?: number;
}

/** A Canva API error, with the HTTP status (401 means the user must connect again). */
export class CanvaApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function canvaFetch<T>(endpoint: string, token: string, options: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  let res = await send();

  // Rate limited ("too many requests"): wait as long as Canva asks (Retry-After, capped at 30s) and try once more
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) : 10;
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    res = await send();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.message || body.error_description || `Canva API error ${res.status} ${res.statusText}`;
    throw new CanvaApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// ---------- Designs ----------

export type DesignSort = "relevance" | "modified_descending" | "modified_ascending" | "title_descending" | "title_ascending";

/** List the user's designs; `query` searches titles and content. */
export async function searchDesigns(
  token: string,
  options: { query?: string; limit?: number; ownership?: "any" | "owned" | "shared"; sortBy?: DesignSort } = {},
) {
  const params = new URLSearchParams();
  if (options.query) params.set("query", options.query);
  params.set("limit", String(Math.min(Math.max(options.limit ?? 10, 1), 100)));
  if (options.ownership) params.set("ownership", options.ownership);
  if (options.sortBy) params.set("sort_by", options.sortBy);
  return canvaFetch<{ items: CanvaDesign[]; continuation?: string }>(`/designs?${params}`, token);
}

export async function getDesign(token: string, designId: string) {
  return canvaFetch<{ design: CanvaDesign }>(`/designs/${encodeURIComponent(designId)}`, token);
}

/** Preset types the REST API accepts; anything else needs a custom width and height in pixels. */
export const PRESET_DESIGN_TYPES = ["presentation", "doc", "whiteboard", "email"] as const;
export type PresetDesignType = (typeof PRESET_DESIGN_TYPES)[number];

export async function createDesign(
  token: string,
  title: string,
  type: { preset: PresetDesignType } | { width: number; height: number },
) {
  const design_type =
    "preset" in type
      ? { type: "preset", name: type.preset }
      : { type: "custom", width: Math.round(type.width), height: Math.round(type.height) };
  return canvaFetch<{ design: CanvaDesign }>(`/designs`, token, {
    method: "POST",
    body: JSON.stringify({ type: "type_and_asset", title, design_type }),
  });
}

// ---------- Folders ----------

export type FolderItem =
  | { type: "folder"; folder: CanvaFolder }
  | { type: "design"; design: CanvaDesign }
  | { type: "image"; image: { id: string; name?: string } };

/** List what's in a folder. "root" is the top level of the user's projects. */
export async function listFolderItems(
  token: string,
  folderId = "root",
  itemTypes: Array<"design" | "folder" | "image"> = ["design", "folder", "image"],
  limit = 50,
) {
  const params = new URLSearchParams({ item_types: itemTypes.join(","), limit: String(Math.min(Math.max(limit, 1), 100)) });
  return canvaFetch<{ items: FolderItem[]; continuation?: string }>(
    `/folders/${encodeURIComponent(folderId)}/items?${params}`,
    token,
  );
}

export async function createFolder(token: string, name: string, parentFolderId = "root") {
  return canvaFetch<{ folder: CanvaFolder }>(`/folders`, token, {
    method: "POST",
    body: JSON.stringify({ name, parent_folder_id: parentFolderId }),
  });
}

/** Move a design, folder or image into another folder ("root" = top level of projects). */
export async function moveItemToFolder(token: string, itemId: string, toFolderId: string) {
  await canvaFetch<unknown>(`/folders/move`, token, {
    method: "POST",
    body: JSON.stringify({ item_id: itemId, to_folder_id: toFolderId }),
  });
  return { moved: true, item_id: itemId, to_folder_id: toFolderId };
}

// ---------- Exports ----------

export const EXPORT_FORMATS = ["pdf", "png", "jpg", "pptx", "gif", "mp4"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

type ExportJob = { id: string; status: "in_progress" | "success" | "failed"; urls?: string[]; error?: { code: string; message: string } };

/**
 * Export a design and wait for the download links (they expire after 24 hours).
 * Exports run as a job, so this checks it every 2 seconds for up to `timeoutMs`.
 */
export async function exportDesign(token: string, designId: string, format: ExportFormat = "pdf", timeoutMs = 60_000) {
  let { job } = await canvaFetch<{ job: ExportJob }>(`/exports`, token, {
    method: "POST",
    body: JSON.stringify({ design_id: designId, format: { type: format } }),
  });

  const deadline = Date.now() + timeoutMs;
  while (job.status === "in_progress" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ({ job } = await canvaFetch<{ job: ExportJob }>(`/exports/${encodeURIComponent(job.id)}`, token));
  }

  if (job.status === "failed") throw new CanvaApiError(job.error?.message || "Canva couldn't export this design.", 400);
  if (job.status !== "success") return { status: "in_progress", job_id: job.id, note: "Still exporting; ask again in a moment." };
  return { status: "success", format, download_urls: job.urls ?? [] };
}

// ---------- Jobs: generate, resize, edit pages, import, autofill ----------
// These all start an asynchronous job; `runJob` starts it and checks every 2 seconds until it finishes.

export interface DesignSummary {
  id: string;
  title?: string;
  url?: string;
  urls?: { edit_url?: string; view_url?: string };
  thumbnail?: { url?: string };
  page_count?: number;
}

type Job<R> = { id: string; status: "in_progress" | "success" | "failed"; result?: R; error?: { code?: string; message?: string } };

async function runJob<R>(token: string, start: string, body: unknown, poll: (id: string) => string, timeoutMs = 90_000) {
  let { job } = await canvaFetch<{ job: Job<R> }>(start, token, { method: "POST", body: JSON.stringify(body) });
  const deadline = Date.now() + timeoutMs;
  while (job.status === "in_progress" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ({ job } = await canvaFetch<{ job: Job<R> }>(poll(job.id), token));
  }
  if (job.status === "failed") throw new CanvaApiError(job.error?.message || "Canva couldn't finish this.", 400);
  if (job.status !== "success" || !job.result) {
    return { status: "in_progress" as const, job_id: job.id, note: "Canva is still working on this; it will appear in the user's projects shortly." };
  }
  return { status: "success" as const, ...job.result };
}

/**
 * Generate a design from a text brief (Canva preview API: may change without notice).
 * Supports presentations (optionally following an outline of slides) and docs.
 */
export async function generateDesign(
  token: string,
  brief: string,
  designType: "presentation" | "doc" = "presentation",
  outline?: Array<{ title?: string; description?: string; points?: string[] }>,
) {
  // Canva rejects blank titles, descriptions or points, so keep only slides with real content
  const sections = (outline ?? [])
    .map((s) => {
      const title = s.title?.trim().slice(0, 255);
      const description = s.description?.trim().slice(0, 2000);
      const points = (s.points ?? []).map((p) => p?.trim().slice(0, 1000)).filter(Boolean).slice(0, 50);
      return title ? { title, ...(description ? { description } : {}), ...(points.length ? { points } : {}) } : null;
    })
    .filter((s): s is { title: string; description?: string; points?: string[] } => s !== null)
    .slice(0, 100);

  return runJob<{ design: DesignSummary }>(
    token,
    "/generations",
    {
      brief: brief.trim().slice(0, 5000),
      design_type: { type: "preset", name: designType },
      ...(designType === "presentation" && sections.length ? { outline: { sections } } : {}),
    },
    (id) => `/generations/${encodeURIComponent(id)}`,
    180_000,
  );
}

/** Make a resized copy of a design (needs Canva Pro; free accounts get a few trial uses). */
export async function resizeDesign(
  token: string,
  designId: string,
  type: { preset: PresetDesignType } | { width: number; height: number },
) {
  const design_type =
    "preset" in type
      ? { type: "preset", name: type.preset }
      : { type: "custom", width: Math.round(type.width), height: Math.round(type.height) };
  return runJob<{ design: DesignSummary; trial_information?: unknown }>(
    token,
    "/resizes",
    { design_id: designId, design_type },
    (id) => `/resizes/${encodeURIComponent(id)}`,
  );
}

export type PageOperation =
  | { type: "move_pages"; from_page_numbers: number[]; to_after_page_number: number }
  | { type: "delete_pages"; page_numbers: number[] }
  | {
      type: "insert_pages";
      source: { type: "design"; design_id: string; page_numbers?: number[] };
      after_page_number?: number; // left out = at the end
    };

/** Insert, move or delete pages in an existing design (Canva preview API). Page numbers start at 1. */
export async function editPages(token: string, designId: string, operations: PageOperation[], title?: string) {
  return runJob<{ design: DesignSummary }>(
    token,
    "/merges",
    { type: "modify_existing_design", design_id: designId, operations, ...(title ? { title } : {}) },
    (id) => `/merges/${encodeURIComponent(id)}`,
  );
}

/** Import a publicly reachable file (PDF, PPTX, DOCX, Keynote, AI, PSD…) as a new design. */
export async function importDesignFromUrl(token: string, url: string, title: string) {
  return runJob<{ designs: DesignSummary[] }>(
    token,
    "/url-imports",
    { url, title },
    (id) => `/url-imports/${encodeURIComponent(id)}`,
  );
}

/**
 * The design's data fields: elements marked for autofill in Canva (via Bulk create / data autofill).
 * Only these can be changed through the REST API. Returns {} when the design has none.
 */
export async function getDesignFields(token: string, designId: string) {
  const { dataset } = await canvaFetch<{ dataset?: Record<string, { type: string }> }>(
    `/designs/${encodeURIComponent(designId)}/dataset`,
    token,
  );
  return { fields: dataset ?? {} };
}

export type FieldValue = { type: "text"; text: string } | { type: "image"; asset_id: string };

/**
 * Change a design's data fields in place (autofill `update_design`). Needs a Canva plan with autofill
 * (Pro, Teams or Enterprise). Use getDesignFields first for the field names.
 */
export async function updateDesignFields(token: string, designId: string, data: Record<string, FieldValue>) {
  return runJob<{ type: string; design: DesignSummary }>(
    token,
    "/autofills",
    { type: "update_design", design_id: designId, data },
    (id) => `/autofills/${encodeURIComponent(id)}`,
  );
}

// ---------- User ----------

export async function getProfile(token: string) {
  return canvaFetch<{ profile: { display_name?: string } }>(`/users/me/profile`, token);
}
