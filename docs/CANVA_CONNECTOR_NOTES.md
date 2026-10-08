# Canva connector: notes and issue log

Last updated: 8 Oct 2026. Live site: https://canva-mcp-one.vercel.app

## What the Canva MCP does

**MCP (Model Context Protocol)** is a standard way for an AI to use another product's features as "tools".
Canva runs an **MCP server**: a web service that exposes Canva actions as tools an AI can call on a user's behalf.

In this app:

1. The user clicks **Connect** and approves Canva once (normal Canva sign-in, `www.canva.com/api/oauth/authorize`).
2. When they chat, the server connects to Canva's MCP server, **`https://api.canva.com/connect/v1/mcp`**, with that
   user's token, and gets Canva's list of tools (about 48).
3. **Gemini 2.5 Pro** reads the message, picks tools and fills in their inputs; the app runs them against Canva and
   streams each step to the chat. Gemini then answers with the result and Canva links.

What the tools cover:

| Area | Examples |
|---|---|
| Find and read | search designs and folders, open a design, read its text and pages, previews |
| Create | create a design from a description (Canva AI), blank designs, generate images, import a file from a URL |
| Edit (in place) | change and format text, add text boxes, add shapes and arrows, move/resize/recolour/delete elements, add and reorder pages, speaker notes; done in an editing session that is only saved after the user agrees |
| Other | export (PDF, PNG, …), resize copies, folders, comments, assets, brand kits and templates (Pro and above) |

Everything happens **in the user's own Canva account, under their plan**: premium elements, export quality and AI
allowances follow that account. The app never sees the user's password, and tokens stay in httpOnly cookies.

Requirements: the Developer Portal app has **Canva MCP** turned on, and Vercel has `CANVA_MCP_USE_PORTAL_APP=true`
(see issue 22). Locally without that setting, the app falls back to a self-registered sign-in on `mcp.canva.com`,
which only works on `127.0.0.1`.

## Issue log

Status: **Fixed**, **Open**, or **Limit** (a Canva rule we work within).

### Setup and look

| # | Issue | Cause | Fix | Status |
|---|---|---|---|---|
| 1 | NSOffice kit couldn't be used as-is | Project is Next.js; the kit is a Flask/Jinja kit | Copied the kit; ported shell and macros to React (`src/nsoffice/`); kit CSS/JS served from `public/` | Fixed |
| 2 | Connectors page didn't look like NSOffice | Kit catalogue had hero, search, section titles; no tinted icons | Flat filterable grid, icon tiles, "Use" buttons | Fixed |
| 3 | Canva missing from the chat Connectors menu | No composer component | Added composer with Models / Connectors / AI Tools and connector chips | Fixed |
| 4 | App opened on the Canva page, not Home | Root redirect | `/` now opens Home; Home's ask bar hands off to the Canva chat | Fixed |
| 5 | "Fonts too small" after switching to 127.0.0.1 | Chrome remembers zoom per site; 127.0.0.1 had its own zoom | Reset with Ctrl+0 | Fixed (user setting) |
| 6 | Proportions differed from production NSOffice | Kit was built from AuditBee, which differs from india.nsoffice.ai | Kit resized to measurements from production screenshots (sidebar, Home, Hive, Connectors, assistant page) | Fixed (provisional: replace with production CSS values) |
| 7 | Assistant page didn't match NSOffice assistants | Different header, empty state, ask bar | Title chip, "What's the Move", bee + plug in ask bar, NS logo disclaimer | Fixed |
| 8 | Connect button looked different from NSOffice | Colours, size, solid icon, no green dot | Exact colours from screenshots, 35px, outline plug, dot in both states | Fixed |
| 9 | Next.js "N" badge over the user block | Dev-only indicator | `devIndicators: false` | Fixed |

### Canva setup and sign-in

