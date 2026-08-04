# Windows 桌面端

`desktop/` 是 IT_IMP 的 Wails 桌面端配置工具，负责：

- 保存远程 MySQL 连接配置；
- 测试数据库连接；
- 创建空数据库并执行 Prisma 迁移；
- 在空用户表中创建可配置的首次管理员（不导入业务或演示数据）；
- 执行后续数据库升级迁移；
- 在数据库可连接时重置指定管理员密码，不清空数据；
- 启动和停止本地 Web 服务。

## 开发运行

```powershell
cd desktop
wails doctor
wails dev
```

## 构建 EXE

```powershell
cd desktop
wails build
```

正式发布时，不能只复制 EXE，还需要使用发布脚本准备同目录的 `web/` 和 `bun/` 目录。详见项目根目录 README。
