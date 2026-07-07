import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const TRUST_ITEMS = [
  { icon: "lock" as const, label: "256-bit SSL", desc: "Uçtan uca şifreli iletişim" },
  { icon: "shield" as const, label: "3D Secure", desc: "Banka doğrulamalı kart ödemesi" },
  { icon: "card" as const, label: "PSP API", desc: "PayTR · Stripe · SumUp entegrasyonu" },
  { icon: "success" as const, label: "Anlık Onay", desc: "Webhook ile otomatik yatırım onayı" },
];

const FEATURES = [
  {
    title: "Güvenli Ödeme Altyapısı",
    desc: "Kredi kartı yatırımları için hazır POS katmanı. Müşteri tek arayüzde kalır; ödeme PSP API üzerinden işlenir.",
  },
  {
    title: "3D Secure & SSL",
    desc: "Banka 3D doğrulaması ve 256-bit SSL ile kart verisi korumalı kanallardan geçer. PCI uyumlu sağlayıcı altyapısı.",
  },
  {
    title: "Operasyon Paneli",
    desc: "Yatırım takibi, POS sağlayıcı yönetimi, komisyon ve raporlama — tek yönetim panelinde.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">
          <div className="landing-logo">OP</div>
          <span className="landing-name">OnePOS</span>
        </div>
        <Link href="/login" className="btn btn-primary landing-login">
          Panel Girişi
        </Link>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-tag">Güvenli Ödeme Altyapısı</p>
          <h1 className="landing-title">
            Kredi kartı POS altyapısı — güvenli, hızlı, entegre.
          </h1>
          <p className="landing-desc">
            OnePOS, kredi kartı yatırımları için uçtan uca ödeme altyapısı sunar. 3D Secure doğrulama,
            256-bit SSL şifreleme ve PSP webhook entegrasyonu ile işlemler otomatik onaylanır.
          </p>

          <div className="landing-trust">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="landing-trust-item">
                <span className="landing-trust-icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <div>
                  <div className="landing-trust-label">{item.label}</div>
                  <div className="landing-trust-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="landing-actions">
            <Link href="/login" className="btn btn-primary">
              Yönetim Paneli
            </Link>
            <Link href="/docs" className="btn btn-ghost">
              Entegrasyon Dokümantasyonu
            </Link>
          </div>
        </section>

        <section className="landing-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing-footer">
        <span>OnePOS — Güvenli Ödeme Altyapısı</span>
        <div className="landing-footer-badges">
          <span className="landing-footer-badge">
            <Icon name="lock" size={12} /> 256-bit SSL
          </span>
          <span className="landing-footer-badge">
            <Icon name="shield" size={12} /> 3D Secure
          </span>
        </div>
        <Link href="/docs" className="landing-footer-link">
          API Dokümantasyonu
        </Link>
      </footer>
    </div>
  );
}
