---
name: recur-entitlements
description: Implement access control and permission checking with Recur entitlements API. Use when building paywalls, checking subscription status, gating premium features, or when user mentions "paywall", "權限檢查", "entitlements", "access control", "premium features". Taiwan subscription billing via PAYUNi (recur.tw, 台灣訂閱金流).
license: MIT
metadata:
  author: recur
  version: "0.0.13"
---

# Recur Entitlements & Access Control

You are helping implement access control using Recur's entitlements system. Entitlements let you check if a customer has access to your products (subscriptions or one-time purchases).

## Quick Start: Client-Side Check

```tsx
import { RecurProvider, useCustomer } from 'recur-tw'
// Your own hook, defined in "Knowing when the answer is real" below.
import { useEntitlementsReady } from './hooks/use-entitlements-ready'

// The identifier you hand the provider. Pass the same value to the readiness hook.
const customerEmail = 'user@example.com'

// 1. Wrap app with provider and identify customer
function App() {
  return (
    <RecurProvider
      config={{ publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY }}
      customer={{ email: customerEmail }}
    >
      <MyApp />
    </RecurProvider>
  )
}

// 2. Check access anywhere in your app
function PremiumFeature() {
  const { check } = useCustomer()
  const ready = useEntitlementsReady(customerEmail)

  if (!ready) return <div>Loading...</div>

  const { allowed } = check('pro-plan')

  if (!allowed) {
    return <UpgradePrompt />
  }

  return <PremiumContent />
}
```

### Knowing when the answer is real

`useCustomer()` has no "initialized" flag. `isLoading` starts `false` because the request
only begins in an effect, and `customer` is `null` both before the request and when the
customer genuinely does not exist — so neither one can tell "not fetched yet" from "no such
customer". Gating on `isLoading` alone flashes an upgrade prompt on the first paint; gating
on `!customer` leaves a brand-new customer on the spinner forever.

Track the first completed load yourself:

```tsx
// hooks/use-entitlements-ready.ts
import { useEffect, useRef, useState } from 'react'
import { useCustomer } from 'recur-tw'

// `customerKey` is the identifier you pass to RecurProvider (email, externalId or id).
export function useEntitlementsReady(customerKey: string | null | undefined) {
  const { isLoading, error, customer } = useCustomer()
  const [ready, setReady] = useState(false)
  const [seenKey, setSeenKey] = useState(customerKey)
  const pending = useRef(false)
  const switched = useRef(false)

  // Adjusted during render, not in an effect: RecurProvider kicks off the new request
  // from an effect and leaves the old cache with `isLoading === false` until it does,
  // so an effect-only guard would still pass for one render after a switch.
  if (customerKey !== seenKey) {
    setSeenKey(customerKey)
    setReady(false)
    switched.current = true
  }

  useEffect(() => {
    if (isLoading) {
      pending.current = true
      setReady(false)          // a new fetch: the cache still holds the previous customer
    } else if (pending.current) {
      pending.current = false
      setReady(!error)         // ready only when that request actually succeeded
    }
  }, [isLoading, error])

  // A customer already in the cache proves a request finished. Without this, a gate that
  // first mounts AFTER the provider settled never sees isLoading go true, so it would wait
  // forever. Only before a switch: afterwards the cache still holds the previous customer.
  return ready || (!switched.current && !isLoading && customer !== null)
}
```

The `!error` reset matters because the SDK restores its last successful cache on a failed
request and still clears `isLoading`; without it a failed fetch would open the guard over
whatever was cached before. Read `error` from `useCustomer()` to tell "still loading" from
"the fetch failed".

It stays `false` if you did not pass a `customer` to `RecurProvider`, because no request
ever runs — that is the case to catch in development.

### Mount the gate with the provider

Put the guard in one component directly under `RecurProvider`, not in every leaf:

```tsx
function EntitlementsGate({ children }: { children: React.ReactNode }) {
  const ready = useEntitlementsReady(customerEmail)
  if (!ready) return <Spinner />
  return <>{children}</>
}

<RecurProvider config={{ publishableKey }} customer={{ email: customerEmail }}>
  <EntitlementsGate>
    <App />          {/* everything below can call check() freely */}
  </EntitlementsGate>
</RecurProvider>
```

A gate that mounts with the provider watches the whole request, which is the only way the
hook sees the load at all. A gate that first mounts much later relies on the cache fallback
in the last line of the hook, and that cannot help when the customer does not exist in
Recur: the entitlements endpoint answers `200` with `customer: null` both for "no such
customer" and for "not fetched yet", so a late-mounted gate for an unknown customer waits.

### What this hook cannot do

