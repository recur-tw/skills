---
name: recur-checkout
description: Implement Recur checkout flows including embedded, modal, and redirect modes. Use when adding payment buttons, checkout forms, subscription purchase flows, or when user mentions "checkout", "結帳", "付款按鈕", "embedded checkout". Taiwan subscription billing via PAYUNi (recur.tw, 台灣訂閱金流).
license: MIT
metadata:
  author: recur
  version: "0.0.13"
---

# Recur Checkout Integration

You are helping implement Recur checkout flows. Everything below is checked against the
`recur-tw` typings (`RecurContextValue`, `UseSubscribeResult`, `CheckoutOptions`,
`RedirectToCheckoutOptions`, `SubscriptionResult`). Product IDs are CUIDs from
`list_products` / the dashboard (e.g. `cmfxq8n2a0001l8yz3k5p9t7d`); `prod_xxx` in the
examples is a placeholder. You can also pass `productSlug`.

## Checkout Modes

| Mode | How | Best For |
|------|-----|----------|
| **Hosted** (recommended) | `useRecur().redirectToCheckout()` → checkout.recur.tw | Any app, works on localhost |
| **Modal** | `useSubscribe()` / `useRecur().checkout()` with provider `checkoutMode: 'modal'` | Quick purchases without leaving the page |
| **Embedded** | same hooks with provider `checkoutMode: 'embedded'` + `containerElementId` | Custom checkout pages |

`checkoutMode` lives on `<RecurProvider config>`, not on the call. The provider default is
`'embedded'`, which throws without `containerElementId` — set `checkoutMode: 'modal'` when
you want the popup. There is no `mode: 'hosted' | 'modal'` option on any call.

## Hosted Checkout (recommended)

`isCheckingOut` is only set by `checkout()`; `redirectToCheckout()` creates the session and
navigates away, so track your own pending flag.

```tsx
'use client'

import { useState } from 'react'
import { useRecur } from 'recur-tw'

function CheckoutButton({ productId }: { productId: string }) {
  const { redirectToCheckout } = useRecur()
  const [redirecting, setRedirecting] = useState(false)

  const handleClick = async () => {
    setRedirecting(true)
    try {
      await redirectToCheckout({
        productId,                            // or productSlug: 'pro-plan'
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/pricing`,
        customerEmail: 'user@example.com',    // optional, pre-fills the checkout page
        customerName: 'John Doe',             // optional
        externalCustomerId: 'user_123',       // optional, links to your user system
      })
    } catch (err) {
      setRedirecting(false)
      console.error('Failed to start checkout:', err)
    }
  }

  return (
    <button onClick={handleClick} disabled={redirecting}>
      {redirecting ? 'Redirecting...' : 'Subscribe'}
    </button>
  )
}
```

The browser navigates away; no callbacks fire. Confirm the payment on your success page
(via the session id) or with webhooks.

## Modal / Embedded Checkout

### Using useSubscribe (recommended for modal)

Callbacks are options of the hook; `subscribe()` takes the checkout options only.

```tsx
'use client'

import { useSubscribe } from 'recur-tw'
import { useRouter } from 'next/navigation'

function SubscribeButton({ productId }: { productId: string }) {
  const router = useRouter()
  const { subscribe, isLoading, error, reset } = useSubscribe({
    onPaymentComplete: (subscription) => {
      // subscription: SubscriptionResult — id, status, productId, amount, currentPeriodEnd
      router.push('/dashboard')
    },
    onPaymentFailed: (error) => {
      console.error('Failed:', error.code, error.message)
      return { action: 'retry' } // or 'close' or 'custom'
    },
    onPaymentCancel: () => console.log('User cancelled'),
  })

  return (
    <>
      <button
        onClick={() => subscribe({ productId, customerEmail: 'user@example.com' })}
        disabled={isLoading}
      >
        {isLoading ? 'Processing...' : 'Subscribe'}
      </button>
      {error && <p className="error" onClick={reset}>{error.message}</p>}
    </>
  )
}
```

`useSubscribe()` returns `{ subscribe, mutate, isLoading, error, reset }` — there is no
`subscription` field; use `onPaymentComplete` for the result.

### Using useRecur().checkout (callbacks inline)

```tsx
'use client'

import { useRecur } from 'recur-tw'

function CheckoutButton({ productId }: { productId: string }) {
  const { checkout, isCheckingOut } = useRecur()

  const handleClick = () =>
    checkout({
      productId,
      customerEmail: 'user@example.com',    // optional; collected in the form if omitted
      customerName: 'John Doe',
      externalCustomerId: 'user_123',
      onPaymentComplete: (subscription) => console.log('Success!', subscription.id, subscription.status),
      onPaymentFailed: (error) => ({ action: 'retry' }),
      onPaymentCancel: () => console.log('User cancelled'),
    })

  return (
    <button onClick={handleClick} disabled={isCheckingOut}>
      {isCheckingOut ? 'Processing...' : 'Subscribe'}
    </button>
  )
}
```

### Provider setup for modal / embedded

```tsx
// Modal (popup)
<RecurProvider
  config={{
    publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY!,
    checkoutMode: 'modal',
  }}
>
  {children}
</RecurProvider>

// Embedded (inline form) — the container must exist in the DOM
<RecurProvider
  config={{
    publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY!,
    checkoutMode: 'embedded',
    containerElementId: 'recur-checkout-container',
  }}
>
  {children}
</RecurProvider>

