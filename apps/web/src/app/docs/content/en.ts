import type { DocsContent } from "../types";
import {
  SAMPLE_CANCEL_DEPOSIT_REQ,
  SAMPLE_CANCEL_DEPOSIT_RES,
  SAMPLE_CHECKSUM,
  SAMPLE_CREATE_PAYMENT_LINK_FREE_REQ,
  SAMPLE_CREATE_PAYMENT_LINK_REQ,
  SAMPLE_CREATE_PAYMENT_LINK_RES,
  SAMPLE_DEPOSIT_STATUS_REQ,
  SAMPLE_DEPOSIT_STATUS_RES,
} from "../shared-samples";

export const enContent: DocsContent = {
  nav: { home: "Home", panel: "Dashboard" },
  tocTitle: "Contents",
  toc: [
    { id: "overview", label: "Overview" },
    { id: "endpoint-summary", label: "Endpoint Summary" },
    { id: "api-endpoints", label: "API Endpoints" },
    { id: "integration-flow", label: "Integration Flow" },
    { id: "webhook", label: "Webhook Callback" },
    { id: "errors", label: "Error Codes" },
  ],
  hero: {
    kicker: "Quick Start",
    title: "Integration Documentation",
    lead:
      "The OnePOS API provides credit card deposit infrastructure for integrated platforms. REST services create payment sessions, redirect customers to a secure checkout page, and notify results via BetConstruct-compatible webhooks. Credit card deposits only.",
    securityTitle: "Security & Authorization",
    securityBody:
      "The X-API-Key header is required for site API requests. Never expose your API key in client-side (browser) code in production; all requests must originate from your backend server.",
    baseUrlTitle: "Base URL",
    baseUrlValue: "/backend/user/",
    baseUrlNote:
      "All endpoints are called under this prefix (Next.js proxy → API server). Example: POST /backend/user/create_payment_link",
  },
  endpointSummary: {
    title: "Endpoint Summary",
    headers: ["Method", "Endpoint", "Description"],
    rows: [
      {
        method: "POST",
        endpoint: "/user/create_payment_link",
        description: "Create payment session / redirect link",
      },
      {
        method: "GET",
        endpoint: "/user/deposit_status",
        description: "Query deposit status (BetConstruct-compatible polling)",
      },
      {
        method: "POST",
        endpoint: "/user/cancel_deposit",
        description: "Cancel pending deposit",
      },
    ],
  },
  endpointsSectionTitle: "API Endpoints",
  endpoints: [
    {
      id: "create-payment-link",
      method: "POST",
      path: "/user/create_payment_link",
      description:
        "Creates a single-use payment session for the customer. Redirect the customer to the url field in the response to open the credit card checkout. Session expires in 45 minutes. Send amount: 0 for free-amount mode.",
      paramTitle: "Parameter Reference",
      params: [
        { name: "user_id", type: "string", required: "yes", description: "Customer unique ID (callback UserCode)" },
        { name: "name", type: "string", required: "yes", description: "Customer full name" },
        { name: "amount", type: "number", required: "yes", description: "Deposit amount (TRY). 0 = free amount" },
        { name: "return_url", type: "string", required: "optional", description: "Return URL after payment" },
        { name: "transaction_id", type: "string", required: "optional", description: "External reference (callback CustomField)" },
      ],
      requestLabel: "Request",
      requestSample: SAMPLE_CREATE_PAYMENT_LINK_REQ,
      responseLabel: "Success Response (200 OK)",
      responseSample: SAMPLE_CREATE_PAYMENT_LINK_RES,
      notes: [
        "Send amount: 0 for free amount mode. Response returns amount_editable: true.",
        `Free amount request example:\n${SAMPLE_CREATE_PAYMENT_LINK_FREE_REQ}`,
      ],
    },
    {
      id: "deposit-status",
      method: "GET",
      path: "/user/deposit_status?ref={reference}&token={deposit_token}",
      description:
        "Queries the current deposit status. Use for polling if webhooks are unavailable; webhooks are recommended in production.",
      paramTitle: "Query Parameters",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Deposit reference from checkout flow" },
        { name: "token", type: "string", required: "yes", description: "Session or deposit token" },
      ],
      requestLabel: "Query Example",
      requestSample: SAMPLE_DEPOSIT_STATUS_REQ,
      responseLabel: "Response Example",
      responseSample: SAMPLE_DEPOSIT_STATUS_RES,
      statusPills: [
        { value: "pending", label: "Awaiting approval", tone: "warn" },
        { value: "approved", label: "Completed", tone: "ok" },
        { value: "rejected", label: "Rejected", tone: "bad" },
        { value: "cancelled", label: "Cancelled", tone: "info" },
      ],
    },
    {
      id: "cancel-deposit",
      method: "POST",
      path: "/user/cancel_deposit",
      description: "Cancels a pending deposit. Approved or rejected deposits cannot be cancelled.",
      paramTitle: "Parameter Reference",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Deposit reference" },
        { name: "token", type: "string", required: "yes", description: "Deposit token" },
      ],
      requestLabel: "Request",
      requestSample: SAMPLE_CANCEL_DEPOSIT_REQ,
      responseLabel: "Success Response (200 OK)",
      responseSample: SAMPLE_CANCEL_DEPOSIT_RES,
    },
  ],
  flow: {
    title: "Integration Flow",
    steps: [
      "Site Backend → POST create_payment_link (X-API-Key)",
      "Customer → Redirected to data.url checkout page",
      "OnePOS → Credit card payment + 3DS (hosted checkout)",
      "OnePOS → CheckSum-signed webhook POST to callback_url_deposit",
      "Site Backend → Verify CheckSum, update customer balance",
      "Optional → GET deposit_status polling",
    ],
  },
  webhook: {
    title: "Webhook Callback System",
    intro:
      "After deposit approval/rejection/cancellation, OnePOS POSTs to callback_url_deposit defined in the site panel. BetConstruct / OnePay compatible payload format. Webhooks are recommended over polling.",
    flowTitle: "Integration Flow",
    flowSteps: ["Betco / Site", "API call", "OnePOS", "Transaction completes", "Webhook POST", "Betco / Site"],
    payloadTitle: "Callback Payload Sent to Your Server",
    responseTitle: "Return HTTP 200",
    checksumTitle: "CheckSum Verification (Required)",
    checksumSample: SAMPLE_CHECKSUM,
    tableTitle: "StatusCode Reference",
    tableHeaders: ["StatusCode", "Triggered When", "Expected Action"],
    rows: [
      { statusCode: "1", when: "Deposit approved", action: "Credit customer balance" },
      { statusCode: "2", when: "Deposit rejected", action: "Notify customer" },
      { statusCode: "3", when: "Deposit cancelled", action: "Close pending record" },
    ],
    setupTitle: "Webhook URL Configuration",
    setupItems: [
      "Site callback URL: Admin Panel → Sites → edit site → callback_url_deposit",
      "TraderKey field in payload is your site API key",
      "CustomField carries transaction_id from create_payment_link",
      "HTTP 2xx is treated as success; 4xx/5xx are logged",
    ],
  },
  errors: {
    title: "Error Codes",
    intro: 'All errors return { "success": false, "message": "..." }.',
    tableHeaders: ["HTTP", "Message", "Condition"],
    rows: [
      { cells: ["401", "API key required / Invalid API key", "Authentication"] },
      { cells: ["404", "Invalid session / Record not found", "Invalid token or reference"] },
      { cells: ["409", "You have a pending deposit", "Pending within 15 min"] },
      { cells: ["410", "Payment session expired", "Session timeout (45 min)"] },
      { cells: ["422", "user_id required / Enter valid amount", "Validation"] },
      { cells: ["429", "Too many requests", "Rate limit"] },
    ],
  },
};
