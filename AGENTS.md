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
└── skills/
    ├── recur-help/
    │   └── SKILL.md
    ├── recur-quickstart/
    │   └── SKILL.md
    ├── recur-checkout/
    │   └── SKILL.md
    ├── recur-webhooks/
    │   └── SKILL.md
    └── recur-entitlements/
        └── SKILL.md
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

1. **New integration / Getting started** → `recur-quickstart`
2. **Adding payment buttons or forms** → `recur-checkout`
3. **Receiving payment notifications** → `recur-webhooks`
4. **Checking subscription status / Paywalls** → `recur-entitlements`
5. **Customer self-service / Account management** → `recur-portal`
6. **Not sure what's available** → `recur-help`

## Integration Context

### Recur SDK (`recur-tw`)

The SDK is available on npm as `recur-tw`:

```bash
pnpm add recur-tw
```

Key exports:
- `RecurProvider` - React context provider
- `useRecur` - Checkout hook
- `useCustomer` - Entitlements hook
- `Recur` (from `recur-tw/server`) - Server-side SDK

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

**Checkout Flow**
```tsx
const { checkout } = useRecur()
await checkout({ productId: 'prod_xxx', mode: 'modal' })
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
  version: "0.0.5"
---
```

**Content Guidelines**:
- Keep under 500 lines for context efficiency
- Include working code examples
- Show both basic and advanced patterns
- Reference related skills at the end

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
- [MCP Server](https://mcp.recur.tw) - For account management via AI
