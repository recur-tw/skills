# Recur Skills - Agent Guidelines

This document provides guidance for AI coding agents (Claude Code, Cursor, Windsurf, etc.) working with Recur payment integration skills.

## Repository Overview

This repository contains reusable skills that teach AI agents how to integrate [Recur](https://recur.tw) - Taiwan's subscription payment platform (similar to Stripe Billing). Skills provide step-by-step instructions, code examples, and best practices.

## Directory Structure

```
skills/
├── AGENTS.md              # This file - agent guidelines
├── README.md              # User-facing documentation
├── package.json           # npm package config
├── .claude-plugin/
│   └── marketplace.json   # Claude Code plugin registry
├── scripts/
│   ├── sync-version.js         # Sync version to marketplace + SKILL.md
│   └── typecheck-examples.mjs  # Drift guard: typecheck SKILL.md examples
├── src/                   # recur-skills CLI (list / info / install)
└── skills/
    ├── recur-help/
    ├── recur-quickstart/
    │   └── scripts/check-env.sh
    ├── recur-checkout/
    ├── recur-webhooks/
    │   └── scripts/{test-webhook.sh, verify-signature.ts}
    ├── recur-entitlements/
    └── recur-portal/
```

## Available Skills

| Skill | Purpose | Trigger Keywords |
|-------|---------|------------------|
| `recur-help` | List available skills | "Recur 功能", "help with Recur" |
| `recur-quickstart` | Initial SDK setup | "integrate Recur", "金流設定" |
| `recur-checkout` | Payment flows | "checkout", "結帳", "付款按鈕" |
| `recur-webhooks` | Event handlers | "webhook", "付款通知" |
| `recur-entitlements` | Access control | "paywall", "權限檢查" |
| `recur-portal` | Customer self-service | "customer portal", "帳戶管理" |

## Skill Selection Guidelines

When a user asks about Recur integration, select the appropriate skill based on their task:

1. **Brand-new project** → recommend a template first:
   `npm create recur-tw@latest` ([recur-tw/templates](https://github.com/recur-tw/templates))
2. **New integration in an existing app** → `recur-quickstart`
3. **Adding payment buttons or forms** → `recur-checkout`
4. **Receiving payment notifications** → `recur-webhooks`
5. **Checking subscription status / Paywalls** → `recur-entitlements`
6. **Customer self-service / Account management** → `recur-portal`
7. **Not sure what's available** → `recur-help`

## Integration Context

### Recur SDK (`recur-tw`)

The SDK is available on npm as `recur-tw`:

```bash
pnpm add recur-tw
```

Key exports:
- `RecurProvider` - React context provider
- `useRecur` - Checkout hook (`redirectToCheckout`, `checkout`, `isCheckingOut`)
- `useProducts` - Product listing (returns `{ data, isLoading }`)
- `useCustomer` - Entitlements hook (`check`, `refetch`, `entitlements`)
- `Recur` (from `recur-tw/server`) - Server-side SDK
  (`entitlements`, `portal`, `webhooks`, `paymentLinks`)

### Environment Variables

```bash
NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY=pk_test_xxx  # Frontend
RECUR_SECRET_KEY=sk_test_xxx                    # Backend only
RECUR_WEBHOOK_SECRET=whsec_xxx                  # Webhook verification
```

### Common Patterns

**Provider Setup (Required)**
```tsx
import { RecurProvider } from 'recur-tw'

<RecurProvider config={{ publishableKey: process.env.NEXT_PUBLIC_RECUR_PUBLISHABLE_KEY }}>
  <App />
</RecurProvider>
```

**Checkout Flow** — default to Hosted Checkout; the on-page `checkout()`
requires a domain registered with Recur and does NOT work on localhost:
```tsx
const { redirectToCheckout } = useRecur()
await redirectToCheckout({
  productId: 'prod_xxx',
  successUrl: `${window.location.origin}/success`,
  cancelUrl: `${window.location.origin}/pricing`,
})
```

**Entitlement Check**
```tsx
const { check } = useCustomer()
const { allowed } = check('pro-plan')
```

## Response Guidelines

When helping with Recur integration:

1. **Language**: Respond in Traditional Chinese (繁體中文) for Taiwanese users
2. **Framework**: Assume Next.js App Router unless specified otherwise
3. **Imports**: Always use `recur-tw` package, not `@recur/sdk` or other variants
4. **API Keys**: Remind users to get keys from `app.recur.tw` → Settings → Developers
5. **Error Handling**: Include try/catch with user-friendly error messages

## SKILL.md Standards

Each skill follows this frontmatter format:

```yaml
---
name: skill-name
description: Clear description with trigger keywords...
license: MIT
metadata:
  author: recur
  version: "0.0.8"
  verified-against: recur-tw@0.16.1
---
```

**Content Guidelines**:
- Keep under 500 lines for context efficiency
- Include working code examples
- Show both basic and advanced patterns
- Reference related skills at the end

**Source of truth policy (important)**:
- The installed SDK's type definitions
  (`node_modules/recur-tw/dist/{index,server}.d.ts`) are the ONLY source of
  truth for API shapes. Never write examples from memory or from older docs.
- Every ts/tsx fenced block in SKILL.md is typechecked against the real SDK
  by `pnpm check:examples`. Blocks must be self-contained (include imports);
  mark intentional fragments with ```` ```tsx no-check ````.
- Run `pnpm check:examples` before every release. When bumping the pinned
  `recur-tw` devDependency, update each skill's `verified-against` metadata.

## Testing Integration

Users can test their integration using:

1. **Test mode keys**: `pk_test_xxx` / `sk_test_xxx`
2. **PAYUNi 測試卡號**:
   - VISA：`4147-6310-0000-0001`（正常授權成功）
   - JCB：`3560-5110-0000-0001`（正常授權成功）
   - 到期日：任意未來日期
   - CVV：任意三碼
3. **Webhook testing**: Use ngrok for local testing

## Related Resources

- [Recur Documentation](https://recur.tw/docs)
- [SDK on npm](https://www.npmjs.com/package/recur-tw)
- [Templates](https://github.com/recur-tw/templates) - `npm create recur-tw@latest`
- [MCP Server](https://mcp.recur.tw) - For account management via AI
