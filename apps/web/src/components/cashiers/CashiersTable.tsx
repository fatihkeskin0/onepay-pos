"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CashierRow } from "./CashierFormModal";

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "—";
  }
}

interface CashiersTableProps {
  items: CashierRow[];
  loading: boolean;
  onEdit: (row: CashierRow) => void;
  onToggle: (row: CashierRow) => void;
  onReset: (row: CashierRow) => void;
  onForceLogout: (row: CashierRow) => void;
}

export function CashiersTable({
  items,
  loading,
  onEdit,
  onToggle,
  onReset,
  onForceLogout,
}: CashiersTableProps) {
  if (loading) {
    return <div className="cashiers-loading">Yükleniyor…</div>;
  }

  if (items.length === 0) {
    return <div className="cashiers-empty">Kayıtlı agent bulunamadı.</div>;
  }

  return (
    <div className="cashiers-table-wrap">
      <table className="cashiers-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Rol</th>
            <th>Komisyon</th>
            <th>2FA</th>
            <th>Son giriş</th>
            <th>Durum</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="cashiers-agent-cell">
                  <span className="cashiers-agent-avatar">{initials(row.username)}</span>
                  <span className="cashiers-agent-name">{row.username}</span>
                </div>
              </td>
              <td>
                <Badge variant={row.role === "admin" ? "blue" : "gray"}>{row.role}</Badge>
              </td>
              <td>%{row.commissionRate}</td>
              <td>
                <Badge variant={row.totpEnabled ? "approved" : "pending"}>
                  {row.totpEnabled ? "Aktif" : "Kapalı"}
                </Badge>
              </td>
              <td>{formatDate(row.lastLogin)}</td>
              <td>
                <div className="cashiers-status-cell">
                  {row.online ? <span className="cashiers-online-dot" title="Çevrimiçi" /> : null}
                  <Badge variant={row.isActive ? "approved" : "cancelled"}>
                    {row.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              </td>
              <td>
                <div className="cashiers-actions">
                  <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row)}>
                    Düzenle
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onToggle(row)}>
                    {row.isActive ? "Pasif" : "Aktif"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onReset(row)}>
                    Şifre
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onForceLogout(row)}>
                    Çıkış
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
