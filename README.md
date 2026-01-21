# Recur Skills for Claude Code

Claude Code skills to help developers integrate [Recur](https://recur.tw) - Taiwan's subscription payment platform.

## Installation

### Claude Code Plugin (Recommended)

```bash
/plugin marketplace add recur-tw/skills
```

### npm CLI

```bash
# Install all skills globally
npx recur-skills install --all --global

# Install specific skills
npx recur-skills install recur-quickstart recur-webhooks

# Install to current project
npx recur-skills install --all --project
```

### Manual Installation

Copy skills to your Claude Code skills directory:

```bash
# Global (all projects)
cp -r skills/* ~/.claude/skills/

# Project-specific
cp -r skills/* .claude/skills/
```

## Available Skills

### recur-quickstart

Quick setup guide for Recur payment integration.

**Triggers:** "integrate Recur", "setup Recur", "Recur 串接", "金流設定"

- SDK installation
- API key configuration
- Basic provider setup
- First checkout implementation

### recur-checkout

Implement Recur checkout flows.

**Triggers:** "checkout", "結帳", "付款按鈕", "embedded checkout"

- Embedded, modal, and redirect modes
- useRecur and useSubscribe hooks
- Product types (subscription, one-time, credits, donation)
- Payment error handling
- 3D verification

### recur-webhooks

Set up and handle Recur webhook events.

**Triggers:** "webhook", "付款通知", "訂閱事件", "payment notification"

- All webhook event types
- Signature verification
- Next.js and Express handlers
- Testing webhooks locally
- Idempotency handling

### recur-entitlements

Implement access control and permission checking.

**Triggers:** "paywall", "權限檢查", "entitlements", "access control"

- useCustomer hook
- Cached vs live checks
- Paywall components
- Server-side verification
- Handling subscription statuses

## Usage

Once installed, Claude will automatically use these skills when you're working on Recur integration tasks.

You can also invoke them directly:

```
/recur-quickstart
/recur-checkout
/recur-webhooks
/recur-entitlements
```

## Utility Scripts

### Check Environment

```bash
./skills/recur-quickstart/scripts/check-env.sh
```

### Test Webhook Locally

```bash
./skills/recur-webhooks/scripts/test-webhook.sh http://localhost:3000/api/webhooks/recur checkout.completed
```

### Verify Webhook Signature

```bash
npx tsx ./skills/recur-webhooks/scripts/verify-signature.ts '<payload>' '<signature>' '<secret>'
```

## Links

- [Recur Website](https://recur.tw)
- [Documentation](https://recur.tw/docs)
- [SDK on npm](https://www.npmjs.com/package/recur-tw)
- [API Reference](https://recur.tw/docs/api)

## Contributing

Found an issue or want to improve a skill? Please open an issue or PR at [github.com/recur-tw/skills](https://github.com/recur-tw/skills).

## License

MIT
