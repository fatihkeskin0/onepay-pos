import { Icon } from "@/components/ui/Icon";
import { ApplyForm } from "@/components/landing/ApplyForm";
import { LandingShell } from "@/components/landing/LandingShell";
import { LandingWave } from "@/components/landing/LandingWave";
import { TelegramSupportCard } from "@/components/landing/TelegramSupportCard";

const TRUST_ITEMS = [
  { icon: "lock" as const, label: "256-bit SSL", desc: "Uçtan uca şifreli veri aktarımı" },
  { icon: "shield" as const, label: "3D Secure", desc: "Banka doğrulamalı kart işlemleri" },
  { icon: "card" as const, label: "Visa · Mastercard", desc: "Yaygın kart ağları desteği" },
  { icon: "success" as const, label: "Anlık bildirim", desc: "Onay ve red saniyeler içinde" },
];

const FEATURES = [
  {
    icon: "card" as const,
    title: "Ödeme linki API",
    desc: "REST API ile saniyeler içinde tek kullanımlık ödeme sayfası oluşturun. Müşteriyi güvenli checkout'a yönlendirin.",
  },
  {
    icon: "shield" as const,
    title: "Güvenlik katmanları",
    desc: "3D Secure, SSL ve imzalı callback'ler. Kart verisi işletme sunucularınıza dokunmaz.",
  },
  {
    icon: "chart" as const,
    title: "Operasyon paneli",
    desc: "Yatırımlar, siteler ve raporlar tek panelde. Ekip için sade, hızlı arayüz.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "API ile link oluşturun",
    desc: "X-Api-Key ile create_payment_link çağrısı yapın; müşteriye ödeme URL'si dönün.",
  },
  {
    num: "02",
    title: "Müşteri ödemesini tamamlar",
    desc: "Kart sahibi 3D Secure ile doğrulanır; PSP webhook'u işlemi otomatik sonuçlandırır.",
  },
  {
    num: "03",
    title: "Callback ile sonucu alın",
    desc: "Onay veya red imzalı POST ile sitenize iletilir; panelden anlık takip edin.",
  },
];

export default function LandingPage() {
  return (
    <LandingShell>
      <div className="landing-flow">
        <section className="landing-band landing-band--hero">
          <div className="landing-band-inner">
            <div className="landing-hero">
              <div className="landing-hero-copy">
                <p className="landing-tag">Kredi kartı tahsilat platformu</p>
                <h1 className="landing-title">
                  İşletmeniz için
                  <span className="landing-title-accent"> hazır ödeme altyapısı.</span>
                </h1>
                <p className="landing-desc">
                  OnePOS ile müşterilerinizden kartla güvenli tahsilat alın. API entegrasyonu,
                  3D Secure checkout ve imzalı callback — ek altyapı kurmadan production&apos;a geçin.
                </p>

                <div className="landing-actions">
                  <a href="#basvur" className="btn btn-primary landing-btn-primary">
                    Başvuru yap
                  </a>
                </div>

                <div className="landing-pills">
                  <span className="landing-pill">
                    <Icon name="lock" size={14} /> PCI-ready flow
                  </span>
                  <span className="landing-pill">
                    <Icon name="shield" size={14} /> 3D Secure
                  </span>
                  <span className="landing-pill">
                    <Icon name="globe" size={14} /> REST API v1
                  </span>
                </div>
              </div>

              <div className="landing-hero-visual" aria-hidden>
                <div className="landing-hero-card-scene">
                  <div className="landing-hero-card-glow" />
                  <div className="landing-hero-card-wrap">
                    <article className="landing-hero-card">
                      <div className="landing-hero-card-top">
                        <span className="landing-hero-card-brand">OnePOS</span>
                        <span className="landing-hero-card-contactless" />
                      </div>
                      <span className="landing-hero-card-chip" />
                      <p className="landing-hero-card-number">4242 &nbsp;•••• &nbsp;•••• &nbsp;4242</p>
                      <div className="landing-hero-card-bottom">
                        <div className="landing-hero-card-meta">
                          <span className="landing-hero-card-label">Kart sahibi</span>
                          <span className="landing-hero-card-value">AYŞE YILMAZ</span>
                        </div>
                        <div className="landing-hero-card-meta">
                          <span className="landing-hero-card-label">SKT</span>
                          <span className="landing-hero-card-value">12/28</span>
                        </div>
                        <span className="landing-hero-card-network">VISA</span>
                      </div>
                      <span className="landing-hero-card-shine" />
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LandingWave variant="to-muted" />

        <section className="landing-band landing-band--muted">
          <div className="landing-band-inner">
            <div className="landing-trust" aria-label="Güvenlik özellikleri">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="landing-card landing-trust-item">
                  <span className="landing-card-icon">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <div>
                    <div className="landing-trust-label">{item.label}</div>
                    <div className="landing-trust-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingWave variant="to-default" />

        <section id="ozellikler" className="landing-band landing-band--default">
          <div className="landing-band-inner">
            <div className="landing-features">
              <div className="landing-section-head">
                <h2>Platform özellikleri</h2>
                <p>Entegrasyondan operasyona kadar ihtiyacınız olan her şey tek üründe.</p>
              </div>
              <div className="landing-features-grid">
                {FEATURES.map((f) => (
                  <article key={f.title} className="landing-card landing-feature">
                    <span className="landing-card-icon landing-card-icon--lg">
                      <Icon name={f.icon} size={20} />
                    </span>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <LandingWave variant="to-muted" />

        <section id="nasil" className="landing-band landing-band--muted">
          <div className="landing-band-inner">
            <div className="landing-steps">
              <div className="landing-section-head">
                <h2>Nasıl çalışır?</h2>
                <p>Üç adımda canlıya geçin — merchant backend&apos;inizden API çağrısı yeterli.</p>
              </div>
              <div className="landing-steps-grid">
                {STEPS.map((step) => (
                  <article key={step.num} className="landing-card landing-step">
                    <span className="landing-step-num">{step.num}</span>
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <LandingWave variant="to-default" />

        <section id="basvur" className="landing-band landing-band--default">
          <div className="landing-band-inner">
            <div className="landing-apply">
              <div className="landing-apply-copy">
                <p className="landing-apply-kicker">Merchant başvurusu</p>
                <h2>OnePOS&apos;a katılın</h2>
                <p>
                  Formu doldurun; başvurunuz yönetim paneline düşsün. Ekibimiz onboarding için
                  sizinle iletişime geçsin.
                </p>
                <ul className="landing-apply-list">
                  <li>API anahtarı ve test ortamı</li>
                  <li>PSP ve site ayarları</li>
                  <li>Operasyon paneli erişimi</li>
                </ul>
              </div>
              <div className="landing-card landing-apply-panel">
                <ApplyForm />
              </div>
            </div>
          </div>
        </section>

        <LandingWave variant="to-muted" />

        <section className="landing-band landing-band--muted landing-band--last">
          <div className="landing-band-inner">
            <div className="landing-support-section">
              <div className="landing-section-head landing-section-head--center">
                <h2>Destek</h2>
                <p>Kurumsal Telegram hattı üzerinden teknik ve operasyonel destek.</p>
              </div>
              <TelegramSupportCard />
            </div>
          </div>
        </section>
      </div>
    </LandingShell>
  );
}
