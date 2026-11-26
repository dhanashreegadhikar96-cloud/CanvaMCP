# deAsra Brand Studio: overview

Last updated: 24 Nov 2026. Status: built and partly tested locally; **not committed yet**.

## 1. What we are doing and why

This project is a Canva connector: a web app (Next.js) where people chat with an AI (Gemini) that works in their
own Canva account through **Canva's MCP server** (Canva's actions exposed as "tools" an AI can call). Until now it
was a general chat: "make a poster", "find my deck", "export as PDF".

We are turning it into a **fixed design workflow** for one business need, deAsra's **Use Case 2: Brand-aligned
wireframes and image generation**:

| | |
|---|---|
| **Current situation** | Different team members make landing-page wireframes, feature concepts and images in separate tools, typing the same brand instructions every time. |
| **Required capability** | Use deAsra's approved colours, typography, content language, design patterns, basic user journeys and nano-entrepreneur personas to produce consistent wireframes and images. |
| **Illustrative request** | "Create a wireframe for a new program landing page and supporting visuals, using established deAsra design and target-group references." |
| **Expected output** | A usable wireframe and relevant images that follow deAsra branding, content hierarchy and user flow, and represent nano-entrepreneurs well. |

**The idea in one line:** deAsra's brand rules are written down **once**, in code. Every request passes through
them automatically, so team members only describe *what* they need, never *how it should look*.

A free-text chat can't guarantee that: people forget instructions and the AI improvises. A workflow can, because
its steps are fixed: **brief → plan (reviewed) → build in Canva → refine**.

## 2. Where it lives

- Page: **`/workflow/brand-studio`** (locally `http://127.0.0.1:3000/workflow/brand-studio`)
- It is a **standalone page with its own look** (deAsra blue header, deAsra colours). It does **not** use the
  NSOffice shell (sidebar, Hive etc.). The NSOffice pages of the app are unchanged.
- It reuses the app's existing Canva sign-in and Canva chat underneath.

## 3. The workflow, step by step

```
 ┌──────────────┐     ┌────────────────────────┐     ┌──────────────────────┐     ┌──────────────┐
 │ 1. Brief     │ ──▶ │ 2. Plan & preview      │ ──▶ │ 3. Build in Canva    │ ──▶ │ 4. Refine    │
 │ form, ~1 min │     │ Gemini + brand profile │     │ Canva MCP tools      │     │ chat         │
 └──────────────┘     │ no Canva usage         │     │ uses Canva AI        │     └──────────────┘
                      └────────────────────────┘     └──────────────────────┘
```

### Step 1: Brief

The user fills in a short form:

| Field | Example |
|---|---|
| Deliverable | Program landing page + visuals / New website feature concept + visuals / Visuals only |
| Program or feature name | "Udyam Saathi: free business registration support" |
| Goal (what should the visitor do?) | "Request free one-on-one help to register their business" |
| Target nano-entrepreneurs | Pick one or more persona cards (Sunita, Rahul, Fatima, Akash) |
| User journey | Discover → apply / Ask an expert / Self-learn from resources |
| Copy language | English, Marathi or Hindi |
| Key messages (optional) | "Registration opens doors to loans and bigger orders…" |
| Primary call to action | "Get free registration help" |

"Fill example" loads the illustrative request from the use case.

### Step 2: Plan & preview (no Canva usage)

The app sends the brief **plus the full deAsra brand profile** to Gemini (2.5 Flash), which must answer in a fixed
structure (a JSON schema), so the result is always usable. The plan contains:

