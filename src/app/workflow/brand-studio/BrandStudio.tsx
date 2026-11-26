"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandProfile } from "@/lib/brand/deasra";
import { DELIVERABLES, buildPrompt, patternId, type PlanSection, type WireframePlan, type WorkflowRequest } from "@/lib/brand/plan";
import CanvaChat from "@/app/connector/canva/CanvaChat";

// Use Case 2 as a workflow: 1. Brief  2. Plan (brand-aligned wireframe + image prompts, reviewed here)
// 3. Build in Canva (the Canva chat, with deAsra's brand rules added server-side), then refine by chatting.

type Step = 1 | 2 | 3;

const EXAMPLE: WorkflowRequest = {
  deliverable: "landing",
  name: "Udyam Saathi: free business registration support",
  goal: "Get home-based and small shop entrepreneurs to request free one-on-one help to register their business (Udyam/FSSAI/GST).",
  personaIds: ["home-food", "kirana"],
  journeyId: "apply",
  keyMessages: "Registration opens doors to loans and bigger orders. It's free with deAsra. An expert guides you step by step, in your language.",
  primaryCta: "Get free registration help",
  language: "English",
};

const STATE_KEY = "deasra-studio"; // brief + plan, kept while the user signs in to Canva

const BLANK: WorkflowRequest = { deliverable: "landing", name: "", goal: "", personaIds: [], journeyId: "apply", keyMessages: "", primaryCta: "", language: "English" };

