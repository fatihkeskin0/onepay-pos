import type { DocsContent } from "../types";
import {
  SAMPLE_CANCEL_DEPOSIT_REQ,
  SAMPLE_CANCEL_DEPOSIT_RES,
  SAMPLE_CHECKSUM,
  SAMPLE_CREATE_PAYMENT_LINK_REQ,
  SAMPLE_CREATE_PAYMENT_LINK_RES,
  SAMPLE_DEPOSIT_STATUS_REQ,
  SAMPLE_DEPOSIT_STATUS_RES,
} from "../shared-samples";

export const trContent: DocsContent = {
  nav: { home: "Ana Sayfa", panel: "Panel" },
  tocTitle: "İçindekiler",
  toc: [
    { id: "overview", label: "Genel Bakış" },
    { id: "endpoint-summary", label: "Endpoint Özeti" },
    { id: "api-endpoints", label: "API Uç Noktaları" },
    { id: "integration-flow", label: "Entegrasyon Akışı" },
    { id: "webhook", label: "Webhook Callback" },
    { id: "errors", label: "Hata Kodları" },
  ],
  hero: {
    kicker: "Hızlı Başlangıç",
    title: "Entegrasyon Dokümantasyonu",
    lead:
      "OnePOS API, entegre platformlarınız için kredi kartı yatırım altyapısı sunar. REST servisleri ile ödeme oturumu oluşturur, müşterinizi güvenli ödeme sayfasına yönlendirir ve işlem sonucunu BetConstruct uyumlu webhook ile bildirir. Yalnızca kredi kartı yatırım kapsamındadır.",
    securityTitle: "Güvenlik & Yetkilendirme",
    securityBody:
      "Site API isteklerinde X-API-Key header zorunludur. Production ortamında API anahtarınızı asla client-side (tarayıcı) kodunda barındırmayın; tüm istekler backend sunucunuzdan yapılmalıdır.",
    baseUrlTitle: "Base URL",
    baseUrlValue: "/backend/user/",
    baseUrlNote:
      "Tüm endpoint'ler bu prefix üzerinden çağrılır (Next.js proxy → API sunucusu). Örn: POST /backend/user/create_payment_link",
  },
  endpointSummary: {
    title: "Endpoint Özet Tablosu",
    headers: ["Metot", "Endpoint", "Açıklama"],
    rows: [
      {
        method: "POST",
        endpoint: "/user/create_payment_link",
        description: "Ödeme oturumu / yönlendirme linki oluştur",
      },
      {
        method: "GET",
        endpoint: "/user/deposit_status",
        description: "Yatırım durumu sorgula (BetConstruct uyumlu polling)",
      },
      {
        method: "POST",
        endpoint: "/user/cancel_deposit",
        description: "Bekleyen yatırımı iptal et",
      },
    ],
  },
  endpointsSectionTitle: "API Uç Noktaları",
  endpoints: [
    {
      id: "create-payment-link",
      method: "POST",
      path: "/user/create_payment_link",
      description:
        "Müşteriye özel tek kullanımlık ödeme oturumu üretir. Yanıtta dönen url alanına müşterinizi yönlendirdiğinizde kredi kartı ödeme ekranı açılır. Oturum 15 dakika geçerlidir.",
      paramTitle: "Parametre Referansı",
      params: [
        { name: "user_id", type: "string", required: "yes", description: "Müşteri benzersiz ID (callback UserCode)" },
        { name: "name", type: "string", required: "optional", description: "Müşteri ad soyad (ödeme sayfasında gösterilir)" },
        { name: "amount", type: "number", required: "yes", description: "Yatırım tutarı (TRY). Minimum site ayarına göre belirlenir." },
        { name: "return_url", type: "string", required: "yes", description: "Ödeme sonrası dönüş URL" },
        { name: "transaction_id", type: "string", required: "yes", description: "Harici referans (callback CustomField)" },
      ],
      requestLabel: "İstek (Request)",
      requestSample: SAMPLE_CREATE_PAYMENT_LINK_REQ,
      responseLabel: "Başarılı Yanıt (200 OK)",
      responseSample: SAMPLE_CREATE_PAYMENT_LINK_RES,
      notes: [
        "expires_at alanı UTC+3 (Europe/Istanbul) saat diliminde YYYY-MM-DD HH:mm:ss formatındadır.",
        "Eksik veya geçersiz parametrelerde HTTP 400 döner.",
      ],
    },
    {
      id: "deposit-status",
      method: "GET",
      path: "/user/deposit_status?ref={reference}&token={deposit_token}",
      description:
        "Yatırım işleminin anlık durumunu sorgular. Webhook altyapınız yoksa polling için kullanılabilir; production ortamında webhook tercih edilir.",
      paramTitle: "Query Parametreleri",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Yatırım referans numarası" },
        { name: "token", type: "string", required: "yes", description: "Ödeme oturumu token'ı" },
      ],
      requestLabel: "Sorgu Örneği",
      requestSample: SAMPLE_DEPOSIT_STATUS_REQ,
      responseLabel: "Yanıt Örneği",
      responseSample: SAMPLE_DEPOSIT_STATUS_RES,
      statusPills: [
        { value: "pending", label: "Onay bekliyor", tone: "warn" },
        { value: "approved", label: "Tamamlandı", tone: "ok" },
        { value: "rejected", label: "Reddedildi", tone: "bad" },
        { value: "cancelled", label: "İptal", tone: "info" },
      ],
    },
    {
      id: "cancel-deposit",
      method: "POST",
      path: "/user/cancel_deposit",
      description: "Bekleyen (pending) yatırım talebini iptal eder. Onaylanmış veya reddedilmiş işlemler iptal edilemez.",
      paramTitle: "Parametre Referansı",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Yatırım referans numarası" },
        { name: "token", type: "string", required: "yes", description: "Deposit token" },
      ],
      requestLabel: "İstek (Request)",
      requestSample: SAMPLE_CANCEL_DEPOSIT_REQ,
      responseLabel: "Başarılı Yanıt (200 OK)",
      responseSample: SAMPLE_CANCEL_DEPOSIT_RES,
    },
  ],
  flow: {
    title: "Entegrasyon Akışı",
    steps: [
      "Site Backend → POST create_payment_link (X-API-Key)",
      "Müşteri → data.url ödeme sayfasına yönlendirilir",
      "OnePOS → Kredi kartı ödeme + 3DS (hosted checkout)",
      "OnePOS → callback_url_deposit adresine CheckSum imzalı webhook POST",
      "Site Backend → CheckSum doğrula, müşteri bakiyesini güncelle",
      "Opsiyonel → GET deposit_status ile polling",
    ],
  },
  webhook: {
    title: "Webhook Callback Sistemi",
    intro:
      "Yatırım onay/red/iptal sonrası OnePOS, site panelinde tanımlı callback_url_deposit adresine otomatik POST atar. BetConstruct / OnePay ile birebir uyumlu payload formatı kullanılır. Polling yerine webhook ile anlık bildirim almanız önerilir.",
    flowTitle: "Entegrasyon Akışı",
    flowSteps: ["Betco / Site", "API call", "OnePOS", "İşlem tamamlanır", "Webhook POST", "Betco / Site"],
    payloadTitle: "OnePOS'un Sizin Sunucunuza Attığı Callback Payload",
    responseTitle: "Sizin HTTP 200 ile Dönmeniz Yeterlidir",
    checksumTitle: "CheckSum Doğrulama (Zorunlu)",
    checksumSample: SAMPLE_CHECKSUM,
    tableTitle: "StatusCode Referansı",
    tableHeaders: ["StatusCode", "Ne Zaman Tetiklenir", "Sizden Beklenen"],
    rows: [
      { statusCode: "1", when: "Yatırım onaylandığında", action: "Müşteri bakiyesine yansıtın" },
      { statusCode: "2", when: "Yatırım reddedildiğinde", action: "Müşteriyi bilgilendirin" },
      { statusCode: "3", when: "Yatırım iptal edildiğinde", action: "Bekleyen kaydı kapatın" },
    ],
    setupTitle: "Webhook URL Ayarlama",
    setupItems: [
      "Site callback URL: Admin Panel → Siteler → site düzenle → callback_url_deposit",
      "Payload TraderKey alanı site API key'inizdir",
      "CustomField alanı create_payment_link isteğindeki transaction_id değerini taşır",
      "HTTP 2xx yanıt başarılı kabul edilir; 4xx/5xx loglanır",
    ],
  },
  errors: {
    title: "Hata Kodları",
    intro: 'Tüm hatalar { "success": false, "message": "..." } formatında döner.',
    tableHeaders: ["HTTP", "Mesaj", "Durum"],
    rows: [
      { cells: ["401", "API key gerekli / Geçersiz API key", "Kimlik doğrulama"] },
      { cells: ["404", "Geçersiz oturum / Kayıt bulunamadı", "Token veya referans hatalı"] },
      { cells: ["409", "Bekleyen yatırımınız var", "15 dk içinde pending kayıt"] },
      { cells: ["410", "Ödeme süresi doldu", "Oturum süresi (45 dk)"] },
      { cells: ["422", "user_id gerekli / Geçerli tutar girin", "Validasyon"] },
      { cells: ["429", "Çok fazla istek", "Rate limit"] },
    ],
  },
};
