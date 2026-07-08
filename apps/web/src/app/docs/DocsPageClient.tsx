"use client";

import { useCallback, useEffect, useState } from "react";
import { docsContent as c } from "./content";
import { SAMPLE_BC_CALLBACK, SAMPLE_BC_CALLBACK_RESPONSE } from "./shared-samples";
import type {
  DocsCallbackRow,
  DocsEndpointDoc,
  DocsErrorRow,
  DocsParamRow,
  DocsStatusPill,
} from "./types";

function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function IconAnchor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="5" r="3" />
      <path d="M12 22V8M5 12H2a10 10 0 0 0 10 10 10 10 0 0 0 10-10h-3" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MethodBadge({ method }: { method: "POST" | "GET" }) {
  return <span className={`docs-method docs-method--${method.toLowerCase()}`}>{method}</span>;
}

function RequiredTag({ value }: { value: DocsParamRow["required"] }) {
  return (
    <span className={`docs-required docs-required--${value}`}>
      {value === "yes" ? "required" : "optional"}
    </span>
  );
}

function InlineMeta({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="docs-inline-meta">
      {items.map((m) => (
        <span key={m.label} className="docs-inline-meta-item">
          <span className="docs-inline-meta-label">{m.label}</span>
          <span className="docs-inline-meta-value">{m.value}</span>
        </span>
      ))}
    </div>
  );
}

