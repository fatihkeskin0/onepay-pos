import type { ProxyMode, ProxyProtocol } from "@onepara/shared";

export type { ProxyMode, ProxyProtocol };

export interface ProxyImportItem {
  label: string;
  host: string;
  port: number;
  protocol?: ProxyProtocol;
  username?: string;
  password?: string;
}

export interface ProxyRuntimeEntry {
  id: number;
  label: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  username: string | null;
  password: string | null;
}

export type PspFetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;
