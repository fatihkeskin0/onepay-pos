export const SAMPLE_CREATE_PAYMENT_LINK_REQ = `curl --location '{API_PUBLIC_URL}/user/create_payment_link' \\
--header 'Content-Type: application/json' \\
--header 'X-Api-Key: {site_api_key}' \\
--data-raw '{
  "user_id": "customer_12345",
  "amount": 1500,
  "name": "Ahmet Yilmaz",
  "return_url": "https://merchant.example.com/deposit/return",
  "transaction_id": "ext-ref-001"
}'`;

export const SAMPLE_CREATE_PAYMENT_LINK_RES = `{
  "success": true,
  "message": "ok",
  "data": {
    "token": "a1b2c3d4e5f6789012345678abcdef01",
    "url": "{APP_PAYMENT_URL}/pay/a1b2c3d4e5f6789012345678abcdef01",
    "expires_at": "2026-07-05 18:45:00"
  }
}`;

export const SAMPLE_DEPOSIT_STATUS_REQ = `curl --location '{API_PUBLIC_URL}/user/deposit_status?ref={reference}&token={deposit_token}'`;

export const SAMPLE_DEPOSIT_STATUS_RES = `{
  "success": true,
  "message": "ok",
  "data": {
    "status": "approved",
    "amount": 1500,
    "reference": "20260705143052001",
    "reject_reason": null,
    "remaining_seconds": 0
  }
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

export const SAMPLE_BC_CALLBACK_RESPONSE = `HTTP 200 OK`;

export const SAMPLE_CHECKSUM = `canonical = TraderKey + TransactionID + UserCode + Amount + StatusCode + UnixTime
CheckSum  = HMAC-SHA256(canonical, site_api_key).toLowerCase() hex

// Amount always 2 decimal places: 1000 -> "1000.00"
// Verify CheckSum before updating customer balance`;
