import type { DocsContent } from "../types";
import {
  SAMPLE_CHECKSUM,
  SAMPLE_CREATE_PAYMENT_LINK_REQ,
  SAMPLE_CREATE_PAYMENT_LINK_RES,
  SAMPLE_DEPOSIT_STATUS_REQ,
  SAMPLE_DEPOSIT_STATUS_RES,
} from "../shared-samples";

export const trContent: DocsContent = {
  tocTitle: "İçindekiler",
  toc: [
    { id: "overview", label: "Genel Bakış" },
    { id: "create-payment-link", label: "Ödeme Linki Oluştur" },
    { id: "deposit-status", label: "Yatırım Durumu" },
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
    baseUrlValue: "/backend/user/",
    baseUrlNote: "Aşağıdaki yolların başına kendi site adresinizi ekleyin (örn. https://siteniz.com/backend/user/). Parametre adları büyük/küçük harfe duyarlıdır.",
  },
  endpointsSectionTitle: "API Uç Noktaları",
  endpoints: [
    {
      id: "create-payment-link",
      title: "Ödeme Linki Oluştur",
      method: "POST",
      path: "/backend/user/create_payment_link",
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
        { name: "user_id", type: "string (maks. 100)", required: "yes", description: "Sisteminizdeki benzersiz müşteri ID. Callback'te UserCode olarak döner." },
        { name: "amount", type: "float (maks. 18,2)", required: "yes", description: "Yatırım tutarı (TRY). Minimum, site ayarınıza göre belirlenir. Ondalık ayırıcı olarak nokta kullanın." },
        { name: "return_url", type: "string (maks. 500)", required: "optional", description: "Ödeme sonrası müşterinin yönlendirileceği URL." },
        { name: "transaction_id", type: "string (maks. 128)", required: "optional", description: "Kendi benzersiz işlem ID'niz. Callback'in CustomField alanında döner; gönderilmezse boş string." },
        { name: "name", type: "string (maks. 100)", required: "optional", description: "Müşteri ad soyad. Ödeme sayfasında gösterilir. Alternatif alan adı: user_name." },
      ],
      requestLabel: "İstek Örneği (cURL)",
      requestSample: SAMPLE_CREATE_PAYMENT_LINK_REQ,
      responseLabel: "Başarılı Yanıt (200 OK)",
      responseSample: SAMPLE_CREATE_PAYMENT_LINK_RES,
      notes: [
        "url, tam ödeme sayfası adresidir ({APP_PAYMENT_URL}/pay/{token}). Müşteriyi bu adrese yönlendirin.",
        "token, ödeme oturum token'ıdır (32 hex karakter); deposit_status'ta kullanılan yatırım token'ı değildir.",
        "expires_at alanı UTC+3 (Europe/Istanbul) saat diliminde YYYY-MM-DD HH:mm:ss formatındadır.",
        "Müşteri 15 dakika içinde ödemeyi tamamlamazsa bekleyen yatırım otomatik iptal edilir. Merchant tarafında iptal API'si yoktur — sonuç callback ile StatusCode 2 olarak gelir.",
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
      path: "/backend/user/deposit_status",
      description:
        "Bir yatırımın anlık durumunu sorgular. ref ve token, müşteri ödeme sayfasında checkout başlattığında oluşan yatırım kimlik bilgileridir; create_payment_link yanıtında dönmez. Merchant backend için polling yerine callback kullanın.",
      meta: [
        { label: "Servis", value: "Kredi Kartı" },
        { label: "Metot", value: "GET" },
        { label: "Yetki", value: "ref + token" },
      ],
      paramTitle: "Query Parametreleri",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Yatırım referansı (checkout akışından; create_payment_link'ten gelmez)." },
        { name: "token", type: "string", required: "yes", description: "ref ile eşleşen yatırım token'ı (checkout akışından)." },
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
      { statusCode: "2", when: "Yatırım reddedildiğinde, iptal edildiğinde veya süresi dolduğunda", action: "Müşteriyi bilgilendirin; bakiye değişmez." },
    ],
    setupTitle: "Notlar",
    setupItems: [
      "Amount her zaman 2 ondalık basamakla formatlanır (örn. \"1500.00\").",
      "TraderKey site API anahtarınızdır; CustomField gönderdiğiniz transaction_id değerini taşır (gönderilmezse boş string).",
      "İptal ve süresi dolan yatırımlar da reddedilmiş gibi StatusCode 2 ile bildirilir.",
      "Callback istekleri 10 saniye sonra zaman aşımına uğrar. 2xx dışı yanıtlar yalnızca sunucu konsoluna loglanır; yeniden denenmez.",
    ],
  },
};
