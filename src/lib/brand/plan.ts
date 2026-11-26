// The wireframe plan: what the planning step (/api/workflow/plan) returns, what the Brand Studio previews,
// and what the Canva build step turns into a design and images.
import { Type } from "@google/genai";
import { DEASRA, brandBrief, personaBrief, type BrandProfile } from "./deasra";

export type ElementKind = "heading" | "text" | "button" | "image" | "card" | "list" | "form" | "stat" | "nav";

export type PlanSection = {
  pattern: string; // id from the brand's patterns (hero, benefits, …)
  name: string;
  headline: string;
  subtext: string;
  elements: { kind: ElementKind; label: string }[];
  imageId?: string; // id of an entry in images[] shown in this section
};

export type PlanImage = {
  id: string;
  purpose: string;
  personaId: string;
  prompt: string;
  aspect: "LANDSCAPE_16_9" | "SQUARE_1_1" | "PORTRAIT_4_5" | "LANDSCAPE_4_3";
};

export type WireframePlan = {
  title: string;
  summary: string;
  userFlow: string[];
  sections: PlanSection[];
  images: PlanImage[];
  brandChecks: string[];
};

export type WorkflowRequest = {
  deliverable: "landing" | "feature" | "visuals";
  name: string; // program or feature name
  goal: string;
  personaIds: string[];
  journeyId: string;
  keyMessages: string;
  primaryCta: string;
  language: string;
};

export const DELIVERABLES: Record<WorkflowRequest["deliverable"], string> = {
  landing: "Program landing page wireframe + supporting visuals",
  feature: "New website feature concept (wireframe of the screens/sections) + visuals",
  visuals: "Supporting visuals only (image set for an existing page or campaign)",
};

export const PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING, description: "Two sentences: who the page is for and what it should make them do" },
    userFlow: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The visitor's steps through the page, 4–6 items" },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pattern: { type: Type.STRING, enum: DEASRA.patterns.map((p) => p.id), description: "Id of the approved section pattern" },
          name: { type: Type.STRING },
          headline: { type: Type.STRING, description: "Real copy, in the brand voice and the requested language" },
          subtext: { type: Type.STRING },
          elements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kind: { type: Type.STRING, enum: ["heading", "text", "button", "image", "card", "list", "form", "stat", "nav"] },
                label: { type: Type.STRING, description: "The element's actual copy or content" },
              },
              required: ["kind", "label"],
            },
          },
          imageId: { type: Type.STRING, description: "Id of the image shown in this section, if any" },
        },
        required: ["pattern", "name", "headline", "subtext", "elements"],
      },
    },
    images: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Short id such as img-hero" },
          purpose: { type: Type.STRING },
          personaId: { type: Type.STRING },
          prompt: { type: Type.STRING, description: "Complete image-generation prompt following the imagery rules; no text in the image" },
          aspect: { type: Type.STRING, enum: ["LANDSCAPE_16_9", "SQUARE_1_1", "PORTRAIT_4_5", "LANDSCAPE_4_3"] },
        },
        required: ["id", "purpose", "personaId", "prompt", "aspect"],
      },
    },
    brandChecks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "How this plan follows the brand rules, one line each" },
  },
  required: ["title", "summary", "userFlow", "sections", "images", "brandChecks"],
};

/** The pattern id for a section, also when a model gave the pattern's name ("Final CTA band") instead of its id. */
export function patternId(value: string, brand: BrandProfile = DEASRA): string {
  const v = value.trim().toLowerCase();
  const hit = brand.patterns.find((p) => p.id === v || p.name.toLowerCase() === v);
  return hit?.id ?? (/nav|header/.test(v) ? "nav" : /hero|intro/.test(v) ? "hero" : /cta|call to action/.test(v) ? "cta" : /footer/.test(v) ? "footer" : v);
}

/** Brand rules added to the Canva chat's system instruction while the workflow is in use. */
export function workflowContext(brand: BrandProfile = DEASRA): string {
  return `BRAND WORKFLOW: everything you make in this conversation is for ${brand.name} and must follow these rules.
${brandBrief(brand)}
Personas (represent them respectfully, as described): ${brand.personas.map(personaBrief).join(" | ")}
When the user asks for changes, keep to these colours (hex), fonts, voice and imagery rules. If an approved deAsra \
brand kit exists in Canva (list the brand kits once), pass its id when creating designs.`;
}

