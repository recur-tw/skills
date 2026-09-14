# Recur Skills

[![skills.sh](https://skills.sh/b/recur-tw/skills)](https://skills.sh/recur-tw/skills)

Skills to help developers integrate [Recur](https://recur.tw) - Taiwan's subscription payment platform.

Supports Claude Code, Cursor, Codex, GitHub Copilot, Gemini CLI, Antigravity, and other AI coding agents.

## Installation

### npx skills add (Recommended)

```bash
npx skills add recur-tw/skills
```

### Claude Code Plugin (skills + MCP server)

```bash
/plugin marketplace add recur-tw/skills
/plugin install recur-skills@recur-skills
```

The plugin bundles the Recur MCP server (`https://mcp.recur.tw/`, see `.mcp.json`).
After installing, run `/mcp` and authorize `recur` — no account yet? Click 註冊 on the
login page; the account is created inside the OAuth flow.

### MCP for other agents

`npx skills add` installs skills only. Add `https://mcp.recur.tw/` as a remote MCP
server in Cursor, VS Code, Codex, Gemini CLI, or Claude Desktop — one-click links
and config snippets at https://docs.recur.tw/guides/mcp.

Or from a shell:

```bash
claude plugin marketplace add recur-tw/skills
claude plugin install recur-skills@recur-skills
```

Plugin skills are namespaced, e.g. `/recur-skills:recur-checkout`. See [Claude Code plugins](https://code.claude.com/docs/en/plugins).

## Getting Started

Not sure where to begin? Ask Claude:

```
Recur 有什麼功能？
```

No Recur account yet? Ask:

```
幫我申請 Recur 帳號，建立每月 $499 的訂閱方案並串接付款流程
```

Or type `/recur-help` to see all available skills.

## Available Skills

### recur-help

List all available Recur skills and how to use them.

**Triggers:** "Recur 有什麼功能", "help with Recur", "what can Recur do"

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

### recur-portal

Implement Customer Portal for subscription self-service.

**Triggers:** "customer portal", "帳戶管理", "訂閱管理", "更新付款方式", "self-service"

- Create portal sessions
- Portal button component
- Next.js API routes and server actions
- Account management pages

## Usage

Once installed, Claude will automatically use these skills when you're working on Recur integration tasks.

## Links

- [skills.sh](https://skills.sh/recur-tw/skills): `npx skills add recur-tw/skills`
- [Recur Website](https://recur.tw)
- [Documentation](https://recur.tw/docs)
- [SDK on npm](https://www.npmjs.com/package/recur-tw)

## License

MIT
