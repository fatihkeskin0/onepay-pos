import { SiMastercard, SiVisa } from "react-icons/si";

export function PaymentNetworkLogos() {
  return (
    <div className="landing-footer-networks" aria-label="Desteklenen kart ağları">
      <span className="landing-footer-network-logo" title="Visa">
        <SiVisa className="landing-footer-network-icon landing-footer-network-icon--visa" aria-hidden />
      </span>
      <span className="landing-footer-network-logo" title="Mastercard">
        <SiMastercard className="landing-footer-network-icon landing-footer-network-icon--mc" aria-hidden />
      </span>
    </div>
  );
}
