---
name: recur-entitlements
description: Implement access control and permission checking with Recur entitlements API. Use when building paywalls, checking subscription status, gating premium features, or when user mentions "paywall", "權限檢查", "entitlements", "access control", "premium features".
license: MIT
metadata:
  author: recur
  version: "0.0.8"
  verified-against: recur-tw@0.16.1
---

# Recur Entitlements & Access Control

You are helping implement access control using Recur's entitlements system. Entitlements let you check if a customer has access to your products (subscriptions or one-time purchases).

**Golden rule: client-side checks are for UI only.** Anything that must not
be bypassed (API responses, premium actions, content delivery) must be gated
server-side with `recur-tw/server`.

## Quick Start: Client-Side Check

```tsx
'use client'

import { RecurProvider, useCustomer } from 'recur-tw'

// 1. Wrap app with provider and identify the customer
export function App({ children }: { children: React.ReactNode }) {
  return (
    <RecurProvider
      config={{ publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY }}
      customer={{ email: 'user@example.com' }}
    >
      {children}
    </RecurProvider>
  )
}

// 2. Check access anywhere in your app
export function PremiumFeature() {
  const { check, isLoading } = useCustomer()

  if (isLoading) return <div>Loading...</div>

  const { allowed } = check('pro-plan')

  if (!allowed) {
    return <a href="/pricing">升級方案</a>
  }

  return <div>Premium content</div>
}
```

## Customer Identification

Identify customers on the provider using one of these (in priority order:
`id` &gt; `externalId` &gt; `email`):

```tsx no-check
<RecurProvider customer={{ email: 'user@example.com' }}>   // by email (most common)
<RecurProvider customer={{ externalId: 'user_123' }}>      // by your system's user ID
<RecurProvider customer={{ id: 'cus_xxx' }}>               // by Recur customer ID
```

## Checking Access (client)

### Synchronous check (cached — good for UI rendering)

```tsx
'use client'

import { useCustomer } from 'recur-tw'

export function GatedBlock() {
  const { check } = useCustomer()

  // By product slug (string shorthand) or object form
  const { allowed, entitlement, reason } = check('pro-plan')

  if (!allowed) {
    // reason: 'no_customer' | 'no_entitlement' | 'not_found'
    //       | 'expired' | 'insufficient_balance'
    return <a href="/pricing">Subscribe ({reason})</a>
  }

  // entitlement: status, source ('subscription' | 'order'),
  // grantedAt, expiresAt (null = permanent)
  return <div>Access until: {entitlement?.expiresAt ?? 'forever'}</div>
}
```

### Live check (async — for critical moments)

```tsx
'use client'

import { useCustomer } from 'recur-tw'

export function CriticalAction() {
  const { check } = useCustomer()

  const run = async () => {
    // Fetches fresh data — use after checkout or before important actions
    const { allowed } = await check('pro-plan', { live: true })
    if (!allowed) return
    // proceed...
  }

  return <button onClick={run}>Run</button>
}
```

### Refetch after checkout

```tsx
'use client'

import { useCustomer, useRecur } from 'recur-tw'

export function BuyButton({ productId }: { productId: string }) {
  const { checkout } = useRecur()
  const { refetch } = useCustomer()

  const handleClick = () =>
    checkout({
      productId,
      onPaymentComplete: async () => {
        await refetch() // refresh entitlements so the UI unlocks
      },
    })

  return <button onClick={handleClick}>Buy</button>
}
```

## Entitlement Structure (client)

```typescript
import type { Entitlement, EntitlementStatus } from 'recur-tw'

function describe(e: Entitlement) {
  const status: EntitlementStatus = e.status
  // 'active'    - subscription active
  // 'trialing'  - in trial period
  // 'past_due'  - payment failed, grace period
  // 'canceled'  - cancelled, access until period end
  // 'purchased' - one-time purchase (permanent)
  return {
    product: e.product,     // product slug
    status,
    source: e.source,       // 'subscription' | 'order'
    sourceId: e.sourceId,   // sub_xxx or ord_xxx
    grantedAt: e.grantedAt,
    expiresAt: e.expiresAt, // null = permanent
  }
}
```

