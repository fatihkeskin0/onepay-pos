"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ADMIN_NAV, KASIYER_NAV, LS_KEYS, type NavItem } from "@onepara/shared";
import { API } from "@/lib/api";
import { PAGE_HREF, DEFAULT_PANEL_HREF } from "@/lib/nav";
import { NavIcon, roleLabel } from "@/components/NavIcon";
import { useClientSession } from "@/hooks/useClientSession";

function LogoIcon({ small }: { small?: boolean }) {
  return <div className={`logo-icon ${small ? "logo-icon-sm" : ""}`.trim()}>OP</div>;
}

function filterNav(items: NavItem[]): NavItem[] {
  if (process.env.NODE_ENV === "production") {
    return items.filter((item) => !item.devOnly);
  }
  return items;
}

function groupNav(items: NavItem[]): { section: string; items: NavItem[] }[] {
  const groups: { section: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }
  return groups;
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, role, username, isAdmin } = useClientSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!ready) return;
    if (!API.token()) {
      router.replace("/login");
    }
  }, [ready, router]);

  useEffect(() => {
    if (!ready || !role) return;
    const poll = async () => {
      try {
        if (isAdmin) {
          const data = await API.get<{ deposits: number; suspicious: number; online_kas: number; applications: number }>(
            "/admin/badges",
          );
          setBadges({
            "nav-badge-adm-dep": data.deposits,
            "nav-badge-supheli": data.suspicious,
            "nav-badge-online-kas": data.online_kas,
            "nav-badge-applications": data.applications,
          });
        } else {
          const data = await API.get<{ pending_deposits: number }>("/cashier/stats");
          setBadges({ "nav-badge-dep": data.pending_deposits });
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [role, ready, isAdmin]);

  const toggleTheme = async () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(LS_KEYS.theme, next);
    try {
      await API.post("/cashier/save_theme", { theme: next });
    } catch {
      /* ignore */
    }
  };

  const nav = filterNav(isAdmin ? ADMIN_NAV : KASIYER_NAV);
  const navGroups = useMemo(() => groupNav(nav), [nav]);

  if (!ready) {
    return (
      <div className="app app-loading">
        <p className="text-muted">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mobile-topbar">
        <button type="button" className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Menü">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <LogoIcon small />
        <span className="mobile-brand">OnePOS</span>
        <button type="button" className="sidebar-action-btn ml-auto" onClick={toggleTheme} aria-label="Tema">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <div className="app">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} id="sidebar">
          <div className="sidebar-header">
            <LogoIcon />
            <div className="sidebar-brand">
              <div className="logo-text">OnePOS</div>
              <div className="logo-sub">Kredi Kartı Panel</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navGroups.map((group) => (
              <div key={group.section} className="nav-group">
                <div className="nav-section">{group.section}</div>
                <div className="nav-group-items">
                  {group.items.map((item) => {
                    const href = PAGE_HREF[item.id] ?? DEFAULT_PANEL_HREF;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    const badgeCount = item.badge ? badges[item.badge] : 0;
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className={`nav-item ${active ? "active" : ""}`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <span className={`nav-icon-wrap ${active ? "active" : ""}`}>
                          <NavIcon id={item.id} active={active} />
                        </span>
                        <span className="nav-label">{item.label}</span>
                        {badgeCount > 0 && <span className="nav-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="avatar">{(username[0] ?? "?").toUpperCase()}</div>
              <div className="sidebar-user-info">
                <div className="user-name">{username}</div>
                <div className="user-role">{roleLabel(role)}</div>
              </div>
            </div>
            <div className="sidebar-actions">
              <button type="button" className="sidebar-action-btn" onClick={toggleTheme} title="Tema değiştir">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="sidebar-action-btn danger" onClick={() => API.logout()} title="Çıkış">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
        <main className="content" id="content-area">
          {children}
        </main>
      </div>
    </>
  );
}
