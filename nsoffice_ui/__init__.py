"""NSOffice UI kit — the shared NSOffice shell, design tokens and catalogue components for Flask apps.

    from nsoffice_ui import nsoffice_ui
    app.register_blueprint(nsoffice_ui)
    app.config["NSOFFICE_UI"] = {"credits": "1,000 NU", "user": {"name": "Sam"}}   # optional

Pages extend the shell:  {% extends "nsoffice/base.html" %}
Components:              {% from "nsoffice/macros.html" import page_header, hub_cards, catalog %}
See README.md for blocks, settings and examples.
"""
import copy

from flask import Blueprint, current_app

VERSION = "1.0.0"

nsoffice_ui = Blueprint(
    "nsoffice_ui",
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/nsoffice-ui/static",
)

# Shell settings. Override any of them with app.config["NSOFFICE_UI"] (nested dicts are merged).
DEFAULTS = {
    "title": "NSOffice.AI — System of Context",
    "brand": {"href": "/home", "view": "home", "alt": "NSOffice.AI by NETWORKSCIENCE"},
    "credits": "2,585.18 NU",
    "user": {
        "name": "Dhanashree",
        "full_name": "Dhanashree Gadhikar",
        "email": "dhanashree@networkscience.ai",
        "role": "Admin",
        "role_href": "/admin-settings/user-management",
        "role_view": "admin_users",
    },
    # Sidebar navigation. "key" is matched against the page's active_nav; "view" enables in-place
    # switching in single-page apps (see static/js/shell.js); "icon" is one of the shell icons.
    "nav": [
        {"key": "home", "id": "navHome", "label": "Home", "href": "/home", "view": "home", "icon": "home"},
        {"key": "hive", "id": "navHive", "label": "Hive", "href": "/hive", "view": "hive", "icon": "hive"},
        {"key": "projects", "id": "navProjects", "label": "Projects", "href": "#", "icon": "folder"},
        {"key": "new_chat", "label": "New Chat", "href": "/home", "view": "home", "icon": "plus"},
    ],
    "recent_chats": [
        {"icon": "fa-regular fa-envelope", "label": "See Folder Nga..."},
        {"icon": "fa-regular fa-comment", "label": "Brainstorm Ide..."},
        {"icon": "fa-regular fa-comment", "label": "Brainstorm Ide..."},
        {"icon": "fa-regular fa-envelope", "label": "Consolidate AI..."},
        {"icon": "fa-regular fa-comment", "label": "Summarize (2)"},
    ],
    "all_chats_label": "+ Show all chats (793)",
    "admin_settings": {"href": "/admin-settings/user-management", "view": "admin_users"},
}


def _merge(base, override):
    out = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


@nsoffice_ui.app_context_processor
def _inject_settings():
    return {
        "nsoffice": _merge(DEFAULTS, current_app.config.get("NSOFFICE_UI")),
        "nsoffice_version": VERSION,
    }
