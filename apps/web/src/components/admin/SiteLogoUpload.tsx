"use client";

import { useEffect, useRef, useState } from "react";
import { API } from "@/lib/api";
import { resolveBrandLogoUrl } from "@/lib/brand-logo";

const ACCEPT = "image/svg+xml,image/png,image/webp,.svg,.png,.webp";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Dosya okunamadı"));
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

interface SiteLogoUploadProps {
  siteId?: number;
  value: string;
  onChange: (url: string) => void;
  onPendingFile?: (file: File | null) => void;
  disabled?: boolean;
}

export function SiteLogoUpload({
  siteId,
  value,
  onChange,
  onPendingFile,
  disabled,
}: SiteLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayUrl = previewUrl ?? resolveBrandLogoUrl(value);

  const handleFile = async (file: File | null) => {
    setError("");
    if (!file) return;

    const allowed = ["image/svg+xml", "image/png", "image/webp"];
    const extOk = /\.(svg|png|webp)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extOk) {
      setError("Yalnızca SVG, PNG veya WebP yükleyebilirsiniz");
      return;
    }

    if (file.size > 512 * 1024) {
      setError("Logo en fazla 512 KB olabilir");
      return;
    }

    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    if (!siteId) {
      onPendingFile?.(file);
      return;
    }

    setUploading(true);
    try {
      const content_base64 = await fileToBase64(file);
      const data = await API.post<{ url: string }>("/admin/upload_site_logo", {
        site_id: siteId,
        filename: file.name,
        content_base64,
      });
      onChange(data.url);
      onPendingFile?.(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  const clearLogo = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onChange("");
    onPendingFile?.(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="site-logo-upload">
      <label className="form-label">Logo</label>
      <div className="site-logo-upload__row">
        <div className={`site-logo-upload__preview${displayUrl ? " has-image" : ""}`}>
          {displayUrl ? (
            <img src={displayUrl} alt="Site logosu önizleme" className="site-logo-upload__img" />
          ) : (
            <span className="site-logo-upload__placeholder">SVG · PNG · WebP</span>
          )}
        </div>
        <div className="site-logo-upload__actions">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="site-logo-upload__input"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleFile(file);
            }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Yükleniyor…" : displayUrl ? "Değiştir" : "Logo yükle"}
          </button>
          {displayUrl ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={disabled || uploading}
              onClick={clearLogo}
            >
              Kaldır
            </button>
          ) : null}
          <p className="site-logo-upload__hint">Yatay logo önerilir. Maks. 512 KB.</p>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export async function uploadPendingSiteLogo(siteId: number, file: File): Promise<string> {
  const content_base64 = await fileToBase64(file);
  const data = await API.post<{ url: string }>("/admin/upload_site_logo", {
    site_id: siteId,
    filename: file.name,
    content_base64,
  });
  return data.url;
}