function CheckoutPage() {
  return (
    <div>
      <h1>Complete Your Purchase</h1>
      {/* Recur renders the payment form here */}
      <div id="recur-checkout-container" />
    </div>
  )
}
```

Modal/embedded checkout needs a registered domain; on `localhost` use Hosted Checkout.

## Option Types

```typescript
// redirectToCheckout()
interface RedirectToCheckoutOptions {
  productId?: string          // or productSlug — one is required
  productSlug?: string
  mode?: 'PAYMENT' | 'SUBSCRIPTION' | 'SETUP'  // usually inferred from the product
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  customerName?: string
  externalCustomerId?: string
}

// checkout() / subscribe()
interface CheckoutOptions {
  productId?: string
  productSlug?: string
  customerEmail?: string
  customerName?: string
  externalCustomerId?: string
  successUrl?: string         // used if 3-D Secure needs a redirect
  cancelUrl?: string
  // checkout() only — for subscribe() pass these to useSubscribe():
  onPaymentComplete?: (subscription: SubscriptionResult) => void
  onPaymentFailed?: (error: CheckoutError) => PaymentFailedAction | void
  onPaymentCancel?: () => void
  onSuccess?: (result: CheckoutResult) => void   // session created (before payment)
  onError?: (error: CheckoutError) => void
}

interface SubscriptionResult {          // onPaymentComplete argument
  id: string
  status: string                        // 'ACTIVE', 'TRIALING', ...
  productId: string
  amount: number                        // whole TWD (499 = NT$499). NEVER divide by 100
  billingPeriod: string
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEndsAt?: string
  nextBillingDate?: string
}
```

No `trialDays`, `quantity`, or `metadata` on these options — trials and pricing come from
the product (the server SDK's `checkoutSessions.create()` does accept `metadata`).

## Product Types

All four types go through the same calls; the product decides the behaviour:

```tsx
redirectToCheckout({ productSlug: 'pro-monthly', successUrl, cancelUrl })  // SUBSCRIPTION (recurring)
redirectToCheckout({ productSlug: 'ebook', successUrl, cancelUrl })        // ONE_TIME
redirectToCheckout({ productSlug: 'credits-100', successUrl, cancelUrl })  // CREDITS (prepaid wallet)
redirectToCheckout({ productSlug: 'support-us', successUrl, cancelUrl })   // DONATION (variable amount)
```

## Listing Products

```tsx
import { useProducts } from 'recur-tw'

function PricingPage() {
  const { data: products, isLoading, error } = useProducts({ type: 'SUBSCRIPTION' })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>{error.message}</div>

  return (
    <div className="pricing-grid">
      {products?.map((product) => (
        <PricingCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

`Product` fields: `id`, `name`, `slug`, `description`, `type`, `billingPeriod`
(`'MONTHLY' | 'YEARLY' | ... | null`), `price` (whole TWD), `currency`, `trialDays`,
`metadata`, `productFamily`, `displayOrder`. There is no `priceFormatted` on the SDK type — format with
`` `NT$${product.price.toLocaleString()}` ``.

## Payment Failed Handling

`CheckoutError.code` is `'PAYMENT_FAILED'` for a declined payment; the gateway's own code
is in `error.details.failure_code` (with `failure_message` and `can_retry`).
`CheckoutErrorDetails` is a union — an array for conflict errors, an object for payment
failures — so narrow it before reading the fields.

```tsx
onPaymentFailed: (error) => {
  const details = Array.isArray(error.details) ? undefined : error.details

  switch (details?.failure_code) {
    case 'CARD_DECLINED':
      return { action: 'retry' }
    case 'INSUFFICIENT_FUNDS':
      return { action: 'custom', customTitle: '餘額不足', customMessage: '請使用其他付款方式' }
    default:
      return details?.can_retry ? { action: 'retry' } : { action: 'close' }
  }
}
```

## Server-Side Checkout (Hosted, no React)

```typescript
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)
const session = await recur.checkoutSessions.create({
  productId: 'prod_xxx',                 // a CUID from list_products
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/cancel',
  customerEmail: 'user@example.com',
  metadata: { plan: 'pro' },             // optional, server-side only
})
// redirect the customer to session.url
```

Or with plain REST:

```typescript
const response = await fetch('https://api.recur.tw/v1/checkout/sessions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.RECUR_SECRET_KEY}`,   // X-Recur-Secret-Key also works
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    productId: 'prod_xxx',
    customerEmail: 'user@example.com',
    successUrl: 'https://yourapp.com/success',
    cancelUrl: 'https://yourapp.com/cancel',
  }),
})

// The session object is the response body itself (no outer `data` wrapper, snake_case keys)
const { url } = await response.json()
// Redirect the customer to `url`. (/v1/checkouts is the embedded-form endpoint, different shape.)
```

## Best Practices

1. **Default to Hosted Checkout** — works everywhere, including localhost
2. **Handle every callback** on modal/embedded — onPaymentComplete, onPaymentFailed, onPaymentCancel
3. **Show loading states** — `isCheckingOut` (useRecur, modal/embedded only) / `isLoading` (useSubscribe); for `redirectToCheckout()` track your own flag
4. **Pre-fill customer info** when you already have it; it is optional
5. **Use externalCustomerId** to link Recur customers to your user system
6. **Test in sandbox first** — `pk_test_` / `sk_test_` keys

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-webhooks` - Receive payment notifications
- `/recur-entitlements` - Check subscription access
