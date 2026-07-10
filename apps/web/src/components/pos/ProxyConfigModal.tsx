"use client";

import { useEffect, useState } from "react";
import type { ProxyMode } from "@onepara/shared";
import { Modal } from "@/components/Modal";

interface ProxyPoolEntry {
  id: number;
  label: string;
  host: string;
  port: number;
  is_active: boolean;
}

interface ProxyConfigModalProps {
  open: boolean;
  provider: string;
  proxyEnabled: boolean;
  proxyMode: ProxyMode;
  proxyEntryIds: number[];
  poolEntries: ProxyPoolEntry[];
  onClose: () => void;
  onSave: (config: {
    proxy_enabled: boolean;
    proxy_mode: ProxyMode;
    proxy_entry_ids: number[];
  }) => void;
}

export function ProxyConfigModal({
  open,
  provider,
  proxyEnabled,
  proxyMode,
  proxyEntryIds,
  poolEntries,
  onClose,
  onSave,
}: ProxyConfigModalProps) {
  const [enabled, setEnabled] = useState(proxyEnabled);
  const [mode, setMode] = useState<ProxyMode>(proxyMode);
  const [selectedIds, setSelectedIds] = useState<number[]>(proxyEntryIds);

  useEffect(() => {
    if (open) {
      setEnabled(proxyEnabled);
      setMode(proxyMode);
      setSelectedIds(proxyEntryIds);
    }
  }, [open, proxyEnabled, proxyMode, proxyEntryIds]);

  const toggleId = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const activePool = poolEntries.filter((e) => e.is_active);

  return (
    <Modal
      open={open}
      title={`Proxy: ${provider}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onSave({
                proxy_enabled: enabled,
                proxy_mode: enabled ? mode : "off",
                proxy_entry_ids: mode === "pool_selected" ? selectedIds : [],
              })
            }
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Proxy etkin
        </label>
      </div>
      {enabled && (
        <>
          <div className="form-group">
            <label className="form-label">Mod</label>
            <select className="form-input" value={mode} onChange={(e) => setMode(e.target.value as ProxyMode)}>
              <option value="pool_all">Tüm havuz</option>
              <option value="pool_selected">Seçili proxyler</option>
            </select>
          </div>
          {mode === "pool_selected" && (
            <div className="form-group">
              <label className="form-label">Proxy seçimi</label>
              {activePool.length === 0 ? (
                <p className="settings-note">Aktif proxy yok. Önce Proxy Havuzu sayfasından ekleyin.</p>
              ) : (
                <div className="flex-col gap-2">
                  {activePool.map((entry) => (
                    <label key={entry.id} className="form-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(entry.id)}
                        onChange={() => toggleId(entry.id)}
                      />{" "}
                      {entry.label} ({entry.host}:{entry.port})
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
