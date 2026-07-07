export type DocsLocale = "tr" | "en";

export type ParamRequired = "yes" | "optional";

export interface DocsTocItem {
  id: string;
  label: string;
}

export interface DocsParamRow {
  name: string;
  type: string;
  required: ParamRequired;
  description: string;
}

export interface DocsStatusPill {
  value: string;
  label: string;
  tone: "warn" | "ok" | "bad" | "info";
}

export interface DocsMetaItem {
  label: string;
  value: string;
}

export interface DocsErrorRow {
  code: string;
  description: string;
}

export interface DocsEndpointDoc {
  id: string;
  title: string;
  method: "POST" | "GET";
  path: string;
  description: string;
  meta: DocsMetaItem[];
  paramTitle: string;
  params: DocsParamRow[];
  requestLabel: string;
  requestSample: string;
  responseLabel: string;
  responseSample: string;
  statusPills?: DocsStatusPill[];
  notes?: string[];
  errorTitle: string;
  errors: DocsErrorRow[];
}

export interface DocsCallbackRow {
  statusCode: string;
  when: string;
  action: string;
}

export interface DocsContent {
  nav: { home: string };
  tocTitle: string;
  toc: DocsTocItem[];
  hero: {
    kicker: string;
    title: string;
    lead: string;
    securityTitle: string;
    securityBody: string;
    baseUrlTitle: string;
    baseUrlValue: string;
    baseUrlNote: string;
  };
  endpointsSectionTitle: string;
  endpoints: DocsEndpointDoc[];
  webhook: {
    title: string;
    intro: string;
    payloadTitle: string;
    responseTitle: string;
    checksumTitle: string;
    checksumSample: string;
    tableTitle: string;
    tableHeaders: [string, string, string];
    rows: DocsCallbackRow[];
    setupTitle: string;
    setupItems: string[];
  };
}
