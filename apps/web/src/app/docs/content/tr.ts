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
  nav: { home: "Ana Sayfa" },
  tocTitle: "İçindekiler",
  toc: [
    { id: "overview", label: "Genel Bakış" },
    { id: "create-payment-link", label: "Ödeme Linki Oluştur" },
    { id: "deposit-status", label: "Yatırım Durumu" },
    { id: "cancel-deposit", label: "Yatırım İptal" },
    { id: "webhook", label: "Yatırım Callback" },
  ],
  hero: {
    kicker: "Kredi Kartı Yatırım API",
    title: "Entegrasyon Dokümantasyonu",
    lead: "Ödeme oturumu oluşturun, müşteriyi ödeme sayfasına yönlendirin ve sonucu imzalı callback ile alın.",
    securityTitle: "Kimlik Doğrulama",
    securityBody:
      "create_payment_link için X-Api-Key header zorunludur. Yalnızca kendi backend'inizden gönderin; anahtarı tarayıcı kodunda asla açığa çıkarmayın.",
    baseUrlTitle: "Base URL",
    baseUrlValue: "https://api.onekart.info/user/",
    baseUrlNote: "Aşağıdaki tüm endpoint'ler bu base altında çağrılır. Parametre adları büyük/küçük harfe duyarlıdır.",
  },
  endpointsSectionTitle: "API Uç Noktaları",
  endpoints: [
    {
      id: "create-payment-link",
      title: "Ödeme Linki Oluştur",
      method: "POST",
      path: "https://api.onekart.info/user/create_payment_link",
      description:
        "Tek kullanımlık bir ödeme sayfası linki üretir. Yanıttaki url alanına müşterinizi yönlendirdiğinizde kredi kartı ödeme ekranı açılır.",
      meta: [
        { label: "Servis", value: "Kredi Kartı" },
        { label: "Metot", value: "POST" },
        { label: "Yetki", value: "X-Api-Key" },
        { label: "Para Birimi", value: "TRY" },
        { label: "Link Geçerliliği", value: "15 Dakika" },
      ],
      paramTitle: "Parametreler",
      params: [
        { name: "X-Api-Key", type: "string (header)", required: "yes", description: "Site API anahtarınız. HTTP header olarak gönderilir." },
        { name: "user_id", type: "string (maks. 64)", required: "yes", description: "Sisteminizdeki benzersiz müşteri ID. Callback'te UserCode olarak döner." },
        { name: "amount", type: "float (maks. 18,2)", required: "yes", description: "Yatırım tutarı (TRY). Minimum, site ayarınıza göre belirlenir. Ondalık ayırıcı olarak nokta kullanın." },
        { name: "return_url", type: "string (maks. 512)", required: "yes", description: "Ödeme sonrası müşterinin yönlendirileceği URL." },
        { name: "transaction_id", type: "string (maks. 128)", required: "yes", description: "Kendi benzersiz işlem ID'niz. Callback'in CustomField alanında geri döner." },
        { name: "name", type: "string (maks. 100)", required: "optional", description: "Müşteri ad soyad. Ödeme sayfasında gösterilir." },
      ],
      requestLabel: "İstek Örneği (cURL)",
      requestSample: SAMPLE_CREATE_PAYMENT_LINK_REQ,
      responseLabel: "Başarılı Yanıt (200 OK)",
      responseSample: SAMPLE_CREATE_PAYMENT_LINK_RES,
      notes: [
        "expires_at alanı UTC+3 (Europe/Istanbul) saat diliminde YYYY-MM-DD HH:mm:ss formatındadır.",
      ],
      errorTitle: "Hata Yanıtları",
      errors: [
        { code: "400", description: "Eksik/geçersiz parametre veya tutar site minimumunun altında." },
        { code: "401", description: "Eksik veya geçersiz API anahtarı." },
        { code: "429", description: "Çok fazla istek (rate limit)." },
      ],
    },
    {
      id: "deposit-status",
      title: "Yatırım Durumu",
      method: "GET",
      path: "https://api.onekart.info/user/deposit_status",
      description:
        "Bir yatırımın anlık durumunu sorgular. Callback kullanamıyorsanız polling için kullanın; production'da callback önerilir.",
      meta: [
        { label: "Servis", value: "Kredi Kartı" },
        { label: "Metot", value: "GET" },
        { label: "Yetki", value: "ref + token" },
      ],
      paramTitle: "Query Parametreleri",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Yatırım referansı." },
        { name: "token", type: "string", required: "yes", description: "Yatırım token'ı." },
      ],
      requestLabel: "İstek Örneği (cURL)",
      requestSample: SAMPLE_DEPOSIT_STATUS_REQ,
      responseLabel: "Yanıt Örneği",
      responseSample: SAMPLE_DEPOSIT_STATUS_RES,
      statusPills: [
        { value: "pending", label: "Ödeme/onay bekliyor", tone: "warn" },
        { value: "approved", label: "Tamamlandı", tone: "ok" },
        { value: "rejected", label: "Reddedildi", tone: "bad" },
        { value: "cancelled", label: "İptal", tone: "info" },
      ],
      errorTitle: "Hata Yanıtları",
      errors: [
        { code: "404", description: "Kayıt bulunamadı." },
        { code: "422", description: "ref ve token zorunludur." },
        { code: "429", description: "Çok fazla istek (rate limit)." },
      ],
    },
    {
      id: "cancel-deposit",
      title: "Yatırım İptal",
      method: "POST",
      path: "https://api.onekart.info/user/cancel_deposit",
      description:
        "Bekleyen (pending) bir yatırımı iptal eder. Onaylanmış, reddedilmiş veya işleme alınmış yatırımlar iptal edilemez.",
      meta: [
        { label: "Servis", value: "Kredi Kartı" },
        { label: "Metot", value: "POST" },
        { label: "Yetki", value: "ref + token" },
      ],
      paramTitle: "Parametreler",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Yatırım referansı." },
        { name: "token", type: "string", required: "yes", description: "Yatırım token'ı." },
      ],
      requestLabel: "İstek Örneği (cURL)",
      requestSample: SAMPLE_CANCEL_DEPOSIT_REQ,
      responseLabel: "Başarılı Yanıt (200 OK)",
      responseSample: SAMPLE_CANCEL_DEPOSIT_RES,
      errorTitle: "Hata Yanıtları",
      errors: [
        { code: "404", description: "Kayıt bulunamadı." },
        { code: "409", description: "İptal edilemez (onaylı/reddedilmiş/işlemde)." },
        { code: "422", description: "ref ve token zorunludur." },
      ],
    },
  ],
  webhook: {
    title: "Yatırım Callback Bildirimi",
    intro:
      "Bir yatırım onaylandığında, reddedildiğinde veya iptal edildiğinde, site ayarlarınızda tanımlı callback_url_deposit adresine otomatik POST atılır. CheckSum'ı doğrulayın, ardından müşteri bakiyesini güncelleyin.",
    payloadTitle: "Callback Payload (sunucunuza gönderilir)",
    responseTitle: "Beklenen Yanıt",
    checksumTitle: "CheckSum Doğrulama (zorunlu)",
    checksumSample: SAMPLE_CHECKSUM,
    tableTitle: "StatusCode Referansı",
    tableHeaders: ["StatusCode", "Ne Zaman Tetiklenir", "Sizden Beklenen"],
    rows: [
      { statusCode: "1", when: "Yatırım onaylandığında", action: "Müşteri bakiyesine yansıtın." },
      { statusCode: "2", when: "Yatırım reddedildiğinde", action: "Müşteriyi bilgilendirin; bakiye değişmez." },
      { statusCode: "3", when: "Yatırım iptal edildiğinde", action: "Bekleyen kaydı kapatın; bakiye değişmez." },
    ],
    setupTitle: "Notlar",
    setupItems: [
      "Amount her zaman 2 ondalık basamakla formatlanır (örn. \"1500.00\").",
      "TraderKey site API anahtarınızdır; CustomField gönderdiğiniz transaction_id değerini taşır.",
      "Callback URL'iniz HTTP 200 dönmelidir. 2xx dışı yanıtta teslimat başarısız olarak loglanır.",
    ],
  },
};
