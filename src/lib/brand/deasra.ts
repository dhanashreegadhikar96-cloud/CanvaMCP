// deAsra brand profile: the one place the design workflow (/workflow/brand-studio) reads brand rules from.
// Every wireframe plan, Canva design brief and image prompt is built from this, so team members don't
// repeat brand instructions by hand.
//
// IMPORTANT: values marked "CONFIRM" are working assumptions, not taken from deAsra's approved brand guide.
// Replace them with the approved values (colours, fonts, logo usage) before sharing output externally.

export type Persona = {
  id: string;
  name: string;
  business: string;
  location: string;
  languages: string[];
  goals: string[];
  barriers: string[];
  /** How to show this person in images: setting, clothing, props. Respectful and real, never stereotyped. */
  visual: string;
};

export type Journey = { id: string; name: string; steps: string[] };

export type SectionPattern = { id: string; name: string; purpose: string; elements: string[] };

export type BrandProfile = {
  name: string;
  mission: string;
  colors: { name: string; hex: string; use: string }[];
  typography: { role: string; font: string; weight: string; size: string }[];
  voice: { principles: string[]; doList: string[]; avoidList: string[]; languages: string[] };
  imagery: string[];
  patterns: SectionPattern[];
  journeys: Journey[];
  personas: Persona[];
};

export const DEASRA: BrandProfile = {
  name: "deAsra Foundation",
  mission:
    "Helps nano, micro and small entrepreneurs start and grow their businesses with free, practical, " +
    "one-on-one support, so more people can earn a sustainable livelihood.",
  // CONFIRM: replace with the hex codes from deAsra's brand guide
  colors: [
    { name: "deAsra Orange", hex: "#F26B21", use: "Primary: CTAs, key highlights, active states" },
    { name: "Deep Blue", hex: "#1F3A68", use: "Headings, navigation, footer background" },
    { name: "Leaf Green", hex: "#3E9B4F", use: "Success, growth stories, progress indicators" },
    { name: "Warm Sand", hex: "#FFF4E8", use: "Section backgrounds, cards" },
    { name: "Ink", hex: "#222222", use: "Body text" },
    { name: "White", hex: "#FFFFFF", use: "Page background, text on dark" },
  ],
  // CONFIRM: fonts. Both are Google Fonts with Devanagari support (Marathi and Hindi).
  typography: [
    { role: "Headings", font: "Poppins", weight: "SemiBold 600", size: "H1 48px / H2 32px / H3 24px" },
    { role: "Body", font: "Mukta", weight: "Regular 400", size: "18px, line height 1.6" },
    { role: "Buttons and labels", font: "Poppins", weight: "Medium 500", size: "16px" },
  ],
  voice: {
    principles: [
      "Warm and encouraging, like a trusted mentor",
      "Simple words; one idea per sentence",
      "Practical: say what the entrepreneur gets and what to do next",
      "Respectful: entrepreneurs are capable people, not beneficiaries",
    ],
    doList: [
      "Use 'you' and 'your business'",
      "Lead with the benefit (e.g. 'Get your business registered')",
      "Mention that support is free where true",
      "Use real numbers and short success stories",
    ],
    avoidList: [
      "Jargon (scalability, leverage, synergy)",
      "Charity or pity framing ('poor', 'helpless', 'needy')",
      "Long paragraphs and all-caps",
    ],
    languages: ["English", "मराठी (Marathi)", "हिंदी (Hindi)"],
  },
  imagery: [
    "Real Indian nano-entrepreneurs at work in their own setting (home kitchen, shop counter, workshop, market stall)",
    "Natural light, warm tones, genuine expressions of confidence and pride",
    "Balance of women and men, ages 20–55, urban and semi-urban",
    "Show the work and the product, not only portraits",
    "No poverty imagery, no staged corporate stock look, no text baked into images",
  ],
  patterns: [
    { id: "nav", name: "Header", purpose: "Orientation", elements: ["Logo", "Programs, Resources, Success stories, About", "Language switch (EN/मराठी/हिंदी)", "Primary CTA: Get free help"] },
    { id: "hero", name: "Hero", purpose: "State the promise and one action", elements: ["H1 benefit headline", "One-line subhead", "Primary CTA", "Secondary CTA (call/WhatsApp helpline)", "Photo of an entrepreneur"] },
    { id: "benefits", name: "What you get", purpose: "Explain value", elements: ["3–4 benefit cards with icon, title, one line"] },
    { id: "eligibility", name: "Who it's for", purpose: "Self-qualification", elements: ["Checklist of who can join", "Persona tiles"] },
    { id: "steps", name: "How it works", purpose: "Reduce effort anxiety", elements: ["3–4 numbered steps", "Time / cost note"] },
    { id: "stories", name: "Success stories", purpose: "Social proof", elements: ["2–3 story cards: photo, name, business, quote, result"] },
    { id: "impact", name: "Impact numbers", purpose: "Credibility", elements: ["3 stat blocks"] },
    { id: "faq", name: "FAQ", purpose: "Remove doubts", elements: ["4–6 questions, accordion"] },
    { id: "cta", name: "Final CTA band", purpose: "Conversion", elements: ["Headline", "Primary CTA", "Helpline number"] },
    { id: "footer", name: "Footer", purpose: "Trust and navigation", elements: ["Contact, address, social", "Partner logos", "Language switch"] },
  ],
  journeys: [
    {
      id: "apply",
      name: "Discover → apply for a program",
      steps: ["Lands from WhatsApp/social link", "Reads benefit and eligibility", "Taps 'Apply' or 'Get free help'", "Short form (name, phone, business, language)", "Confirmation + counsellor call within 48 hours"],
    },
    {
      id: "expert",
      name: "Ask an expert (one-on-one help)",
      steps: ["Chooses a topic (registration, finance, marketing…)", "Books a slot or requests a call-back", "Speaks with a deAsra expert", "Gets follow-up resources"],
    },
    {
      id: "learn",
      name: "Self-learn from resources",
      steps: ["Searches or browses topics", "Reads article / watches video in own language", "Downloads template or checklist", "Prompted to talk to an expert"],
    },
  ],
  // CONFIRM: illustrative personas; replace with deAsra's research personas when available
  personas: [
    {
      id: "home-food",
      name: "Sunita, 38",
      business: "Home-based tiffin and snacks business",
      location: "Pune (Hadapsar)",
      languages: ["Marathi", "basic Hindi"],
      goals: ["Get FSSAI registration", "Take bulk orders from offices", "Price her products correctly"],
      barriers: ["Little time", "Unsure about paperwork", "Mostly uses WhatsApp on her phone"],
      visual: "Woman in her late 30s in a clean home kitchen, cotton saree or salwar kameez, packing tiffins, confident smile",
    },
    {
      id: "kirana",
      name: "Rahul, 29",
      business: "Neighbourhood kirana / general store",
      location: "Pimpri-Chinchwad",
      languages: ["Hindi", "Marathi"],
      goals: ["Accept UPI and track sales", "Get a working-capital loan", "Compete with quick-commerce apps"],
      barriers: ["Irregular cash flow", "No formal accounts"],
      visual: "Young man at a well-stocked shop counter, casual shirt, using a phone/QR code with a customer",
    },
    {
      id: "artisan",
      name: "Fatima, 45",
      business: "Tailoring and embroidery unit with 3 helpers",
      location: "Nashik",
      languages: ["Hindi", "Urdu", "basic Marathi"],
      goals: ["Sell online", "Register as MSME (Udyam)", "Train and pay helpers properly"],
      barriers: ["Low digital confidence", "Depends on local middlemen"],
      visual: "Woman in her 40s at a sewing machine in a small workshop with fabrics, colleagues working in background",
    },
    {
      id: "first-gen",
      name: "Akash, 24",
      business: "Aspiring entrepreneur: mobile repair service",
      location: "Satara (semi-urban)",
      languages: ["Marathi", "English (basic)"],
      goals: ["Write a simple business plan", "Find a starting loan or scheme", "Get first customers"],
      barriers: ["No mentor", "Fear of failure"],
      visual: "Young man at a small repair table with tools and phones, focused, bright natural light",
    },
  ],
};

