import { panelHref } from "./panel-routes";

export const PAGE_HREF: Record<string, string> = {
  "adm-dashboard": panelHref("dashboard"),
  "kas-dashboard": panelHref("dashboard"),
  "adm-dep": panelHref("deposit"),
  "kas-dep": panelHref("deposit"),
  "adm-export": panelHref("transactions"),
  "kas-export": panelHref("transactions"),
  "adm-basvurular": panelHref("applications"),
  "adm-siteler": panelHref("sites"),
  "adm-uyeler": panelHref("users"),
  "adm-kasiyerler": panelHref("cashiers"),
  "adm-monitor": panelHref("monitor"),
  "adm-reconciliation": panelHref("reconciliation"),
  "adm-site-mutabakat": panelHref("site-reconciliation"),
  "adm-giris": panelHref("logs"),
  "adm-raporlar": panelHref("reports"),
  "adm-supheliler": panelHref("suspicious"),
  "adm-duyurular": panelHref("announcements"),
  "kas-duyurular": panelHref("announcements"),
  "adm-ayarlar": panelHref("settings"),
  "kas-sifre": panelHref("settings"),
  "adm-demo": panelHref("demo"),
  "adm-pos": panelHref("pos"),
};

export const DEFAULT_PANEL_HREF = panelHref("dashboard");
