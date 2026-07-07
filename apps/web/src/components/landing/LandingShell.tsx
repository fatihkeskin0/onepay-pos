import Link from "next/link";

interface LandingShellProps {
  children: React.ReactNode;
  active?: "home" | "support";
}

export function LandingShell({ children, active = "home" }: LandingShellProps) {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          <div className="landing-logo">OP</div>
          <span className="landing-name">OnePOS</span>
        </Link>
        <nav className="landing-nav" aria-label="Ana menü">
          <Link href="/" className={`landing-nav-link ${active === "home" ? "landing-nav-link--active" : ""}`.trim()}>
            Ana Sayfa
          </Link>
          <Link
            href="/support"
            className={`landing-nav-link ${active === "support" ? "landing-nav-link--active" : ""}`.trim()}
          >
            Destek
          </Link>
        </nav>
      </header>

      {children}

      <footer className="landing-footer">
        <span className="landing-footer-brand">OnePOS</span>
        <div className="landing-footer-links">
          <Link href="/support">Destek</Link>
          <Link href="/#basvur">Başvuru</Link>
        </div>
        <span className="landing-footer-copy">Güvenli ödeme altyapısı</span>
      </footer>
    </div>
  );
}
