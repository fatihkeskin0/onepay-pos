"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useClientSession } from "@/hooks/useClientSession";

interface Application {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  message: string | null;
  status: "new" | "reviewed" | "archived";
  ip: string;
  created_at: string;
}

const STATUS_LABEL: Record<Application["status"], string> = {
  new: "Yeni",
  reviewed: "İncelendi",
  archived: "Arşiv",
};

export default function ApplicationsPage() {
  const { ready, isAdmin } = useClientSession();
  const { notify } = useToast();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("new");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await API.get<{ items: Application[]; pages: number }>(
        `/admin/applications?page=${page}&status=${statusFilter}`,
      );
      setItems(data.items);
      setPages(data.pages || 1);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, notify, page, statusFilter]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    load();
  }, [ready, isAdmin, load]);

  const updateStatus = async (id: number, status: Application["status"]) => {
    try {
      await API.post("/admin/applications/update_status", { id, status });
      notify("Durum güncellendi", "success");
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  if (!ready) return null;
  if (!isAdmin) {
    return (
      <div className="card">
        <p className="text-muted">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Başvurular</div>
          <div className="page-sub">Landing üzerinden gelen merchant başvuruları</div>
        </div>
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="new">Yeni</option>
          <option value="reviewed">İncelendi</option>
          <option value="archived">Arşiv</option>
          <option value="all">Tümü</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="text-muted">Bu filtrede başvuru yok.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Şirket</th>
                  <th>Yetkili</th>
                  <th>İletişim</th>
                  <th>Mesaj</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString("tr-TR")}</td>
                    <td>{item.company_name}</td>
                    <td>{item.contact_name}</td>
                    <td>
                      <div>{item.email}</div>
                      <div className="text-muted text-sm">{item.phone}</div>
                    </td>
                    <td className="applications-message">{item.message || "—"}</td>
                    <td>
                      <span className={`badge badge-${item.status}`}>{STATUS_LABEL[item.status]}</span>
                    </td>
                    <td>
                      <div className="applications-actions">
                        {item.status !== "reviewed" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => updateStatus(item.id, "reviewed")}
                          >
                            İncelendi
                          </button>
                        ) : null}
                        {item.status !== "archived" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => updateStatus(item.id, "archived")}
                          >
                            Arşivle
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 ? (
          <div className="pagination-row">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </button>
            <span className="text-muted text-sm">
              Sayfa {page} / {pages}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
