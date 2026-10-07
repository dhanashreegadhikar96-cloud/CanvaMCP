// NSOffice shell settings: the kit's DEFAULTS (nsoffice_ui/__init__.py) plus this app's overrides.
// Same shape as app.config["NSOFFICE_UI"] in a Flask app; only set what differs in APP_SETTINGS.

export type NavItem = { key: string; label: string; href: string; view?: string; id?: string; icon: string };
export type RecentChat = { icon: string; label: string; href?: string };

export type NsofficeSettings = {
  title: string;
  brand: { href: string; view?: string; alt: string };
  credits: string;
  user: { name: string; full_name: string; email: string; role?: string; role_href?: string | null; role_view?: string };
  nav: NavItem[];
  recent_chats: RecentChat[];
  all_chats_label: string;
  admin_settings: { href: string; view?: string } | null;
};

const DEFAULTS: NsofficeSettings = {
  title: "NSOffice.AI — System of Context",
  brand: { href: "/home", view: "home", alt: "NSOffice.AI by NETWORKSCIENCE" },
  credits: "2,585.18 NU",
  user: {
    name: "Dhanashree",
    full_name: "Dhanashree Gadhikar",
    email: "dhanashree@networkscience.ai",
    role: "Admin",
    role_href: "/admin-settings/user-management",
    role_view: "admin_users",
  },
  nav: [
    { key: "home", id: "navHome", label: "Home", href: "/home", view: "home", icon: "home" },
    { key: "hive", id: "navHive", label: "Hive", href: "/hive", view: "hive", icon: "hive" },
    { key: "projects", id: "navProjects", label: "Projects", href: "#", icon: "folder" },
    { key: "new_chat", label: "New Chat", href: "/home", view: "home", icon: "plus" },
  ],
  recent_chats: [
    { icon: "fa-regular fa-envelope", label: "See Folder Nga..." },
    { icon: "fa-regular fa-comment", label: "Brainstorm Ide..." },
    { icon: "fa-regular fa-comment", label: "Brainstorm Ide..." },
    { icon: "fa-regular fa-envelope", label: "Consolidate AI..." },
    { icon: "fa-regular fa-comment", label: "Summarize (2)" },
  ],
  all_chats_label: "+ Show all chats (793)",
  admin_settings: { href: "/admin-settings/user-management", view: "admin_users" },
};

// This app: a Canva connector with no admin area.
const APP_SETTINGS: Partial<NsofficeSettings> = {
  title: "Canva — NSOffice.AI",
  admin_settings: null,
  user: { ...DEFAULTS.user, role_href: null },
};

export const nsoffice: NsofficeSettings = { ...DEFAULTS, ...APP_SETTINGS };
