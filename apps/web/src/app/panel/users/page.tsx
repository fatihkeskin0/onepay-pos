"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/Modal";

interface Wallet {
  userId: string;
  balance: string;
  currency: string;
  totalDeposited: string;
  totalWithdrawn: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: string;
  createdAt: string;
}

export default function UsersPage() {
  const [items, setItems] = useState<Wallet[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  const [detailUser, setDetailUser] = useState<string | null>(null);
  const [detailWallet, setDetailWallet] = useState<Wallet | null>(null);
  const [detailTxs, setDetailTxs] = useState<Transaction[]>([]);

  const load = async (q?: string) => {
    setLoading(true);
    try {
      const query = q !== undefined ? q : search;
      const url = query ? `/admin/users?search=${encodeURIComponent(query)}` : "/admin/users";
      const data = await API.get<{ items: Wallet[] }>(url);
      setItems(data.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const openDetail = async (userId: string) => {
    try {
      const data = await API.get<{ wallet: Wallet | null; transactions: Transaction[] }>(
        `/admin/user_detail?user_id=${encodeURIComponent(userId)}`,
      );
      setDetailUser(userId);
      setDetailWallet(data.wallet);
      setDetailTxs(data.transactions);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Detay yüklenemedi", "error");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Kullanıcılar</div>
          <div className="page-sub">Cüzdan bakiyeleri</div>
        </div>
        <div className="page-actions">
          <input
            className="form-input w-220"
            placeholder="User ID ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(search)}
          />
          <button type="button" className="btn btn-primary" onClick={() => load(search)}>
            Ara
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Bakiye</th>
              <th>Para</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.userId} className="cursor-pointer" onClick={() => openDetail(w.userId)}>
                  <td>{w.userId}</td>
                  <td>{w.balance}</td>
                  <td>{w.currency}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={detailUser !== null}
        title={detailUser ? `Kullanıcı: ${detailUser}` : ""}
        onClose={() => setDetailUser(null)}
        wide
      >
        {detailWallet ? (
          <div className="mb-4">
            <p>
              <strong>Bakiye:</strong> {detailWallet.balance} {detailWallet.currency}
            </p>
            <p>
              <strong>Toplam Yatırım:</strong> {detailWallet.totalDeposited}
            </p>
            <p>
              <strong>Toplam Çekim:</strong> {detailWallet.totalWithdrawn}
            </p>
          </div>
        ) : (
          <p>Cüzdan bulunamadı.</p>
        )}
        {detailTxs.length > 0 && (
          <>
            <div className="form-label">Son İşlemler</div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Tip</th>
                  <th>Tutar</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {detailTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.type}</td>
                    <td>{tx.amount}</td>
                    <td>{new Date(tx.createdAt).toLocaleString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </>
  );
}
