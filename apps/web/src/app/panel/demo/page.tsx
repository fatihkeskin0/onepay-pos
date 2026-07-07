"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface SiteOption {
  id: number;
  name: string;
  minDeposit: string;
  isActive: boolean;
}

interface DemoResult {
  token: string;
  url: string;
  pay_path: string;
  expires_at: string;
  amount_editable: boolean;
  site_name: string;
}

export default function DemoPage() {
  const { notify } = useToast();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState("");
  const [userId, setUserId] = useState("demo_user_001");
  const [userName, setUserName] = useState("Demo Müşteri");
  const [amount, setAmount] = useState("500");
  const [freeAmount, setFreeAmount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);

  const loadSites = useCallback(async () => {
    try {
      const data = await API.get<{ items: SiteOption[] }>("/admin/sites");
      const active = data.items.filter((s) => s.isActive);
      setSites(active);
      if (active.length > 0) {
        setSiteId((prev) => prev || String(active[0].id));
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Siteler yüklenemedi", "error");
    }
  }, [notify]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const startDemo = async (openTab: boolean) => {
    if (!siteId) {
      notify("Site seçin", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        site_id: Number(siteId),
        user_id: userId,
        name: userName,
        amount: freeAmount ? 0 : Number(amount) || 0,
      };
      const data = await API.post<DemoResult>("/admin/demo_payment_link", payload);
      setResult(data);
      notify("Demo ödeme oturumu oluşturuldu", "success");
      if (openTab) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Oturum oluşturulamadı", "error");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      notify("Link kopyalandı", "success");
    } catch {
      notify("Kopyalanamadı", "error");
    }
  };

  const selectedSite = sites.find((s) => String(s.id) === siteId);

  return (
    <>
      <PageHeader
        title="Ödeme Linki"
        subtitle="Gerçek API akışıyla test ödeme oturumu oluşturun"
      />

      <div className="demo-grid">
        <Card title="Demo oturumu oluştur">
          <p className="demo-hint">
            Seçilen site için gerçek API akışıyla ödeme linki üretilir. Aktif bir POS yöntemi gerekir (
            <Link href="/panel/pos">POS Ayarları</Link>).
          </p>

          <FormField label="Site">
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Site seçin</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (min {s.minDeposit} ₺)
                </option>
              ))}
            </Select>
          </FormField>

          <div className="form-row form-row-2">
            <FormField label="Müşteri ID">
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </FormField>
            <FormField label="Müşteri adı">
              <Input value={userName} onChange={(e) => setUserName(e.target.value)} />
            </FormField>
          </div>

          <div className="form-group">
            <label className="form-check demo-check">
              <input
                type="checkbox"
                checked={freeAmount}
                onChange={(e) => setFreeAmount(e.target.checked)}
              />
              Serbest tutar (müşteri ödeme sayfasında girer)
            </label>
          </div>

          {!freeAmount ? (
            <FormField label="Sabit tutar (₺)" hint={selectedSite ? `Min: ${selectedSite.minDeposit} ₺` : undefined}>
              <Input
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
          ) : null}

          <div className="demo-actions">
            <Button variant="primary" loading={loading} onClick={() => startDemo(true)}>
              Demo ödemeyi başlat
            </Button>
            <Button variant="secondary" loading={loading} onClick={() => startDemo(false)}>
              Sadece link oluştur
            </Button>
          </div>
        </Card>

        <Card title="Son oturum">
          {result ? (
            <div className="demo-result">
              <div className="demo-result-row">
                <span className="text-muted">Site</span>
                <strong>{result.site_name}</strong>
              </div>
              <div className="demo-result-row">
                <span className="text-muted">Token</span>
                <code className="cell-mono">{result.token.slice(0, 16)}…</code>
              </div>
              <div className="demo-result-row">
                <span className="text-muted">Tutar</span>
                <strong>{result.amount_editable ? "Serbest" : `${amount} ₺`}</strong>
              </div>
              <div className="demo-result-row">
                <span className="text-muted">Geçerlilik</span>
                <span>{new Date(result.expires_at).toLocaleString("tr-TR")}</span>
              </div>
              <div className="demo-link-box">
                <code>{result.url}</code>
              </div>
              <div className="demo-actions">
                <Button variant="primary" onClick={() => window.open(result.url, "_blank", "noopener,noreferrer")}>
                  Ödeme sayfasını aç
                </Button>
                <Button variant="ghost" onClick={copyLink}>
                  Linki kopyala
                </Button>
              </div>
            </div>
          ) : (
            <p className="demo-hint mb-0">Henüz demo oturumu oluşturulmadı.</p>
          )}
        </Card>
      </div>

      <Card title="Akış özeti" className="mt-4">
        <ol className="demo-steps">
          <li>Ödeme linki oluştur → müşteri ödeme sayfası açılır</li>
          <li>Tutar ve POS yöntemini seç → PSP ödeme ekranına yönlendirilir</li>
          <li>Ödeme tamamlanır → yatırım otomatik onaylanır</li>
          <li>Sonucu <Link href="/panel/deposit">Yatırımlar</Link> ekranından takip edin</li>
        </ol>
      </Card>
    </>
  );
}
