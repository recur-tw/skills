---
name: recur-webhooks
description: Set up and handle Recur webhook events for payment notifications. Use when implementing webhook handlers, verifying signatures, handling subscription events, or when user mentions "webhook", "付款通知", "訂閱事件", "payment notification". Taiwan subscription billing via PAYUNi (recur.tw, 台灣訂閱金流).
license: MIT
metadata:
  author: recur
  version: "0.0.13"
---

# Recur Webhook Integration

You are helping implement Recur webhooks to receive real-time payment and subscription events.

## Webhook Events

### Core Events (Most Common)

| Event | When Fired |
|-------|------------|
| `checkout.completed` | Payment successful, subscription/order created |
| `subscription.activated` | Subscription is now active |
| `subscription.cancelled` | Subscription cancelled — check `data.status` / `data.current_period_end`: period-end cancellation keeps access until that date, while dashboard or refund cancellation revokes it immediately |
| `subscription.renewed` | Recurring payment successful |
| `subscription.past_due` | Payment failed, subscription at risk |
| `invoice.paid` / `invoice.payment_failed` | Invoice outcome. Invoices exist only for renewals and plan switches, so `billing_reason` is `subscription_cycle` or `subscription_update` and **never** `subscription_create` — a first payment produces no invoice. A paid renewal also sends `subscription.renewed`; a failed charge also sends `subscription.past_due` only with a grace period. A renewal with no usable card sends NO invoice event — see `subscription.payment_method_required` / `subscription.revoked` |
| `order.paid` / `order.payment_failed` | An order was paid or failed — **not one-time purchases only**. A subscription's first payment is an order, not an invoice, so both events also carry `billing_reason: 'subscription_create'`, and these are the ONLY events that report that first charge. Handle both branches: `purchase` is the one-time buy, `subscription_create` the signup. An empty `subscription_create` branch silently loses every new subscriber |
| `refund.created` | Refund initiated |

### All Supported Events (`WEBHOOK_EVENT_TYPES` in `recur-tw/server`)

```typescript
type WebhookEventType =
  | 'checkout.created' | 'checkout.completed'
  | 'order.paid' | 'order.payment_failed'
  | 'subscription.created' | 'subscription.activated' | 'subscription.cancelled'
  | 'subscription.revoked' | 'subscription.expired' | 'subscription.trial_ending'
  | 'subscription.upgraded' | 'subscription.downgraded' | 'subscription.renewed'
  | 'subscription.past_due' | 'subscription.payment_method_required'
  | 'subscription.schedule_created' | 'subscription.schedule_executed' | 'subscription.schedule_cancelled'
  | 'invoice.created' | 'invoice.paid' | 'invoice.payment_failed'
  | 'customer.created' | 'customer.updated'
  | 'product.created' | 'product.updated'
  | 'refund.created' | 'refund.succeeded' | 'refund.failed'
  | 'einvoice.issued' | 'einvoice.issue_failed' | 'einvoice.voided' | 'einvoice.allowance_created'
```

There is no `subscription.updated`, `subscription.payment_failed`, or `invoice.refunded`.

## Signature Verification

- Header: `X-Recur-Signature` (read it case-insensitively)
- Algorithm: HMAC-SHA256 over the **raw body**, **Base64** encoded (not hex)
- Use `recur.webhooks.verify(payload, signature, secret)` from `recur-tw/server`; it does a
  constant-time compare and throws `WebhookSignatureVerificationError` on mismatch

## Webhook Handler Implementation

### Next.js App Router

