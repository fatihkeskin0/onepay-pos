"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { panelHref } from "@/lib/panel-routes";
import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui/Badge";

interface UserProfile {
  userId: string;
  displayName: string | null;
  balance: number;
  currency: string;
  updatedAt: string;
  depositCount: number;
  approvedDepositTotal: number;
  pendingDepositCount: number;
  totalCredited: number;
  totalDebited: number;
}

interface UserDeposit {
  id: number;
  reference: string;
  amount: number;
  status: string;
  siteName: string | null;
  createdAt: string;
}

interface UserTransaction {
  id: number;
  type: string;
  amount: number;
  createdAt: string;
}

interface PaginatedDeposits {
  items: UserDeposit[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

interface UserProfileModalProps {
  userId: string | null;
  onClose: () => void;
  onError: (message: string) => void;
}

const STATUS_BADGE: Record<string, "pending" | "approved" | "rejected" | "cancelled" | "gray"> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylı",
  rejected: "Red",
  cancelled: "İptal",
};

function userInitial(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || userId.slice(0, 2) || "?").toUpperCase();
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserProfileModal({ userId, onClose, onError }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [deposits, setDeposits] = useState<PaginatedDeposits | null>(null);
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  const load = useCallback(
    async (id: string, page: number, isPageChange = false) => {
      if (isPageChange) setPageLoading(true);
      else setInitialLoading(true);
      try {
        const data = await API.get<{
          profile: UserProfile | null;
          deposits: PaginatedDeposits;
          transactions: { items: UserTransaction[]; total: number };
        }>(`/admin/user_detail?user_id=${encodeURIComponent(id)}&deposit_page=${page}`);
        setProfile(data.profile);
        setDeposits(data.deposits);
        setTransactions(data.transactions.items);
        setTxTotal(data.transactions.total);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Detay yüklenemedi");
        onClose();
      } finally {
        if (isPageChange) setPageLoading(false);
        else setInitialLoading(false);
      }
    },
    [onClose, onError],
  );

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setDeposits(null);
      setTransactions([]);
      setTxTotal(0);
      return;
    }
    void load(userId, 1, false);
  }, [userId, load]);

  const depositsHref = userId
    ? `${panelHref("deposit")}?user_id=${encodeURIComponent(userId)}`
    : panelHref("deposit");

  const depositRangeStart = deposits ? (deposits.page - 1) * deposits.limit + 1 : 0;
  const depositRangeEnd = deposits
    ? Math.min(deposits.page * deposits.limit, deposits.total)
    : 0;

  const displayTitle = profile?.displayName || profile?.userId || "Kullanıcı";

  return (
    <Modal
      open={userId !== null}
      title={displayTitle}
      subtitle={profile?.displayName ? profile.userId : undefined}
      onClose={onClose}
      className="modal--profile"
      overlayClassName="modal-overlay--minimal"
    >
      {initialLoading && !profile ? (
        <div className="uprof-skeleton">
          <div className="uprof-skeleton-hero" />
          <div className="uprof-skeleton-stats" />
          <div className="uprof-skeleton-table" />
        </div>
      ) : !profile ? (
        <p className="uprof-empty">Bu kullanıcı için cüzdan bulunamadı.</p>
      ) : (
        <div className="uprof">
          <div className="uprof-hero-card">
            <div className="uprof-hero-main">
              <span className="uprof-avatar">{userInitial(profile.userId)}</span>
              <div className="uprof-hero-info">
                {!profile.displayName ? (
                  <code className="uprof-id-chip">{profile.userId}</code>
                ) : null}
                <p className="uprof-meta">Son aktivite · {formatFullDate(profile.updatedAt)}</p>
              </div>
            </div>
            <div className="uprof-kpis">
              <div className="uprof-kpi uprof-kpi--accent">
                <span className="uprof-kpi-label">Bakiye</span>
                <span className="uprof-kpi-value">
                  {profile.balance.toLocaleString("tr-TR")}
                  <small>{profile.currency}</small>
                </span>
              </div>
              <div className="uprof-kpi">
                <span className="uprof-kpi-label">Onaylı toplam</span>
                <span className="uprof-kpi-value">
                  {profile.approvedDepositTotal.toLocaleString("tr-TR")}
                  <small>₺</small>
                </span>
              </div>
              <div className="uprof-kpi">
                <span className="uprof-kpi-label">Yatırım</span>
                <span className="uprof-kpi-value">{profile.depositCount.toLocaleString("tr-TR")}</span>
              </div>
              <div className="uprof-kpi">
                <span className="uprof-kpi-label">Bekleyen</span>
                <span className="uprof-kpi-value">{profile.pendingDepositCount}</span>
              </div>
            </div>
          </div>

          <section className="uprof-panel">
            <div className="uprof-panel-head">
              <div>
                <h3 className="uprof-panel-title">Yatırımlar</h3>
                {deposits && deposits.total > 0 ? (
                  <p className="uprof-panel-sub">
                    {depositRangeStart}–{depositRangeEnd} / {deposits.total.toLocaleString("tr-TR")} kayıt
                  </p>
                ) : null}
              </div>
              {deposits && deposits.total > deposits.limit ? (
                <Link href={depositsHref} className="uprof-panel-link" onClick={onClose}>
                  Tümünü aç →
                </Link>
              ) : null}
            </div>

            {deposits && deposits.total === 0 ? (
              <p className="uprof-panel-empty">Henüz yatırım yok.</p>
            ) : deposits ? (
              <>
                <div className={`uprof-table-wrap${pageLoading ? " is-loading" : ""}`}>
                  <table className="uprof-table">
                    <thead>
                      <tr>
                        <th>Referans</th>
                        <th>Site</th>
                        <th>Tutar</th>
                        <th>Durum</th>
                        <th>Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.items.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <code className="uprof-ref">{d.reference}</code>
                          </td>
                          <td className="uprof-cell-muted">{d.siteName ?? "—"}</td>
                          <td className="uprof-cell-amount">{d.amount.toLocaleString("tr-TR")} ₺</td>
                          <td>
                            <Badge variant={STATUS_BADGE[d.status] ?? "gray"}>
                              {STATUS_LABEL[d.status] ?? d.status}
                            </Badge>
                          </td>
                          <td className="uprof-cell-muted">{formatShortDate(d.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {deposits.pages > 1 ? (
                  <div className="uprof-pager">
                    <button
                      type="button"
                      className="uprof-pager-btn"
                      disabled={deposits.page <= 1 || pageLoading}
                      onClick={() => userId && load(userId, deposits.page - 1, true)}
                    >
                      Önceki
                    </button>
                    <span className="uprof-pager-info">
                      {deposits.page} / {deposits.pages}
                    </span>
                    <button
                      type="button"
                      className="uprof-pager-btn"
                      disabled={deposits.page >= deposits.pages || pageLoading}
                      onClick={() => userId && load(userId, deposits.page + 1, true)}
                    >
                      Sonraki
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          {transactions.length > 0 ? (
            <section className="uprof-panel uprof-panel--compact">
              <div className="uprof-panel-head">
                <div>
                  <h3 className="uprof-panel-title">Cüzdan hareketleri</h3>
                  {txTotal > transactions.length ? (
                    <p className="uprof-panel-sub">Son {transactions.length} kayıt</p>
                  ) : null}
                </div>
              </div>
              <ul className="uprof-tx-list">
                {transactions.map((tx) => (
                  <li key={tx.id} className="uprof-tx-item">
                    <div>
                      <span className="uprof-tx-type">{tx.type}</span>
                      <time className="uprof-tx-date">{formatShortDate(tx.createdAt)}</time>
                    </div>
                    <span
                      className={`uprof-tx-amount${tx.amount >= 0 ? " is-credit" : " is-debit"}`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amount.toLocaleString("tr-TR")} ₺
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
