"use client";

import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui/Badge";

export interface LogDetailItem {
  id: string;
  category: string;
  action: string;
  title: string;
  userId?: string;
  actor?: string;
  amount?: string;
  status?: string;
  detail?: string;
  ip?: string;
  target?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  auth: "Giriş",
  deposit: "Yatırım",
  member: "Üye",
  deposit_edit: "Düzenleme",
  psp: "PSP",
  admin: "Admin",
  cashier: "Agent",
  site: "Site",
  settings: "Ayarlar",
  security: "Güvenlik",
  proxy: "Proxy",
  pos: "POS",
};

const PAYLOAD_LABELS: Record<string, string> = {
  cashier_id: "Agent ID",
  username: "Kullanıcı adı",
  role: "Rol",
  commission_rate: "Komisyon",
  is_active: "Aktif",
  password_reset: "Şifre sıfırlandı",
  site_id: "Site ID",
  site_name: "Site adı",
  name: "Ad",
  keys: "Güncellenen anahtarlar",
  cidr: "CIDR",
  label: "Etiket",
  provider: "Sağlayıcı",
  enabled: "Etkin",
  deposit_id: "Yatırım ID",
  reference: "Referans",
  amount: "Tutar",
  old_amount: "Eski tutar",
  new_amount: "Yeni tutar",
  status: "Durum",
  reject_reason: "Red nedeni",
  imported: "İçe aktarılan",
  skipped: "Atlanan",
  count: "Adet",
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function flattenPayload(obj: Record<string, unknown>, prefix = ""): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    const label = PAYLOAD_LABELS[k] ?? k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      rows.push(...flattenPayload(v as Record<string, unknown>, fullKey));
    } else {
      rows.push({ key: fullKey, label, value: formatValue(v) });
    }
  }
  return rows;
}

interface LogDetailModalProps {
  open: boolean;
  item: LogDetailItem | null;
  onClose: () => void;
}

export function LogDetailModal({ open, item, onClose }: LogDetailModalProps) {
  const payloadRows = item?.payload ? flattenPayload(item.payload) : [];

  return (
    <Modal
      open={open}
      title="Log detayı"
      subtitle={item?.title}
      className="modal--minimal"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Kapat
        </button>
      }
    >
      {item ? (
        <div className="log-detail">
          <section className="log-detail-section">
            <h4 className="log-detail-heading">Özet</h4>
            <dl className="log-detail-dl">
              <dt>İşlem</dt>
              <dd>{item.title}</dd>
              <dt>Kategori</dt>
              <dd>
                <Badge variant="gray">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
              </dd>
              <dt>Aksiyon</dt>
              <dd><code>{item.action}</code></dd>
              <dt>Tarih</dt>
              <dd>{new Date(item.createdAt).toLocaleString("tr-TR")}</dd>
            </dl>
          </section>

          <section className="log-detail-section">
            <h4 className="log-detail-heading">Aktör</h4>
            <dl className="log-detail-dl">
              <dt>Kullanıcı</dt>
              <dd>{item.actor ?? "—"}</dd>
              <dt>Üye ID</dt>
              <dd>{item.userId ?? "—"}</dd>
              <dt>IP</dt>
              <dd>{item.ip ?? "—"}</dd>
              <dt>Hedef</dt>
              <dd>{item.target ?? "—"}</dd>
            </dl>
          </section>

          {item.detail ? (
            <section className="log-detail-section">
              <h4 className="log-detail-heading">Detay</h4>
              <p className="log-detail-text">{item.detail}</p>
            </section>
          ) : null}

          {payloadRows.length > 0 ? (
            <section className="log-detail-section">
              <h4 className="log-detail-heading">Payload</h4>
              <dl className="log-detail-dl">
                {payloadRows.map((row) => (
                  <div key={row.key} className="log-detail-payload-row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
