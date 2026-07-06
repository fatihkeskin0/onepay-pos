import Link from "next/link";

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
          <p className="landing-tag">Kredi Kartı Ödeme Altyapısı</p>
          <h1 className="landing-title">
            Site entegrasyonu, otomatik onay ve operasyon paneli — tek platformda.
          </h1>
          <p className="landing-desc">
            PayTR, Stripe ve SumUp desteği. PSP callback ile anında bakiye yansıtma. BetConstruct uyumlu
            callback formatı.
          </p>
          <div className="landing-actions">
            <Link href="/login" className="btn btn-primary">
              Yönetim Paneli
            </Link>
          </div>
        </section>

        <section className="landing-features">
          {[
            { title: "Otomatik Onay", desc: "PSP callback sonrası yatırım anında onaylanır." },
            { title: "Çoklu Sağlayıcı", desc: "PayTR ana kanal; Stripe ve SumUp yedek olarak yapılandırılabilir." },
            { title: "Operasyon Paneli", desc: "Yatırımlar, siteler, kasiyerler ve raporlar tek arayüzde." },
          ].map((f) => (
            <article key={f.title} className="landing-feature">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing-footer">
        <span>OnePOS — Kredi Kartı Yatırım Sistemi</span>
        <Link href="/docs" className="landing-footer-link">
          API Dokümantasyonu
        </Link>
      </footer>
    </div>
  );
}
