"use client";

import { useEffect, useState } from "react";
import { API } from "@/lib/api";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export default function GenericTablePage<T extends Record<string, unknown>>({
  title,
  subtitle,
  endpoint,
  dataKey,
  columns,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  dataKey: string;
  columns: Column<T>[];
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await API.get<Record<string, T[]>>(endpoint);
        setItems(data[dataKey] ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [endpoint, dataKey]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-sub">{subtitle}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length}>Yükleniyor...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>Kayıt yok</td>
              </tr>
            ) : (
              items.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const val = row[c.key as keyof T];
                    return (
                      <td key={String(c.key)}>
                        {c.render ? c.render(val, row) : String(val ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
