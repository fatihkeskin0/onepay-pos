export type DocsLocale = "tr" | "en";

export type ParamRequired = "yes" | "optional";

export interface DocsTocItem {
  id: string;
  label: string;
}

export interface DocsEndpointRow {
  method: "POST" | "GET";
  endpoint: string;
  description: string;
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

export interface DocsEndpointDoc {
  id: string;
  method: "POST" | "GET";
  path: string;
  description: string;
  paramTitle: string;
  params: DocsParamRow[];
  requestLabel: string;
  requestSample: string;
  responseLabel: string;
  responseSample: string;
  statusPills?: DocsStatusPill[];
  notes?: string[];
}

export interface DocsCallbackRow {
  statusCode: string;
  when: string;
  action: string;
}

export interface DocsContent {
  nav: { home: string; panel: string };
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
  endpointSummary: {
    title: string;
    headers: [string, string, string];
    rows: DocsEndpointRow[];
  };
  endpointsSectionTitle: string;
  endpoints: DocsEndpointDoc[];
  flow: {
    title: string;
    steps: string[];
  };
  webhook: {
    title: string;
    intro: string;
    flowTitle: string;
    flowSteps: string[];
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
  errors: {
    title: string;
    intro: string;
    tableHeaders: [string, string, string];
    rows: { cells: [string, string, string] }[];
  };
}
