import { LandingShell } from "@/components/landing/LandingShell";
import { TelegramSupportCard } from "@/components/landing/TelegramSupportCard";

export const metadata = {
  title: "Destek — OnePOS",
  description: "OnePOS destek kanalları",
};

export default function SupportPage() {
  return (
    <LandingShell active="support">
      <main className="landing-main landing-main--narrow">
        <section className="landing-support-page">
          <p className="landing-support-kicker">Destek</p>
          <h1 className="landing-support-title">Özel Destek Altyapısı</h1>
          <p className="landing-support-lead">
            Kurumsal düzeyde iletişim kanalları aracılığıyla 7/24 özel yardım sağlıyoruz.
          </p>
          <TelegramSupportCard />
        </section>
      </main>
    </LandingShell>
  );
}
