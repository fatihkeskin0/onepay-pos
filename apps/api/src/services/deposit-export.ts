import * as XLSX from "xlsx";

const STATUS_LABEL: Record<string, string> = {
  pending: "Bekliyor",
  approved: "Onaylı",
  rejected: "Red",
  cancelled: "İptal",
};

export interface SiteDepositExportRow {
  reference: string;
  siteName: string;
  userId: string;
  amount: number;
  commission: number;
  net: number;
  status: string;
  pspProvider: string | null;
  externalId: string | null;
  createdAt: string;
  approvedAt: string | null;
}

function formatDateTr(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildSiteDepositsXlsx(rows: SiteDepositExportRow[]): Buffer {
  const sheetRows = rows.map((r) => ({
    Referans: r.reference,
    Site: r.siteName,
    "Kullanıcı ID": r.userId,
    "Tutar (₺)": r.amount,
    "Komisyon (₺)": r.commission,
    "Net (₺)": r.net,
    Durum: STATUS_LABEL[r.status] ?? r.status,
    PSP: r.pspProvider ?? "",
    "Harici ID": r.externalId ?? "",
    Oluşturulma: formatDateTr(r.createdAt),
    "Onay Tarihi": formatDateTr(r.approvedAt),
  }));

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Islemler");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