```typescript
// app/api/webhooks/recur/route.ts
import { NextResponse } from 'next/server'
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function POST(request: Request) {
  const payload = await request.text()                       // raw body — never re-serialize
  const signature = request.headers.get('x-recur-signature')

  let event
  try {
    event = recur.webhooks.verify(payload, signature, process.env.RECUR_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // event.data is the object itself (snake_case keys), e.g. event.data.id for checkout,
  // order, subscription and invoice events. einvoice.* payloads have order_id / invoice_id
  // instead, so use the envelope event.id whenever you need an identifier for every event.
  switch (event.type) {
    case 'checkout.completed':
      await handleCheckoutCompleted(event.data)
      break
    case 'subscription.activated':
      await handleSubscriptionActivated(event.data)
      break
    case 'subscription.cancelled':
      await handleSubscriptionCancelled(event.data)
      break
    // A successful renewal emits BOTH invoice.paid and subscription.renewed. A failed
    // CHARGE emits invoice.payment_failed, plus subscription.past_due only when the product
    // has a grace period. Event-id dedupe does not help — the paired events have different
    // ids — so act on the invoice event and treat the subscription one as informational.
    //
    // A renewal with NO usable card emits no invoice event at all: it sends
    // subscription.payment_method_required (grace) or subscription.revoked (no grace).
    // Handle those below, or you will miss those failures entirely.
    case 'invoice.paid':
      // Invoices exist only for renewals and plan switches, so billing_reason here is
      // 'subscription_cycle' or 'subscription_update' — never 'subscription_create'.
      // A subscription's FIRST payment produces no invoice at all; it arrives as
      // order.paid. One-time purchases produce no invoice either.
      if (event.data.billing_reason === 'subscription_cycle') {
        await handleRenewal(event.data)        // extend access, record recurring revenue
      } else {
        await handleSwitchInvoice(event.data)  // 'subscription_update': the plan switch
      }
      break
    case 'order.paid':
      // Orders cover BOTH one-time buys and a subscription's first payment. Nothing else
      // reports that first payment, so both branches have to do real work.
      if (event.data.billing_reason === 'purchase') {
        await handleOneTimePurchase(event.data)
      } else {
        await handleFirstSubscriptionPayment(event.data)   // 'subscription_create'
      }
      break
    case 'order.payment_failed':
      // Same split. A failed signup emits ONLY this event — no invoice.payment_failed
      // follows it — so an empty branch here loses the failure entirely.
      if (event.data.billing_reason === 'purchase') {
        await handlePurchaseFailed(event.data)
      } else {
        await handleSignupFailed(event.data)               // 'subscription_create'
      }
      break
    case 'subscription.renewed':
      break                                    // informational: same renewal as invoice.paid
    case 'invoice.payment_failed':
      await handlePaymentFailure(event.data)   // dunning email, mark at risk
      break
    case 'subscription.past_due':
      break                                    // informational: same failure
    case 'subscription.payment_method_required':
      await handlePaymentFailure(event.data)   // no card on file — no invoice event fires
      break
    case 'subscription.revoked':
      await handleSubscriptionCancelled(event.data)  // access ended immediately
      break
    case 'refund.created':
      await handleRefundCreated(event.data)
      break
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

type Payload = Record<string, unknown>

async function handleCheckoutCompleted(data: Payload) {
  // data.id (checkout id), data.status, data.amount (whole TWD), data.product_id,
  // data.customer { id, email, name }
}
async function handleSubscriptionActivated(data: Payload) {
  // data.id (subscription id), data.status, data.product_id, data.customer
}
async function handleSubscriptionCancelled(data: Payload) {
  // data.id, data.status, data.current_period_end.
  // Period-end cancellation: keep access until current_period_end.
  // Immediate cancellation (dashboard, refund): status is already "canceled" — revoke now.
}
async function handleRenewal(data: Payload) {}          // invoice, 'subscription_cycle'
async function handleSwitchInvoice(data: Payload) {}    // invoice, 'subscription_update'
async function handleOneTimePurchase(data: Payload) {}  // order, 'purchase'
async function handleFirstSubscriptionPayment(data: Payload) {}  // order, 'subscription_create'
async function handlePurchaseFailed(data: Payload) {}   // order failure, 'purchase'
async function handleSignupFailed(data: Payload) {}     // order failure, 'subscription_create'
async function handlePaymentFailure(data: Payload) {}
async function handleRefundCreated(data: Payload) {}
```

### Express.js

```typescript
import express from 'express'
import { Recur } from 'recur-tw/server'
// Your own dispatch — the claim-first version is in "Idempotency" below.
import { handleEvent } from './handle-event'

const app = express()
const recur = new Recur(process.env.RECUR_SECRET_KEY!)

// Use the raw body for signature verification
app.post('/api/webhooks/recur', express.raw({ type: 'application/json' }), async (req, res) => {
  const payload = req.body.toString()
  const signature = req.header('x-recur-signature') ?? null

  let event
  try {
    event = recur.webhooks.verify(payload, signature, process.env.RECUR_WEBHOOK_SECRET!)
  } catch {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Dispatch before answering: a 2xx tells Recur the event is handled.
  try {
    await handleEvent(event)
  } catch (err) {
    console.error('webhook handler failed', event.id, err)
    return res.status(500).json({ error: 'handler failed' })   // Recur retries
  }

  res.json({ received: true })
})
```

### Without the SDK

Two implementations. The first uses Web Crypto and runs anywhere (edge, workers, Node);
the second is the Node-only `node:crypto` version. Web Crypto has no `timingSafeEqual`, so
the first one compares the bytes itself rather than with `===`:

```typescript
async function verifyEdge(payload: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))

  // Constant time over equal-length strings (the length itself is not secret).
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}
```

