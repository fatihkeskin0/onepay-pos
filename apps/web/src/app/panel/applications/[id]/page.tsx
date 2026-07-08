"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useClientSession } from "@/hooks/useClientSession";
import { panelHref } from "@/lib/panel-routes";

interface ApplicationDetail {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  telegram_username: string;
  message: string | null;
  status: "new" | "reviewed" | "archived";
  ip: string;
  created_at: string;
}

const STATUS_LABEL: Record<ApplicationDetail["status"], string> = {
  new: "Yeni",
  reviewed: "İncelendi",
  archived: "Arşiv",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, isAdmin } = useClientSession();
  const { notify } = useToast();
  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  const applicationId = Number(params.id);

  const load = useCallback(async () => {
    if (!isAdmin || !applicationId) return;
    setLoading(true);
    try {
      const data = await API.get<ApplicationDetail>(`/admin/applications/${applicationId}`);
      setItem(data);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Başvuru yüklenemedi", "error");
      router.replace(panelHref("applications"));
    } finally {
      setLoading(false);
    }
  }, [applicationId, isAdmin, notify, router]);

  useEffect(() => {
    if (!ready || !isAdmin) return;
    load();
  }, [ready, isAdmin, load]);

  const archive = async () => {
    if (!item) return;
    setArchiving(true);
    try {
      await API.post("/admin/applications/update_status", { id: item.id, status: "archived" });
      notify("Başvuru arşivlendi", "success");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    } finally {
      setArchiving(false);
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

  if (loading) {
    return <p className="text-muted">Yükleniyor…</p>;
  }

  if (!item) return null;

  return (
    <div className="apps-detail">
      <div className="page-header">
        <div>
          <Link href={panelHref("applications")} className="apps-back">
            ← Başvurular
          </Link>
          <div className="page-title">{item.company_name}</div>
          <div className="page-sub">Başvuru #{item.id}</div>
        </div>
        <div className="page-actions">
          <span className={`badge badge-${item.status}`}>{STATUS_LABEL[item.status]}</span>
          {item.status !== "archived" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={archive} disabled={archiving}>
              {archiving ? "Arşivleniyor…" : "Arşivle"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="apps-detail-grid">
        <section className="card apps-detail-card">
          <h2 className="apps-detail-title">İletişim</h2>
          <dl className="apps-detail-list">
            <div>
              <dt>Yetkili</dt>
              <dd>{item.contact_name}</dd>
            </div>
            <div>
              <dt>E-posta</dt>
              <dd>
                <a href={`mailto:${item.email}`} className="apps-link">
                  {item.email}
                </a>
              </dd>
            </div>
            <div>
              <dt>Telegram</dt>
              <dd>
                <a
                  href={`https://t.me/${item.telegram_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apps-link apps-telegram"
                >
                  @{item.telegram_username}
                </a>
              </dd>
            </div>
            <div>
              <dt>Tarih</dt>
              <dd>{formatDate(item.created_at)}</dd>
            </div>
            {item.ip ? (
              <div>
                <dt>IP</dt>
                <dd className="cell-mono">{item.ip}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="card apps-detail-card apps-detail-card--message">
          <h2 className="apps-detail-title">Mesaj</h2>
          {item.message?.trim() ? (
            <div className="apps-message-box">{item.message}</div>
          ) : (
            <p className="text-muted">Başvuruda mesaj bırakılmamış.</p>
          )}
        </section>
      </div>
    </div>
  );
}