function ParamList({ title, params }: { title: string; params: DocsParamRow[] }) {
  return (
    <div className="docs-section-group">
      <div className="docs-group-title">{title}</div>
      <div className="docs-param-list">
        {params.map((p) => (
          <div className="docs-param-row" key={p.name}>
            <div className="docs-param-row-head">
              <code>{p.name}</code>
              <span className="docs-param-type">{p.type}</span>
              <RequiredTag value={p.required} />
            </div>
            <p className="docs-param-row-desc">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPills({ pills }: { pills: DocsStatusPill[] }) {
  return (
    <div className="docs-section-group">
      <div className="docs-group-title">Status Values</div>
      <div className="docs-status-pills">
        {pills.map((p) => (
          <span key={p.value} className={`docs-status-pill docs-status-pill--${p.tone}`}>
            <code>{p.value}</code> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ErrorList({ title, errors }: { title: string; errors: DocsErrorRow[] }) {
  return (
    <div className="docs-section-group">
      <div className="docs-group-title">{title}</div>
      <div className="docs-kv-list">
        {errors.map((e) => (
          <div className="docs-kv-row" key={e.code}>
            <code className="docs-kv-key docs-kv-key--error">{e.code}</code>
            <span className="docs-kv-val">{e.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallbackRows({ rows }: { rows: DocsCallbackRow[] }) {
  return (
    <div className="docs-kv-list">
      {rows.map((row) => (
        <div className="docs-kv-row" key={row.statusCode}>
          <code className="docs-kv-key docs-kv-key--status">StatusCode {row.statusCode}</code>
          <div className="docs-kv-body">
            <strong>{row.when}</strong>
            <span>{row.action}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyCodePanel({
  code,
  label,
  tone = "default",
}: {
  code: string;
  label?: string;
  tone?: "default" | "blue" | "green";
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [code]);

  const preClass = [
    "docs-pre",
    "docs-pre--dark",
    tone === "blue" ? "docs-pre--blue" : "",
    tone === "green" ? "docs-pre--green" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="docs-code-block">
      {label ? <div className="docs-code-label">{label}</div> : null}
      <div className="docs-pre-shell">
        <button
          type="button"
          className={`docs-copy-btn${copied ? " docs-copy-btn--done" : ""}`}
          onClick={() => void onCopy()}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          title={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </button>
        <pre className={preClass}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function EndpointBlock({ ep, index }: { ep: DocsEndpointDoc; index: number }) {
  return (
    <div className="docs-endpoint-block" id={ep.id}>
      <div className="docs-endpoint-grid">
        <div className="docs-endpoint-main">
          <div className="docs-endpoint-head">
            <span className="docs-endpoint-index">{String(index).padStart(2, "0")}</span>
            <div className="docs-endpoint-headline">
              <h3 className="docs-endpoint-title">{ep.title}</h3>
              <div className="docs-endpoint-route">
                <MethodBadge method={ep.method} />
                <code className="docs-endpoint-path">{ep.path}</code>
              </div>
            </div>
          </div>
          <p className="docs-endpoint-desc">{ep.description}</p>
          <InlineMeta items={ep.meta} />
          <ParamList title={ep.paramTitle} params={ep.params} />
          {ep.statusPills ? <StatusPills pills={ep.statusPills} /> : null}
          {ep.notes && ep.notes.length > 0 ? (
            <div className="docs-section-group">
              <div className="docs-group-title">Notes</div>
              <ul className="docs-notes-list">
                {ep.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <ErrorList title={ep.errorTitle} errors={ep.errors} />
        </div>

        <div className="docs-endpoint-rail">
          <CopyCodePanel label={ep.requestLabel} code={ep.requestSample} />
          <CopyCodePanel label={ep.responseLabel} code={ep.responseSample} />
        </div>
      </div>
    </div>
  );
}

function DocsBody() {
  return (
    <main className="docs-main">
      <section className="docs-block" id="overview">
        <span className="docs-eyebrow">{c.hero.kicker}</span>
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
            <IconAnchor /> {c.hero.baseUrlTitle}
          </div>
          <code className="docs-base-url">{c.hero.baseUrlValue}</code>
          <p className="docs-callout-note">{c.hero.baseUrlNote}</p>
        </div>
      </section>

      <section className="docs-block" id="api-endpoints">
        <h2 className="docs-h2">{c.endpointsSectionTitle}</h2>
        {c.endpoints.map((ep, i) => (
          <EndpointBlock key={ep.id} ep={ep} index={i + 1} />
        ))}
      </section>

      <section className="docs-block" id="webhook">
        <h2 className="docs-h2">{c.webhook.title}</h2>
        <p className="docs-text">{c.webhook.intro}</p>

        <div className="docs-section-group">
          <div className="docs-group-title">{c.webhook.tableTitle}</div>
          <CallbackRows rows={c.webhook.rows} />
        </div>

        <div className="docs-section-group">
          <div className="docs-group-title">{c.webhook.payloadTitle}</div>
          <CopyCodePanel code={SAMPLE_BC_CALLBACK} tone="blue" />
        </div>

        <div className="docs-section-group">
          <div className="docs-group-title">{c.webhook.responseTitle}</div>
          <CopyCodePanel code={SAMPLE_BC_CALLBACK_RESPONSE} tone="green" />
        </div>

        <div className="docs-section-group">
          <div className="docs-group-title">{c.webhook.checksumTitle}</div>
          <CopyCodePanel code={c.webhook.checksumSample} />
        </div>

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
  const [activeId, setActiveId] = useState(c.toc[0]?.id);

  useEffect(() => {
    const ids = c.toc.map((t) => t.id);
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-88px 0px -65% 0px", threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-wrap" lang="en">
      <header className="docs-header">
        <div className="docs-brand">
          <div className="docs-logo">OP</div>
          <span>OnePOS</span>
          <span className="docs-brand-tag">API Reference</span>
        </div>
        <div className="docs-header-right">
          <span className="docs-version-tag">v1.0</span>
          <span className="docs-status-dot" aria-hidden />
          <span className="docs-status-text">Operational</span>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-toc custom-scrollbar">
          <div className="docs-toc-title">{c.tocTitle}</div>
          <ul>
            {c.toc.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className={activeId === item.id ? "is-active" : ""}>
                  <span className="docs-toc-index">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <DocsBody />
      </div>
    </div>
  );
}
