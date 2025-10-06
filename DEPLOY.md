# 部署到 GitHub / Vercel

本项目为 Next.js App Router（支持 SSR/Edge）。建议使用 Vercel 一键绑定 GitHub 自动部署。

## 一、GitHub Actions：CI（E2E 自动化）

仓库已内置 `.github/workflows/ci.yml`：
- push/PR 到 `main` 分支会自动：安装、启动 dev 并运行 Playwright 用例。
- 失败会上传测试报告（artifact）。

## 二、部署到 Vercel（推荐）

1. 打开 https://vercel.com/import 并选择 GitHub 仓库。
2. 环境变量（必填）：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - 可选：`DEEPSEEK_API_KEY`（开启 AI 真实服务）
3. 选择 `root = /`，Framework 选择 Next.js，构建/启动命令保持默认。
4. 部署后每次推送到 `main` 会自动更新。

> 如果想在 CI 中用 Vercel CLI 触发部署，可创建 workflow，使用 `vercel/actions` 并配置 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 为 GitHub Secrets。

## 三、GitHub Pages（不推荐）

本项目含 SSR 能力，GitHub Pages 仅支持静态托管，会丢失 API 路由与 SSR。若强行导出：
- 需改成 `next export` 的纯静态方案（当前代码不支持）。
- 或改造成完全静态 SPA（移除 `/api/*` 与 SSR 重定向）。

因此，生产部署推荐 Vercel 或任意 Node/Serverless 托管（如 Netlify、Render、Cloudflare Pages + Functions）。
