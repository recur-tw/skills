---
name: recur-checkout
description: Implement Recur checkout flows including hosted, embedded, and modal modes. Use when adding payment buttons, checkout forms, subscription purchase flows, or when user mentions "checkout", "結帳", "付款按鈕", "embedded checkout".
license: MIT
metadata:
  author: recur
  version: "0.0.8"
  verified-against: recur-tw@0.16.1
---

# Recur Checkout Integration

You are helping implement Recur checkout flows. Recur supports multiple checkout modes for different use cases.

## Choosing a Checkout Mode

| Mode | API | Works on localhost | Best for |
|------|-----|--------------------|----------|
| **Hosted Checkout** (recommended) | `redirectToCheckout()` | ✅ Yes | Most apps — simplest, works on any domain |
| On-page (embedded/modal) | `checkout()` | ❌ No — requires a registered domain | Polished production UX on your own domain |
| Payment Link | `recur.paymentLinks.create()` (server) | ✅ Yes | No-frontend flows: emails, DMs, invoices |

**Default to Hosted Checkout.** The on-page `checkout()` renders the card
form via the PAYUNi SDK and only works on domains registered with Recur —
it will fail during local development.

## Hosted Checkout (recommended)

Redirects to `checkout.recur.tw`; the customer pays and is redirected back
to your `successUrl`.

```tsx
'use client'

import { useRecur } from 'recur-tw'

export function SubscribeButton({ productId }: { productId: string }) {
  const { redirectToCheckout, isCheckingOut } = useRecur()

  const handleClick = async () => {
    await redirectToCheckout({
      productId, // or productSlug: 'pro-plan'
      successUrl: `${window.location.origin}/dashboard?welcome=1`,
      cancelUrl: `${window.location.origin}/pricing`,
      // Optional: pre-fill and link to your user system
      customerEmail: 'user@example.com',
      externalCustomerId: 'user_123',
    })
  }

  return (
    <button onClick={handleClick} disabled={isCheckingOut}>
      {isCheckingOut ? '處理中…' : '訂閱'}
    </button>
  )
}
```

There are no client-side success callbacks in this mode — handle success on
the `successUrl` page (and authoritatively via webhooks / entitlements).

To control the redirect yourself (e.g. open in a new tab):

```tsx
'use client'

import { useRecur } from 'recur-tw'

export function OpenCheckoutInNewTab({ productId }: { productId: string }) {
  const { createCheckoutSession } = useRecur()

  const handleClick = async () => {
    const session = await createCheckoutSession({
      productId,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/pricing`,
    })
    window.open(session.url, '_blank')
  }

  return <button onClick={handleClick}>前往結帳</button>
}
```

## On-page Checkout (embedded / modal)

⚠️ Requires a domain registered with Recur. Does NOT work on localhost —
use Hosted Checkout for local development.

```tsx
'use client'

import { useRecur } from 'recur-tw'

export function CheckoutButton({ productId }: { productId: string }) {
  const { checkout, isCheckingOut } = useRecur()

  const handleClick = async () => {
    await checkout({
      productId, // or productSlug: 'pro-plan'
      customerEmail: 'user@example.com',
      externalCustomerId: 'user_123',
      onPaymentComplete: (subscription) => {
        // subscription.id, subscription.status,
        // subscription.currentPeriodEnd, subscription.trialEndsAt
        console.log('Payment successful!', subscription.id)
      },
      onPaymentFailed: (error) => {
        console.error('Failed:', error.message)
        return { action: 'retry' } // or 'close' or 'custom'
      },
      onPaymentCancel: () => {
        console.log('User cancelled')
      },
    })
  }

  return (
    <button onClick={handleClick} disabled={isCheckingOut}>
      {isCheckingOut ? 'Processing...' : 'Subscribe'}
    </button>
  )
}
```

### Embedded mode container

Embedded mode renders the card form into a container element on your page:

```tsx no-check
// In RecurProvider config
<RecurProvider
  config={{
    publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY,
    checkoutMode: 'embedded', // 'embedded' (default) | 'modal'
    containerElementId: 'recur-checkout-container',
  }}
