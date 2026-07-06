"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";
import { useClientSession } from "@/hooks/useClientSession";

interface Deposit {
  id: number;
  reference: string;
  userId: string;
  amount: string;
  commissionAmount?: string;
  status: string;
  createdAt: string;
  site?: { name: string };
}

interface EditLog {
  id: number;
  oldAmount: string;
  newAmount: string;
  editedBy: string;
  editedAt: string;
}

export default function DepositsPage() {
  const [items, setItems] = useState<Deposit[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();
  const { ready, isAdmin } = useClientSession();
  const listPrefix = isAdmin ? "/admin" : "/cashier";

  const [rejectModal, setRejectModal] = useState<{ id: number; reason: string } | null>(null);
  const [editModal, setEditModal] = useState<{ id: number; amount: string; logs: EditLog[] } | null>(null);

  const load = async (s: string) => {
    setLoading(true);
    try {
      const data = await API.get<{ items: Deposit[] }>(`${listPrefix}/deposits?status=${s}`);
      setItems(data.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    load(tab);
  }, [tab, listPrefix, ready]);

  const approve = async (id: number) => {
    try {
      await API.post("/cashier/approve_deposit", { id });
      notify("Onaylandı", "success");
      load(tab);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    try {
      await API.post("/cashier/reject_deposit", { id: rejectModal.id, reason: rejectModal.reason });
      notify("Reddedildi", "success");
      setRejectModal(null);
      load(tab);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const openEditModal = async (id: number, currentAmount: string) => {
    try {
      const data = await API.get<{ items: EditLog[] }>(`/admin/deposit_edit_logs?deposit_id=${id}`);
      setEditModal({ id, amount: currentAmount, logs: data.items });
    } catch {
      setEditModal({ id, amount: currentAmount, logs: [] });
    }
  };

  const submitEditAmount = async () => {
    if (!editModal) return;
    try {
      await API.post("/admin/update_deposit_amount", {
        id: editModal.id,
        amount: Number(editModal.amount),
      });
      notify("Tutar güncellendi", "success");
      setEditModal(null);
      load(tab);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const tabs = [
    { key: "pending", label: "Bekleyen" },
    { key: "approved", label: "Onaylı" },
    { key: "rejected", label: "Red" },
    { key: "cancelled", label: "İptal" },
    { key: "all", label: "Tümü" },
  ];

  const showCommission = ready && isAdmin && (tab === "approved" || tab === "all");
  const colSpan = showCommission ? 8 : 7;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Yatırımlar</div>
          <div className="page-sub">Kredi kartı yatırım işlemleri</div>
        </div>
      </div>
      <div className="filter-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ftab ftab-${t.key}${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Kullanıcı</th>
              <th>Site</th>
              <th>Tutar</th>
              {showCommission && <th>Komisyon</th>}
              <th>Durum</th>
              <th>Tarih</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td>{d.reference}</td>
                  <td>{d.userId}</td>
                  <td>{d.site?.name ?? "—"}</td>
                  <td>{d.amount} TL</td>
                  {showCommission && (
                    <td>
                      {d.status === "approved" && d.commissionAmount != null
                        ? `${d.commissionAmount} TL`
                        : "—"}
                    </td>
                  )}
                  <td>
                    <span className={`badge badge-${d.status}`}>{d.status}</span>
                  </td>
                  <td>{new Date(d.createdAt).toLocaleString("tr-TR")}</td>
                  <td className="table-actions">
                    {tab === "pending" && (
                      <>
                        <button type="button" className="btn btn-success btn-sm" onClick={() => approve(d.id)}>
                          Onay
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setRejectModal({ id: d.id, reason: "" })}
                        >
                          Red
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEditModal(d.id, d.amount)}
                      >
                        ✎ Tutar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={rejectModal !== null}
        title="Yatırımı Reddet"
        onClose={() => setRejectModal(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setRejectModal(null)}>
              İptal
            </button>
            <button type="button" className="btn btn-danger" onClick={submitReject}>
              Reddet
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Red Sebebi</label>
          <input
            className="form-input"
            value={rejectModal?.reason ?? ""}
            onChange={(e) => setRejectModal((m) => (m ? { ...m, reason: e.target.value } : null))}
            placeholder="Sebep girin..."
          />
        </div>
      </Modal>

      <Modal
        open={editModal !== null}
        title="Tutar Düzenle"
        onClose={() => setEditModal(null)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>
              İptal
            </button>
            <button type="button" className="btn btn-primary" onClick={submitEditAmount}>
              Kaydet
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Yeni Tutar (₺)</label>
          <input
            className="form-input"
            type="number"
            min={0}
            step={0.01}
            value={editModal?.amount ?? ""}
            onChange={(e) => setEditModal((m) => (m ? { ...m, amount: e.target.value } : null))}
          />
        </div>
        {editModal && editModal.logs.length > 0 && (
          <div className="mt-4">
            <div className="form-label">Tutar Geçmişi</div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th>Eski</th>
                  <th>Yeni</th>
                  <th>Kim</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {editModal.logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.oldAmount}</td>
                    <td>{log.newAmount}</td>
                    <td>{log.editedBy}</td>
                    <td>{new Date(log.editedAt).toLocaleString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
