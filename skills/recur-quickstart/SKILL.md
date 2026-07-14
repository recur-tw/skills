---
name: recur-quickstart
description: Quick setup guide for Recur payment integration. Use when starting a new Recur integration, setting up API keys, installing the SDK, or when user mentions "integrate Recur", "setup Recur", "Recur 串接", "金流設定".
license: MIT
metadata:
  author: recur
  version: "0.0.8"
  verified-against: recur-tw@0.16.1
---

# Recur Quickstart

You are helping a developer integrate Recur, Taiwan's subscription payment platform (similar to Stripe Billing).

## Fastest Path: Start from a Template

For a **new project**, don't wire Recur by hand — scaffold a template with
everything pre-integrated (checkout, webhooks, entitlements gate, customer
portal):

```bash
npm create recur-tw@latest my-app -- --template saas
# or browse templates: https://github.com/recur-tw/templates
```

Then follow the template's `AGENTS.md` to customize. The steps below are for
integrating Recur into an **existing** app.

## Step 1: Install SDK

```bash
pnpm add recur-tw
# or
npm install recur-tw
```

## Step 2: Get API Keys

API keys are available in the Recur dashboard at `app.recur.tw` → Settings → Developers.

**Key formats:**
- `pk_test_xxx` - Publishable key (frontend, safe to expose)
- `sk_test_xxx` - Secret key (backend only, never expose)
- `pk_live_xxx` / `sk_live_xxx` - Production keys

**Environment variables to set:**
```bash
NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY=pk_test_xxx
RECUR_SECRET_KEY=sk_test_xxx
```

## Step 3: Add Provider (React)

Wrap your app with `RecurProvider`:

```tsx
'use client'

import { RecurProvider } from 'recur-tw'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RecurProvider
      config={{
        publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY,
      }}
    >
      {children}
    </RecurProvider>
  )
}
```

## Step 4: Create Your First Checkout

Use **Hosted Checkout** (`redirectToCheckout`) — it works on any domain
including localhost. (The on-page `checkout()` requires a domain registered
with Recur; see `/recur-checkout`.)

```tsx
'use client'

import { useRecur } from 'recur-tw'

export function PricingButton({ productId }: { productId: string }) {
  const { redirectToCheckout, isCheckingOut } = useRecur()

  const handleCheckout = async () => {
    await redirectToCheckout({
      productId,
      successUrl: `${window.location.origin}/success`,
      cancelUrl: `${window.location.origin}/pricing`,
    })
  }

  return (
    <button onClick={handleCheckout} disabled={isCheckingOut}>
      {isCheckingOut ? '處理中…' : 'Subscribe'}
    </button>
  )
}
```

## Step 5: Set Up Webhooks

Create a webhook endpoint to receive payment notifications. See the
`/recur-webhooks` skill — the server SDK's `recur.webhooks.verify()` handles
signature verification for you.

## Quick Verification Checklist

- [ ] SDK installed (`pnpm list recur-tw`)
- [ ] Environment variables set
- [ ] RecurProvider wrapping app
- [ ] Test checkout works in sandbox (test cards below)
- [ ] Webhook endpoint configured

**PAYUNi 測試卡號** (sandbox):
- VISA:`4147-6310-0000-0001`,JCB:`3560-5110-0000-0001`
- 到期日:任意未來日期;CVV:任意三碼

## Common Issues

### "Invalid API key"
- Check key format: must start with `pk_test_`, `sk_test_`, `pk_live_`, or `sk_live_`
- Ensure using publishable key for frontend, secret key for backend

### "Product not found"
- Verify product exists in Recur dashboard
- Check you're using correct environment (sandbox vs production)

### Checkout fails on localhost
- The on-page `checkout()` (embedded/modal) only works on registered
  domains — use `redirectToCheckout()` during local development

### Checkout not appearing
- Ensure `RecurProvider` wraps your app
- Check browser console for errors
- Verify publishable key is correct

## Next Steps

- `/recur-checkout` - Checkout flow options (hosted / embedded / payment links)
- `/recur-webhooks` - Set up payment notifications
- `/recur-entitlements` - Implement access control
- `/recur-portal` - Customer self-service portal

## Resources

- [Recur Documentation](https://recur.tw/docs)
- [SDK on npm](https://www.npmjs.com/package/recur-tw)
- [Templates](https://github.com/recur-tw/templates)
