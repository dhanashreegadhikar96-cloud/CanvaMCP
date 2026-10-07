// NSOffice UI — page components, ported from nsoffice_ui/templates/nsoffice/macros.html.
//
//   <PageHeader title backHref? backView? />
//   <HubCards cards={[{title, desc, icon (Font Awesome classes), color: "purple"|"blue", href?, view?}]} />
//   <Catalog sections|items hero? filters? searchPlaceholder? buttonLabel? banner? />
//   <Composer heading? prompts connectors placeholder? menu? />
//
// Differences from the Jinja macros, since server components can't take onclick strings:
// a catalogue item opens something only when it has an `href` (routed by the kit's shell.js via
// data-view/data-href). Items without one stay clickable but go nowhere.
// Item icons: a Lucide name ("palette"), "bee", or Font Awesome classes ("fa-solid fa-bolt").
// Item colours (icon tiles): purple, indigo, blue, teal, green, red, amber, slate.
// Search and filter pills are handled by the kit's catalog.js; the composer menu by composer.js.

export function PageHeader({
  title,
  backHref,
  backView,
  children,
}: {
  title: string;
  backHref?: string;
  backView?: string;
  /** Page-level controls on the right of the header (e.g. a .view-header-pill status). */
  children?: React.ReactNode;
}) {
  return (
    <div className="view-header">
      {backHref && (
        <a href={backHref} data-view={backView} className="back-btn">
          <i className="fa-solid fa-arrow-left"></i>
        </a>
      )}
      <span className="view-header-title">{title}</span>
      {children}
    </div>
  );
}

export type HubCard = { title: string; desc: string; icon: string; color?: "purple" | "blue"; href?: string; view?: string };

