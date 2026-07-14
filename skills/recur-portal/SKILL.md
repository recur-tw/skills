---
name: recur-portal
description: Implement Customer Portal for subscription self-service. Use when building account pages, letting customers manage subscriptions, update payment methods, view billing history, or when user mentions "customer portal", "帳戶管理", "訂閱管理", "更新付款方式", "self-service".
license: MIT
metadata:
  author: recur
  version: "0.0.8"
  verified-against: recur-tw@0.16.1
---

# Recur Customer Portal Integration

You are helping implement Recur's Customer Portal, which allows subscribers to self-manage their subscriptions without contacting support.

## What is Customer Portal?

Customer Portal is a hosted page where your customers can:
- View active subscriptions and billing history
- Update payment methods
- Cancel or reactivate subscriptions
- Switch between plans (upgrade/downgrade)

## When to Use

| Scenario | Solution |
|----------|----------|
| "Add account management page" | Create portal session and redirect |
| "Let users update their card" | Portal handles payment method updates |
| "Users need to cancel subscription" | Portal provides self-service cancellation |
| "Show billing history" | Portal displays invoices and payments |

## Quick Start: Create Portal Session

Portal sessions are created server-side (requires Secret Key). Identify the
customer by `customer` (Recur ID, highest priority), `externalId`, or
`email` (lowest priority).

```typescript
import { Recur } from 'recur-tw/server'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function createPortalUrl(email: string) {
  const session = await recur.portal.sessions.create({
    email, // or customer: 'cus_xxx' / externalId: 'user_123'
    returnUrl: 'https://yourapp.com/account',
    locale: 'zh-TW', // or 'en'
  })
  return session.url // redirect the customer here
}
```

## Next.js Implementation

### API Route (App Router)

```typescript
// app/api/portal/route.ts
import { NextResponse } from 'next/server'
import { Recur, RecurAPIError } from 'recur-tw/server'
import { auth } from '@/lib/auth' // your auth solution

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function POST() {
  const session = await auth()

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const portalSession = await recur.portal.sessions.create({
      email: session.user.email,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
      locale: 'zh-TW',
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    if (error instanceof RecurAPIError && error.statusCode === 404) {
      // Customer doesn't exist in Recur — they haven't purchased yet
      return NextResponse.json({ error: 'no_customer' }, { status: 404 })
    }
    console.error('Portal session error:', error)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
```

### Server Action

```typescript
// app/actions/portal.ts
'use server'

import { Recur } from 'recur-tw/server'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export async function openPortal() {
  const session = await auth()

  if (!session?.user?.email) {
    throw new Error('Unauthorized')
  }

  const portalSession = await recur.portal.sessions.create({
    email: session.user.email,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
    locale: 'zh-TW',
  })

  redirect(portalSession.url)
}
```

### Portal Button Component

```tsx
// components/portal-button.tsx
'use client'

import { useState } from 'react'

export function PortalButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/portal', { method: 'POST' })
      const data = await response.json()

      if (data.error === 'no_customer') {
        window.location.href = '/pricing' // nothing to manage yet
        return
      }
      if (!response.ok || !data.url) throw new Error(data.error)

      window.location.href = data.url
    } catch (err) {
      console.error('Failed to open portal:', err)
      setError('無法開啟帳戶管理頁面,請稍後再試')
      setIsLoading(false)
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={isLoading}>
        {isLoading ? '載入中...' : '管理訂閱'}
      </button>
      {error && <p>{error}</p>}
    </div>
  )
}
```

## Portal Session Response

```typescript
import type { PortalSession } from 'recur-tw/server'

function describe(session: PortalSession) {
  return {
    id: session.id,                 // 'portal_sess_xxx'
    url: session.url,               // redirect customer here
    customer: session.customer,     // Recur customer ID
    returnUrl: session.returnUrl,
    status: session.status,         // 'active' | 'expired'
    expiresAt: session.expiresAt,   // sessions last 1 hour
    accessedAt: session.accessedAt, // null until first opened
    createdAt: session.createdAt,
  }
}
```

## Common Patterns

### Account page with conditional portal access

Only show the portal button when the user actually has something to manage:

```tsx
// app/account/page.tsx (server component)
import { Recur } from 'recur-tw/server'
import { auth } from '@/lib/auth'
import { PortalButton } from '@/components/portal-button'

const recur = new Recur(process.env.RECUR_SECRET_KEY!)

export default async function AccountPage() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return <a href="/login">請先登入</a>

  const { entitlements } = await recur.entitlements.list({ customer: { email } })

  return (
    <div>
      <h1>帳戶設定</h1>
      <p>Email: {email}</p>
      {entitlements.length > 0 ? (
        <PortalButton />
      ) : (
        <a href="/pricing">查看方案</a>
      )}
    </div>
  )
}
```

## Portal Configuration

Configure portal behavior in Recur Dashboard → Settings → Customer Portal:

- **Default Return URL**: Where to redirect after leaving portal
- **Allowed Actions**: Enable/disable cancel, update payment, switch plan
- **Branding**: Custom logo and colors

## Security Notes

1. **Server-side only**: Portal sessions require the Secret Key (`sk_xxx`)
2. **Short-lived**: Sessions expire in 1 hour
3. **One-time use**: Each session URL should only be used once
4. **Verify the user**: Always authenticate before creating a portal session
   — never accept an arbitrary email from the client

## Related Skills

- `/recur-quickstart` - Initial SDK setup
- `/recur-checkout` - Implement purchase flows
- `/recur-entitlements` - Check subscription access
