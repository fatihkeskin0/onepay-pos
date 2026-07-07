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

export const enContent: DocsContent = {
  nav: { home: "Home" },
  tocTitle: "Contents",
  toc: [
    { id: "overview", label: "Overview" },
    { id: "create-payment-link", label: "Create Payment Link" },
    { id: "deposit-status", label: "Deposit Status" },
    { id: "cancel-deposit", label: "Cancel Deposit" },
    { id: "webhook", label: "Deposit Callback" },
  ],
  hero: {
    kicker: "Credit Card Deposit API",
    title: "Integration Documentation",
    lead: "Create a payment session, redirect the customer to the checkout page, and receive the result via a signed callback.",
    securityTitle: "Authentication",
    securityBody:
      "The X-Api-Key header is required for create_payment_link. Send it from your backend only; never expose the key in browser code.",
    baseUrlTitle: "Base URL",
    baseUrlValue: "https://api.onekart.info/user/",
    baseUrlNote: "All endpoints below are called under this base. Parameter names are case-sensitive.",
  },
  endpointsSectionTitle: "API Endpoints",
  endpoints: [
    {
      id: "create-payment-link",
      title: "Create Payment Link",
      method: "POST",
      path: "https://api.onekart.info/user/create_payment_link",
      description:
        "Generates a single-use payment page link. Redirect the customer to the url field in the response to open the credit card checkout.",
      meta: [
        { label: "Service", value: "Credit Card" },
        { label: "Method", value: "POST" },
        { label: "Auth", value: "X-Api-Key" },
        { label: "Currency", value: "TRY" },
        { label: "Link Validity", value: "15 Minutes" },
      ],
      paramTitle: "Parameters",
      params: [
        { name: "X-Api-Key", type: "string (header)", required: "yes", description: "Your site's API key. Sent as an HTTP header." },
        { name: "user_id", type: "string (max. 64)", required: "yes", description: "Unique customer ID in your system. Returned as UserCode in the callback." },
        { name: "amount", type: "float (max. 18,2)", required: "yes", description: "Deposit amount (TRY). Minimum is defined by your site settings. Use a dot as the decimal separator." },
        { name: "return_url", type: "string (max. 512)", required: "yes", description: "URL to redirect the customer to after payment." },
        { name: "transaction_id", type: "string (max. 128)", required: "yes", description: "Your unique transaction ID. Returned in the CustomField of the callback." },
        { name: "name", type: "string (max. 100)", required: "optional", description: "Customer full name. Displayed on the payment page." },
      ],
      requestLabel: "Request Example (cURL)",
      requestSample: SAMPLE_CREATE_PAYMENT_LINK_REQ,
      responseLabel: "Success Response (200 OK)",
      responseSample: SAMPLE_CREATE_PAYMENT_LINK_RES,
      notes: [
        "expires_at is formatted as YYYY-MM-DD HH:mm:ss in UTC+3 (Europe/Istanbul).",
      ],
      errorTitle: "Error Responses",
      errors: [
        { code: "400", description: "Missing/invalid parameter, or amount below the site minimum." },
        { code: "401", description: "Missing or invalid API key." },
        { code: "429", description: "Too many requests (rate limit)." },
      ],
    },
    {
      id: "deposit-status",
      title: "Deposit Status",
      method: "GET",
      path: "https://api.onekart.info/user/deposit_status",
      description:
        "Queries the current status of a deposit. Use for polling when the callback is unavailable; the callback is recommended in production.",
      meta: [
        { label: "Service", value: "Credit Card" },
        { label: "Method", value: "GET" },
        { label: "Auth", value: "ref + token" },
      ],
      paramTitle: "Query Parameters",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Deposit reference." },
        { name: "token", type: "string", required: "yes", description: "Deposit token." },
      ],
      requestLabel: "Request Example (cURL)",
      requestSample: SAMPLE_DEPOSIT_STATUS_REQ,
      responseLabel: "Response Example",
      responseSample: SAMPLE_DEPOSIT_STATUS_RES,
      statusPills: [
        { value: "pending", label: "Awaiting payment/approval", tone: "warn" },
        { value: "approved", label: "Completed", tone: "ok" },
        { value: "rejected", label: "Rejected", tone: "bad" },
        { value: "cancelled", label: "Cancelled", tone: "info" },
      ],
      errorTitle: "Error Responses",
      errors: [
        { code: "404", description: "Record not found." },
        { code: "422", description: "ref and token are required." },
        { code: "429", description: "Too many requests (rate limit)." },
      ],
    },
    {
      id: "cancel-deposit",
      title: "Cancel Deposit",
      method: "POST",
      path: "https://api.onekart.info/user/cancel_deposit",
      description:
        "Cancels a pending deposit. Approved, rejected, or already processing deposits cannot be cancelled.",
      meta: [
        { label: "Service", value: "Credit Card" },
        { label: "Method", value: "POST" },
        { label: "Auth", value: "ref + token" },
      ],
      paramTitle: "Parameters",
      params: [
        { name: "ref", type: "string", required: "yes", description: "Deposit reference." },
        { name: "token", type: "string", required: "yes", description: "Deposit token." },
      ],
      requestLabel: "Request Example (cURL)",
      requestSample: SAMPLE_CANCEL_DEPOSIT_REQ,
      responseLabel: "Success Response (200 OK)",
      responseSample: SAMPLE_CANCEL_DEPOSIT_RES,
      errorTitle: "Error Responses",
      errors: [
        { code: "404", description: "Record not found." },
        { code: "409", description: "Cannot be cancelled (already approved/rejected/processing)." },
        { code: "422", description: "ref and token are required." },
      ],
    },
  ],
  webhook: {
    title: "Deposit Callback Notification",
    intro:
      "When a deposit is approved, rejected, or cancelled, an automatic POST request is sent to the callback_url_deposit defined in your site settings. Verify the CheckSum, then update the customer balance.",
    payloadTitle: "Callback Payload (sent to your server)",
    responseTitle: "Expected Response",
    checksumTitle: "CheckSum Verification (required)",
    checksumSample: SAMPLE_CHECKSUM,
    tableTitle: "StatusCode Reference",
    tableHeaders: ["StatusCode", "Triggered When", "Expected Action"],
    rows: [
      { statusCode: "1", when: "Deposit approved", action: "Credit the customer balance." },
      { statusCode: "2", when: "Deposit rejected", action: "Notify the customer; balance unchanged." },
      { statusCode: "3", when: "Deposit cancelled", action: "Close the pending record; balance unchanged." },
    ],
    setupTitle: "Notes",
    setupItems: [
      "Amount is always formatted with 2 decimal places (e.g. \"1500.00\").",
      "TraderKey is your site API key; CustomField carries the transaction_id you sent.",
      "Your callback URL must return HTTP 200. Return a non-2xx to have the delivery logged as failed.",
    ],
  },
};
