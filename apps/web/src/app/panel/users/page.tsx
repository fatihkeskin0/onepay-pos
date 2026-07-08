"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { UserProfileModal } from "@/components/admin/UserProfileModal";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

interface UserListItem {
  userId: string;
  balance: number;
  currency: string;
  updatedAt: string;
  depositCount: number;
  approvedDepositTotal: number;
  pendingDepositCount: number;
}

function userInitial(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || userId.slice(0, 2) || "?").toUpperCase();
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UsersPage() {
  const [items, setItems] = useState<UserListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const { notify } = useToast();

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const query = q !== undefined ? q : search;
        const url = query
          ? `/admin/users?search=${encodeURIComponent(query)}`
          : "/admin/users";
        const data = await API.get<{ items: UserListItem[] }>(url);
        setItems(data.items);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
      } finally {
        setLoading(false);
      }
    },
    [notify, search],
  );

  useEffect(() => {
    void load("");
  }, []);

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <div className="page-title">Kullanıcılar</div>
          <div className="page-sub">Cüzdan profilleri ve yatırım geçmişi</div>
        </div>
        <div className="users-toolbar">
          <div className="users-search">
            <Icon name="search" size={14} className="users-search-icon" />
            <input
              className="form-input"
              placeholder="User ID ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(search)}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => load(search)}>
            Ara
          </button>
        </div>
      </div>

      <div className="users-card">
        {loading ? (
          <p className="users-empty">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="users-empty">Kullanıcı bulunamadı.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Bakiye</th>
                  <th>Onaylı Yatırım</th>
                  <th>Yatırım</th>
                  <th>Bekleyen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.userId} onClick={() => setDetailUserId(u.userId)}>
                    <td>
                      <div className="users-user-cell">
                        <span className="users-avatar">{userInitial(u.userId)}</span>
                        <div>
                          <div className="users-user-id">{u.userId}</div>
                          <div className="users-user-meta">
                            Son güncelleme {formatShortDate(u.updatedAt)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="users-metric">
                      <strong>{u.balance.toLocaleString("tr-TR")}</strong>
                      <span>{u.currency}</span>
                    </td>
                    <td className="users-metric">
                      <strong>{u.approvedDepositTotal.toLocaleString("tr-TR")}</strong>
                      <span>₺</span>
                    </td>
                    <td className="users-metric">
                      <strong>{u.depositCount.toLocaleString("tr-TR")}</strong>
                    </td>
                    <td>
                      {u.pendingDepositCount > 0 ? (
                        <Badge variant="pending">{u.pendingDepositCount}</Badge>
                      ) : (
                        <span className="users-row-action">—</span>
                      )}
                    </td>
                    <td className="users-row-action">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserProfileModal
        userId={detailUserId}
        onClose={() => setDetailUserId(null)}
        onError={(msg) => notify(msg, "error")}
      />
    </div>
  );
}