- **Title and summary:** who the page is for, what it should make them do.
- **User flow:** the visitor's 4–6 steps through the page, ending in the call to action.
- **Sections in order**, each built from an *approved deAsra section pattern* (Header, Hero, What you get,
  Who it's for, How it works, Success stories, Impact numbers, FAQ, Final CTA band, Footer), with **real copy**
  in the chosen language (no lorem ipsum) and its elements (buttons, cards, stats, lists, form fields, images).
- **Image briefs:** 3–6 images, each tied to a persona, with a complete photo prompt that follows the imagery rules.
- **Brand checks:** a few lines showing which brand rules the plan applied.

On screen the user sees:
- the user flow as numbered chips;
- a **wireframe preview** drawn in deAsra's colours and fonts (Poppins / Mukta). Headlines and subtext can be
  edited by clicking them;
- the **image prompts**, editable;
- the brand checks.

The user can **Re-plan** or continue to **Build in Canva**. Because this step uses only Gemini, people can iterate
on structure and copy freely without spending Canva's AI allowance.

### Step 3: Build in Canva

The approved plan becomes one precise instruction to the Canva chat (shown in the page, with each Canva step
visible). The chat runs with deAsra's brand rules added to its instructions, and:

1. checks the user's Canva **brand kits** once; if a deAsra kit exists, uses it;
2. creates **one website-format wireframe design** with the exact section order, hierarchy and copy, deAsra hex
   colours and fonts, and grey placeholders labelled with the image ids;
3. **generates each image** with Canva AI, one per prompt;
4. replies with the wireframe link, the image results and what can be asked next.

### Step 4: Refine

The chat stays open under the build, still with the brand rules applied. Typical follow-ups:
"put the images into the wireframe", "change the hero headline to…", "make a mobile version",
"export as PDF/PNG".

## 4. The brand profile (the heart of it)

File: [`src/lib/brand/deasra.ts`](../src/lib/brand/deasra.ts). Everything the workflow produces is driven from here.

| Part | What it holds |
|---|---|
| Mission | One line on what deAsra does |
| Colours | 6 colours with hex codes and where to use each (e.g. orange for buttons, deep blue for headings) |
| Typography | Headings Poppins, body Mukta (both support Devanagari for Marathi/Hindi), sizes and weights |
| Voice | Principles, do's and don'ts (warm mentor tone, benefit first, no jargon, no charity/pity framing), languages |
| Imagery rules | Real Indian nano-entrepreneurs in their own work settings, natural light, balanced gender and age, no poverty imagery, no text in images |
| Section patterns | The 10 approved page sections and what each contains |
| User journeys | 3 basic journeys with their steps |
| Personas | 4 nano-entrepreneur personas: business, location, languages, goals, barriers, and how to show them in images |

> **Important: placeholder values.** We don't have deAsra's approved brand guide in this project. Colours, fonts
> and the four personas are **reasonable working values, marked `CONFIRM`** in the file. Replace them with the
> approved brand guide and real research personas before anything is shared outside the team. Changing that one
> file updates the plan, the preview, the Canva brief and the image prompts.

The "View brand profile" button on the page shows the profile in use (swatches, fonts, voice, imagery).

## 5. How it is built (technical)

### New files

| File | Purpose |
|---|---|
| `src/lib/brand/deasra.ts` | Brand profile + helpers that turn it into text for AI prompts |
| `src/lib/brand/plan.ts` | Plan data types, the JSON schema Gemini must follow, the planning prompt, the Canva build prompt, the brand rules for the chat, and a helper that fixes section ids |
| `src/app/api/workflow/plan/route.ts` | `POST /api/workflow/plan`: brief in, structured plan out (Gemini 2.5 Flash) |
| `src/app/workflow/brand-studio/page.tsx` | The page: standalone header with Canva connection status |
| `src/app/workflow/brand-studio/BrandStudio.tsx` | The 3-step UI: brief form, plan review, wireframe preview, embedded chat |
| `src/app/workflow/brand-studio/studio.css` | The studio's own styles (not NSOffice) |

### Changed files

| File | Change |
|---|---|
| `src/app/api/canva/chat/route.ts` | Accepts `workflow: "deasra"`; when set, adds deAsra's brand rules to the AI's instructions. The rules come from the server-side profile, never from the browser. |
| `src/app/connector/canva/CanvaChat.tsx` | Can be embedded in another page: custom heading/suggestions, a message sent by the page ("Build in Canva"), no auto-focus; Connect links now include where to return after sign-in. |
| `src/lib/canva-auth.ts` | `rememberReturn` / `returnPath`: remembers which page started a Canva sign-in (only allowed pages: the Canva chat and the Brand Studio). |
| `src/app/api/auth/canva/{login,callback}`, `src/app/api/auth/canva-mcp/{login,callback}` | After signing in, go back to the page that started it instead of always the Canva chat. |

### Data flow

```
Browser (Brand Studio)
  │ 1. POST /api/workflow/plan  {brief}
  ▼
Plan route ── brief + brand profile ──▶ Gemini 2.5 Flash (JSON schema) ──▶ plan
  │
  │ 2. user reviews / edits plan in the browser (kept in sessionStorage)
  │
  │ 3. POST /api/canva/chat  {messages: [build prompt], workflow: "deasra"}
  ▼
Chat route ── instructions + brand rules ──▶ Gemini 2.5 Pro ──▶ Canva MCP tools
                                                               (list-brand-kits, create-design,
                                                                generate-image, editing tools…)
  │ streams each step and the answer back to the page
  ▼
Canva designs and images in the user's own Canva account
```

### Small robustness details
- The brief and plan are saved in the browser tab (`sessionStorage`), so they survive a reload or the trip to
  Canva's sign-in.
- Gemini sometimes returned section *names* instead of ids; the schema now restricts the field to valid ids and
  the app also maps names to ids, so the preview always lays out correctly.
- Input lengths are capped on the server.

## 6. Requirements to use it

- `GEMINI_API_KEY` set (already needed by the app).
- Canva connected. **Canva MCP** is needed for the website wireframe and image generation; with only the Canva
  REST API connection, Canva can make presentations and docs, and the page shows a warning.
- Canva AI usage: step 3 creates one design and 3–6 images, which count against the user's Canva AI allowance and
  per-minute limit. Step 2 doesn't.
- A deAsra **brand kit in Canva** (Pro/Teams) is optional but makes Canva's output more faithful (logo, fonts).

### Who can sign in (Canva's rule)

The studio needs only the **Canva MCP** connection (the header's "Connect Canva").

| Where | Sign-in route | Who can sign in |
|---|---|---|
| Local, `http://127.0.0.1:3000` (default `.env.local`) | Self-registered client on `mcp.canva.com` | **Any Canva account**, so others can demo on your machine |
| Live site (`CANVA_MCP_USE_PORTAL_APP=true`) | Your Developer Portal app | **Only you** (and collaborators) until Canva releases the app; everyone else sees "The client ID is invalid" |

No code can get around the live-site rule. To let others in there, either add them as **collaborators** on the app
in the Canva Developer Portal (same Canva team, Teams/Enterprise plan), or **submit the app for review and release**.
To demo with a different account locally, sign out of canva.com in the browser first, or Canva reuses the account
that's already signed in.

### Rate limits

- **Gemini:** a build makes several calls to Gemini 2.5 Pro within a minute. On a 429 (per-minute limit) or 503
  (overloaded), the app now waits (as long as Google asks, up to 60 s) and continues, up to 4 tries, and shows
  "Gemini is busy". A **daily** limit isn't retried; the message says so. A paid Gemini plan (billing on the key's
  Google Cloud project) removes these limits.
- **Canva:** calls that create with Canva AI (designs, images) are spaced at least 4 s apart. A "too many requests"
  answer is retried twice (after 20 s, then 40 s) with a "Canva is busy" notice. A used-up AI allowance isn't
  retried.
- The build asks Gemini to start all images in one step, which cuts the number of Gemini calls per build.

## 7. What has been tested

| Check | Result |
|---|---|
| Page loads standalone, no console errors | ✅ |
| Example brief → plan (real Gemini call) | ✅ 8–10 sections, real copy, flow, image prompts, brand checks |
| Wireframe preview: header, hero, cards, buttons, image placeholders | ✅ (after the section-id fix) |
| Plan restored after page reload | ✅ |
| "Build in Canva" with Canva not connected → connect dialog | ✅ |
| Connect links carry the return address | ✅ |
| Type check (`tsc`) | ✅ |
| **Actual build in Canva** (wireframe design + images) | ❌ Not run: Canva isn't connected in the local preview |
| **Return to the studio after a real Canva sign-in** | ❌ Not run, same reason |

## 8. Open items and next steps

| # | Item | Notes |
|---|---|---|
| 1 | Replace placeholder brand values | Colours, fonts, personas from deAsra's approved guide and research |
| 2 | Run a real Canva build | Connect Canva MCP, run the example, check the wireframe and image quality |
| 3 | Check the sign-in return | Sign in from the studio, confirm you land back with the plan intact |
| 4 | Commit and deploy | Nothing is committed yet (branch `separate-canva-connections`) |
| 5 | Ideas | Export the plan as a Markdown/PDF spec for developers; mobile wireframe as a standard second output; let the brand team edit the profile in the UI instead of in code; add deAsra's logo to the preview; a link to the studio from the app's home page |
