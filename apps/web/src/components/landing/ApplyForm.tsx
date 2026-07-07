"use client";

import { useState } from "react";
import { PublicAPI } from "@/lib/public-api";
import { Button } from "@/components/ui/Button";

export function ApplyForm() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await PublicAPI.submitApplication({
        company_name: companyName,
        contact_name: contactName,
        email,
        phone,
        message: message || undefined,
      });
      setSuccess(true);
      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru gönderilemedi");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="landing-apply-success">
        <div className="landing-apply-success-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3>Başvurunuz alındı</h3>
        <p>Ekibimiz en kısa sürede sizinle iletişime geçecek.</p>
        <button type="button" className="btn btn-ghost landing-apply-reset" onClick={() => setSuccess(false)}>
          Yeni başvuru gönder
        </button>
      </div>
    );
  }

  return (
    <form className="landing-apply-form" onSubmit={handleSubmit} noValidate>
      {error ? (
        <div className="landing-apply-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="landing-apply-grid">
        <div className="landing-apply-field">
          <label htmlFor="apply-company">Şirket / Marka adı</label>
          <input
            id="apply-company"
            className="landing-apply-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="landing-apply-field">
          <label htmlFor="apply-contact">Yetkili adı</label>
          <input
            id="apply-contact"
            className="landing-apply-input"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="landing-apply-field">
          <label htmlFor="apply-email">E-posta</label>
          <input
            id="apply-email"
            type="email"
            className="landing-apply-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={loading}
          />
        </div>
        <div className="landing-apply-field">
          <label htmlFor="apply-phone">Telefon</label>
          <input
            id="apply-phone"
            type="tel"
            className="landing-apply-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="landing-apply-field">
        <label htmlFor="apply-message">Mesajınız (opsiyonel)</label>
        <textarea
          id="apply-message"
          className="landing-apply-textarea"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
        />
      </div>

      <Button type="submit" variant="primary" loading={loading} className="landing-apply-submit">
        Başvuruyu gönder
      </Button>
    </form>
  );
}