/** The brand profile as plain text for model prompts (wireframe plans, Canva briefs). */
export function brandBrief(b: BrandProfile = DEASRA): string {
  return [
    `Brand: ${b.name}. ${b.mission}`,
    `Colours (use these hex codes only): ${b.colors.map((c) => `${c.name} ${c.hex} (${c.use})`).join("; ")}.`,
    `Typography: ${b.typography.map((t) => `${t.role}: ${t.font} ${t.weight}, ${t.size}`).join("; ")}.`,
    `Voice: ${b.voice.principles.join("; ")}. Do: ${b.voice.doList.join("; ")}. Avoid: ${b.voice.avoidList.join("; ")}. Languages offered: ${b.voice.languages.join(", ")}.`,
    `Imagery rules: ${b.imagery.join("; ")}.`,
    `Approved page sections (id: name, purpose, elements): ${b.patterns.map((p) => `${p.id}: ${p.name} (${p.purpose}: ${p.elements.join(", ")})`).join(" | ")}.`,
  ].join("\n");
}

export function personaBrief(p: Persona): string {
  return `${p.name}, ${p.business}, ${p.location}. Speaks ${p.languages.join(", ")}. Goals: ${p.goals.join("; ")}. Barriers: ${p.barriers.join("; ")}. Show as: ${p.visual}.`;
}
