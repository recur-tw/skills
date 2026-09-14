---
name: recur-quickstart
description: Quick setup guide for Recur payment integration, from account signup (via the Recur MCP OAuth flow) to the first checkout. Use when starting a new Recur integration, creating a Recur account, setting up API keys, creating a product, installing the SDK, or when user mentions "申請 Recur 帳號", "integrate Recur", "setup Recur", "Recur 串接", "金流設定". Taiwan subscription billing via PAYUNi (recur.tw, 台灣訂閱金流).
license: MIT
metadata:
  author: recur
  version: "0.0.13"
---

# Recur Quickstart

You are helping a developer integrate Recur, Taiwan's subscription payment platform (similar to Stripe Billing).

## Step 0: Account, MCP, and First Product

Skip this step only if the user already has a Recur API key and a product ID.

Recur has no public signup form. **Accounts are created inside the Recur MCP
OAuth flow**, so make sure the `recur` MCP server is connected. Pick ONE:

- **Installed as the `recur-skills` Claude Code plugin** (this skill is
  `/recur-skills:recur-quickstart`): the MCP server is already bundled. Run
  `/mcp`, pick `recur`, authorize. Do NOT run `claude mcp add` — that would
  register a second `recur` server.
- **Claude Code without the plugin** (skill installed via `npx skills add`):

  ```bash
  claude mcp add --transport http recur https://mcp.recur.tw/
  ```

- **Cursor, VS Code, Codex, Gemini CLI, Claude Desktop**: add
  `https://mcp.recur.tw/` as a remote (streamable HTTP) MCP server. One-click
  links and config snippets: https://docs.recur.tw/guides/mcp

Before the first tool call, tell the user what will happen:

> A browser window will open. Log in, or click **建立新帳號** (Create account) on
> the login page to create a Recur account, then approve the connection. Keep
> the default scopes — Step 0 needs `api-keys:write` and `products:write`.
> New accounts start in sandbox mode.

Then, through MCP:

1. `get_setup_overview` — lists the SANDBOX keys and products that already
   exist. Reuse them; only create what is missing (every create call inserts a
   new row, so rerunning this step blindly makes duplicates).
2. `create_api_key` for each SANDBOX key type the overview does NOT show — it
   creates ONE key per call: `type: PUBLISHABLE` and/or `type: SECRET`, with
   `environment: SANDBOX` (`pk_test_…` / `sk_test_…`). A secret key is shown
   only once; store it. An existing secret key cannot be read back — if it was
   lost, create a new one and `revoke_api_key` the old one.
3. `create_product` only if the overview / `list_products` has no matching
   product — e.g. name `Pro`, price `499` (TWD integer, NOT cents), interval
   `month` (MCP takes `month` / `year`; only the CLI flag below spells it
   `monthly`), type `SUBSCRIPTION`. Note the returned product `id` (a CUID
   such as `cm5x…`, not a `prod_` prefix).

No MCP available? The CLI does the same once the user has a secret key from
the dashboard (app.recur.tw → 設定 → 開發者):

```bash
npx @recur-tw/cli login
recur products create --name "Pro" --price 499 --interval monthly --type SUBSCRIPTION
```

Charging real cards requires merchant review (apply from app.recur.tw when
ready); everything else works end-to-end in sandbox.

## Step 1: Install SDK

```bash
pnpm add recur-tw
# or
npm install recur-tw
```

## Step 2: Get API Keys

Use the SANDBOX key pair from Step 0 (MCP `create_api_key`), or copy one from the dashboard at `app.recur.tw` → 設定 → 開發者.

**Key formats:**
- `pk_test_xxx` - Publishable key (frontend, safe to expose)
- `sk_test_xxx` - Secret key (backend only, never expose)
- `pk_live_xxx` / `sk_live_xxx` - Production keys

**Environment variables to set:**
```bash
NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY=pk_test_xxx   # frontend (Next.js needs the NEXT_PUBLIC_ prefix)
RECUR_SECRET_KEY=sk_test_xxx                   # backend only
```

## Step 3: Add Provider (React)

Wrap your app with `RecurProvider`:

```tsx
'use client'

import { RecurProvider } from 'recur-tw'

export default function App({ children }) {
  return (
    <RecurProvider
      config={{
        publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY!,
      }}
    >
      {children}
    </RecurProvider>
  )
}
```

## Step 4: Create Your First Checkout (Hosted)

Hosted Checkout redirects to checkout.recur.tw and works on localhost. (Modal/embedded
checkout via `useSubscribe()` needs `checkoutMode` on the provider and a registered domain —
see `/recur-checkout`.)

```tsx
'use client'   // hooks + window: this must be a Client Component in the App Router

import { useState } from 'react'
import { useRecur } from 'recur-tw'

function PricingButton({ productId }: { productId: string }) {
  const { redirectToCheckout } = useRecur()
  const [redirecting, setRedirecting] = useState(false)   // redirectToCheckout does not set isCheckingOut

  const handleCheckout = async () => {
    setRedirecting(true)
    try {
      await redirectToCheckout({
        productId,                                 // the CUID from Step 0 (or productSlug)
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/pricing`,
      })
    } catch (err) {
      setRedirecting(false)
      // Invalid key, unreachable API, bad product id — show it, don't swallow it
      console.error('Failed to start checkout:', err)
      alert('無法開始結帳，請稍後再試')
    }
  }

  return (
    <button onClick={handleCheckout} disabled={redirecting}>
      {redirecting ? 'Redirecting...' : 'Subscribe'}
    </button>
  )
}
```

The result arrives on your success page and via webhooks (Step 5), not through a callback.

## Step 5: Set Up Webhooks

Create a webhook endpoint to receive payment notifications. See the `recur-webhooks` skill for detailed instructions.

## Quick Verification Checklist

- [ ] Recur account connected via MCP, sandbox API key and product created (Step 0)
- [ ] SDK installed (`pnpm list recur-tw`)
- [ ] Environment variables set
- [ ] RecurProvider wrapping app
- [ ] Test checkout works in sandbox
- [ ] Webhook endpoint configured

## Common Issues

### "Invalid API key"
- Check key format: must start with `pk_test_`, `sk_test_`, `pk_live_`, or `sk_live_`
- Ensure using publishable key for frontend, secret key for backend

### "Product not found"
- Create one first: MCP `create_product`, `recur products create`, or the dashboard
- Use the real `id` returned by `list_products` / `recur products list` (a CUID like
  `cm5x…`; Recur product IDs have no `prod_` prefix), never a placeholder
- Check you're using the correct environment (sandbox vs production keys)

### Checkout not appearing
- Ensure `RecurProvider` wraps your app
- Check browser console for errors
- Verify publishable key is correct

## Next Steps

- `/recur-checkout` - Learn checkout flow options
- `/recur-webhooks` - Set up payment notifications
- `/recur-entitlements` - Implement access control

## Resources

- [Recur Documentation](https://docs.recur.tw)
- [MCP setup for every agent](https://docs.recur.tw/guides/mcp)
- [SDK on npm](https://www.npmjs.com/package/recur-tw)
- [CLI on npm (`@recur-tw/cli`)](https://www.npmjs.com/package/@recur-tw/cli)
- [API Reference](https://docs.recur.tw/api-reference)