It does not make a customer switch safe. `RecurProvider` has no request sequencing: when
the identifier changes it starts a second request while the first is still in flight, and
whichever lands last wins. The previous customer's response can overwrite the new one's
cache and clear the shared `isLoading` flag, at which point this hook reports ready over the
wrong data. The render-time reset narrows the window but cannot close it from outside the
SDK.

So if one session can switch between customers in place, do not treat the client cache as an
authorization decision. Confirm on the server, where you hold the secret key and read the
customer you actually mean. Remounting the app on a switch also avoids the overlap.


## Customer Identification

Identify customers using one of these methods:

```tsx
// By email (most common)
<RecurProvider customer={{ email: 'user@example.com' }}>

// By your system's user ID
<RecurProvider customer={{ externalId: 'user_123' }}>

// By Recur customer ID
<RecurProvider customer={{ id: 'cus_xxx' }}>
```

## Checking Access

### Synchronous Check (Cached)

Fast, uses cached data. Good for UI rendering.

```tsx
const { check } = useCustomer()

// Check by product slug
const { allowed, entitlement } = check('pro-plan')

// Check by product ID (a CUID from list_products, e.g. 'cmfxq8n2a0001l8yz3k5p9t7d'; 'prod_xxx' is a placeholder)
const { allowed } = check('prod_xxx')

if (allowed) {
  // User has access
  // entitlement contains details like status, expiresAt
}
```

### Async Check (Live)

Refetches before answering. Useful, but **not authoritative** — see the warning below.

```tsx
const { check } = useCustomer()

// Refetches, then answers
const { allowed, entitlement } = await check('pro-plan', { live: true })

// Good for:
// - Refreshing the UI after checkout
// - When cached data is probably stale
```

> **`{ live: true }` can answer from the previous snapshot.** In the current SDK it awaits
> the refetch and then calls the synchronous check captured by the render it was called
> from, so the fresh data is in the cache but the answer is not computed from it. Right
> after a purchase it can still say `false`.
>
> Never use it as the gate on something that matters — granting access, releasing a
> download, starting paid work. Check on the server with the secret key instead. On the
> client, `{ live: true }` is a way to refresh what the user sees, not a decision.

### Manual Refetch

```tsx
const { refetch } = useCustomer()

// After checkout completion
onPaymentComplete: async () => {
  await refetch() // Refresh entitlements
  router.push('/dashboard')
}
```

## Entitlement Response Structure

```typescript
interface CheckResult {          // what check() returns
  allowed: boolean
  reason?: 'no_customer' | 'no_entitlement' | 'not_found' | 'expired' | 'insufficient_balance'
  entitlement?: Entitlement
  balance?: number               // CREDITS products
  unlimited?: boolean
  subscription?: { id: string; status: string; product: { id: string; slug: string; name: string }; currentPeriodEnd: string }
}

interface Entitlement {
  product: string        // Product slug
  productId: string      // Product ID (CUID)
  status: EntitlementStatus
  source: 'subscription' | 'order'  // How they got access
  sourceId: string       // Subscription/Order ID
  grantedAt: string      // When access was granted
  expiresAt: string | null  // When access expires (null = permanent)
  subscriptionId?: string
}

type EntitlementStatus =
  | 'active'      // Subscription active
  | 'trialing'    // In trial period
  | 'past_due'    // Payment failed, in grace period
  | 'canceled'    // Cancelled but access until period end
  | 'purchased'   // One-time purchase (permanent)
```

## Server-Side Checking

### Using Server SDK

```typescript
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

// In API route or server action
async function checkAccess(userEmail: string) {
  // Server EntitlementCheckResult is { allowed, subscription? } — there is no
  // `entitlement` field here (that one belongs to the React check()).
  const { allowed, subscription } = await recur.entitlements.check({
    product: 'pro-plan',
    customer: { email: userEmail },
  })

  if (!allowed) {
    throw new Error('Upgrade required')
  }

  return subscription
}
```

### Using REST API Directly

```typescript
// GET /v1/customers/entitlements
const response = await fetch(
  `https://api.recur.tw/v1/customers/entitlements?email=${encodeURIComponent(email)}`,
  {
    headers: {
      'X-Recur-Secret-Key': process.env.RECUR_SECRET_KEY!,
    },
  }
)

// REST responses are snake_case (the API wrapper converts them), unlike the SDK's
// camelCase types: customer { id, email, name, external_id }, subscription | null,
// entitlements[] with product_id / granted_at / expires_at / source_id.
const { customer, subscription, entitlements } = await response.json()
```

## Common Patterns

### Paywall Component

```tsx
function Paywall({
  children,
  product,
  customerKey,
  fallback
}: {
  children: React.ReactNode
  product: string
  /** The identifier passed to RecurProvider, so the guard closes on a customer switch. */
  customerKey: string | null | undefined
  fallback?: React.ReactNode
}) {
  const { check } = useCustomer()
  const ready = useEntitlementsReady(customerKey)

  if (!ready) {
    return <div>Loading...</div>
  }

  const { allowed } = check(product)

  if (!allowed) {
    return fallback || <UpgradePrompt product={product} />
  }

  return <>{children}</>
}

