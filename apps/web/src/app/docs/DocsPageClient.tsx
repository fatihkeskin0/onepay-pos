"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getDocsContent } from "./content";
import { SAMPLE_BC_CALLBACK, SAMPLE_BC_CALLBACK_RESPONSE } from "./shared-samples";
import type {
  DocsContent,
  DocsEndpointDoc,
  DocsErrorRow,
  DocsLocale,
  DocsMetaItem,
  DocsParamRow,
  DocsStatusPill,
} from "./types";

const STORAGE_KEY = "onepos-docs-locale";

function IconBook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function MethodBadge({ method }: { method: "POST" | "GET" }) {
  return <span className={`docs-method docs-method--${method.toLowerCase()}`}>{method}</span>;
}

function RequiredBadge({ value, locale }: { value: DocsParamRow["required"]; locale: DocsLocale }) {
  const yes = locale === "tr" ? "Evet" : "Yes";
  const optional = locale === "tr" ? "Opsiyonel" : "Optional";
  return (
    <span className={`docs-required docs-required--${value}`}>
      {value === "yes" ? yes : optional}
    </span>
  );
}

function ParamTable({
  title,
  params,
  locale,
}: {
  title: string;
  params: DocsParamRow[];
  locale: DocsLocale;
}) {
  const headers =
    locale === "tr"
      ? ["Parametre", "Tip", "Zorunlu", "Açıklama"]
      : ["Parameter", "Type", "Required", "Description"];

  return (
    <>
      <div className="docs-param-title">{title}</div>
      <div className="docs-table-wrap">
        <table className="docs-table docs-table--params">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name}>
                <td>
                  <code>{p.name}</code>
                </td>
                <td className="docs-muted">{p.type}</td>
                <td>
                  <RequiredBadge value={p.required} locale={locale} />
                </td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusPills({ pills, locale }: { pills: DocsStatusPill[]; locale: DocsLocale }) {
  const title = locale === "tr" ? "Durum Değerleri" : "Status Values";
  return (
    <div className="docs-status-box">
      <div className="docs-status-box-title">{title}</div>
      <div className="docs-status-pills">
        {pills.map((p) => (
          <span key={p.value} className={`docs-status-pill docs-status-pill--${p.tone}`}>
            {p.value} — {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="docs-code-block">
      <div className="docs-code-label">{label}</div>
      <pre className="docs-pre docs-pre--dark">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MetaBlock({ items }: { items: DocsMetaItem[] }) {
  return (
    <div className="docs-meta">
      {items.map((m) => (
        <div key={m.label} className="docs-meta-item">
          <span className="docs-meta-label">{m.label}</span>
          <span className="docs-meta-value">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorTable({
  title,
  errors,
  locale,
}: {
  title: string;
  errors: DocsErrorRow[];
  locale: DocsLocale;
}) {
  const headers = locale === "tr" ? ["HTTP", "Açıklama"] : ["HTTP", "Description"];
  return (
    <>
      <div className="docs-param-title">{title}</div>
      <div className="docs-table-wrap">
        <table className="docs-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.code}>
                <td>
                  <code>{e.code}</code>
                </td>
                <td>{e.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EndpointBlock({ ep, locale }: { ep: DocsEndpointDoc; locale: DocsLocale }) {
  return (
    <div className="docs-endpoint-block" id={ep.id}>
      <h3 className="docs-endpoint-title">{ep.title}</h3>
      <div className="docs-endpoint-head">
        <MethodBadge method={ep.method} />
        <strong>{ep.path}</strong>
      </div>
      <p className="docs-endpoint-desc">{ep.description}</p>
      <MetaBlock items={ep.meta} />
      <ParamTable title={ep.paramTitle} params={ep.params} locale={locale} />
      {ep.statusPills ? <StatusPills pills={ep.statusPills} locale={locale} /> : null}
      {ep.notes?.map((note) => (
        <div key={note} className="docs-note">
          <pre className="docs-pre docs-pre--dark docs-pre--compact">
            <code>{note}</code>
          </pre>
        </div>
      ))}
      <div className="docs-code-grid">
        <CodeBlock label={ep.requestLabel} code={ep.requestSample} />
        <CodeBlock label={ep.responseLabel} code={ep.responseSample} />
      </div>
      <ErrorTable title={ep.errorTitle} errors={ep.errors} locale={locale} />
    </div>
  );
}

function DocsBody({ c, locale }: { c: DocsContent; locale: DocsLocale }) {
  return (
    <main className="docs-main docs-sandbox-pane">
      <section className="docs-block" id="overview">
        <div className="docs-kicker-row">
          <IconBook />
          <span className="docs-kicker">{c.hero.kicker}</span>
        </div>
        <h1>{c.hero.title}</h1>
        <p className="docs-lead">{c.hero.lead}</p>

        <div className="docs-callout docs-callout--warn">
          <div className="docs-callout-title">
            <IconShield /> {c.hero.securityTitle}
          </div>
          <p>{c.hero.securityBody}</p>
        </div>

        <div className="docs-callout docs-callout--info">
          <div className="docs-callout-title">
            <IconGlobe /> {c.hero.baseUrlTitle}
          </div>
          <code className="docs-base-url">{c.hero.baseUrlValue}</code>
          <p className="docs-callout-note">{c.hero.baseUrlNote}</p>
        </div>
      </section>

      <section className="docs-block" id="api-endpoints">
        <h2 className="docs-h2">{c.endpointsSectionTitle}</h2>
        {c.endpoints.map((ep) => (
          <EndpointBlock key={ep.id} ep={ep} locale={locale} />
        ))}
      </section>

      <section className="docs-block" id="webhook">
        <h2 className="docs-h2">{c.webhook.title}</h2>
        <p className="docs-text">{c.webhook.intro}</p>

        <div className="docs-param-title">{c.webhook.tableTitle}</div>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                {c.webhook.tableHeaders.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.webhook.rows.map((row) => (
                <tr key={row.statusCode}>
                  <td>
                    <code className="docs-code-ok">StatusCode {row.statusCode}</code>
                  </td>
                  <td>{row.when}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="docs-param-title">{c.webhook.payloadTitle}</div>
        <pre className="docs-pre docs-pre--dark docs-pre--blue">
          <code>{SAMPLE_BC_CALLBACK}</code>
        </pre>

        <div className="docs-param-title">{c.webhook.responseTitle}</div>
        <pre className="docs-pre docs-pre--dark docs-pre--green">
          <code>{SAMPLE_BC_CALLBACK_RESPONSE}</code>
        </pre>

        <div className="docs-param-title">{c.webhook.checksumTitle}</div>
        <pre className="docs-pre docs-pre--dark">
          <code>{c.webhook.checksumSample}</code>
        </pre>

        <div className="docs-setup-box">
          <h4>{c.webhook.setupTitle}</h4>
          <ul>
            {c.webhook.setupItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

export function DocsPageClient() {
  const [locale, setLocale] = useState<DocsLocale>("tr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "tr" || stored === "en") {
        setLocale(stored);
      } else if (typeof navigator !== "undefined" && navigator.language.startsWith("en")) {
        setLocale("en");
      }
    } catch {
      /* ignore */
    } finally {
      setReady(true);
    }
  }, []);

  const onLocaleChange = useCallback((next: DocsLocale) => {
    setLocale(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    if (ready) {
      document.documentElement.lang = locale;
    }
  }, [locale, ready]);

  const c = getDocsContent(locale);

  return (
    <div className="docs-wrap">
      <header className="docs-header">
        <div className="docs-brand">
          <div className="docs-logo">OP</div>
          <span>OnePOS API</span>
        </div>
        <nav className="docs-nav">
          <div className="docs-lang" role="group" aria-label="Documentation language">
            <button
              type="button"
              className={`docs-lang-btn ${locale === "tr" ? "active" : ""}`}
              onClick={() => onLocaleChange("tr")}
            >
              TR
            </button>
            <button
              type="button"
              className={`docs-lang-btn ${locale === "en" ? "active" : ""}`}
              onClick={() => onLocaleChange("en")}
            >
              EN
            </button>
          </div>
          <Link href="/">{c.nav.home}</Link>
        </nav>
      </header>

      <div className="docs-layout">
        <aside className="docs-toc custom-scrollbar">
          <div className="docs-toc-title">{c.tocTitle}</div>
          <ul>
            {c.toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ul>
        </aside>

        <DocsBody c={c} locale={locale} />
      </div>
    </div>
  );
}