export default function BrandStudio({ brand, connected, editorConnected }: { brand: BrandProfile; connected: boolean; editorConnected: boolean }) {
  const [step, setStep] = useState<Step>(1);
  const [req, setReq] = useState<WorkflowRequest>(BLANK);
  const [plan, setPlan] = useState<WireframePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [build, setBuild] = useState<{ id: number; text: string } | null>(null);
  const [showBrand, setShowBrand] = useState(false);

  // Restore the brief and plan (e.g. after the Canva sign-in), and show a sign-in error if there was one
  const restored = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
      if (saved?.req) setReq(saved.req);
      if (saved?.plan) {
        setPlan(saved.plan);
        setStep(2);
      }
    } catch {
      // nothing saved
    }
    restored.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setError(`Canva sign-in: ${params.get("error")}`);
    if (params.has("error") || params.has("connected")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ req, plan }));
    } catch {
      // storage unavailable: state just isn't kept
    }
  }, [req, plan]);

  const set = <K extends keyof WorkflowRequest>(key: K, value: WorkflowRequest[K]) => setReq((r) => ({ ...r, [key]: value }));
  const togglePersona = (id: string) =>
    set("personaIds", req.personaIds.includes(id) ? req.personaIds.filter((p) => p !== id) : [...req.personaIds, id]);

  async function makePlan() {
    setPlanning(true);
    setError("");
    try {
      const res = await fetch("/api/workflow/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Planning failed (${res.status}).`);
      const plan = data.plan as WireframePlan;
      setPlan({ ...plan, sections: plan.sections.map((sec) => ({ ...sec, pattern: patternId(sec.pattern, brand) })) });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning failed.");
    } finally {
      setPlanning(false);
    }
  }

  function startBuild() {
    if (!plan) return;
    setStep(3);
    setBuild({ id: Date.now(), text: buildPrompt(plan, brand) });
  }

  const updateSection = (i: number, patch: Partial<PlanSection>) =>
    setPlan((p) => (p ? { ...p, sections: p.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : p));
  const updateImagePrompt = (i: number, prompt: string) =>
    setPlan((p) => (p ? { ...p, images: p.images.map((img, j) => (j === i ? { ...img, prompt } : img)) } : p));

  return (
    <main className="studio">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600&family=Poppins:wght@500;600&display=swap" />
      <div className="studio-inner">
        <header className="studio-head">
          <div>
            <h1 className="studio-title">Brand-aligned wireframes &amp; images</h1>
            <p className="studio-sub">
              Describe the page. The studio plans it with deAsra&apos;s colours, typography, voice, section patterns, journeys and
              personas, then builds the wireframe and visuals in your Canva account.
            </p>
          </div>
          <button type="button" className="studio-link" onClick={() => setShowBrand(!showBrand)}>
            <i className="fa-solid fa-swatchbook"></i> {showBrand ? "Hide" : "View"} brand profile
          </button>
        </header>

        {showBrand && <BrandPanel brand={brand} />}

        <ol className="studio-steps">
          {(["Brief", "Plan & preview", "Build in Canva"] as const).map((label, i) => {
            const n = (i + 1) as Step;
            const reachable = n === 1 || (n === 2 && plan) || (n === 3 && build);
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`studio-step${step === n ? " is-active" : ""}${step > n ? " is-done" : ""}`}
                  disabled={!reachable}
                  onClick={() => setStep(n)}
                >
                  <span className="studio-step-n">{step > n ? <i className="fa-solid fa-check"></i> : n}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <form
            className="studio-card studio-form"
            onSubmit={(e) => {
              e.preventDefault();
              makePlan();
            }}
          >
            <div className="studio-row-between">
              <h2 className="studio-h2">What do you need?</h2>
              <button type="button" className="studio-link" onClick={() => setReq(EXAMPLE)}>
                <i className="fa-regular fa-lightbulb"></i> Fill example: new program landing page
              </button>
            </div>

            <div className="studio-choices">
              {(Object.keys(DELIVERABLES) as WorkflowRequest["deliverable"][]).map((d) => (
                <label key={d} className={`studio-choice${req.deliverable === d ? " is-on" : ""}`}>
                  <input type="radio" name="deliverable" checked={req.deliverable === d} onChange={() => set("deliverable", d)} />
                  {DELIVERABLES[d]}
                </label>
              ))}
            </div>

            <label className="studio-field">
              <span>Program or feature name</span>
              <input value={req.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Udyam Saathi registration support" required />
            </label>
            <label className="studio-field">
              <span>Goal: what should the visitor do?</span>
              <textarea rows={2} value={req.goal} onChange={(e) => set("goal", e.target.value)} required />
            </label>

            <div className="studio-field">
              <span>Target nano-entrepreneurs</span>
              <div className="persona-grid">
                {brand.personas.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`persona-card${req.personaIds.includes(p.id) ? " is-on" : ""}`}
                    onClick={() => togglePersona(p.id)}
                    aria-pressed={req.personaIds.includes(p.id)}
                  >
                    <strong>{p.name}</strong>
                    <span>{p.business}</span>
                    <small>{p.location} · {p.languages.join(", ")}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-2col">
              <label className="studio-field">
                <span>User journey</span>
                <select value={req.journeyId} onChange={(e) => set("journeyId", e.target.value)}>
                  {brand.journeys.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </label>
              <label className="studio-field">
                <span>Copy language</span>
                <select value={req.language} onChange={(e) => set("language", e.target.value)}>
                  <option>English</option>
                  <option>Marathi</option>
                  <option>Hindi</option>
                </select>
              </label>
            </div>
            <label className="studio-field">
              <span>Key messages (optional)</span>
              <textarea rows={2} value={req.keyMessages} onChange={(e) => set("keyMessages", e.target.value)} />
            </label>
            <label className="studio-field">
              <span>Primary call to action</span>
              <input value={req.primaryCta} onChange={(e) => set("primaryCta", e.target.value)} placeholder="Get free help" />
            </label>

            {error && <p className="chat-error">{error}</p>}
            <div className="studio-actions">
              <span className="studio-hint">Planning doesn&apos;t use your Canva AI allowance.</span>
              <button type="submit" className="studio-btn" disabled={planning}>
                {planning ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Planning…</> : <>Plan wireframe <i className="fa-solid fa-arrow-right"></i></>}
              </button>
            </div>
          </form>
        )}

        {step === 2 && plan && (
          <div className="studio-plan">
            <div className="studio-card">
              <div className="studio-row-between">
                <div>
                  <h2 className="studio-h2">{plan.title}</h2>
                  <p className="studio-sub">{plan.summary}</p>
                </div>
                <div className="studio-actions-inline">
                  <button type="button" className="studio-btn studio-btn--ghost" onClick={makePlan} disabled={planning}>
                    {planning ? "Re-planning…" : "Re-plan"}
                  </button>
                  <button type="button" className="studio-btn" onClick={startBuild}>
                    Build in Canva <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
              {error && <p className="chat-error">{error}</p>}
              <div className="flow">
                {plan.userFlow.map((s, i) => (
                  <span key={i} className="flow-step"><b>{i + 1}</b>{s}</span>
                ))}
              </div>
            </div>

            <div className="studio-plan-grid">
              <div className="studio-card wf-frame">
                <div className="wf-browser"><span></span><span></span><span></span> Wireframe preview · click text to edit</div>
                <Wireframe plan={plan} brand={brand} onEdit={updateSection} />
              </div>
              <aside className="studio-side">
                <div className="studio-card">
                  <h3 className="studio-h3">Images to generate</h3>
                  {plan.images.map((img, i) => (
                    <div key={img.id} className="img-brief">
                      <div className="img-brief-head">
                        <b>{img.id}</b>
                        <span>{img.aspect.replace(/_/g, " ").toLowerCase()} · {brand.personas.find((p) => p.id === img.personaId)?.name ?? img.personaId}</span>
                      </div>
                      <div className="img-brief-purpose">{img.purpose}</div>
                      <textarea rows={4} value={img.prompt} onChange={(e) => updateImagePrompt(i, e.target.value)} aria-label={`Prompt for ${img.id}`} />
                    </div>
                  ))}
                </div>
                <div className="studio-card">
                  <h3 className="studio-h3">Brand checks</h3>
                  <ul className="checks">
                    {plan.brandChecks.map((c, i) => (
                      <li key={i}><i className="fa-solid fa-circle-check"></i>{c}</li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* Kept mounted after the first build so the conversation survives switching steps */}
        {build && (
          <div className="studio-card studio-chat" hidden={step !== 3}>
            {!editorConnected && (
              <p className="studio-warn">
                <i className="fa-solid fa-triangle-exclamation"></i> Connect <b>Canva MCP</b> (plug icon below) to build the
                wireframe and images in your Canva account.
              </p>
            )}
            <CanvaChat
              embedded
              mcpOnly
              workflow="deasra"
              connected={false /* the studio builds with Canva MCP only */}
              editorConnected={editorConnected}
              heading="Building in Canva"
              suggestions={[]}
              autoSend={build}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function BrandPanel({ brand }: { brand: BrandProfile }) {
  return (
    <div className="studio-card brand-panel">
      <div>
        <h3 className="studio-h3">Colours</h3>
        <div className="swatches">
          {brand.colors.map((c) => (
            <div key={c.hex} className="swatch" title={c.use}>
              <span style={{ background: c.hex }}></span>
              <b>{c.name}</b>
              <code>{c.hex}</code>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="studio-h3">Typography</h3>
        {brand.typography.map((t) => (
          <div key={t.role} className="type-row" style={{ fontFamily: `'${t.font}', sans-serif` }}>
            <b>{t.role}</b> {t.font} · {t.weight} · {t.size}
          </div>
        ))}
        <h3 className="studio-h3">Voice</h3>
        <ul className="plain-list">{brand.voice.principles.map((v) => <li key={v}>{v}</li>)}</ul>
      </div>
      <div>
        <h3 className="studio-h3">Imagery</h3>
        <ul className="plain-list">{brand.imagery.map((v) => <li key={v}>{v}</li>)}</ul>
      </div>
      <p className="studio-hint brand-note">
        Source: <code>src/lib/brand/deasra.ts</code>. Colours, fonts and personas are working values: replace them with deAsra&apos;s approved brand guide.
      </p>
    </div>
  );
}

// A quick HTML rendering of the plan in deAsra's colours and fonts, so it can be reviewed before using Canva.
function Wireframe({ plan, brand, onEdit }: { plan: WireframePlan; brand: BrandProfile; onEdit: (i: number, patch: Partial<PlanSection>) => void }) {
  const [primary, deep, green, sand, ink] = brand.colors.map((c) => c.hex);
  const vars = { "--b-primary": primary, "--b-deep": deep, "--b-green": green, "--b-sand": sand, "--b-ink": ink } as React.CSSProperties;
  const imageFor = (s: PlanSection) => plan.images.find((img) => img.id === s.imageId);

  return (
    <div className="wf" style={vars}>
      {plan.sections.map((s, i) => {
        const by = (k: string) => s.elements.filter((e) => e.kind === k);
        const img = imageFor(s);
        const editable = (field: "headline" | "subtext", Tag: "h2" | "p", cls: string) => (
          <Tag
            className={cls}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => onEdit(i, { [field]: e.currentTarget.textContent ?? "" })}
          >
            {s[field]}
          </Tag>
        );
        if (s.pattern === "nav") {
          return (
            <div key={i} className="wf-nav">
              <span className="wf-logo">deAsra</span>
              <span className="wf-nav-links">{(by("nav").length ? by("nav") : by("text")).map((e, j) => <span key={j}>{e.label}</span>)}</span>
              {by("button").slice(0, 1).map((e, j) => <span key={j} className="wf-btn">{e.label}</span>)}
            </div>
          );
        }
        const isHero = s.pattern === "hero";
        return (
          <div key={i} className={`wf-sec wf-sec--${s.pattern}${i % 2 ? " wf-sec--alt" : ""}`}>
            <span className="wf-tag">{s.name}</span>
            <div className={isHero ? "wf-hero" : ""}>
              <div>
                {editable("headline", "h2", isHero ? "wf-h1" : "wf-h2")}
                {editable("subtext", "p", "wf-p")}
                {by("text").map((e, j) => <p key={j} className="wf-p">{e.label}</p>)}
                {by("list").length > 0 && <ul className="wf-list">{by("list").map((e, j) => <li key={j}>{e.label}</li>)}</ul>}
                {isHero && <div className="wf-btns">{by("button").map((e, j) => <span key={j} className={j ? "wf-btn wf-btn--ghost" : "wf-btn"}>{e.label}</span>)}</div>}
              </div>
              {isHero && img && <div className="wf-img wf-img--hero">{img.id}<small>{img.purpose}</small></div>}
            </div>
            {by("card").length > 0 && (
              <div className="wf-cards">{by("card").map((e, j) => <div key={j} className="wf-card"><span className="wf-icon"></span>{e.label}</div>)}</div>
            )}
            {by("stat").length > 0 && <div className="wf-stats">{by("stat").map((e, j) => <div key={j} className="wf-stat">{e.label}</div>)}</div>}
            {by("form").length > 0 && <div className="wf-form">{by("form").map((e, j) => <div key={j} className="wf-input">{e.label}</div>)}</div>}
            {!isHero && img && <div className="wf-img">{img.id}<small>{img.purpose}</small></div>}
            {by("image").filter(() => !img).map((e, j) => <div key={j} className="wf-img">{e.label}</div>)}
            {!isHero && by("button").length > 0 && <div className="wf-btns">{by("button").map((e, j) => <span key={j} className={j ? "wf-btn wf-btn--ghost" : "wf-btn"}>{e.label}</span>)}</div>}
          </div>
        );
      })}
    </div>
  );
}
