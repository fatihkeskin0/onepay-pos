"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type LogCategory = "auth" | "deposit" | "member" | "deposit_edit" | "psp";

interface LogItem {
  id: string;
  category: LogCategory;
  action: string;
  userId?: string;
  actor?: string;
  amount?: string;
  status?: string;
  detail?: string;
  ip?: string;
  createdAt: string;
}

const CATEGORIES: { id: "" | LogCategory; label: string }[] = [
  { id: "", label: "Tümü" },
  { id: "auth", label: "Giriş" },
  { id: "deposit", label: "Yatırım" },
  { id: "member", label: "Üye" },
  { id: "deposit_edit", label: "Düzenleme" },
  { id: "psp", label: "PSP" },
];

const CATEGORY_LABEL: Record<LogCategory, string> = {
  auth: "Giriş",
  deposit: "Yatırım",
  member: "Üye",
  deposit_edit: "Düzenleme",
  psp: "PSP",
};

const ACTION_LABEL: Record<string, string> = {
  login: "Giriş",
  logout: "Çıkış",
  created: "Oluşturuldu",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  cancelled: "İptal",
  amount_edit: "Tutar düzenleme",
  bet: "Bahis",
  win: "Kazanç",
  credit: "Kredi",
  debit: "Borç",
  rollback: "Geri alma",
  initiated: "Başlatıldı",
  processing: "İşleniyor",
  succeeded: "Başarılı",
  paid: "Ödendi",
  failed: "Başarısız",
  refunded: "İade",
};

function statusVariant(status?: string): "pending" | "approved" | "rejected" | "cancelled" | "gray" {
  if (!status) return "gray";
  if (status === "pending" || status === "initiated" || status === "processing") return "pending";
  if (status === "approved" || status === "paid" || status === "completed" || status === "succeeded") return "approved";
  if (status === "rejected" || status === "failed") return "rejected";
  if (status === "cancelled" || status === "refunded") return "cancelled";
  return "gray";
}

export default function LogsPage() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<"" | LogCategory>("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterKey, setFilterKey] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (category) params.set("category", category);
      if (userId.trim()) params.set("user_id", userId.trim());
      if (search.trim()) params.set("q", search.trim());

      const data = await API.get<{ items: LogItem[]; total: number }>(`/admin/logs?${params.toString()}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [category, page, search, userId]);

  useEffect(() => {
    load();
  }, [category, page, search, userId, filterKey, load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const applyFilters = () => {
    setPage(1);
    setFilterKey((k) => k + 1);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Loglar</div>
          <div className="page-sub">Giriş, yatırım, üye işlemleri ve PSP kayıtları</div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="logs-filters">
          <div className="logs-tabs">
            {CATEGORIES.map((c) => (
              <button
                key={c.id || "all"}
                type="button"
                className={`ftab ftab-all${category === c.id ? " active" : ""}`}
                onClick={() => {
                  setCategory(c.id);
                  setPage(1);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="logs-search-row">
            <Input
              placeholder="Kullanıcı ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="logs-input"
            />
            <Input
              placeholder="Ara (ref, kullanıcı, detay…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="logs-input logs-input-wide"
            />
            <Button type="button" variant="secondary" size="sm" onClick={applyFilters}>
              Filtrele
            </Button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Kategori</th>
              <th>İşlem</th>
              <th>Kullanıcı</th>
              <th>Tutar</th>
              <th>Detay</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString("tr-TR")}</td>
                  <td>{CATEGORY_LABEL[row.category]}</td>
                  <td>
                    <Badge variant={statusVariant(row.status ?? row.action)}>
                      {ACTION_LABEL[row.action] ?? row.action}
                    </Badge>
                  </td>
                  <td>{row.userId ?? row.actor ?? "—"}</td>
                  <td>{row.amount ? `₺${Number(row.amount).toLocaleString("tr-TR")}` : "—"}</td>
                  <td className="logs-detail">{row.detail ?? "—"}</td>
                  <td>{row.ip ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="logs-pagination">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Önceki
          </Button>
          <span className="logs-page-info">
            {page} / {totalPages} ({total} kayıt)
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </Button>
        </div>
      ) : null}
    </>
  );
}
