"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LogDetailModal, type LogDetailItem } from "@/components/logs/LogDetailModal";

type LogCategory =
  | ""
  | "auth"
  | "deposit"
  | "member"
  | "deposit_edit"
  | "psp"
  | "admin"
  | "security"
  | "proxy"
  | "pos";

const CATEGORIES: { id: LogCategory; label: string }[] = [
  { id: "", label: "Tümü" },
  { id: "auth", label: "Giriş" },
  { id: "deposit", label: "Yatırım" },
  { id: "member", label: "Üye" },
  { id: "psp", label: "PSP" },
  { id: "admin", label: "Admin" },
  { id: "security", label: "Güvenlik" },
  { id: "proxy", label: "Proxy" },
  { id: "pos", label: "POS" },
];

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

export default function LogsPage() {
  const [items, setItems] = useState<LogDetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<LogCategory>("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterKey, setFilterKey] = useState(0);
  const [detailItem, setDetailItem] = useState<LogDetailItem | null>(null);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (category) params.set("category", category);
      if (userId.trim()) params.set("user_id", userId.trim());
      if (search.trim()) params.set("q", search.trim());

      const data = await API.get<{ items: LogDetailItem[]; total: number }>(`/admin/logs?${params.toString()}`);
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
          <div className="page-sub">Sistem aktivitesi, giriş, yatırım ve admin işlemleri</div>
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
              placeholder="Ara (ref, kullanıcı, işlem…)"
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
              <th>IP</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString("tr-TR")}</td>
                  <td>
                    <Badge variant="gray">{CATEGORY_LABEL[row.category] ?? row.category}</Badge>
                  </td>
                  <td className="logs-title-cell">{row.title}</td>
                  <td>{row.userId ?? row.actor ?? "—"}</td>
                  <td>{row.ip ?? "—"}</td>
                  <td>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDetailItem(row)}>
                      Görüntüle
                    </Button>
                  </td>
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

      <LogDetailModal open={detailItem !== null} item={detailItem} onClose={() => setDetailItem(null)} />
    </>
  );
}
