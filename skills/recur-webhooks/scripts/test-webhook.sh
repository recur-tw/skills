#!/bin/bash
# Send a test webhook to your local endpoint
#
# Usage:
#   ./test-webhook.sh [endpoint] [event_type]
#
# Example:
#   ./test-webhook.sh http://localhost:3000/api/webhooks/recur checkout.completed

ENDPOINT="${1:-http://localhost:3000/api/webhooks/recur}"
EVENT_TYPE="${2:-checkout.completed}"
SECRET="${RECUR_WEBHOOK_SECRET:-test_secret}"

# Generate timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create payload based on event type (snake_case, whole-TWD amounts — the shapes
# Recur actually sends; see packages/webhooks/src/types.ts / WEBHOOK_EVENT_TYPES)
NOW_TS=$(date +%s)
PERIOD_END=$(date -u -v+1m +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '+1 month' +"%Y-%m-%dT%H:%M:%SZ")
case $EVENT_TYPE in
  "checkout.completed")
    PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_${NOW_TS}",
  "type": "checkout.completed",
  "timestamp": "$TIMESTAMP",
  "data": {
    "id": "checkout_test_123",
    "status": "complete",
    "subtotal": 499,
    "discount": null,
    "amount": 499,
    "currency": "TWD",
    "product_id": "cmfxq8n2a0001l8yz3k5p9t7d",
    "customer": { "id": "cust_test_456", "external_id": null, "email": "test@example.com", "name": "Test User" },
    "customer_email": null,
    "created_at": "$TIMESTAMP",
    "completed_at": "$TIMESTAMP",
    "metadata": null
  }
}
EOF
)
    ;;
  "subscription.activated"|"subscription.cancelled")
    # The dispatcher lowercases enum fields (status, type, billing_reason, reason) before
    # delivery, so ACTIVE/CANCELED arrive as active/canceled. Note that a period-end
    # cancellation still reports "active" until current_period_end — only an immediate
    # cancellation (dashboard, refund) reports "canceled". Override with CANCEL_STATUS to
    # test the other shape.
    STATUS=$([ "$EVENT_TYPE" = "subscription.activated" ] && echo "active" || echo "${CANCEL_STATUS:-active}")
    PAYLOAD=$(cat <<EOF
{
  "id": "evt_test_${NOW_TS}",
  "type": "$EVENT_TYPE",
  "timestamp": "$TIMESTAMP",
  "data": {
    "id": "sub_test_789",
    "customer": { "id": "cust_test_456", "external_id": null, "email": "test@example.com", "name": "Test User" },
    "product_id": "cmfxq8n2a0001l8yz3k5p9t7d",
    "price_id": "cmfxq8n2a0002l8yzabcd1234",
    "status": "$STATUS",
    "original_amount": 499,
    "discount": null,
    "amount": 499,
    "interval": "month",
    "interval_count": 1,
    "next_billing_date": "$PERIOD_END",
    "trial_ends_at": null,
    "current_period_start": "$TIMESTAMP",
    "current_period_end": "$PERIOD_END",
    "created_at": "$TIMESTAMP",
    "updated_at": "$TIMESTAMP"
  }
}
EOF
)
    ;;
  *)
    # Every other event (invoice.*, order.*, refund.*, einvoice.*, ...) has its own required
    # fields, so a generic { id } body would be a fixture this script cannot honestly claim
    # to emulate. Fail instead of sending a misleading payload.
    echo "❌ No fixture for '$EVENT_TYPE'."
    echo "   Supported: checkout.completed, subscription.activated, subscription.cancelled"
    echo "   For other events, copy a real delivery from Dashboard → Webhooks → delivery logs,"
    echo "   or forward live traffic with: npx @recur-tw/cli webhooks listen $ENDPOINT"
    exit 1
    ;;
esac

# Calculate signature: HMAC-SHA256 over the exact body, Base64-encoded (what Recur sends)
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

echo "📤 Sending test webhook..."
echo "Endpoint: $ENDPOINT"
echo "Event: $EVENT_TYPE"
echo "Signature: ${SIGNATURE:0:20}..."
echo ""

# Send request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-recur-signature: $SIGNATURE" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response: $HTTP_CODE"
echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Webhook delivered successfully!"
else
  echo "❌ Webhook delivery failed"
fi
