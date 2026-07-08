import Link from "next/link";
import { resolvePanelDashboardHref } from "@/lib/public-urls";

interface LandingShellProps {
  children: React.ReactNode;
}

export function LandingShell({ children }: LandingShellProps) {
  const dashboardHref = resolvePanelDashboardHref();

  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <div className="landing-logo">OP</div>
          <span className="landing-name">OnePOS</span>
        </Link>
        <nav className="landing-nav" aria-label="Ana menü">
          <a href={dashboardHref} className="landing-nav-cta">
            Dashboard
          </a>
        </nav>
      </header>

      {children}

      <footer className="landing-footer">
        <span className="landing-footer-brand">OnePOS</span>
        <div className="landing-footer-links">
          <a href={dashboardHref}>Dashboard</a>
          <Link href="/#basvur">Başvuru</Link>
        </div>
        <span className="landing-footer-copy">Güvenli ödeme altyapısı</span>
      </footer>
    </div>
  );
}
