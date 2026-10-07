// NSOffice UI — the shared shell, ported from nsoffice_ui/templates/nsoffice/base.html.
// Keep the markup in step with base.html; styling lives in the kit's CSS, not here.
//
//   <Shell activeNav="hive">...page...</Shell>
//
// Props mirror base.html's page variables and blocks: activeNav, sidebarAdminOpen, sidebarExtra,
// recentChats, profileMenuExtra, topBarStart, topBar, children (= content).
import type { ReactNode } from "react";
import { nsoffice } from "./config";

const KIT = "/nsoffice-ui/static";

function ShellIcon({ name }: { name: string }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" {...stroke} className="sidebar-icon">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  if (name === "hive")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="sidebar-icon">
        <polygon points="9.5,2.2 11.4,3.3 11.4,5.5 9.5,6.6 7.6,5.5 7.6,3.3" fill="#64748b" />
        <polygon points="14.5,2.2 16.4,3.3 16.4,5.5 14.5,6.6 12.6,5.5 12.6,3.3" fill="#64748b" />
        <polygon points="7,7.2 8.9,8.3 8.9,10.5 7,11.6 5.1,10.5 5.1,8.3" fill="#64748b" />
        <polygon points="12,7.2 13.9,8.3 13.9,10.5 12,11.6 10.1,10.5 10.1,8.3" fill="#0f172a" />
        <polygon points="17,7.2 18.9,8.3 18.9,10.5 17,11.6 15.1,10.5 15.1,8.3" fill="#64748b" />
        <polygon points="9.5,12.2 11.4,13.3 11.4,15.5 9.5,16.6 7.6,15.5 7.6,13.3" fill="#64748b" />
        <polygon points="14.5,12.2 16.4,13.3 16.4,15.5 14.5,16.6 12.6,15.5 12.6,13.3" fill="#64748b" />
        <polygon points="12,17.2 13.9,18.3 13.9,20.5 12,21.6 10.1,20.5 10.1,18.3" fill="#64748b" />
      </svg>
    );
  if (name === "folder")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" {...stroke} className="sidebar-icon">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    );
  if (name === "plus")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" {...stroke} className="sidebar-icon">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  return name ? <i className={`${name} sidebar-icon`}></i> : null;
}

type ShellProps = {
  activeNav?: string;
  sidebarAdminOpen?: boolean;
  sidebarExtra?: ReactNode;
  recentChats?: ReactNode;
  profileMenuExtra?: ReactNode;
  /** Left side of the top bar: a page title chip (base.html top_bar_start). Labels only, no controls. */
  topBarStart?: ReactNode;
  /** Pages without the top bar (base.html hide_top_bar), like production's Hive and Connectors pages. */
  hideTopBar?: boolean;
  topBar?: ReactNode;
  children?: ReactNode;
};

export default function Shell({
  activeNav,
  sidebarAdminOpen = false,
  sidebarExtra,
  recentChats,
  profileMenuExtra,
  topBarStart,
  hideTopBar = false,
  topBar,
  children,
}: ShellProps) {
  const { brand, nav, user, admin_settings } = nsoffice;
  const chatsDisplay = sidebarAdminOpen ? "none" : "flex";

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-logo">
          <a href={brand.href} data-view={brand.view}>
            <img src={`${KIT}/img/nsoffice_logo.png`} alt={brand.alt} className="brand-logo-img" />
          </a>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              data-view={item.view}
              id={item.id}
              className={`nav-item-link ${activeNav && activeNav === item.key ? "active" : ""}`}
            >
              <ShellIcon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {sidebarExtra}

        {recentChats ?? (
          <>
            {/* Standard Recent Chats */}
            <div className="recent-chats-header" id="recentChatsHeader" style={{ display: chatsDisplay }}>
              <span>RECENT CHATS</span>
              <i className="fa-solid fa-chevron-down" style={{ fontSize: "0.75rem" }}></i>
            </div>
            <div className="recent-chats-list" id="recentChatsList" style={{ display: chatsDisplay }}>
              {nsoffice.recent_chats.map((chat, i) => (
                <a key={i} href={chat.href ?? "#"} className="recent-chat-item">
                  <i className={`${chat.icon} me-2`}></i> {chat.label}
                </a>
              ))}
              <a href="#" className="show-all-chats-link">
                {nsoffice.all_chats_label}
              </a>
            </div>
          </>
        )}

        {/* User block + profile menu */}
        <div className="sidebar-user">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="user-profile-icon">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <div className="user-info-stack">
            <div className="user-name">{user.name}</div>
            {user.role &&
              (user.role_href ? (
                <span className="admin-badge" data-href={user.role_href} data-view={user.role_view}
                  style={{ cursor: "pointer" }} title="Open Admin Panel">
                  {user.role}
                </span>
              ) : (
                <span className="admin-badge">{user.role}</span>
              ))}
          </div>

          <div className="profile-popover-menu" id="profileMenuPopover">
            <div className="popover-user-header">
              <div className="popover-user-name">{user.full_name}</div>
              <div className="popover-user-email">{user.email}</div>
            </div>
            <a href="#" className="popover-item">
              <i className="fa-regular fa-user text-muted"></i> Account
            </a>
            {admin_settings && (
              <div className="popover-tooltip-wrap">
                <a href={admin_settings.href} data-view={admin_settings.view} className="popover-item">
                  <i className="fa-shield-halved fa-solid text-primary"></i> Admin Settings
                </a>
                <div className="popover-tooltip-box">
                  Set access, configure models, connect tools, and monitor activity across your organisation.
                </div>
              </div>
            )}
            {profileMenuExtra}
            <a href="#" className="popover-item text-danger">
              <i className="fa-solid fa-right-from-bracket"></i> Sign out
            </a>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        {!hideTopBar && (
          <header className="top-bar">
            {topBarStart && <div className="top-bar-start">{topBarStart}</div>}
            {topBar ?? (
              <div className="top-pill">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>{nsoffice.credits}</span>
              </div>
            )}
          </header>
        )}

        {children}
      </main>
    </div>
  );
}
