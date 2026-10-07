import type { CatalogItem, ComposerConnector } from "@/nsoffice/macros";

// Every connector, as shown in Hive -> Connectors (cards) and the home composer's Connectors flyout (chips).
// Only items with an href open something; the rest are listed but not built in this app yet.
type Connector = CatalogItem & { label?: string };

export const CONNECTORS: Connector[] = [
  { title: "Canva", icon: "palette", color: "purple", category: "documents", href: "/connector/canva",
    desc: "Create, find and export Canva designs" },
  { title: "Outlook", icon: "mail", color: "blue", category: "communications",
    desc: "Manage Outlook emails and calendar" },
  { title: "Microsoft Teams", label: "Teams", icon: "users", color: "indigo", category: "communications",
    desc: "Connect Teams for messaging & collaboration" },
  { title: "SharePoint", icon: "folder-open", color: "teal", category: "documents",
    desc: "Access SharePoint documents and sites" },
  { title: "OneDrive", icon: "hard-drive", color: "blue", category: "documents",
    desc: "Sync and manage OneDrive files" },
  { title: "HubSpot", icon: "building-2", color: "blue", category: "business",
    desc: "Work with HubSpot contacts, deals and companies" },
  { title: "Oracle", icon: "database", color: "red", category: "business",
    desc: "Connect Oracle database" },
  { title: "MSSQL", icon: "database", color: "red", category: "business",
    desc: "Connect SQL Server / Azure SQL database" },
  { title: "MySQL", icon: "database", color: "teal", category: "business",
    desc: "Connect MySQL database" },
  { title: "Xero", icon: "dollar-sign", color: "teal", category: "business",
    desc: "Read invoices, bills and accounts from Xero" },
  { title: "ClickHouse", icon: "database", color: "amber", category: "business",
    desc: "Query ClickHouse analytics tables" },
  { title: "ERPNext", label: "ERP", icon: "briefcase-business", color: "green", category: "business",
    desc: "Connect ERPNext ERP for business data" },
  { title: "Zoho Desk", icon: "spline", color: "green", category: "business",
    desc: "Manage support tickets and helpdesk" },
  { title: "Zoho Sprints", icon: "pen-tool", color: "green", category: "business",
    desc: "Manage agile sprints and project items" },
  { title: "Zoho Analytics", icon: "chart-column", color: "green", category: "business",
    desc: "Query workspaces, reports, and dashboards" },
  { title: "Tally Prime", icon: "receipt", color: "slate", category: "business",
    desc: "Read ledgers and vouchers from Tally Prime" },
  { title: "Outline", icon: "book-open", color: "indigo", category: "documents",
    desc: "Search and read your Outline wiki" },
];

export const CONNECTOR_FILTERS = [
  { category: "communications", label: "Communications" },
  { category: "documents", label: "Document Management" },
  { category: "business", label: "Business Application" },
];

export const COMPOSER_CONNECTORS: ComposerConnector[] = CONNECTORS.map(({ title, label, icon, color, href }) => ({
  title,
  label,
  icon,
  color,
  href,
}));
