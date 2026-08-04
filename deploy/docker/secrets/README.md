# Docker Secrets 本地目录

将下列 `.example` 文件复制为没有 `.example` 后缀的同名 `.txt`，并分别写入真实值：

- `mysql_root_password.txt`：MySQL root 密码；当前 Compose 使用 root 作为应用数据库账号，因此 Web 服务会读取同一 Secret。
- `jwt_secret.txt`：JWT 签名密钥，建议使用至少 32 个随机字符。
- `initial_admin_password.txt`：可选的首次管理员密码 Secret。基础 Compose 默认使用公开的 `admin / 123456`；生产环境可叠加 `../docker-compose.secrets.yml` 启用此文件。

Windows PowerShell：

```powershell
Copy-Item .\mysql_root_password.txt.example .\mysql_root_password.txt
Copy-Item .\jwt_secret.txt.example .\jwt_secret.txt
```

如需为首次管理员启用 Secret，再额外复制 `initial_admin_password.txt.example`。

真实的 `*.txt` 密码文件被 Git 忽略，绝不能提交到仓库。
