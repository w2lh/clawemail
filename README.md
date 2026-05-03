# Claw Email Web Manager

这是一个用于管理 `claw.163.com` 子邮箱的前后端项目。它可以在网页里创建/删除邮箱、查看收件、发送邮件、回复邮件，并通过 Docker 部署。

## 功能范围

- Claw 连接：在网页里输入 Claw 登录邮箱，验证码确认后自动保存 Dashboard Cookie 和 API Key。
- 创建邮箱：调用 Claw Dashboard 内部接口创建 `vercel.<suffix>@claw.163.com`。
- 删除邮箱：调用 Claw Dashboard 内部接口删除指定邮箱。
- 收信：使用 `@clawemail/node-sdk` 为每个已管理邮箱建立 WebSocket 监听，新邮件落库到 SQLite，并用 SSE 通知前端刷新。
- 发信：使用 `@clawemail/node-sdk` 从已管理邮箱发出邮件。
- 回复：基于本地已保存邮件的 Claw 原始邮件 ID 调用 SDK 回复。
- 附件：本地保存附件元数据，下载时再通过 SDK 拉取附件流。

## 已确认的 Claw 接口

Dashboard 接口只能放在后端调用，不能暴露 Cookie 到浏览器。

```http
POST https://claw.163.com/mailserv-claw-dashboard/api/v1/mailboxes
Content-Type: application/json
Cookie: <CLAW_DASHBOARD_COOKIE>
```

```json
{
  "prefix": "3",
  "displayName": "3",
  "mailboxType": "sub",
  "workspaceId": "XnVvZknr",
  "parentMailboxId": "3L85M1qk"
}
```

```http
POST https://claw.163.com/mailserv-claw-dashboard/api/v1/mailboxes/delete?id=<mailboxId>
Cookie: <CLAW_DASHBOARD_COOKIE>
```

```http
GET https://claw.163.com/mailserv-claw-dashboard/api/v1/mailboxes?workspaceId=XnVvZknr
Cookie: <CLAW_DASHBOARD_COOKIE>
```

## 本项目 API

所有 `/api/*` 请求需要鉴权：

```http
X-Admin-Password: <ADMIN_PASSWORD>
```

SSE 和附件下载这种浏览器不方便带 Header 的请求使用：

```http
?token=<ADMIN_PASSWORD>
```

接口列表：

```http
GET /api/mailboxes
GET /api/mailboxes?sync=true
POST /api/mailboxes
DELETE /api/mailboxes/:id
GET /api/mails?mailbox=<email>&limit=50&offset=0
GET /api/mails/:id
GET /api/mails/:id/attachments/:partId
POST /api/send
POST /api/reply
GET /api/events
GET /api/listeners
GET /health
```

创建邮箱：

```json
{
  "suffix": "4"
}
```

发送邮件：

```json
{
  "from": "vercel.4@claw.163.com",
  "to": ["target@example.com"],
  "subject": "hello",
  "body": "message body",
  "html": false
}
```

回复邮件：

```json
{
  "mailId": 1,
  "body": "reply body",
  "html": false,
  "toAll": false
}
```

## Claw 网页登录

这个项目不做第三方密码采集。连接 Claw 使用官方邮箱验证码接口：

```http
POST https://claw.163.com/mailserv-claw-dashboard/p/v1/auth/email/send-code
POST https://claw.163.com/mailserv-claw-dashboard/p/v1/auth/email/verify-code
```

登录成功后，后端会从响应头提取 `CLAW_SESS`，再自动调用：

```http
GET https://claw.163.com/mailserv-claw-dashboard/api/v1/auth/me
GET https://claw.163.com/mailserv-claw-dashboard/api/v1/workspaces
GET https://claw.163.com/mailserv-claw-dashboard/api/v1/mailboxes?workspaceId=<workspaceId>
GET https://claw.163.com/mailserv-claw-dashboard/api/v1/api-keys
```

自动保存的信息：

```text
Dashboard Cookie
API Key
workspaceId
parentMailboxId
rootPrefix
domain
```

这些值保存在 SQLite 的 `app_settings` 表，不会写进前端代码。

## 环境变量

复制 `.env.example` 为 `.env`，填入真实值。

```env
NODE_ENV=production
PORT=3000
ADMIN_PASSWORD=change-me

CLAW_API_KEY=
CLAW_DASHBOARD_COOKIE=
CLAW_WORKSPACE_ID=XnVvZknr
CLAW_PARENT_MAILBOX_ID=3L85M1qk
CLAW_ROOT_PREFIX=vercel
CLAW_DOMAIN=claw.163.com

DATABASE_PATH=/app/data/app.db
```

说明：

- `CLAW_API_KEY`：可选兜底值。网页连接 Claw 后会自动保存。
- `CLAW_DASHBOARD_COOKIE`：可选兜底值。网页连接 Claw 后会自动保存。
- `ADMIN_PASSWORD`：网页和 API 的简单管理密码，生产环境必须改强密码。
- `DATABASE_PATH`：Docker 推荐 `/app/data/app.db`，本地运行可改成 `./data/app.db`。

## 本地运行

```powershell
npm install
npm run build
npm start
```

访问：

```text
http://localhost:3000
```

开发模式可开两个终端：

```powershell
npm run dev
```

```powershell
npm run dev:web
```

前端开发地址：

```text
http://localhost:5173
```

## Docker 部署

```powershell
docker compose up -d --build
```

检查服务：

```powershell
docker compose ps
curl http://localhost:3000/health
```

数据文件保存在：

```text
./data/app.db
```

## 安全边界

- 不要把 `CLAW_API_KEY` 和 `CLAW_DASHBOARD_COOKIE` 写进前端代码。
- 不要把 `.env` 提交到 Git。
- 这个项目的 `ADMIN_PASSWORD` 是轻量保护，不等于完整用户体系；如果暴露公网，建议放到 Nginx/Cloudflare Access/Zero Trust 后面。
- Claw Dashboard 接口是网页内部接口，后续可能变化；如果 Claw 改接口路径或字段，需要重新抓包确认。
