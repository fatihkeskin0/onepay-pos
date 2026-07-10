"use client";

import { useEffect, useMemo, useState } from "react";
import { API } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { ConfirmModal } from "@/components/Modal";
import { StepUpModal } from "@/components/auth/StepUpModal";
import { Icon } from "@/components/ui/Icon";
import { useStepUp } from "@/hooks/useStepUp";
import { CashiersTable } from "@/components/cashiers/CashiersTable";
import { CashierFormModal, type CashierRow } from "@/components/cashiers/CashierFormModal";
import { CashierResetModal } from "@/components/cashiers/CashierResetModal";

type RoleFilter = "all" | "admin" | "kasiyer";
type ActiveFilter = "all" | "active" | "inactive";

export default function CashiersPage() {
  const [items, setItems] = useState<CashierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CashierRow | null>(null);
  const [resetTarget, setResetTarget] = useState<CashierRow | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const {
    stepUpOpen,
    stepUpTitle,
    stepUpLoading,
    requestStepUp,
    closeStepUp,
    confirmStepUp,
  } = useStepUp((msg) => notify(msg, "error"));

  const load = async () => {
    setLoading(true);
    try {
      const data = await API.get<{ items: CashierRow[] }>("/admin/cashiers");
      setItems(data.items);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (q && !c.username.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && c.role !== roleFilter) return false;
      if (activeFilter === "active" && !c.isActive) return false;
      if (activeFilter === "inactive" && c.isActive) return false;
      return true;
    });
  }, [items, search, roleFilter, activeFilter]);

  const requestAdd = (form: {
    username: string;
    password: string;
    role: "admin" | "kasiyer";
    commission_rate: string;
  }) => {
    requestStepUp({
      title: "Agent ekle",
      closeParent: () => setAddOpen(false),
      run: async (totpCode) => {
        await API.post("/admin/add_cashier", {
          username: form.username,
          password: form.password,
          role: form.role,
          commission_rate: Number(form.commission_rate),
          totp_code: totpCode,
        });
        notify("Agent eklendi", "success");
        load();
      },
    });
  };

  const submitEdit = async (
    form: {
      commission_rate: string;
      telegram_chat_id: string;
      admin_note: string;
      is_active: boolean;
    },
  ) => {
    if (!editTarget) return;
    try {
      await API.post("/admin/update_cashier", {
        id: editTarget.id,
        commission_rate: Number(form.commission_rate),
        telegram_chat_id: form.telegram_chat_id,
        admin_note: form.admin_note,
        is_active: form.is_active,
      });
      notify("Güncellendi", "success");
      setEditTarget(null);
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Hata", "error");
    }
  };

  const toggleActive = (c: CashierRow) => {
    setConfirmAction({
      title: c.isActive ? "Pasife Al" : "Aktifleştir",
      message: `${c.username} hesabını ${c.isActive ? "pasife almak" : "aktifleştirmek"} istiyor musunuz?`,
      onConfirm: () => {
        setConfirmAction(null);
        requestStepUp({
          title: c.isActive ? "Pasife al" : "Aktifleştir",
          run: async (totpCode) => {
            await API.post("/admin/toggle_cashier", { id: c.id, totp_code: totpCode });
            notify("Durum güncellendi", "success");
            load();
          },
        });
      },
    });
  };

  const requestResetPassword = (password: string) => {
    if (!resetTarget) return;
    const targetId = resetTarget.id;
    requestStepUp({
      title: "Şifre sıfırla",
      closeParent: () => setResetTarget(null),
      run: async (totpCode) => {
        await API.post("/admin/update_cashier", {
          id: targetId,
          password,
          totp_code: totpCode,
        });
        notify("Şifre sıfırlandı", "success");
      },
    });
  };

  const forceLogout = (c: CashierRow) => {
    setConfirmAction({
      title: "Çıkış Yaptır",
      message: `${c.username} oturumunu sonlandırmak istiyor musunuz?`,
      onConfirm: () => {
        setConfirmAction(null);
        requestStepUp({
          title: "Oturumu sonlandır",
          run: async (totpCode) => {
            await API.post("/admin/force_logout", { id: c.id, totp_code: totpCode });
            notify("Oturum sonlandırıldı", "success");
          },
        });
      },
    });
  };

  return (
    <div className="cashiers-page">
      <div className="page-header">
        <div>
          <div className="page-title">
            <Icon name="users" size={22} /> Agentler
          </div>
          <div className="page-sub">Kasiyer ve admin hesapları</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={16} /> Agent Ekle
        </button>
      </div>

      <div className="cashiers-card">
        <div className="cashiers-toolbar">
          <input
            className="form-input cashiers-search"
            placeholder="Kullanıcı adı ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="cashiers-tabs">
            {(["all", "admin", "kasiyer"] as RoleFilter[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`btn btn-sm ${roleFilter === r ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setRoleFilter(r)}
              >
                {r === "all" ? "Tümü" : r === "admin" ? "Admin" : "Kasiyer"}
              </button>
            ))}
            {(["all", "active", "inactive"] as ActiveFilter[]).map((a) => (
              <button
                key={a}
                type="button"
                className={`btn btn-sm ${activeFilter === a ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveFilter(a)}
              >
                {a === "all" ? "Tüm durum" : a === "active" ? "Aktif" : "Pasif"}
              </button>
            ))}
          </div>
        </div>

        <CashiersTable
          items={filtered}
          loading={loading}
          onEdit={setEditTarget}
          onToggle={toggleActive}
          onReset={setResetTarget}
          onForceLogout={forceLogout}
        />
      </div>

      <CashierFormModal
        open={addOpen}
        mode="add"
        onClose={() => setAddOpen(false)}
        onSubmitAdd={requestAdd}
        onSubmitEdit={() => {}}
      />

      <CashierFormModal
        open={editTarget !== null}
        mode="edit"
        initial={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmitAdd={() => {}}
        onSubmitEdit={submitEdit}
      />

      <CashierResetModal
        open={resetTarget !== null}
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onSubmit={requestResetPassword}
      />

      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />

      <StepUpModal
        open={stepUpOpen}
        title={stepUpTitle}
        loading={stepUpLoading}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />
    </div>
  );
}