/** The chat message that builds an approved plan in Canva. */
export function buildPrompt(plan: WireframePlan, brand: BrandProfile = DEASRA): string {
  const persona = (id: string) => brand.personas.find((p) => p.id === id);
  const sections = plan.sections
    .map(
      (s, i) =>
        `${i + 1}. ${s.name} [${s.pattern}]\n   Headline: ${s.headline}\n   Subtext: ${s.subtext}\n` +
        s.elements.map((e) => `   - ${e.kind}: ${e.label}`).join("\n") +
        (s.imageId ? `\n   - image placeholder: ${s.imageId}` : ""),
    )
    .join("\n");
  const images = plan.images
    .map((img) => `- ${img.id} (${img.aspect}, ${img.purpose}; persona: ${persona(img.personaId)?.name ?? img.personaId}): ${img.prompt}`)
    .join("\n");
  return `Build this approved deAsra wireframe plan in Canva.

1. Check my brand kits once. If there's a deAsra kit, use it for the design.
2. Create ONE design in the "Website" format: a desktop landing-page wireframe titled "${plan.title} – wireframe". \
Brief: a clean, mid-fidelity wireframe that keeps this exact section order, hierarchy and copy, uses the deAsra colours \
${brand.colors.map((c) => c.hex).join(", ")} and fonts ${[...new Set(brand.typography.map((t) => t.font))].join(" / ")}, \
generous white space, clear primary buttons in ${brand.colors[0].hex}, and grey image placeholders labelled with the image ids.

SECTIONS
${sections}

USER FLOW: ${plan.userFlow.join(" → ")}

3. Generate these images, using each prompt as written. Start all of them together in the same step (one generate-image call per image, all in one response) rather than one step per image:
${images}

4. Reply with the wireframe link, the image results (with links if Canva gives them), and one line on what I can ask next \
(e.g. put the images into the wireframe, change copy, make a mobile version, export as PDF/PNG).`;
}

/** The instruction for the planning model. */
export function planPrompt(req: WorkflowRequest, brand: BrandProfile = DEASRA): string {
  const personas = brand.personas.filter((p) => req.personaIds.includes(p.id));
  const journey = brand.journeys.find((j) => j.id === req.journeyId) ?? brand.journeys[0];
  return `You are deAsra's UX and content designer. Plan a wireframe that a designer can build directly.

BRAND RULES (follow exactly):
${brandBrief(brand)}

REQUEST
- Deliverable: ${DELIVERABLES[req.deliverable]}
- Program / feature: ${req.name}
- Goal: ${req.goal}
- Target personas: ${personas.map(personaBrief).join("\n  ") || "all nano-entrepreneurs"}
- User journey to support: ${journey.name}: ${journey.steps.join(" → ")}
- Key messages: ${req.keyMessages || "(write them from the goal)"}
- Primary call to action: ${req.primaryCta || "Get free help"}
- Copy language: ${req.language}

HOW TO PLAN
- Build the page from the approved section patterns (use their ids in "pattern"), in a clear content hierarchy: \
the promise first, then value, who it's for, how it works, proof, and the final call to action. Leave out patterns that don't help this goal.
- ${req.deliverable === "visuals" ? "Keep sections minimal (a hero and one section showing where images go); focus on the images." : "8–10 sections for a landing page; for a feature concept, the sections/screens of that feature."}
- Write real, short copy in the brand voice and in ${req.language} (button labels too). No lorem ipsum.
- Map the user journey onto the page: the flow should end in the primary call to action.
- Images: ${req.deliverable === "visuals" ? "4–6" : "3–4"} images, each tied to one of the target personas (personaId), following the imagery rules and the persona's "show as" description. \
Prompts describe a photo-realistic scene; never ask for text, logos or words inside the image.
- brandChecks: 4–6 lines showing which brand rules the plan applies (colours, type, voice, representation, journey).`;
}
