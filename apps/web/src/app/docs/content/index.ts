import type { DocsLocale } from "../types";
import { enContent } from "./en";
import { trContent } from "./tr";

export const DOCS_CONTENT = {
  tr: trContent,
  en: enContent,
} as const;

export function getDocsContent(locale: DocsLocale) {
  return DOCS_CONTENT[locale];
}
