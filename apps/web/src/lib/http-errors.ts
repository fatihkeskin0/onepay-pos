export type ApiErrorCode =
  | "POS_NOT_CONFIGURED"
  | "PSP_INIT_FAILED"
  | "SESSION_EXPIRED"
  | "PENDING_DEPOSIT"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "IP_CHANGED"
  | "STEP_UP_REQUIRED"
  | "SESSION_SUPERSEDED"
  | "SESSION_INVALID"
  | "TOTP_REQUIRED"
  | "PANEL_IP_BLOCKED"
  | string;

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  code?: ApiErrorCode;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: ApiErrorCode;
  readonly data: unknown;

  constructor(message: string, status: number, code?: ApiErrorCode, data: unknown = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function parseApiResponse<T>(res: Response): Promise<ApiEnvelope<T>> {
  let data: ApiEnvelope<T>;
  try {
    data = (await res.json()) as ApiEnvelope<T>;
  } catch {
    const fallback = mapPayError(res.status, "", undefined);
    throw new ApiRequestError(res.ok ? "Geçersiz sunucu yanıtı" : fallback, res.status);
  }
  return data;
}

export function mapPayError(status: number, message: string, code?: ApiErrorCode): string {
  if (code === "POS_NOT_CONFIGURED") {
    return "Ödeme altyapısı yapılandırılmamış. Lütfen daha sonra tekrar deneyin.";
  }
  if (code === "PSP_INIT_FAILED") {
    return "Ödeme sağlayıcısı geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.";
  }
  if (code === "SESSION_EXPIRED" || status === 410) {
    return "Ödeme oturumunun süresi doldu. Yeni bir ödeme bağlantısı isteyin.";
  }
  if (code === "PENDING_DEPOSIT" || status === 409) {
    return message || "Bekleyen bir yatırım işleminiz var.";
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return "Çok fazla istek gönderildi. Lütfen bekleyin.";
  }
  if (status === 503 || code === "UPSTREAM_UNAVAILABLE") {
    return "Ödeme altyapısı şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.";
  }
  if (status === 502) {
    return "Ödeme sağlayıcısı geçici olarak kullanılamıyor. Lütfen biraz sonra tekrar deneyin.";
  }
  if (status === 422 || code === "VALIDATION_ERROR") {
    return message || "Geçersiz istek.";
  }
  if (status === 404) {
    return message || "Kayıt bulunamadı.";
  }
  if (status === 401 || code === "UNAUTHORIZED") {
    return message || "Yetkisiz istek.";
  }
  if (status === 403 || code === "FORBIDDEN") {
    return message || "Bu işlem için yetkiniz yok.";
  }
  return message || "Bir hata oluştu. Lütfen tekrar deneyin.";
}

export function mapPanelError(status: number, message: string, code?: ApiErrorCode): string {
  if (code === "IP_CHANGED") {
    return "IP adresi değişti, oturum sonlandırıldı";
  }
  if (code === "SESSION_SUPERSEDED") {
    return "Başka bir cihazda oturum açıldı";
  }
  if (code === "SESSION_INVALID") {
    return "Oturum geçersiz, lütfen tekrar giriş yapın";
  }
  if (code === "TOTP_REQUIRED") {
    return "2FA kurulumu gerekli";
  }
  if (code === "STEP_UP_REQUIRED") {
    return "2FA doğrulaması gerekli";
  }
  if (code === "PANEL_IP_BLOCKED") {
    return "Bu IP adresinden panele erişim izni yok";
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return message || "Çok fazla istek. Lütfen bekleyin.";
  }
  if (status === 401 || code === "UNAUTHORIZED") {
    return message || "Yetkisiz";
  }
  if (status === 403 || code === "FORBIDDEN") {
    return message || "Bu işlem için yetkiniz yok";
  }
  if (status === 503 || code === "UPSTREAM_UNAVAILABLE") {
    return "Servis geçici olarak kullanılamıyor";
  }
  return message || "İstek başarısız";
}

export function throwIfApiFailed<T>(res: Response, data: ApiEnvelope<T>): T {
  if (res.ok && data.success) return data.data;
  const status = res.status;
  const code = data.code;
  const message = mapPayError(status, data.message, code);
  throw new ApiRequestError(message, status, code, data.data);
}

export function throwIfPanelApiFailed<T>(res: Response, data: ApiEnvelope<T>): T {
  if (res.ok && data.success) return data.data;
  const status = res.status;
  const code = data.code;
  const message = mapPanelError(status, data.message, code);
  throw new ApiRequestError(message, status, code, data.data);
}
