---
name: recur-webhooks
description: Set up and handle Recur webhook events for payment notifications. Use when implementing webhook handlers, verifying signatures, handling subscription events, or when user mentions "webhook", "付款通知", "訂閱事件", "payment notification".
license: MIT
metadata:
  author: recur
  version: "0.0.8"
  verified-against: recur-tw@0.16.1
---

# Recur Webhook Integration

You are helping implement Recur webhooks to receive real-time payment and subscription events.

## Webhook Events

### Core Events (Most Common)

| Event | When Fired |
|-------|------------|
| `checkout.completed` | Payment successful, subscription/order created |
| `subscription.activated` | Subscription is now active |
| `subscription.cancelled` | Subscription was cancelled (access continues until period end) |
| `invoice.paid` | Recurring payment succeeded (renewal) |
| `subscription.payment_failed` | Payment failed, subscription at risk |
| `order.paid` | One-time purchase completed |
| `invoice.refunded` | Invoice was refunded |

### All Supported Events

From the SDK's `WebhookEventType` (unknown future types are also allowed):

```typescript
import type { WebhookEventType } from 'recur-tw/server'

const knownEvents: WebhookEventType[] = [
  // Checkout & orders
  'checkout.completed',
  'order.paid',
  // Subscription lifecycle
  'subscription.created',
  'subscription.activated',
  'subscription.updated',
  'subscription.cancelled',
  'subscription.revoked',
  'subscription.expired',
  'subscription.trial_ending',
  'subscription.payment_failed',
  // Invoices
  'invoice.created',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.refunded',
  // Customer
  'customer.created',
  'customer.updated',
]
```

## Webhook Handler Implementation

Use the server SDK's `recur.webhooks.verify()` — it verifies the HMAC-SHA256
signature (timing-safe) and returns the parsed event, or throws
`WebhookSignatureVerificationError`.

### Next.js App Router

```typescript
// app/api/webhooks/recur/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function POST(request: NextRequest) {
  // Signature verification needs the RAW body — read text() before parsing.
  const payload = await request.text()
  const signature = request.headers.get('x-recur-signature')

  let event
  try {
    event = recur.webhooks.verify(payload, signature, process.env.RECUR_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  switch (event.type) {
    case 'checkout.completed':
      // Payment successful — send welcome email, track conversion
      break
    case 'subscription.activated':
      // Provision resources for the new subscriber
      break
    case 'invoice.paid':
      // Renewal succeeded — extend quotas, update billing records
      break
    case 'subscription.payment_failed':
      // Dunning: notify the user; entitlement enters grace period
      break
    case 'subscription.cancelled':
      // Access continues until period end — confirmation email
      break
    case 'subscription.expired':
    case 'subscription.revoked':
      // Access fully ended — clean up
      break
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
```

### Express.js

```typescript
import express from 'express'
import { Recur, WebhookSignatureVerificationError } from 'recur-tw/server'

const app = express()
const recur = new Recur(process.env.RECUR_SECRET_KEY!)

// Important: use the raw body for signature verification
app.post(
  '/api/webhooks/recur',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const event = recur.webhooks.verify(
        req.body.toString(),
        req.headers['x-recur-signature'] as string,
        process.env.RECUR_WEBHOOK_SECRET!,
      )
      console.log('Received event:', event.type)
      res.json({ received: true })
    } catch (err) {
      if (err instanceof WebhookSignatureVerificationError) {
        res.status(401).json({ error: 'Invalid signature' })
        return
      }
      throw err
    }
  }
)
```

### Manual verification (non-SDK environments)

The signature is `HMAC-SHA256(payload, webhookSecret)` hex-encoded, sent in
the `x-recur-signature` header. Compare with a timing-safe comparison:

```typescript
import crypto from 'crypto'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
```

## Event Payload Structure

```typescript
import type { WebhookEvent } from 'recur-tw/server'

function describe(event: WebhookEvent) {
  return {
    id: event.id,               // Unique event ID — use for idempotency
    type: event.type,           // Event type
    timestamp: event.timestamp, // ISO 8601
    data: event.data,           // Record<string, unknown>, varies by type
  }
}
```

`data` typically contains identifiers such as `customerId`, `customerEmail`,
`subscriptionId`, `orderId`, `productId`, and amounts in the smallest
currency unit.

## Webhook Configuration

1. Go to **Recur Dashboard** → **Settings** → **Webhooks**
2. Click **Add Endpoint**
3. Enter your endpoint URL (e.g., `https://yourapp.com/api/webhooks/recur`)
4. Select events to receive
5. Copy the **Webhook Secret** to your environment variables

## Testing Webhooks Locally

```bash
# Start an ngrok tunnel and use the URL in the Recur dashboard
ngrok http 3000
# https://xxxx.ngrok.io/api/webhooks/recur

# Or send a signed test event to your local endpoint
./scripts/test-webhook.sh http://localhost:3000/api/webhooks/recur checkout.completed
```

## Best Practices

### 1. Always Verify Signatures

Never trust webhook payloads without verification. Pass the **raw request
body** to `verify()` — re-serializing parsed JSON breaks the signature.

### 2. Handle Idempotency

Webhooks may be delivered more than once. Deduplicate by `event.id`:

```typescript
import type { WebhookEvent } from 'recur-tw/server'

// Swap for your database or KV store in production.
const processed = new Set<string>()

async function handleEventOnce(event: WebhookEvent, handle: () => Promise<void>) {
  if (processed.has(event.id)) {
    console.log('Event already processed:', event.id)
    return
  }
  await handle()
  processed.add(event.id)
}
```

### 3. Return 200 Quickly

Recur retries on failures/timeouts. Do heavy work asynchronously (queue) and
respond immediately.

### 4. You Usually Don't Need to Mirror State

For access control, prefer checking entitlements live
(`recur.entitlements.check()`) over rebuilding subscription state from
events — use webhooks for side effects (emails, provisioning, analytics).

## Debugging Webhooks

Recur Dashboard → Webhooks → click endpoint → delivery logs.

**401 Unauthorized** — wrong secret, or body was parsed before verification
(must use raw body).

**Timeout (no response)** — return 200 before heavy processing.

**Missing events** — check event types are selected in the dashboard and the
endpoint URL is reachable.

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-checkout` - Implement payment flows
- `/recur-entitlements` - Check subscription access after webhook