>
  {children}
</RecurProvider>
```

```tsx
export function CheckoutPage() {
  return (
    <div>
      <h1>Complete Your Purchase</h1>
      {/* Recur renders the payment form here */}
      <div id="recur-checkout-container" />
    </div>
  )
}
```

### Payment failure handling

Failure details live in `error.details` (`failure_code`, `can_retry`):

```tsx
'use client'

import { useRecur, type PaymentFailureDetails } from 'recur-tw'

export function CheckoutWithErrorHandling({ productId }: { productId: string }) {
  const { checkout } = useRecur()

  const handleClick = () =>
    checkout({
      productId,
      onPaymentFailed: (error) => {
        const details = error.details as PaymentFailureDetails | undefined
        switch (details?.failure_code) {
          case 'INSUFFICIENT_FUNDS':
            return {
              action: 'custom' as const,
              customTitle: '餘額不足',
              customMessage: '請使用其他付款方式',
            }
          case 'NETWORK_ERROR':
          case 'TIMEOUT':
            return { action: 'retry' as const }
          default:
            // undefined = use the SDK's default handling
            return undefined
        }
      },
    })

  return <button onClick={handleClick}>Subscribe</button>
}
```

## useSubscribe Hook (with state management)

`useSubscribe()` returns `{ subscribe, isLoading, error, reset }` — success
is reported through the `onPaymentComplete` option, not a return value.

```tsx
'use client'

import { useState } from 'react'
import { useSubscribe, type SubscriptionResult } from 'recur-tw'

export function SubscribeWithState({ productId }: { productId: string }) {
  const [subscription, setSubscription] = useState<SubscriptionResult | null>(null)
  const { subscribe, isLoading, error } = useSubscribe({
    onPaymentComplete: (sub) => {
      setSubscription(sub)
    },
  })

  if (subscription) {
    return <p>Subscribed! ID: {subscription.id}</p>
  }

  return (
    <>
      <button onClick={() => subscribe({ productId })} disabled={isLoading}>
        Subscribe
      </button>
      {error && <p className="error">{error.message}</p>}
    </>
  )
}
```

## Listing Products

`useProducts()` returns `{ data, isLoading, error, refetch }`. Prices are in
the smallest currency unit (`29900` = NT$299).

```tsx
'use client'

import { useProducts } from 'recur-tw'

export function PricingPage() {
  const { data: products, isLoading } = useProducts({
    type: 'SUBSCRIPTION', // 'SUBSCRIPTION' | 'ONE_TIME' | 'CREDITS' | 'DONATION'
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div className="pricing-grid">
      {products?.map((product) => (
        <div key={product.id}>
          <h2>{product.name}</h2>
          <p>
            NT${(product.price / 100).toLocaleString('zh-TW')}
            {product.billingPeriod === 'MONTHLY' && ' / 月'}
            {product.billingPeriod === 'YEARLY' && ' / 年'}
          </p>
          {product.trialDays ? <p>免費試用 {product.trialDays} 天</p> : null}
        </div>
      ))}
    </div>
  )
}
```

Product types: `SUBSCRIPTION` (recurring), `ONE_TIME`, `CREDITS` (prepaid
wallet), `DONATION` (variable amount). All check out the same way.

## Payment Links (server-side, no frontend needed)

Generate a shareable checkout URL from the server:

```typescript
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function createLink() {
  const link = await recur.paymentLinks.create({
    productSlug: 'pro-plan',
    successUrl: 'https://yourapp.com/success',
  })
  return link.url // share via email, DM, invoice, ...
}
```

## Best Practices

1. **Default to Hosted Checkout** — on-page `checkout()` fails outside
   registered domains, including localhost.
2. **Success is confirmed by the server, not the browser** — treat the
   `successUrl` page as UX only; gate access via webhooks/entitlements.
3. **Show loading states** — use `isCheckingOut` to disable buttons.
4. **Use `externalCustomerId`** — links Recur customers to your user system.
5. **Test in sandbox first** — use `pk_test_` keys during development.

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-webhooks` - Receive payment notifications
- `/recur-entitlements` - Check subscription access
