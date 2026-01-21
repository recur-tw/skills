# Recur Skills for Claude Code

Claude Code skills to help developers integrate [Recur](https://recur.tw) - Taiwan's subscription payment platform.

## Installation

```bash
/plugin marketplace add recur-tw/skills
/plugin install recur-skills@recur-skills
```

## Available Skills

### recur-quickstart

Quick setup guide for Recur payment integration.

**Triggers:** "integrate Recur", "setup Recur", "Recur 串接", "金流設定"

- SDK installation
- API key configuration
- Provider setup
- First checkout implementation

### recur-checkout

Implement Recur checkout flows.

**Triggers:** "checkout", "結帳", "付款按鈕", "embedded checkout"

- Embedded, modal, and redirect modes
- useRecur and useSubscribe hooks
- Product types (subscription, one-time, credits, donation)
- Payment error handling

### recur-webhooks

Set up and handle Recur webhook events.

**Triggers:** "webhook", "付款通知", "訂閱事件", "payment notification"

- All webhook event types
- Signature verification
- Next.js and Express handlers
- Idempotency handling

### recur-entitlements

Implement access control and permission checking.

**Triggers:** "paywall", "權限檢查", "entitlements", "access control"

- useCustomer hook
- Cached vs live checks
- Paywall components
- Server-side verification

## Usage

Once installed, Claude will automatically use these skills when you're working on Recur integration tasks.

## Links

- [Recur Website](https://recur.tw)
- [Documentation](https://recur.tw/docs)
- [SDK on npm](https://www.npmjs.com/package/recur-tw)

## License

MIT
