# 贡献指南

感谢参与 IT_IMP。提交代码前请先创建 Issue 描述问题或变更目的；较大的功能请先讨论设计方案。

## 本地检查（完整门禁）

`web/` 侧（提交前依次执行）：

```powershell
npm.cmd --prefix web ci
npm.cmd --prefix web exec -- prisma generate
npm.cmd --prefix web run typecheck
npm.cmd --prefix web test
npm.cmd --prefix web run build
```

如修改 `desktop/`，还应执行：

```powershell
cd desktop
go test ./...
wails doctor
wails build
```

## 提交要求

- 不提交密钥、真实业务数据、`node_modules`、`.output`、`.nuxt` 或 EXE。
- 业务逻辑只修改 `web/`；不要复制出第二套 Docker 或桌面业务源码。
- Docker 变更必须保持从项目根目录 `web/` 构建。
- 保持变更小而明确，并在 PR 中说明测试结果（typecheck/test/build 及相关 go test）。
- 不在源码、脚本、日志或文档中硬编码账号密码；演示/清理脚本统一通过 `ADMIN_TOKEN` 或 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 环境变量传入凭据。
