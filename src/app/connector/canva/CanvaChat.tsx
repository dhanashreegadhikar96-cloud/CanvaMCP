"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { useEffect, useRef, useState } from "react";
import { BeeMark, Disclaimer } from "@/nsoffice/macros";
import { Markdown } from "./markdown";

// Chat with the Canva connector. The conversation (Anthropic message history) lives here and is
// sent to /api/canva/chat on every turn; the route streams back text and Canva tool steps.

export const HANDOFF_KEY = "nsoffice:canva-prompt"; // Home's ask bar leaves its message here

const SUGGESTIONS = [
  { title: "Search designs", desc: "Find designs by keyword", prompt: "Search my designs for “quarterly report”" },
  { title: "Create a folder", desc: "Organise designs into folders", prompt: "Create a folder called “Marketing 2026”" },
  { title: "Recent designs", desc: "See what you edited last", prompt: "Show my 5 most recently edited designs" },
  { title: "Create a design", desc: "Start a presentation or post", prompt: "Create a presentation called “Team offsite 2026”" },
];

// What each Canva tool (see /api/canva/chat) is doing, for the step label
const TOOL_LABELS: Record<string, string> = {
  search_designs: "Searching designs",
  read_design: "Opening design",
  create_design: "Creating design",
  list_folder_items: "Looking in folder",
  create_folder: "Creating folder",
  move_item_to_folder: "Moving item",
  export_design: "Exporting design",
  generate_design: "Generating design with Canva AI",
  get_design_fields: "Checking editable fields",
  update_design_fields: "Updating design",
  edit_pages: "Updating pages",
  resize_design: "Resizing design",
  import_design_from_url: "Importing file",
  // Canva editor (MCP) tools
  "create-design": "Creating design with Canva AI",
  "generate-design": "Generating design with Canva AI",
  "get-create-design-async-job": "Waiting for Canva",
  "get-generate-image-job": "Waiting for Canva",
  "search-designs": "Searching designs",
  "get-design": "Opening design",
  "get-design-content": "Reading design",
  "get-design-pages": "Reading pages",
  "get-design-thumbnail": "Getting preview",
  "get-design-thumbnails": "Getting previews",
  "start-editing-transaction": "Opening design for editing",
  "perform-editing-operations": "Editing design",
  "commit-editing-transaction": "Saving changes",
  "cancel-editing-transaction": "Discarding changes",
  "copy-design": "Copying design",
  "resize-design": "Resizing design",
  "merge-designs": "Combining designs",
  "export-design": "Exporting design",
  "create-folder": "Creating folder",
  "list-folder-items": "Looking in folder",
  "search-folders": "Searching folders",
  "move-item-to-folder": "Moving item",
  "generate-image": "Generating image",
  "upload-asset-from-url": "Uploading image",
  "comment-on-design": "Adding comment",
};

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

type Part =
  | { kind: "text"; text: string }
  | { kind: "notice"; tone: "info" | "warning"; title: string; text: string; resetAt?: string }
  | { kind: "tool"; id: string; name: string; input?: unknown; result?: string; status: "running" | "done" | "error" };

type Item =
  | { role: "user"; text: string }
  | { role: "assistant"; parts: Part[]; pending: boolean; error?: string };

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; name: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; is_error: boolean; text: string }
  | { type: "done"; messages: Anthropic.Beta.BetaMessageParam[] }
  | { type: "error"; message: string; connect?: boolean }
  | { type: "notice"; tone: "info" | "warning"; title: string; text: string; resetAt?: string };

function applyEvent(parts: Part[], event: StreamEvent): Part[] {
  const next = [...parts];
  const last = next[next.length - 1];
  switch (event.type) {
    case "text":
      if (last?.kind === "text") next[next.length - 1] = { ...last, text: last.text + event.text };
      else next.push({ kind: "text", text: event.text });
      return next;
    case "tool_start":
      next.push({ kind: "tool", id: event.id, name: event.name, status: "running" });
      return next;
    case "tool_use": {
      const i = next.findIndex((p) => p.kind === "tool" && p.id === event.id);
      if (i >= 0) next[i] = { ...(next[i] as Extract<Part, { kind: "tool" }>), input: event.input };
      else next.push({ kind: "tool", id: event.id, name: event.name, input: event.input, status: "running" });
      return next;
    }
    case "tool_result": {
      const i = next.findIndex((p) => p.kind === "tool" && p.id === event.tool_use_id);
      if (i >= 0) {
        next[i] = { ...(next[i] as Extract<Part, { kind: "tool" }>), result: event.text, status: event.is_error ? "error" : "done" };
      }
      return next;
    }
    case "notice":
      next.push({ kind: "notice", tone: event.tone, title: event.title, text: event.text, resetAt: event.resetAt });
      return next;
    default:
      return next;
  }
}

