import { Icon } from "@/components/ui/Icon";

export const metadata = {
  title: "Güvenli Ödeme",
  description: "Kredi kartı ile güvenli ödeme",
};

export default function PaymentHomePage() {
  return (
    <div className="pay-page">
      <div className="pay-shell">
        <div className="pay-card payment-home-card">
          <div className="pay-card-header">
            <div className="pay-brand">
              <div className="pay-brand-mark" aria-hidden>
                <Icon name="lock" />
              </div>
              <div>
                <div className="pay-brand-name">Güvenli Ödeme</div>
                <div className="pay-brand-sub">256-bit SSL · 3D Secure</div>
              </div>
            </div>
          </div>
          <div className="pay-card-body payment-home-body">
            <p className="payment-home-title">Ödeme sayfasına hoş geldiniz</p>
            <p className="payment-home-desc">
              Bu adrese doğrudan giriş yapılamaz. Size iletilen kişisel ödeme linki ile devam edin.
            </p>
            <ul className="payment-home-list">
              <li>Link e-posta, SMS veya site üzerinden size gönderilir</li>
              <li>Her oturum tek kullanımlıktır ve süre sınırlıdır</li>
              <li>Kart bilgileriniz PSP altyapısında işlenir</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