**Node.js** (`node:crypto`, not available on edge runtimes):

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(payload: string, signature: string | null, secret: string): boolean {
  // Same guards as recur.webhooks.verify(): a missing header or a blank
  // RECUR_WEBHOOK_SECRET must never reach the HMAC.
  if (!signature || !secret) return false

  const expected = createHmac('sha256', secret).update(payload).digest('base64')
  const a = Buffer.from(signature), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

## Event Payload Structure

```typescript
interface WebhookEvent {
  id: string                    // Event ID (for idempotency), e.g. 'evt_abc123'
  type: WebhookEventType
  timestamp: string             // ISO 8601
  data: Record<string, unknown> // the object itself, snake_case keys — NOT { object: {...} }
}

// Most payloads key on data.id; einvoice.* payloads use order_id / invoice_id instead,
// so log or correlate on the envelope event.id when you need something universal.

// Enum-derived fields (status, type, billing_reason, switch_type, reason) are lowercased
// before delivery: "active", "canceled", "complete" — compare against lowercase values.
// The REST API does NOT do this: the same field reads "SUBSCRIPTION_UPDATE" / "ACTIVE"
// there (see openapi.json). Only webhook payloads are lowercased.

// Example: checkout.completed
{
  "id": "evt_abc123",
  "type": "checkout.completed",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "data": {
    "id": "checkout_xyz",
    "status": "complete",
    "subtotal": 990,             // whole TWD, before discount
    "discount": null,
    "amount": 990,               // whole TWD, after discount
    "currency": "TWD",
    "product_id": "cmfxq8n2a0001l8yz3k5p9t7d",
    "customer": { "id": "cust_456", "external_id": null, "email": "user@example.com", "name": "Test User" },
    "customer_email": null,          // only set when the checkout had no customer record yet
    "created_at": "2026-01-15T10:25:00.000Z",
    "completed_at": "2026-01-15T10:30:00.000Z",
    "metadata": null
  }
}
```

## Webhook Configuration

1. **Recur Dashboard** → **Settings** → **Webhooks** → **Add Endpoint** (or MCP `create_webhook`)
2. Enter your endpoint URL (e.g., `https://yourapp.com/api/webhooks/recur`)
3. Select events to receive
4. Copy the **Webhook Secret** into `RECUR_WEBHOOK_SECRET`

The SDK examples build `new Recur(process.env.RECUR_SECRET_KEY!)`, which throws unless that
variable holds a real `sk_` key — a webhook-only service still needs one:

```bash
RECUR_SECRET_KEY=sk_test_xxx       # server key; the Recur client refuses to construct without it
RECUR_WEBHOOK_SECRET=whsec_xxx     # per-endpoint signing secret from the step above
```

The hand-rolled verifiers below need only `RECUR_WEBHOOK_SECRET`.

## Testing Webhooks Locally

```bash
# Expose your dev server
ngrok http 3000
# then register https://xxxx.ngrok.io/api/webhooks/recur in the dashboard

# Or forward live events to your dev server with the CLI (after `npx @recur-tw/cli login`)
npx @recur-tw/cli webhooks listen http://localhost:3000/api/webhooks/recur
```

MCP: `test_webhook` sends a test event to your endpoint; `get_webhook_events` shows deliveries.

## Best Practices

### 1. Always Verify Signatures

Never trust a webhook payload you have not verified — with `recur.webhooks.verify()`, or
with one of the constant-time verifiers above if you are not using the SDK.

### 2. Handle Idempotency

Webhooks may be delivered multiple times, and two deliveries can arrive concurrently.
Read-then-process-then-insert is racy: both requests see no row and both run the side
effects. **Claim the event first** with a unique insert, then process:

```typescript
const LEASE_MS = 5 * 60_000   // a PROCESSING row older than this lost its handler

// Returns true if this delivery owns the event and should process it.
// `token` fences the claim: a worker that lost its lease cannot mark the event DONE.
async function claim(eventId: string, token: string): Promise<boolean> {
  // eventId has a UNIQUE constraint — the insert is the lock.
  try {
    await db.webhookEvent.create({
      data: { eventId, status: 'PROCESSING', claimedAt: new Date(), claimToken: token },
    })
    return true
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
  }

  // The row already exists. Take it over ONLY if it is retryable: a previous attempt
  // failed, or a claim went stale. The conditional update is the atomic part — DONE rows
  // and fresh PROCESSING claims match nothing, so exactly one worker wins.
  const { count } = await db.webhookEvent.updateMany({
    where: {
      eventId,
      OR: [
        { status: 'FAILED' },
        { status: 'PROCESSING', claimedAt: { lt: new Date(Date.now() - LEASE_MS) } },
      ],
    },
    data: { status: 'PROCESSING', claimedAt: new Date(), claimToken: token },
  })
  return count === 1
}

async function handleEvent(event: WebhookEvent) {
  const token = crypto.randomUUID()
  if (!(await claim(event.id, token))) return   // already done, or another delivery owns it
  await processClaimedEvent(event, token)
}

// Takes an event this process already owns. The async worker calls THIS, not handleEvent —
// re-claiming its own fresh PROCESSING row would return false and drop the work.
async function processClaimedEvent(event: WebhookEvent, token: string) {
  try {
    // Process event...

    // Only the current owner may finish it: a worker whose lease expired matches nothing.
    const { count } = await db.webhookEvent.updateMany({
      where: { eventId: event.id, claimToken: token },
      data: { status: 'DONE', processedAt: new Date() },
    })
    if (count === 0) console.warn('lost the claim for', event.id)
  } catch (err) {
    // Mark retryable and return 5xx so Recur redelivers; the next attempt reclaims
    // the FAILED row above instead of being swallowed as a duplicate.
    await db.webhookEvent.updateMany({
      where: { eventId: event.id, claimToken: token },
      data: { status: 'FAILED' },
    })
    throw err
  }
}
```

Only `DONE` is terminal. `FAILED` and stale `PROCESSING` rows are reclaimed by the next
delivery, so a handler that dies mid-flight does not strand the event.

What this does and does not buy you:

- The lease bounds how long a *dead* worker blocks an event. It cannot stop a *slow* worker
  from running past it while a retry reclaims the row; the claim token only stops that
  worker from marking the event DONE. Both may already have run their side effects, so keep
  the side effects idempotent on the underlying object (subscription, order or invoice id),
  not only on the event id.
- `claim()` returning false means "someone else owns it or it is already done". If you
  cannot tell those apart and want the delivery retried, answer 5xx instead of 200 — Recur
  redelivers, and the next attempt either finds it DONE or reclaims an expired lease.
- Nothing here replaces a sweeper. Rows left in `PROCESSING` past the lease with no further
  delivery need a periodic job to reset or alert on them.

### 3. Answering Recur

**A 200 is a promise that you have taken responsibility for the event.** Recur does not
redeliver after a 200, so whatever you skipped is gone unless you retry it yourself.

- **Process synchronously** (the handler above) while the work is short: return 200 on
  success, 5xx on failure, and let Recur's retries do the work. This is the default.
- **Go asynchronous** only if your queue owns durability — retries, a dead-letter queue and
  a replay path. Claim first so duplicates are not enqueued twice, and pass the token so
  the worker completes the row it owns:

  ```typescript
  const token = crypto.randomUUID()
  if (await claim(event.id, token)) {
    try {
      await queue.add('recur-webhook', { event, token }, { attempts: 5, backoff: 'exponential' })
    } catch (err) {
      // The claim exists but nothing owns the work. Release it so the next delivery
      // reclaims the FAILED row, and answer 5xx so Recur actually redelivers —
      // otherwise a 200 here strands the event behind a fresh PROCESSING claim.
      await db.webhookEvent.updateMany({
        where: { eventId: event.id, claimToken: token },
        data: { status: 'FAILED' },
      })
      throw err
    }
  }
  return NextResponse.json({ received: true })
  ```

  The worker calls `processClaimedEvent(event, token)` with that token — not `handleEvent`,
  which would try to claim its own fresh `PROCESSING` row, get `false`, and drop the work.

  A crash between the claim and a successful `queue.add` leaves a fresh `PROCESSING` row
  that no job owns; the next delivery sees `claim() === false` and is acknowledged. Only the
  sweeper recovers that window — run one over rows past the lease, or answer 5xx whenever
  `claim()` returns false so Recur keeps redelivering until the lease expires.

  If that job exhausts its attempts, your dead-letter handling is the only thing left —
  Recur already considers the event delivered.

### 4. Handle Retries Gracefully

Recur retries failed deliveries. Keep handlers idempotent.

### 5. Log the envelope

```typescript
console.log('Webhook received:', { type: event.type, id: event.id, timestamp: event.timestamp })
```

## Debugging Webhooks

Dashboard → Webhooks → endpoint → delivery logs (or MCP `get_webhook_events`).

**401 Unauthorized**
- Wrong `RECUR_WEBHOOK_SECRET`
- Body was re-serialized (`JSON.stringify(await request.json())`) — verify the raw text
- Hand-rolled HMAC in hex — Recur signatures are Base64

**Timeout (no response)**
- Move heavy work off the request, but only behind a durable queue — a 200 tells Recur the
  event is handled and it will not redeliver (see "Answering Recur" above)

**Missing events**
- Event type not selected on the endpoint
- Endpoint URL wrong or not reachable from the internet

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-checkout` - Implement payment flows
- `/recur-entitlements` - Check subscription access after webhook
