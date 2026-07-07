export type PanelRole = "admin" | "kasiyer" | "wd_manager";

export interface TokenPayload {
  id: number;
  role: PanelRole;
  site_id?: number;
  tv?: number;
  exp: number;
}

export interface ApiSuccess<T = Record<string, unknown>> {
  success: true;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  data?: unknown;
}

export type ApiResponse<T = Record<string, unknown>> = ApiSuccess<T> | ApiError;

export interface NavItem {
  section: string;
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  devOnly?: boolean;
}

export const KASIYER_NAV: NavItem[] = [
  { section: "GENEL", id: "kas-dashboard", label: "Dashboard", icon: "📊" },
  { section: "GENEL", id: "kas-dep", label: "Yatırımlar", icon: "💳", badge: "nav-badge-dep" },
  { section: "GENEL", id: "kas-export", label: "Tüm İşlemler", icon: "📋" },
  { section: "AYARLAR", id: "kas-sifre", label: "Hesap Ayarları", icon: "⚙️" },
  { section: "SİSTEM", id: "kas-duyurular", label: "Duyurular", icon: "📢" },
];

export const ADMIN_NAV: NavItem[] = [
  { section: "Yönetim", id: "adm-dashboard", label: "Genel Bakış", icon: "📊" },
  { section: "Yönetim", id: "adm-basvurular", label: "Başvurular", icon: "📝", badge: "nav-badge-applications" },
  { section: "Yönetim", id: "adm-siteler", label: "Siteler", icon: "🌐" },
  { section: "Yönetim", id: "adm-uyeler", label: "Kullanıcılar", icon: "👤" },
  { section: "Yönetim", id: "adm-kasiyerler", label: "Tüm Agentler", icon: "🧑‍💼" },
  { section: "Yönetim", id: "adm-monitor", label: "Canlı İzleme", icon: "📡", badge: "nav-badge-online-kas" },
  { section: "İşlemler", id: "adm-dep", label: "Yatırımlar", icon: "💳", badge: "nav-badge-adm-dep" },
  { section: "İşlemler", id: "adm-export", label: "Tüm İşlemler", icon: "📋" },
  { section: "Finans", id: "adm-pos", label: "POS Ayarları", icon: "🏦" },
  { section: "Finans", id: "adm-site-mutabakat", label: "Site Mutabakatı", icon: "🧾" },
  { section: "Finans", id: "adm-reconciliation", label: "PSP Mutabakatı", icon: "🔄" },
  { section: "Finans", id: "adm-giris", label: "Loglar", icon: "📋" },
  { section: "Finans", id: "adm-raporlar", label: "Raporlar", icon: "📈" },
  { section: "Güvenlik", id: "adm-supheliler", label: "Şüpheli İşlemler", icon: "⚠️", badge: "nav-badge-supheli" },
  { section: "Sistem", id: "adm-duyurular", label: "Duyurular", icon: "📢" },
  { section: "Sistem", id: "adm-ayarlar", label: "Ayarlar", icon: "⚙️" },
  { section: "Sistem", id: "adm-demo", label: "Ödeme Linki", icon: "💳" },
];

export const SLUG_TO_PAGE: Record<string, string> = {
  "": "dashboard",
  dashboard: "dashboard",
  deposit: "deposit",
  "deposit/pending": "deposit",
  "deposit/approved": "deposit",
  "deposit/rejected": "deposit",
  transactions: "transactions",
  duyurular: "duyurular",
  settings: "settings",
  applications: "adm-basvurular",
  sites: "adm-siteler",
  users: "adm-uyeler",
  cashiers: "adm-kasiyerler",
  monitor: "adm-monitor",
  pos: "adm-pos",
  reconciliation: "adm-reconciliation",
  "site-reconciliation": "adm-site-mutabakat",
  reports: "adm-raporlar",
  suspicious: "adm-supheliler",
};

export const PAGE_TO_SLUG: Record<string, string> = {
  "kas-dashboard": "dashboard",
  "adm-dashboard": "dashboard",
  "kas-dep": "deposit",
  "adm-dep": "deposit",
  "kas-export": "transactions",
  "adm-export": "transactions",
  "kas-duyurular": "duyurular",
  "adm-duyurular": "duyurular",
  "kas-sifre": "settings",
  "adm-ayarlar": "settings",
  "adm-basvurular": "applications",
  "adm-siteler": "sites",
  "adm-uyeler": "users",
  "adm-kasiyerler": "cashiers",
  "adm-monitor": "monitor",
  "adm-pos": "pos",
  "adm-site-mutabakat": "site-reconciliation",
  "adm-reconciliation": "reconciliation",
  "adm-raporlar": "reports",
  "adm-supheliler": "suspicious",
  "adm-giris": "logs",
  "adm-demo": "demo",
};

export const LS_KEYS = {
  token: "rf_token",
  role: "rf_role",
  username: "rf_username",
  siteId: "rf_site_id",
  logId: "rf_log_id",
  theme: "rf_theme",
  seenAnn: "rf_seen_ann",
  sound: "rf_sound",
} as const;

export type PspProviderName = "paytr" | "stripe" | "sumup";