export function HubCards({ cards }: { cards: HubCard[] }) {
  return (
    <div className="hub-cards">
      {cards.map((card) => {
        const inner = (
          <>
            <div className={`hub-card-icon hub-card-icon--${card.color ?? "purple"}`}>
              <i className={card.icon}></i>
            </div>
            <div className="hub-card-title">{card.title}</div>
            <div className="hub-card-desc">{card.desc}</div>
          </>
        );
        return card.href ? (
          <a key={card.title} className="hub-card" href={card.href} data-view={card.view}>
            {inner}
          </a>
        ) : (
          <div key={card.title} className="hub-card" data-view={card.view}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function ItemIcon({ name }: { name: string }) {
  if (name === "bee")
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <ellipse cx="8" cy="8.5" rx="4" ry="2.6" fill="#94a3b8" transform="rotate(-35 8 8.5)" />
        <ellipse cx="16" cy="8.5" rx="4" ry="2.6" fill="#94a3b8" transform="rotate(35 16 8.5)" />
        <ellipse cx="12" cy="14" rx="4.2" ry="6" fill="#1e293b" />
        <path d="M8.2 12.6h7.6M8 15.6h8" stroke="#cbd5e1" strokeWidth="1.2" />
      </svg>
    );
  if (name.startsWith("fa-")) return <i className={name}></i>;
  return <i data-lucide={name}></i>;
}

export type BannerColumn = { icon: string; title?: string; text: string; accent?: string; text_after?: string };
export type Banner = { visual_icon?: string; columns: BannerColumn[] };

export function ContextBanner({ banner }: { banner: Banner }) {
  return (
    <div className="context-banner">
      <div className="context-banner-visual">
        <i className={banner.visual_icon ?? "fa-solid fa-layer-group"}></i>
      </div>
      {banner.columns.map((col, i) => (
        <div key={i} className={`context-banner-col${col.title ? "" : " context-banner-col-center"}`}>
          <i data-lucide={col.icon} className="context-banner-icon"></i>
          {col.title ? (
            <div>
              <div className="context-banner-title">{col.title}</div>
              <div className="context-banner-text">{col.text}</div>
            </div>
          ) : (
            <div className="context-banner-text">
              {col.text}
              {col.accent && (
                <>
                  {" "}
                  <span className="context-banner-accent">{col.accent}</span>
                </>
              )}
              {col.text_after ?? ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export type TileColor = "purple" | "indigo" | "blue" | "teal" | "green" | "red" | "amber" | "slate";
export type CatalogItem = { icon: string; title: string; desc: string; href?: string; color?: TileColor; category?: string };
export type CatalogSection = { category: string; title: string; groups: { name: string; items: CatalogItem[] }[] };
export type CatalogHero = { heading: string; accent?: string; subtext?: string; image?: string; image_alt?: string };

type CatalogProps = {
  sections?: CatalogSection[];
  /** Instead of sections: one flat grid; each item has its own category. */
  items?: CatalogItem[];
  hero?: CatalogHero;
  filters?: { category: string; label: string }[];
  /** null hides the search box */
  searchPlaceholder?: string | null;
  buttonLabel?: string;
  banner?: Banner;
};

export function Catalog({ sections = [], items, hero, filters, searchPlaceholder = "Search", buttonLabel = "Open", banner }: CatalogProps) {
  if (items) sections = [{ category: "", title: "", groups: [{ name: "", items }] }];
  return (
    <div className="catalog">
      {hero && (
        <div className="catalog-hero">
          <div className="catalog-hero-content">
            <h1 className="catalog-hero-heading">
              {hero.heading} {hero.accent && <span className="catalog-hero-accent">{hero.accent}</span>}
            </h1>
            {hero.subtext && <p className="catalog-hero-subtext">{hero.subtext}</p>}
          </div>
          {hero.image && <img src={hero.image} alt={hero.image_alt ?? ""} className="catalog-hero-visual" />}
        </div>
      )}

      {searchPlaceholder && (
        <div className="catalog-search">
          <i className="fa-solid fa-magnifying-glass catalog-search-icon"></i>
          <input type="text" className="catalog-search-input" placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
        </div>
      )}

      {filters && (
        <div className="catalog-pills">
          <button type="button" className="catalog-pill active" data-category="all">
            All
          </button>
          {filters.map((f) => (
            <button key={f.category} type="button" className="catalog-pill" data-category={f.category}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.category} className="catalog-section" data-category={section.category}>
          {section.title && <div className="catalog-section-title">{section.title}</div>}
          {section.groups.map((group, gi) => (
            <div key={gi} className="catalog-group">
              {group.name && <div className="catalog-group-title">{group.name}</div>}
              <div className="catalog-grid">
                {group.items.map((item) => (
                  <div
                    key={item.title}
                    className="catalog-card"
                    data-item={item.title}
                    data-category={item.category ?? section.category}
                    data-view={item.href ? "item" : undefined}
                    data-href={item.href}
                  >
                    <div className={`catalog-card-icon${item.color ? ` ns-tile ns-tile--${item.color}` : ""}`}>
                      <ItemIcon name={item.icon} />
                    </div>
                    <div className="catalog-card-title">{item.title}</div>
                    <div className="catalog-card-desc">{item.desc}</div>
                    <button type="button" className="catalog-card-btn">
                      {buttonLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {banner && <ContextBanner banner={banner} />}
    </div>
  );
}

export function BeeMark({ size = 34 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 22C14 22 5.5 17 5.5 11.2C5.5 7.8 8.2 5.5 11 5.5C12.6 5.5 13.5 6.3 14 7.2C14.5 6.3 15.4 5.5 17 5.5C19.8 5.5 22.5 7.8 22.5 11.2C22.5 17 14 22 14 22Z" fill="#A6B0F6" />
      <path d="M14 20.5C14 20.5 7 16.2 7 11.5C7 8.8 9 7 11 7C12.3 7 13.3 7.8 14 8.5C14.7 7.8 15.7 7 17 7C19 7 21 8.8 21 11.5C21 16.2 14 20.5 14 20.5Z" fill="#8391F2" opacity="0.35" />
      <path d="M12.5 6.5L10.5 3.5" stroke="#4E62ED" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 6.5L17.5 3.5" stroke="#4E62ED" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="7.8" r="2" fill="#4E62ED" />
      <path d="M11.5 10.2C11.5 9.5 12.3 9 14 9C15.7 9 16.5 9.5 16.5 10.2V16.8C16.5 18.5 15.2 19.8 14 19.8C12.8 19.8 11.5 18.5 11.5 16.8V10.2Z" fill="#4E62ED" />
      <rect x="8.5" y="12" width="11" height="1.8" rx="0.9" fill="#5467EE" />
      <rect x="9.5" y="14.3" width="9" height="1.8" rx="0.9" fill="#6072EF" />
      <rect x="10.8" y="16.6" width="6.4" height="1.8" rx="0.9" fill="#6678EF" />
    </svg>
  );
}

export type ComposerPrompt = { title: string; desc: string; prompt?: string };
export type ComposerConnector = { icon: string; title: string; label?: string; color?: TileColor; href?: string };
export type ComposerMenuItem = { label: string; icon: string; flyout?: "connectors"; href?: string };

const COMPOSER_MENU: ComposerMenuItem[] = [
  { label: "Models", icon: "cpu" },
  { label: "Connectors", icon: "plug", flyout: "connectors" },
  { label: "AI Tools", icon: "wand-sparkles" },
];

type ComposerProps = {
  heading?: string;
  prompts?: ComposerPrompt[];
  connectors?: ComposerConnector[];
  /** Say what to do now. */
  placeholder?: string;
  menu?: ComposerMenuItem[];
};

export function Composer({
  heading = "What would you like to work on today?",
  prompts = [],
  connectors = [],
  placeholder = "What are we working on today?",
  menu = COMPOSER_MENU,
}: ComposerProps) {
  return (
    <div className="composer">
      <div className="composer-welcome">
        <h1 className="composer-heading">{heading}</h1>
        {prompts.length > 0 && (
          <div className="composer-prompts">
            {prompts.map((p) => (
              <div key={p.title} className="composer-prompt" data-prompt={p.prompt ?? `${p.title}: ${p.desc}`}>
                <div className="composer-prompt-title">{p.title}</div>
                <div className="composer-prompt-desc">{p.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="composer-bar-area">
        <div className="composer-bar">
          <button type="button" className="composer-bee" title="Tools" aria-haspopup="true" aria-expanded="false">
            <BeeMark />
          </button>

          <div className="composer-menu">
            {menu.map((m) => (
              <button
                key={m.label}
                type="button"
                className="composer-menu-item"
                data-flyout={m.flyout ? `composer-flyout-${m.flyout}` : undefined}
                data-view={m.href ? "item" : undefined}
                data-href={m.href}
              >
                <span>
                  <i data-lucide={m.icon}></i> {m.label}
                </span>
                {!m.flyout && <i className="fa-solid fa-chevron-right composer-menu-chevron"></i>}
              </button>
            ))}
            {connectors.length > 0 && (
              <div className="composer-flyout" id="composer-flyout-connectors">
                {connectors.map((c) => (
                  <button
                    key={c.title}
                    type="button"
                    className="composer-chip"
                    data-view={c.href ? "item" : undefined}
                    data-href={c.href}
                  >
                    <span className={`ns-tile ns-tile--${c.color ?? "slate"}`}>
                      <ItemIcon name={c.icon} />
                    </span>
                    {c.label ?? c.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input type="text" className="composer-input" placeholder={placeholder} aria-label={placeholder} />

          <button type="button" className="composer-icon-btn" title="Attach a document">
            <i data-lucide="paperclip"></i>
          </button>
          <button type="button" className="composer-icon-btn" title="Voice input">
            <i data-lucide="mic"></i>
          </button>
          <button type="button" className="composer-send" title="Send">
            <i data-lucide="send"></i>
          </button>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}

/** "NS◐Office.AI is an AI and can make mistakes…" under an ask bar (macros.html: disclaimer). */
export function Disclaimer() {
  return (
    <div className="composer-disclaimer">
      <span className="ns-logo-inline">
        NS
        <svg xmlns="http://www.w3.org/2000/svg" width="44" height="14" viewBox="0 0 44 14" aria-hidden="true">
          <rect x="0" y="0.5" width="44" height="13" rx="6.5" fill="#2d3748" />
          <circle cx="36" cy="7" r="4" fill="#ffffff" />
        </svg>
        Office.AI
      </span>
      <span>is an AI and can make mistakes. Check important info.</span>
    </div>
  );
}

/** Title chip for an assistant page, shown at the left of the top bar (Shell topBarStart). */
export function AssistantChip({ icon, label, color = "purple" }: { icon: string; label: string; color?: TileColor }) {
  return (
    <span className={`assistant-chip ns-tile ns-tile--${color}`}>
      <i className={icon}></i>
      {label}
    </span>
  );
}
