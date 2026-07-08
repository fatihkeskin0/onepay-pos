"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useClientSession } from "@/hooks/useClientSession";
import { panelHref } from "@/lib/panel-routes";

interface Application {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  telegram_username: string;
  has_message: boolean;
  status: "new" | "reviewed" | "archived";
  ip: string;
  created_at: string;
}

type StatusFilter = "new" | "archived" | "all";

const STATUS_LABEL: Record<Application["status"], string> = {
  new: "Yeni",
  reviewed: "İncelendi",
  archived: "Arşiv",
};

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "new", label: "Yeni" },
  { key: "archived", label: "Arşiv" },
  { key: "all", label: "Tümü" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApplicationsPage() {
  const { ready, isAdmin } = useClientSession();
  const { notify } = useToast();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
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

  if (!ready) return null;
  if (!isAdmin) {
    return (
      <div className="card">
        <p className="text-muted">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  return (
    <div className="apps-page">
      <div className="page-header">
        <div>
          <div className="page-title">Başvurular</div>
          <div className="page-sub">Landing formundan gelen merchant başvuruları</div>
        </div>
      </div>

      <div className="filter-tabs apps-filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`ftab ftab-all${statusFilter === filter.key ? " active" : ""}`}
            onClick={() => {
              setPage(1);
              setStatusFilter(filter.key);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="card apps-card">
        {loading ? (
          <p className="text-muted apps-empty">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="text-muted apps-empty">Bu listede başvuru yok.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table apps-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Şirket</th>
                  <th>Yetkili</th>
                  <th>E-posta</th>
                  <th>Telegram</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={item.status === "new" ? "apps-row--new" : ""}>
                    <td className="apps-date">{formatDate(item.created_at)}</td>
                    <td className="apps-company">{item.company_name}</td>
                    <td>{item.contact_name}</td>
                    <td>
                      <a href={`mailto:${item.email}`} className="apps-link">
                        {item.email}
                      </a>
                    </td>
                    <td>
                      <a
                        href={`https://t.me/${item.telegram_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apps-link apps-telegram"
                      >
                        @{item.telegram_username}
                      </a>
                    </td>
                    <td>
                      <span className={`badge badge-${item.status}`}>{STATUS_LABEL[item.status]}</span>
                    </td>
                    <td className="apps-actions-cell">
                      <Link href={panelHref(`applications/${item.id}`)} className="btn btn-sm btn-ghost">
                        {item.has_message ? "Mesajı gör" : "Detay"}
                      </Link>
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
    </div>
  );
}
