---
name: recur-help
description: List all available Recur skills and how to use them. Use when user asks "what can Recur do", "Recur skills", "Recur 有什麼功能", "help with Recur", "如何使用 Recur skills". Taiwan subscription billing via PAYUNi (recur.tw, 台灣訂閱金流).
license: MIT
metadata:
  author: recur
  version: "0.0.13"
---

# Recur Skills 使用指南

當用戶詢問 Recur skills 的功能時，向他們介紹以下可用的 skills：

## 可用的 Skills

### 1. recur-quickstart
**用途**：快速開始 Recur 整合
**觸發方式**：
- 說：「幫我整合 Recur」「setup Recur」「Recur 串接」「金流設定」
- 或輸入：`/recur-quickstart`

### 2. recur-checkout
**用途**：實作結帳流程（embedded、modal、redirect）
**觸發方式**：
- 說：「加上結帳按鈕」「checkout」「付款按鈕」「embedded checkout」
- 或輸入：`/recur-checkout`

### 3. recur-webhooks
**用途**：設定 webhook 接收付款通知
**觸發方式**：
- 說：「設定 webhook」「付款通知」「訂閱事件」
- 或輸入：`/recur-webhooks`

### 4. recur-entitlements
**用途**：實作付費功能權限檢查和 Paywall
**觸發方式**：
- 說：「檢查付費權限」「paywall」「權限檢查」「entitlements」
- 或輸入：`/recur-entitlements`

### 5. recur-portal
**用途**：實作客戶自助入口（管理訂閱、更新付款方式）
**觸發方式**：
- 說：「加上帳戶管理」「customer portal」「訂閱管理」「更新付款方式」
- 或輸入：`/recur-portal`

## 帳號與 MCP

還沒有 Recur 帳號、API key 或商品時，先用 `/recur-quickstart` 的 Step 0：連上
Recur MCP（`https://mcp.recur.tw/`，plugin 安裝者直接 `/mcp` 授權），在 OAuth
登入頁點「建立新帳號」即可建立帳號，接著用 MCP 工具建立 API key 與商品。

## 回覆方式

用使用者的語言回覆（台灣使用者用繁體中文）。用一張表列出上面五個 skills 的用途和一句觸發說法；
還沒開始串接的人建議從 `recur-quickstart` 開始，最後問對方想做什麼。
