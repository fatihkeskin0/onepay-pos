export const SAMPLE_CREATE_PAYMENT_LINK_REQ = `POST /backend/user/create_payment_link
Header: X-API-Key: {site_api_key}
Content-Type: application/json

{
  "user_id": "customer_12345",
  "name": "Ahmet Yılmaz",
  "amount": 1500,
  "return_url": "https://merchant.example.com/deposit/return",
  "transaction_id": "ext-ref-001"
}`;

export const SAMPLE_CREATE_PAYMENT_LINK_RES = `{
  "success": true,
  "message": "ok",
  "data": {
    "token": "a1b2c3d4e5f6789012345678abcdef01",
    "url": "https://pay.example.com/pay/a1b2c3d4e5f6789012345678abcdef01",
    "expires_at": "2026-07-05T15:45:00.000Z",
    "amount_editable": false
  }
}`;

export const SAMPLE_CREATE_PAYMENT_LINK_FREE_REQ = `{
  "user_id": "customer_12345",
  "name": "Ahmet Yılmaz",
  "amount": 0,
  "return_url": "https://merchant.example.com/deposit/return",
  "transaction_id": "ext-ref-002"
}`;

export const SAMPLE_DEPOSIT_STATUS_REQ = `GET /backend/user/deposit_status?ref={reference}&token={deposit_token}`;

export const SAMPLE_DEPOSIT_STATUS_RES = `{
  "success": true,
  "message": "ok",
  "data": {
    "status": "approved",
    "amount": 1500,
    "reference": "20260705143052001",
    "reject_reason": null,
    "remaining_seconds": 0,
    "redirect_url": null,
    "provider": "mock"
  }
}`;

export const SAMPLE_CANCEL_DEPOSIT_REQ = `POST /backend/user/cancel_deposit
Content-Type: application/json

{
  "ref": "20260705143052001",
  "token": "64hex_deposit_token..."
}`;

export const SAMPLE_CANCEL_DEPOSIT_RES = `{
  "success": true,
  "message": "ok",
  "data": { "cancelled": true }
}`;

export const SAMPLE_BC_CALLBACK = `POST {callback_url_deposit}
Content-Type: application/json

{
  "TraderKey": "{site_api_key}",
  "TransactionID": 10,
  "UserCode": "customer_12345",
  "Amount": "1500.00",
  "StatusCode": 1,
  "StatusMessage": "Yatırım talebiniz onaylandı.",
  "CustomField": "ext-ref-001",
  "UnixTime": 1748265600,
  "CheckSum": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
}`;

export const SAMPLE_BC_CALLBACK_RESPONSE = `HTTP 200 OK
{ "success": true }`;

export const SAMPLE_CHECKSUM = `canonical = TraderKey + TransactionID + UserCode + Amount + StatusCode + UnixTime
expected  = HMAC-SHA256(canonical, site_api_key).toLowerCase() hex

// Amount always 2 decimal places: "1500.00"
// Verify CheckSum before updating customer balance`;