| # | Issue | Cause | Fix | Status |
|---|---|---|---|---|
| 10 | No "access token" to copy | Canva only issues tokens through OAuth sign-in | Built Connect (OAuth with PKCE) | Fixed |
| 11 | No Configuration page / client ID | Developer Portal requires MFA on the Canva account | Enable MFA, then Outside Canva → Start integrating | Fixed |
| 12 | Redirect failed locally | App sent `localhost`; Canva needs exact `127.0.0.1` URL; cookie host mismatch | Use 127.0.0.1, bounce localhost → 127.0.0.1 | Fixed |
| 13 | "has not configured its redirect URI" | URL entered under Return navigation instead of Redirect URLs | Moved to Redirect URLs | Fixed |
| 14 | "redirect uri doesn't match" + 404 | Typo `…/callbac` in the portal | Corrected URL | Fixed |
| 15 | Sign-in requested a scope not ticked | `brandtemplate:content:read` requested | Request only the demo's scopes | Fixed |
| 16 | Token readable by page scripts; paste-token box | First version stored token in a normal cookie | httpOnly cookies, auto-renewal, Disconnect; paste box removed | Fixed |
| 17 | Deployed site redirected to 127.0.0.1 | Fallback address when `CANVA_REDIRECT_URI` unset | Address taken from each request (Vercel domain / 127.0.0.1) | Fixed |
| 18 | Two separate Connect buttons | Canva's REST API and MCP server had separate sign-ins | One Connect; with the portal app, one sign-in covers both | Fixed |
| 19 | Unclear how MCP was connected ("coming soon") | We used self-registration (DCR) on mcp.canva.com, not the portal toggle | Explained; switched deployed site to the portal route | Fixed |
| 20 | Deployed editor: "Invalid redirect URI" | mcp.canva.com accepts only local redirect URLs from self-registered apps | Turn on Canva MCP in the Developer Portal | Fixed |
| 21 | Portal app gave 500 on mcp.canva.com | Portal apps use a different server: `api.canva.com/connect/v1/mcp` with normal Canva OAuth | Use that server with the Canva sign-in token | Fixed |
| 22 | Portal route not active on Vercel | `CANVA_MCP_USE_PORTAL_APP` missing; env vars apply only after redeploy | Added variable, redeployed; setting made tolerant (`true`/`1`/`yes`); `/api/auth/canva/status` shows the route | Fixed |

### Chat and Canva tools

| # | Issue | Cause | Fix | Status |
|---|---|---|---|---|
| 23 | Old tester's tool names didn't exist | `search` / `fetch` aren't Canva tools | Real tool names | Fixed |
| 24 | REST calls that don't exist in Canva's API | Folder search, wrong move endpoint, list assets, Enterprise brand templates, export not awaited | Rewritten from Canva's OpenAPI spec | Fixed |
| 25 | REST API can't edit inside designs | Only whole-design/page operations, or data fields via autofill (Pro) | Added generate, resize, page edits, import, data fields; real editing via MCP | Limit (REST) |
| 26 | Generation failed on blank slide titles | Gemini sent empty outline titles | Empty sections dropped before calling Canva | Fixed |
| 27 | "Can't create a slide with this content" | Instructions told Gemini it couldn't add content | Instructions: use the user's wording; insert generated slides into existing decks | Fixed |
| 28 | Follow-up messages lost design IDs | Only final text kept between messages | Full turns (tool calls + results) kept in the conversation | Fixed |
| 29 | Generated slide looked flat, no boxes/arrows | REST generation lets Canva's AI choose the layout; REST can't add shapes | MCP editing tools (shapes, text, positions) | Fixed |
| 30 | Gemini filled Canva's editor schema wrongly | Flash invents fields on large nested schemas | Gemini 2.5 Pro for the editor; schema cleaned for Gemini; hex colour rule kept | Fixed |
| 31 | Chat UI cluttered: 8 "async job" steps, run-on text | Gemini polled Canva's background jobs; text from rounds joined | App waits for jobs itself; paragraphs between rounds; readable step labels | Fixed |
| 32 | "Can't change the font" | Instructions named tools this server doesn't have | Real tool names (start/perform/commit editing transaction) | Fixed (font family change itself unverified) |
| 33 | Edit attempt left no trace | Early stops weren't logged | Every request and early stop logged to `.canva-debug.log` (local only) | Fixed |
| 34 | Paid (premium) elements in designs | Canva's AI may use Pro elements; usable per the user's plan | Explained; free plans see watermarks, exports may fail | Limit |
| 35 | "Limit for new designs" message | Canva rate limit (~20 creations/min) or AI allowance | Auto-retry on rate limits; app notices with reason and reset time; Gemini prefers edits over regenerating | Fixed / Limit |

### Open items

| # | Item | Notes |
|---|---|---|
| A | Replace provisional UI sizes with production CSS | Waiting for production stylesheet |
| B | Copy `nsoffice_ui/` back to AuditBee | Changes AuditBee's look too (sidebar, Home, catalogue, chat, tokens) |
| C | Logo | Production sometimes shows NETWORK SCIENCE logo; kit uses NSOffice.AI |
| D | `mfa_backup_codes.txt` in the project folder | Git-ignored, but move it somewhere safe |
| E | Local setup still uses self-registration | Add `CANVA_MCP_USE_PORTAL_APP=true` to `.env.local` to match the live site |
| F | Visual check of the limit notices | Logic tested; on-page look not yet seen |
| G | Can other Canva users sign in? | Unreviewed public integration: not confirmed; test with a user outside your Canva team |
| H | Font family changes | Not confirmed the editor tools can change font family |
| I | Token cookie size and storage | Tokens must stay under ~4 KB; no server-side store (fine for a demo) |