## Server-Side Checking

`recur.entitlements.check()` returns `{ allowed, subscription? }` — the
subscription (with `currentPeriodEnd`) is present only when allowed. Use
`recur.entitlements.list()` to get entitlement statuses.

```typescript
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function checkAccess(userEmail: string) {
  const { allowed, subscription } = await recur.entitlements.check({
    product: 'pro-plan',
    customer: { email: userEmail },
  })

  if (!allowed) {
    throw new Error('Upgrade required')
  }

  // subscription?.currentPeriodEnd — end of current billing period
  return subscription
}

export async function listAccess(userEmail: string) {
  const { entitlements } = await recur.entitlements.list({
    customer: { email: userEmail },
  })
  // Each: { product, productId, status, subscriptionId }
  return entitlements
}
```

### Gating an API route

```typescript
import { NextResponse } from 'next/server'
import { Recur } from 'recur-tw/server'
import { auth } from '@/lib/auth' // your auth solution

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { allowed } = await recur.entitlements.check({
    product: 'pro-plan',
    customer: { email: session.user.email },
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  return NextResponse.json({ data: 'premium content' })
}
```

## Common Patterns

### Paywall component

```tsx
'use client'

import { useCustomer } from 'recur-tw'

export function Paywall({
  children,
  product,
  fallback,
}: {
  children: React.ReactNode
  product: string
  fallback?: React.ReactNode
}) {
  const { check, isLoading } = useCustomer()

  if (isLoading) return <div>Loading...</div>

  const { allowed } = check(product)
  if (!allowed) {
    return <>{fallback ?? <a href="/pricing">升級解鎖</a>}</>
  }
  return <>{children}</>
}
```

### Multiple product tiers

```tsx
'use client'

import { useCustomer } from 'recur-tw'

export function TieredDashboard() {
  const { check } = useCustomer()

  if (check('enterprise-plan').allowed) return <div>Enterprise</div>
  if (check('pro-plan').allowed) return <div>Pro</div>
  return <div>Free</div>
}
```

### Status-aware banners

```tsx
'use client'

import { useCustomer } from 'recur-tw'

export function SubscriptionBanner() {
  const { check } = useCustomer()
  const { allowed, entitlement } = check('pro-plan')

  if (!allowed || !entitlement) return null

  if (entitlement.status === 'trialing' && entitlement.expiresAt) {
    const msLeft = new Date(entitlement.expiresAt).getTime() - Date.now()
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    return <div>試用期剩 {daysLeft} 天</div>
  }

  if (entitlement.status === 'past_due') {
    return <div>扣款失敗,請更新付款方式(寬限期內仍可使用)</div>
  }

  if (entitlement.status === 'canceled') {
    return <div>已取消,可使用至 {entitlement.expiresAt}</div>
  }

  return null
}
```

## Denial Reasons

`reason` is present on the check result when `allowed` is false:

```tsx
'use client'

import { useCustomer } from 'recur-tw'

export function UpgradePrompt() {
  const { check } = useCustomer()
  const { allowed, reason } = check('pro-plan')

  if (allowed) return null

  switch (reason) {
    case 'no_customer':
      return <a href="/signup">建立帳號</a>
    case 'no_entitlement':
    case 'not_found':
      return <a href="/pricing">訂閱方案</a>
    case 'expired':
      return <a href="/pricing">重新訂閱</a>
    case 'insufficient_balance':
      return <a href="/credits">購買點數</a>
    default:
      return <a href="/pricing">升級</a>
  }
}
```

## Best Practices

1. **Cached checks for UI, live checks for actions** — `check(slug)` is
   synchronous and instant; `check(slug, { live: true })` guarantees
   freshness.
2. **Server-side gate everything that matters** — the client can be
   bypassed.
3. **Handle all statuses** — active, trialing, past_due, canceled,
   purchased.
4. **Refetch after checkout** — so the UI unlocks without a reload.
5. **Show upgrade prompts, not errors** — graceful degradation converts
   better.

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-checkout` - Implement purchase flows
- `/recur-webhooks` - Side effects when subscriptions change
