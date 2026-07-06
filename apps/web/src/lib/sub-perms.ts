import type { SubPermission } from "@onepara/shared";

export const SUB_PERM_LABELS: Record<SubPermission, string> = {
  deps_view: "Yatırımları Gör",
  deps_action: "Yatırım Onayla/Reddet",
  wds_view: "Çekimleri Gör",
  wds_action: "Çekim İşlem Yap",
  iban_view: "IBAN Listesi Gör",
  iban_toggle: "IBAN Aktif/Pasif",
  iban_manage: "IBAN Ekle/Düzenle",
  kasa_view: "Kasa & Raporlar",
  teslim: "Teslim Yapabilir",
};

export const SUB_PERM_KEYS = Object.keys(SUB_PERM_LABELS) as SubPermission[];
