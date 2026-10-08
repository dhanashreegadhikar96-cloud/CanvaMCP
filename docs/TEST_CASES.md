# Canva connector: test cases

Manual test cases. Run on the **live site** (https://canva-mcp-one.vercel.app) unless marked **Local**
(`http://127.0.0.1:3000`, `npm run dev`). "Issue #" refers to the issue log in `CANVA_CONNECTOR_NOTES.md`; those
cases guard against a past problem coming back.

**Before you start**
- A Canva account (note its plan: Free / Pro / Teams). A second account outside your Canva team for TC-SI-09.
- At least one existing design with a few text elements (e.g. the Diwali post `DAHXJ2_rP9s`).
- Record results in the **Result** column: Pass / Fail + notes or screenshot.

## 1. Setup and configuration

| ID | Steps | Expected | Issue # | Result |
|---|---|---|---|---|
| TC-SET-01 | Open `/api/auth/canva/status` | JSON with `clientIdSet`, `clientSecretSet`, `geminiKeySet`, `portalSettingOn` all `true`; editor route "Developer Portal app"; no IDs or secrets shown | 22 | |
| TC-SET-02 | Developer Portal → app → Outside Canva → Configuration | **Canva MCP** on; Redirect URLs include `https://canva-mcp-one.vercel.app/api/auth/canva/callback` (and the 127.0.0.1 one) | 13, 14, 20 | |
| TC-SET-03 | Vercel → Environment Variables | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `GEMINI_API_KEY`, `CANVA_MCP_USE_PORTAL_APP=true` for Production; **no** `CANVA_REDIRECT_URI` pointing at 127.0.0.1 | 17, 22 | |

## 2. Sign-in (Connect / Disconnect)

| ID | Steps | Expected | Issue # | Result |
|---|---|---|---|---|
| TC-SI-01 | Fresh browser (no cookies): open `/connector/canva` | "Connect Apps" popup opens over the page; ask bar shows red plug with red dot and "Connect to Canva to get started" | 8 | |
| TC-SI-02 | Click **Connect** | Goes to Canva sign-in on `www.canva.com`; address never shows 127.0.0.1 | 17 | |
| TC-SI-03 | Approve on Canva | Back on the Canva page; **one** approval screen only; popup closed; plug green with green dot; placeholder "Ask anything..."; address bar has no `?connected=` / `?error=` | 18, 21 | |
| TC-SI-04 | Reopen popup (click plug) | Single "Canva" row shows **Connected**; "Disconnect Canva" link visible | 18 | |
| TC-SI-05 | Click **Disconnect Canva** | Popup shows Connect again; plug red; sending a message opens the popup instead of sending | 16 | |
| TC-SI-06 | On Canva's approval screen click **Cancel** | Back on the page; popup shows "Canva access wasn't allowed." | | |
| TC-SI-07 | Connect, then wait > 4 hours (or clear only `canva_access_token` cookie) and send a message | Message works: token renewed silently | 16 | |
| TC-SI-08 | DevTools → Application → Cookies | `canva_*` cookies are **HttpOnly**; no token in the URL or page source | 16 | |
| TC-SI-09 | Second Canva account, outside your team: Connect | Record whether Canva allows it (unreviewed integration) | Open G | |
| TC-SI-10 | **Local**, open `http://localhost:3000/connector/canva`, click Connect | Switches to `127.0.0.1` before going to Canva; sign-in completes | 12 | |
| TC-SI-11 | Open `/api/auth/canva/callback` directly | Back on the Canva page with a readable error, not a crash or 404 | 14 | |

## 3. Chat basics and UI

| ID | Steps | Expected | Issue # | Result |
|---|---|---|---|---|
| TC-UI-01 | Open `/` | Home ("What would you like to work on today?"), not the Canva page | 4 | |
| TC-UI-02 | Home → type "Search my designs for Diwali" → Enter | Opens the Canva chat and sends the message automatically | 4 | |
| TC-UI-03 | Home → bee icon → Connectors | Flyout lists connectors with Canva first; Canva chip opens the Canva page | 3 | |
| TC-UI-04 | Hive → Connectors | No top bar; flat grid with tinted icons, "Use" buttons; pills filter (Communications shows Outlook, Teams) | 2, 6 | |
| TC-UI-05 | Canva page empty state | "Canva Assistant" chip top-left; "What's the Move"; 4 cards on one line each; NS logo disclaimer | 7 | |
| TC-UI-06 | Click a suggestion card | Sends that prompt | | |
| TC-UI-07 | Send a long request, click **Stop** while it runs | Stops; reply shows "Stopped."; next message works | | |
| TC-UI-08 | Any request that uses Canva | One step row per action with readable label (e.g. "Creating design with Canva AI ✓"); "Details" shows input and Canva's result; no "Get create design async job" spam | 31 | |
| TC-UI-09 | Reply with several steps | Text before/after steps in separate paragraphs, no run-on filler ("Still working on it…") | 31 | |
| TC-UI-10 | Compare with india.nsoffice.ai at 100% zoom (Ctrl+0) | Sidebar, headings, cards, ask bar similar in size and spacing | 5, 6 | |
| TC-UI-11 | Browser console on each page | No errors; no Next.js "N" badge | 9 | |

## 4. Canva actions (MCP)

| ID | Prompt | Expected | Issue # | Result |
|---|---|---|---|---|
| TC-MCP-01 | "Show my 5 most recently edited designs" | List with Canva links, most recent first | | |
| TC-MCP-02 | "Search my designs for Diwali" | Matching designs listed | | |
| TC-MCP-03 | "Create a Diwali Instagram post for my ethnic men's clothing brand" | One "Creating design" step; reply with link; design opens in Canva with separate elements | 29, 31 | |
| TC-MCP-04 | Follow-up: "Export it as PNG" | Uses the design from the previous answer (no new search); download link | 28 | |
| TC-MCP-05 | "In my Diwali ethnicwear Instagram post, change 'Celebrate in Style' to 'Shine This Diwali'" | Edit applied, chat describes it and **asks before saving**; after "yes", text changed in Canva | 32 | |
| TC-MCP-06 | Same design: "Make 'Diwali Edit 2026' bigger and gold" | Size and colour change; colour as hex | 30 | |
| TC-MCP-07 | "Change the font to something traditional" | Either changes it, or says plainly it can't change the font family and offers alternatives (record which) | 32, Open H | |
| TC-MCP-08 | "Create a slide showing the Super Admin and End User flow as boxes connected by arrows" + the flow text | Slide with separate boxes, text and arrows (not one image); nothing overlapping badly | 29, 30 | |
| TC-MCP-09 | "Add a new slide to <presentation> with this content: …" | New page in that presentation with the content | 27 | |
| TC-MCP-10 | "Create a folder called Test QA and move <design> into it" | Folder created; design moved | 24 | |
| TC-MCP-11 | "Resize <design> to an Instagram story" | Resized copy (Pro); on Free, a clear plan/trial message | 25 | |
| TC-MCP-12 | "Delete page 2 of <design>" | Asks to confirm before deleting | | |
| TC-MCP-13 | "Make a 5-slide presentation about our team offsite" (no titles given) | Generates without asking for slide titles | 26 | |
| TC-MCP-14 | Paste a block of content: "Create a slide with this content: …" | Uses the wording; doesn't refuse | 27 | |
| TC-MCP-15 | Check a generated design in Canva for premium elements (crown) and export it | Behaviour matches the account's plan (watermark / export error on Free) | 34 | |

## 5. Limits and errors

| ID | Steps | Expected | Issue # | Result |
|---|---|---|---|---|
| TC-ERR-01 | Trigger a rate limit (many "create a design" requests within a minute) | Blue "Canva is busy … waiting 20 seconds" notice, then success or amber "Canva's limit for now" notice | 35 | |
| TC-ERR-02 | AI allowance exhausted (Free account after many generations) | Amber "Canva AI allowance used up" notice, with reset date if Canva gives one; chat suggests editing/exporting instead | 35 | |
| TC-ERR-03 | Revoke the app's access in Canva (Settings → Apps), then send a message | Popup reopens with a reconnect message (Canva's reason shown) | 16, 22 | |
| TC-ERR-04 | **Local**, remove `GEMINI_API_KEY`, send a message | Clear "GEMINI_API_KEY is not configured" error | | |
| TC-ERR-05 | Ask about a design ID that doesn't exist | Polite "couldn't find it", no crash; step marked failed | | |
| TC-ERR-06 | **Local**: send any message, open `.canva-debug.log` | Request, tools, results and reply logged; no tokens in the file | 33 | |

## 6. Local-only regression (REST fallback)

Run with `CANVA_MCP_USE_PORTAL_APP` **unset** in `.env.local` and only the Canva (REST) sign-in.

| ID | Prompt | Expected | Issue # | Result |
|---|---|---|---|---|
| TC-REST-01 | "Show my 5 most recently edited designs" | Uses REST search; results with links | 24 | |
| TC-REST-02 | "Create a folder called Demo" | Folder created at the top level | 24 | |
| TC-REST-03 | "Export <design> as PDF" | Waits for the export; returns download links (valid 24h) | 24 | |
| TC-REST-04 | "Make a presentation about X" | Canva AI generation; link returned | 25, 26 | |
