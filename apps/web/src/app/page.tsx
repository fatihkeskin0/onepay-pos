import { Icon } from "@/components/ui/Icon";
import { ApplyForm } from "@/components/landing/ApplyForm";
import { LandingShell } from "@/components/landing/LandingShell";
import { TelegramSupportCard } from "@/components/landing/TelegramSupportCard";

const TRUST_ITEMS = [
  { icon: "lock" as const, label: "256-bit SSL", desc: "Tüm veri trafiği şifrelenir" },
  { icon: "shield" as const, label: "3D Secure", desc: "Banka onaylı kart doğrulama" },
  { icon: "card" as const, label: "Kredi & Banka Kartı", desc: "Visa, Mastercard ve Troy" },
  { icon: "success" as const, label: "Anlık Sonuç", desc: "Onay ve red bildirimi saniyeler içinde" },
];

const FEATURES = [
  {
    icon: "card" as const,
    title: "Tek tıkla ödeme sayfası",
    desc: "Müşterinize özel güvenli link gönderin. Kart bilgileri yalnızca şifreli kanallardan iletilir.",
  },
  {
    icon: "shield" as const,
    title: "Uçtan uca koruma",
    desc: "3D Secure, SSL ve PCI uyumlu altyapı ile kart verisi üçüncü taraflarla paylaşılmaz.",
  },
  {
    icon: "chart" as const,
    title: "Tüm ödemeler tek panelde",
    desc: "Günlük hacim, durum ve raporları tek ekrandan takip edin. Sade, hızlı operasyon.",
  },
];

const STEPS = [
  { num: "01", title: "Link oluşturun", desc: "Tutar ve müşteri bilgisiyle saniyeler içinde ödeme linki üretin." },
  { num: "02", title: "Müşteri öder", desc: "Kart sahibi 3D Secure ile doğrulama yapar; işlem şifreli bağlantı üzerinden tamamlanır." },
  { num: "03", title: "Sonucu alın", desc: "Onay veya red anında panelinize düşer; ekstra manuel kontrol gerekmez." },
];

export default function LandingPage() {
  return (
    <LandingShell active="home">
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-tag">Güvenli kart tahsilatı</p>
            <h1 className="landing-title">
              Kredi kartı ile
              <span className="landing-title-accent"> güvenle ödeme alın.</span>
            </h1>
            <p className="landing-desc">
              OnePOS, işletmeniz için hazır ödeme altyapısı sunar. Müşteriniz kartını girer,
              banka 3D Secure ile onaylar; siz sonucu anında görürsünüz. Şifreleme ve güvenlik
              standartları dahili — ek kurulum gerektirmez.
            </p>

            <div className="landing-pills">
              <span className="landing-pill">
                <Icon name="lock" size={14} /> SSL şifreleme
              </span>
              <span className="landing-pill">
                <Icon name="shield" size={14} /> 3D Secure
              </span>
              <span className="landing-pill">
                <Icon name="card" size={14} /> Kart ödemesi
              </span>
            </div>
          </div>

          <div className="landing-hero-visual" aria-hidden>
            <div className="landing-mock-card">
              <div className="landing-mock-chip" />
              <div className="landing-mock-lines">
                <span />
                <span />
              </div>
              <div className="landing-mock-footer">
                <span>•••• 4242</span>
                <span>12/28</span>
              </div>
            </div>
            <div className="landing-mock-badge">
              <Icon name="shield" size={16} />
              Güvenli ödeme
            </div>
          </div>
        </section>

        <section className="landing-trust" aria-label="Güvenlik özellikleri">
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
        </section>

        <section className="landing-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature">
              <span className="landing-feature-icon">
                <Icon name={f.icon} size={20} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </section>

        <section className="landing-steps">
          <h2 className="landing-steps-title">Nasıl çalışır?</h2>
          <div className="landing-steps-grid">
            {STEPS.map((step) => (
              <article key={step.num} className="landing-step">
                <span className="landing-step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="basvur" className="landing-apply">
          <div className="landing-apply-copy">
            <p className="landing-apply-kicker">Hemen Başvur</p>
            <h2>OnePOS altyapısına katılın</h2>
            <p>
              Formu doldurun; başvurunuz yönetim paneline düşsün. Ekibimiz sizinle iletişime geçerek
              onboarding sürecini başlatsın.
            </p>
          </div>
          <div className="landing-apply-panel">
            <ApplyForm />
          </div>
        </section>

        <section className="landing-support-preview">
          <div className="landing-support-preview-copy">
            <h2>Özel Destek Altyapısı</h2>
            <p>Kurumsal düzeyde iletişim kanalları aracılığıyla 7/24 özel yardım sağlıyoruz.</p>
          </div>
          <TelegramSupportCard />
        </section>
      </main>
    </LandingShell>
  );
}
