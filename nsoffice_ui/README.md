# NSOffice UI kit

The NSOffice look in one folder: the shell (sidebar, top bar with the NU credit pill, profile menu),
design tokens, and page components (page header, hub cards, catalogue). AuditBeeNSOffice runs on it,
so any change here is a change to the real app, and the kit can't drift out of date.

```
nsoffice_ui/
├── __init__.py              Flask blueprint + shell settings (DEFAULTS)
├── templates/nsoffice/
│   ├── base.html            the shell — every page extends it
│   └── macros.html          page_header, hub_cards, catalog, composer, context_banner, item_icon
├── static/
│   ├── css/tokens.css       every colour, font, shadow as a variable (--ns-primary, --ns-text, …)
│   ├── css/shell.css        sidebar, top bar, profile menu, page views, page header
│   ├── css/components.css   toast, hub cards, catalogue, context banner
│   ├── js/shell.js          profile menu, data-view navigation, Lucide icons
│   ├── js/catalog.js        catalogue search + filter pills
│   ├── js/composer.js       home composer: bee tools menu, connector flyout, prompt cards
│   └── img/nsoffice_logo.png
└── example/                 a complete small app (Hive → Connectors → Canva) to copy from
```

## Start a new app

1. Copy the `nsoffice_ui/` folder into the new project (next to your `app.py`).
2. Register it:

   ```python
   from flask import Flask
   from nsoffice_ui import nsoffice_ui

   app = Flask(__name__)
   app.register_blueprint(nsoffice_ui)
   app.config["NSOFFICE_UI"] = {"credits": "1,200 NU"}   # optional, see Settings
   ```

3. Write pages that extend the shell:

   ```jinja
   {% extends "nsoffice/base.html" %}
   {% from "nsoffice/macros.html" import page_header, catalog %}
   {% set active_nav = 'hive' %}

   {% block content %}
   <section class="page-view catalog-page active-view">
       {{ page_header('Connectors', back_href='/hive') }}
       {{ catalog(sections, filters=filters, search_placeholder='Find a connector',
                  on_open='openConnector', button_label='Connect') }}
   </section>
   {% endblock %}
   ```

To see it running: `python nsoffice_ui/example/app.py` and open http://localhost:5055.

## Shell blocks and page variables

| Name | What it is |
|---|---|
| `active_nav` (variable) | key of the highlighted sidebar item: `home`, `hive`, `projects` |
| `sidebar_admin_open` (variable) | true hides Recent Chats (while an admin section is showing) |
| `title`, `head` | `<title>`; extra `<head>` tags (your app's CSS/JS, loaded after the kit) |
| `sidebar_extra` | between the nav and Recent Chats (e.g. an admin section) |
| `recent_chats` | replace the Recent Chats list |
| `profile_menu_extra` | extra profile-menu items above "Sign out" |
| `top_bar` | top-bar contents (default: the NU credit pill) |
| `content` | the page, inside `<main>` |
| `body_end` | after the layout: modals, toasts, page scripts |

Each page goes in `<section class="page-view active-view">`. Add `catalog-page` for a catalogue
(sticky header, larger title).

## Settings (`app.config["NSOFFICE_UI"]`)

Merged over `DEFAULTS` in `__init__.py`; nested dicts merge, so you only set what changes.

| Key | Default |
|---|---|
| `title` | `NSOffice.AI — System of Context` |
| `credits` | `2,585.18 NU` |
| `user` | `name`, `full_name`, `email`, `role` (badge), `role_href` (`None` = plain label) |
| `nav` | Home, Hive, Projects, New Chat — each `{key, label, href, view?, id?, icon}` |
| `recent_chats`, `all_chats_label` | sample chats |
| `admin_settings` | `{href, view}` for the profile-menu item; `None` hides it |
| `brand` | logo link `{href, view, alt}` |

## Components (`nsoffice/macros.html`)

- **`page_header(title, back_href=None, back_view=None)`**: the "← Title" row.
- **`hub_cards(cards)`**: big entry cards like Hive's Bees / Connectors.
  `cards = [{title, desc, icon: 'fa-solid fa-bolt', color: 'purple'|'blue', href?, view?}]`
- **`catalog(sections, hero=None, filters=None, search_placeholder, on_open, button_label, banner=None)`**:
  hero, search, filter pills, grouped card grid, optional context banner. Search and pills work automatically.
  ```python
  sections = [{"category": "design", "title": "Design", "groups": [
      {"name": "", "items": [{"icon": "palette", "title": "Canva", "desc": "…"}]}]}]
  ```
  `on_open` names a JS function called with the card title when a card is clicked; an item with an
  `href` opens that page instead (items with neither are clickable but go nowhere).
  Item icons: a [Lucide](https://lucide.dev/icons) name, `"bee"`, or Font Awesome classes.
  - **Flat grid** (Hive → Connectors): pass `items=[…]` instead of `sections`, each item with its own
    `category`; the pills filter card by card. `search_placeholder=None` hides the search box.
  - **Icon tiles**: an item `color` (`purple`, `indigo`, `blue`, `teal`, `green`, `red`, `amber`, `slate`)
    puts its icon on a tinted tile (`.ns-tile.ns-tile--<color>`, colours in `tokens.css`).
  ```jinja
  {{ catalog(items=connectors, filters=filters, search_placeholder=None, button_label='Use') }}
  ```
- **`composer(heading, prompts, connectors, placeholder, menu=None)`**: the home page: heading, prompt
  cards, and the ask bar whose bee button opens Models / Connectors / AI Tools. Connectors shows a flyout
  of `connectors` chips (`{icon, title, label?, color?, href?}`). Clicking a prompt card puts it in the ask bar.
  Behaviour is in `static/js/composer.js`. Enter or the send button fires a `composer:send` event
  (`event.detail.text`) from the `.composer`; the app decides where the message goes.
- **Chat page** (CSS only, `components.css`): `<section class="page-view chat-page active-view">` with the
  page header, a `.chat-thread` (`.chat-thread-inner` → `.chat-row` / `.chat-row--user` with
  `.chat-bubble--user` or `.chat-avatar` + `.chat-bubble--assistant`), tool steps (`.chat-step` +
  `--running` / `--done` / `--error`), `.chat-typing` dots, a `.chat-empty` start screen, and the ask bar
  in `.chat-bar-area` using the composer's `.composer-bar` / `.composer-input` / `.composer-send`
  (outside a `.composer`, so composer.js leaves it to the page's own code). `.view-header-pill` puts a
  status button in the page header.

## Navigation

Shell links carry `data-view`. In a normal multi-page app they're plain links. In a single-page app
that defines `window.navigateTo(url, view, event)` (like AuditBeeNSOffice), `shell.js` routes them
through it so views switch in place.

## Theming

Change colours in `static/css/tokens.css`, or override tokens in your own stylesheet:

```css
:root { --ns-primary: #0f766e; --ns-primary-hover: #115e59; }
```

## Rules

- The shell is shared chrome: don't put page-specific buttons, run progress or tool controls in the
  sidebar or top bar. Put them in the page.
- Keep Home, Hive, Projects, New Chat and Recent Chats in the sidebar. Apps change where navigation
  *starts*, not what the shell contains.
- New colours go in `tokens.css` as a named variable, not as a hex code in a component.
- Fix shell or component styling here, not in an app's own CSS, so every app gets the fix.