// Usage
<Paywall product="pro-plan" customerKey={customerEmail}>
  <PremiumDashboard />
</Paywall>
```

### Feature Flag Style

```tsx
function useFeature(featureProduct: string, customerKey: string | null | undefined) {
  const { check, error } = useCustomer()
  const ready = useEntitlementsReady(customerKey)

  // `isLoading` alone is not enough here either: it starts false, so the first paint
  // would read an empty cache and report the feature as off.
  if (!ready) {
    return { enabled: false, loading: !error, error, entitlement: undefined }
  }

  const { allowed, entitlement } = check(featureProduct)

  return {
    enabled: allowed,
    loading: false,
    error: null,
    entitlement,
    isTrial: entitlement?.status === 'trialing',
    isPastDue: entitlement?.status === 'past_due',
  }
}

// Usage
function MyComponent() {
  const { enabled, isTrial } = useFeature('pro-plan', customerEmail)

  if (!enabled) return <UpgradeButton />

  return (
    <>
      {isTrial && <TrialBanner />}
      <ProFeature />
    </>
  )
}
```

### API Middleware

```typescript
// middleware/requireSubscription.ts
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function requireSubscription(
  req: Request,
  product: string
) {
  const userEmail = await getUserEmail(req) // Your auth logic

  const { allowed } = await recur.entitlements.check({
    product,
    customer: { email: userEmail },
  })

  if (!allowed) {
    throw new Response(JSON.stringify({ error: 'Subscription required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Usage in API route
export async function GET(req: Request) {
  await requireSubscription(req, 'pro-plan')

  // User has access, continue...
  return Response.json({ data: 'premium content' })
}
```

### Multiple Product Tiers

```tsx
function PricingGate({ customerKey }: { customerKey: string | null | undefined }) {
  const { check } = useCustomer()
  const ready = useEntitlementsReady(customerKey)

  if (!ready) return <div>Loading...</div>

  const hasPro = check('pro-plan').allowed
  const hasEnterprise = check('enterprise-plan').allowed

  if (hasEnterprise) {
    return <EnterpriseDashboard />
  }

  if (hasPro) {
    return <ProDashboard />
  }

  return <FreeDashboard />
}
```

## Handling Edge Cases

### Past Due Subscriptions

```tsx
const { allowed, entitlement } = check('pro-plan')

if (allowed && entitlement?.status === 'past_due') {
  // Show warning but allow access during grace period
  return (
    <>
      <PaymentFailedBanner />
      <PremiumContent />
    </>
  )
}
```

### Trial Subscriptions

```tsx
const { entitlement } = check('pro-plan')

if (entitlement?.status === 'trialing') {
  const trialEnds = new Date(entitlement.expiresAt!)
  const daysLeft = Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return <TrialBanner daysLeft={daysLeft} />
}
```

### Cancelled but Active

```tsx
const { entitlement } = check('pro-plan')

if (entitlement?.status === 'canceled') {
  // User cancelled but still has access until period end
  return (
    <>
      <ResubscribeBanner expiresAt={entitlement.expiresAt} />
      <PremiumContent />
    </>
  )
}
```

## Denial Reasons

When `allowed` is `false`, `CheckResult.reason` says why (`'no_customer' | 'no_entitlement' | 'not_found' | 'expired' | 'insufficient_balance'`):

```typescript
const { allowed, reason } = check('pro-plan')

if (!allowed) {
  switch (reason) {
    case 'no_customer':
      // Customer not found
      return <CreateAccountPrompt />

    case 'no_entitlement':
      // No subscription to this product
      return <SubscribePrompt />

    case 'expired':
      // Subscription/access expired
      return <RenewPrompt />

    case 'insufficient_balance':
      // For credit-based products
      return <BuyCreditsPrompt />

    default:
      return <GenericUpgradePrompt />
  }
}
```

## Best Practices

1. **Use cached checks for UI** - Fast rendering, good UX
2. **Decide on the server** - Anything that grants access, releases a file or starts paid
   work is checked with the secret key. `{ live: true }` refreshes the UI; it can still
   answer from the previous snapshot, so it is not an authorization decision
3. **Handle all statuses** - active, trialing, past_due, canceled
4. **Refetch after checkout** - Ensure UI updates after purchase
5. **Implement graceful degradation** - Show upgrade prompts, not errors

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-checkout` - Implement purchase flows
- `/recur-webhooks` - Sync entitlements with webhooks