// App-written notice (e.g. Canva usage limits), shown in the reply whatever the model says
function Notice({ part }: { part: Extract<Part, { kind: "notice" }> }) {
  const reset = part.resetAt ? new Date(part.resetAt) : null;
  return (
    <div className={`chat-notice chat-notice--${part.tone}`} role="status">
      <i className={part.tone === "warning" ? "fa-solid fa-triangle-exclamation" : "fa-regular fa-clock"}></i>
      <div>
        <div className="chat-notice-title">{part.title}</div>
        <div className="chat-notice-text">
          {part.text}
          {reset && !Number.isNaN(reset.getTime()) && (
            <> Resets {reset.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.</>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolStep({ part }: { part: Extract<Part, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const icon =
    part.status === "running" ? "fa-solid fa-circle-notch" : part.status === "error" ? "fa-solid fa-circle-xmark" : "fa-solid fa-circle-check";
  const label = toolLabel(part.name) + (part.status === "running" ? "…" : part.status === "error" ? " failed" : "");
  return (
    <div className={`chat-step chat-step--${part.status}`}>
      <button type="button" className="chat-step-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chat-step-status"><i className={icon}></i></span>
        {label}
        <span className="chat-step-toggle">{open ? "Hide details" : "Details"}</span>
      </button>
      {open && (
        <div className="chat-step-body">
          <div className="chat-step-label">Canva tool: {part.name}</div>
          {part.input !== undefined && <pre>{JSON.stringify(part.input, null, 2)}</pre>}
          {part.result !== undefined && (
            <>
              <div className="chat-step-label">Result</div>
              <pre>{part.result.length > 4000 ? part.result.slice(0, 4000) + "\n…" : part.result}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// "Connect Apps" dialog: sign in to Canva before chatting (same pattern as NSOffice's assistants).
// Canva issues separate tokens for its REST API and its editor (MCP server); one "Connect" does both.
function ConnectDialog({
  error,
  rest,
  editor,
  onClose,
  onDisconnect,
}: {
  error: string;
  rest: boolean;
  editor: boolean;
  onClose: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="ns-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ns-modal" role="dialog" aria-modal="true" aria-labelledby="connectTitle">
        <div className="ns-modal-head">
          <h2 className="ns-modal-title" id="connectTitle">Connect Apps</h2>
          <button type="button" className="ns-modal-close" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        {error && <p className="ns-modal-error">{error}</p>}
        {/* One connection for the user; behind it are Canva's two sign-ins (REST API + editor),
            run back to back by /api/auth/canva/connect */}
        <div className="connect-row">
          <span className="connect-row-icon"><i className="fa-solid fa-palette"></i></span>
          <span className="connect-row-name">
            Canva
            {rest !== editor && (
              <span className="connect-row-detail">
                {rest ? "Editing isn't connected yet" : "Search and export aren't connected yet"}
              </span>
            )}
          </span>
          {rest && editor ? (
            <span className="connect-row-status"><i className="fa-solid fa-circle-check"></i> Connected</span>
          ) : (
            <a className="connect-btn" href="/api/auth/canva/connect">{rest || editor ? "Finish connecting" : "Connect"}</a>
          )}
        </div>
        {(rest || editor) && (
          <div className="connect-disconnect">
            <button type="button" onClick={onDisconnect}>Disconnect Canva</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CanvaChat({
  connected: restConnected,
  editorConnected,
}: {
  connected: boolean;
  editorConnected: boolean;
}) {
  const initiallyConnected = restConnected || editorConnected;
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [rest, setRest] = useState(restConnected);
  const [editor, setEditor] = useState(editorConnected);
  const connected = rest || editor;
  const setConnected = (value: boolean) => {
    setRest(value);
    setEditor(value);
  };
  const [showConnect, setShowConnect] = useState(!initiallyConnected);
  const [connectError, setConnectError] = useState("");
  const history = useRef<any[]>([]);
  const abort = useRef<AbortController | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Coming back from Canva's sign-in: show any error, then tidy the address bar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setConnectError(error);
      setShowConnect(true);
    }
    if (params.has("error") || params.has("connected")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!showConnect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConnect(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showConnect]);

  async function disconnect() {
    await fetch("/api/auth/canva/logout", { method: "POST" }).catch(() => undefined);
    setConnected(false);
    setConnectError("");
    setShowConnect(true);
  }

  const updateAssistant = (fn: (item: Extract<Item, { role: "assistant" }>) => Extract<Item, { role: "assistant" }>) =>
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = fn(last);
      return next;
    });

  async function send(text: string) {
    text = text.trim();
    if (!text || busy) return;
    if (!connected) {
      setInput(text);
      setShowConnect(true);
      return;
    }
    setInput("");
    setBusy(true);
    setItems((prev) => [...prev, { role: "user", text }, { role: "assistant", parts: [], pending: true }]);
    history.current.push({ role: "user", content: text });

    const controller = new AbortController();
    abort.current = controller;
    let finished = false;

    const fail = (message: string) => {
      // Drop the unanswered message so the next turn starts from a clean conversation
      history.current.pop();
      updateAssistant((a) => ({ ...a, pending: false, error: message }));
    };

    try {
      const res = await fetch("/api/canva/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.current }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`The chat service returned ${res.status}.`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "done") {
            history.current.push(...event.messages);
            finished = true;
            updateAssistant((a) => ({ ...a, pending: false }));
          } else if (event.type === "error") {
            finished = true;
            fail(event.message);
            if (event.connect) {
              setConnected(false);
              setShowConnect(true);
            }
          } else {
            updateAssistant((a) => ({ ...a, parts: applyEvent(a.parts, event) }));
          }
        }
      }
      if (!finished) fail("The reply was cut off. Try again.");
    } catch (error) {
      if (!finished) {
        fail(controller.signal.aborted ? "Stopped." : error instanceof Error ? error.message : "Couldn't reach the chat service.");
      }
    } finally {
      abort.current = null;
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  // A message typed on Home arrives here. If Canva isn't connected yet it waits in the ask bar
  // (and in storage, so it's sent once the user is back from connecting).
  useEffect(() => {
    let prompt: string | null = null;
    try {
      prompt = sessionStorage.getItem(HANDOFF_KEY);
      if (prompt && initiallyConnected) sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      // storage unavailable: nothing was handed over
    }
    if (prompt) {
      if (initiallyConnected) send(prompt);
      else setInput(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end" });
  }, [items]);

  return (
    <section className="page-view chat-page active-view">

      <div className="chat-thread">
        {items.length === 0 ? (
          <div className="assistant-welcome">
            <h1 className="assistant-heading">What&apos;s the Move</h1>
            <div className="composer-prompts">
              {SUGGESTIONS.map((s) => (
                <button key={s.title} type="button" className="composer-prompt" onClick={() => send(s.prompt)} disabled={busy}>
                  <div className="composer-prompt-title">{s.title}</div>
                  <div className="composer-prompt-desc">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-thread-inner">
            {items.map((item, i) =>
              item.role === "user" ? (
                <div key={i} className="chat-row chat-row--user">
                  <div className="chat-bubble chat-bubble--user">{item.text}</div>
                </div>
              ) : (
                <div key={i} className="chat-row">
                  <div className="chat-avatar">
                    <i className="fa-solid fa-palette"></i>
                  </div>
                  <div className="chat-bubble chat-bubble--assistant">
                    {item.parts.map((part, j) =>
                      part.kind === "text" ? (
                        <div key={j} className="chat-bubble-text">
                          <Markdown text={part.text} />
                        </div>
                      ) : part.kind === "notice" ? (
                        <Notice key={`n${j}`} part={part} />
                      ) : (
                        <ToolStep key={part.id} part={part} />
                      ),
                    )}
                    {item.pending && item.parts.every((p) => p.kind !== "tool" || p.status !== "running") && (
                      <div className="chat-typing" aria-label="Working">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    )}
                    {item.error && <p className="chat-error">{item.error}</p>}
                  </div>
                </div>
              ),
            )}
            <div ref={threadEnd} />
          </div>
        )}
      </div>

      <div className="chat-bar-area">
        <form
          className="composer-bar"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <span className="composer-bee" aria-hidden="true">
            <BeeMark />
          </span>
          <button
            type="button"
            className={`composer-connect${rest && editor ? " composer-connect--ok" : ""}`}
            title={rest && editor ? "Canva is connected" : connected ? "Finish connecting Canva" : "Connect Canva"}
            onClick={() => setShowConnect(true)}
          >
            {/* Lucide "plug", outline like NSOffice's */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22v-5" />
              <path d="M9 8V2" />
              <path d="M15 8V2" />
              <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            className="composer-input"
            placeholder={connected ? "Ask anything..." : "Connect to Canva to get started"}
            aria-label="Message the Canva connector"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {busy ? (
            <button type="button" className="composer-send composer-send--stop" title="Stop" onClick={() => abort.current?.abort()}>
              <i className="fa-solid fa-stop"></i>
            </button>
          ) : (
            <button type="submit" className="composer-send" title="Send" disabled={!input.trim()}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          )}
        </form>
        <Disclaimer />
      </div>

      {showConnect && (
        <ConnectDialog error={connectError} rest={rest} editor={editor} onClose={() => setShowConnect(false)} onDisconnect={disconnect} />
      )}
    </section>
  );
}
