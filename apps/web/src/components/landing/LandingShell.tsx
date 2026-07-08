import { PaymentNetworkLogos } from "@/components/landing/PaymentNetworkLogos";

interface LandingShellProps {
  children: React.ReactNode;
}

export function LandingShell({ children }: LandingShellProps) {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">
          <div className="landing-logo">OP</div>
          <span className="landing-name">OnePOS</span>
        </div>
        <nav className="landing-nav" aria-label="Ana menü">
          <a href="#ozellikler" className="landing-nav-link">
            Özellikler
          </a>
          <a href="#nasil" className="landing-nav-link">
            Nasıl çalışır
          </a>
          <a href="#basvur" className="landing-nav-cta">
            Başvur
          </a>
        </nav>
      </header>

      {children}

      <footer className="landing-footer">
        <div className="landing-footer-brand-block">
          <div className="landing-logo landing-footer-logo">OP</div>
          <div>
            <span className="landing-footer-brand">OnePOS</span>
            <p className="landing-footer-tagline">Güvenli kart ödeme altyapısı</p>
          </div>
        </div>

        <PaymentNetworkLogos />

        <div className="landing-footer-meta">
          <span className="landing-footer-copy">© OnePOS</span>
          <span className="landing-footer-sep" aria-hidden>
            ·
          </span>
          <span className="landing-footer-badge">256-bit SSL</span>
          <span className="landing-footer-sep" aria-hidden>
            ·
          </span>
          <span className="landing-footer-badge">3D Secure</span>
        </div>
      </footer>
    </div>
  );
}
