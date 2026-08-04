package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	_ "github.com/go-sql-driver/mysql"
)

// DatabaseConfig 数据库配置（密码使用 DPAPI 加密存储）
type DatabaseConfig struct {
	Host               string `json:"host"`
	Port               int    `json:"port"`
	Username           string `json:"username"`
	EncryptedPassword  string `json:"encryptedPassword"`
	PasswordConfigured bool   `json:"passwordConfigured,omitempty"`
	DBName             string `json:"dbname"`
}

// AppConfig 应用配置
type AppConfig struct {
	AppName         string         `json:"appName"`
	Database        DatabaseConfig `json:"database"`
	WebPort         int            `json:"webPort"`
	JWTSecret       string         `json:"jwtSecret"`
	LastInitTime    string         `json:"lastInitTime"`
	LastUpgradeTime string         `json:"lastUpgradeTime"`
}

// DatabaseStatus 数据库状态信息（返回给前端）
type DatabaseStatus struct {
	Status          string `json:"status"` // uninitialized | initialized | connection_failed
	MigrationCount  int    `json:"migrationCount"`
	LastInitTime    string `json:"lastInitTime"`
	LastUpgradeTime string `json:"lastUpgradeTime"`
	Message         string `json:"message"`
}

// App struct
type App struct {
	ctx        context.Context
	config     AppConfig
	configPath string
	cmd        *exec.Cmd
	isRunning  bool
	cmdMutex   sync.Mutex
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	exePath, _ := os.Executable()
	a.configPath = filepath.Join(filepath.Dir(exePath), "config.json")
	a.loadConfig()
	runtime.WindowSetTitle(a.ctx, a.configToolTitle())
}

// loadConfig 从文件加载配置
func (a *App) loadConfig() {
	a.config = AppConfig{
		AppName: "综合管理平台",
		Database: DatabaseConfig{
			Host:     "",
			Port:     3306,
			Username: "root",
			DBName:   "it_imp",
		},
		WebPort: 3000,
	}
	data, err := os.ReadFile(a.configPath)
	if err == nil {
		json.Unmarshal(data, &a.config)
	}
	if strings.TrimSpace(a.config.AppName) == "" {
		a.config.AppName = "综合管理平台"
	}
}

// saveConfig 保存配置到文件（密码已加密）
func (a *App) saveConfig() error {
	data, err := json.MarshalIndent(a.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(a.configPath, data, 0644)
}

// GetConfig 获取当前配置（密码不返回给前端）
func (a *App) GetConfig() AppConfig {
	cfg := a.config
	cfg.Database.PasswordConfigured = cfg.Database.EncryptedPassword != ""
	cfg.Database.EncryptedPassword = "" // 绝不向前端暴露密码
	return cfg
}

// SaveDatabaseConfig 保存数据库配置（密码使用 DPAPI 加密）
func (a *App) SaveDatabaseConfig(host string, port int, username, password, dbname string) error {
	a.config.Database.Host = host
	a.config.Database.Port = port
	a.config.Database.Username = username
	a.config.Database.DBName = dbname
	// 仅当用户输入了新密码时才更新（避免空密码覆盖已有密码）
	if password != "" {
		encrypted, err := encryptPassword(password)
		if err != nil {
			return fmt.Errorf("密码加密失败: %w", err)
		}
		a.config.Database.EncryptedPassword = encrypted
	}
	return a.saveConfig()
}

// SaveWebPort 保存Web端口
func (a *App) SaveWebPort(port int) error {
	a.config.WebPort = port
	return a.saveConfig()
}

// SaveAppName 保存平台名称。桌面配置工具和 Web 服务都会使用此名称。
func (a *App) SaveAppName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("平台名称不能为空")
	}
	a.config.AppName = name
	if a.ctx != nil {
		runtime.WindowSetTitle(a.ctx, a.configToolTitle())
	}
	return a.saveConfig()
}

// SaveJWTSecret 保存 JWT 密钥
func (a *App) SaveJWTSecret(secret string) error {
	a.config.JWTSecret = secret
	return a.saveConfig()
}

// GenerateJWTSecret 生成用于登录认证的随机 JWT 密钥。
func (a *App) GenerateJWTSecret() (string, error) {
	bytes := make([]byte, 48)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("生成 JWT 密钥失败: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func (a *App) configToolTitle() string {
	return fmt.Sprintf("%s-配置工具V0.01", a.config.AppName)
}

// getDecryptedPassword 解密数据库密码供内部使用
func (a *App) getDecryptedPassword() (string, error) {
	return decryptPassword(a.config.Database.EncryptedPassword)
}

// buildDatabaseURL 构造 DATABASE_URL 环境变量（含密码，仅内部使用）
func (a *App) buildDatabaseURL() (string, error) {
	password, err := a.getDecryptedPassword()
	if err != nil {
		return "", fmt.Errorf("密码解密失败: %w", err)
	}
	return fmt.Sprintf("mysql://%s:%s@%s:%d/%s",
		a.config.Database.Username, password,
		a.config.Database.Host, a.config.Database.Port, a.config.Database.DBName), nil
}

// findWebDir 查找 Web 服务目录
// 从 EXE 所在目录开始向上逐级查找包含 web/package.json 的目录
func (a *App) findWebDir() string {
	exePath, _ := os.Executable()
	exeDir := filepath.Dir(exePath)

	// 向上逐级查找，最多 5 级（覆盖开发目录 build/bin → 项目根，和发布包同目录）
	current := exeDir
	for i := 0; i <= 5; i++ {
		candidate := filepath.Join(current, "web")
		if _, err := os.Stat(filepath.Join(candidate, "package.json")); err == nil {
			return candidate
		}
		parent := filepath.Dir(current)
		if parent == current {
			break // 到达根目录
		}
		current = parent
	}
	return ""
}

// findBunExe 查找 Bun 运行时可执行文件
// 优先查找随包携带的 bun/bun.exe，其次在 PATH 中查找
func (a *App) findBunExe() string {
	exePath, _ := os.Executable()
	exeDir := filepath.Dir(exePath)

	// 1. 随包携带的 Bun
	bundled := filepath.Join(exeDir, "bun", "bun.exe")
	if _, err := os.Stat(bundled); err == nil {
		return bundled
	}

	// 2. PATH 中的 bun
	if found, err := exec.LookPath("bun.exe"); err == nil {
		return found
	}
	if found, err := exec.LookPath("bun"); err == nil {
		return found
	}

	return ""
}

// validateDatabaseName 校验数据库名只包含字母、数字和下划线
func validateDatabaseName(name string) error {
	if name == "" {
		return fmt.Errorf("数据库名不能为空")
	}
	for _, c := range name {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return fmt.Errorf("数据库名只能包含字母、数字和下划线，当前值包含非法字符")
		}
	}
	return nil
}

// checkMigrationsExist 检查 Prisma 迁移文件是否存在
func (a *App) checkMigrationsExist(webDir string) error {
	migrationsDir := filepath.Join(webDir, "prisma", "migrations")
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("迁移目录不存在: prisma/migrations（发布包不完整）")
	}
	hasMigration := false
	for _, entry := range entries {
		if entry.IsDir() {
			sqlFile := filepath.Join(migrationsDir, entry.Name(), "migration.sql")
			if _, err := os.Stat(sqlFile); err == nil {
				hasMigration = true
				break
			}
		}
	}
	if !hasMigration {
		return fmt.Errorf("未找到迁移文件（migration.sql），发布包不完整，请联系开发者")
	}
	return nil
}

// TestConnection 测试数据库连接
// 先测试 MySQL 服务器连接（不指定数据库），再测试目标数据库是否存在
func (a *App) TestConnection(host string, port int, username, password, dbname string) string {
	if password == "" {
		storedPassword, err := a.getDecryptedPassword()
		if err == nil {
			password = storedPassword
		}
	}
	if password == "" {
		return "连接失败: 未输入数据库密码，且本机没有已保存的密码"
	}

	// 第一步：测试 MySQL 服务器连接（不指定数据库）
	serverDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true", username, password, host, port)
	db, err := sql.Open("mysql", serverDSN)
	if err != nil {
		return "连接失败: " + err.Error()
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		return "连接失败: " + err.Error()
	}

	// 第二步：检查目标数据库是否存在
	var exists int
	err = db.QueryRow("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?", dbname).Scan(&exists)
	if err != nil {
		return "连接成功，但无法检查数据库状态: " + err.Error()
	}
	if exists == 0 {
		return fmt.Sprintf("MySQL服务器连接成功，但数据库 %s 尚未创建（请点击「初始化数据库」）", dbname)
	}

	// 第三步：测试连接到目标数据库
	dbDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true", username, password, host, port, dbname)
	db2, err := sql.Open("mysql", dbDSN)
	if err != nil {
		return "连接失败: " + err.Error()
	}
	defer db2.Close()
	if err = db2.Ping(); err != nil {
		return "连接失败: " + err.Error()
	}

	return fmt.Sprintf("连接成功，数据库 %s 可用", dbname)
}

// GetDatabaseStatus 获取数据库状态
func (a *App) GetDatabaseStatus() DatabaseStatus {
	status := DatabaseStatus{
		Status:          "uninitialized",
		MigrationCount:  0,
		LastInitTime:    a.config.LastInitTime,
		LastUpgradeTime: a.config.LastUpgradeTime,
	}

	password, err := a.getDecryptedPassword()
	if err != nil || password == "" {
		status.Status = "connection_failed"
		status.Message = "未配置数据库密码"
		return status
	}

	if a.config.Database.Host == "" {
		status.Status = "connection_failed"
		status.Message = "未配置数据库主机地址"
		return status
	}

	// 连接 MySQL 服务器
	serverDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true",
		a.config.Database.Username, password,
		a.config.Database.Host, a.config.Database.Port)
	db, err := sql.Open("mysql", serverDSN)
	if err != nil {
		status.Status = "connection_failed"
		status.Message = "连接失败: " + err.Error()
		return status
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		status.Status = "connection_failed"
		status.Message = "连接失败: " + err.Error()
		return status
	}

	// 检查数据库是否存在
	var exists int
	err = db.QueryRow("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = ?",
		a.config.Database.DBName).Scan(&exists)
	if err != nil || exists == 0 {
		status.Status = "uninitialized"
		status.Message = fmt.Sprintf("数据库 %s 尚未创建", a.config.Database.DBName)
		return status
	}

	// 连接到目标数据库，检查迁移表
	dbDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true",
		a.config.Database.Username, password,
		a.config.Database.Host, a.config.Database.Port, a.config.Database.DBName)
	db2, err := sql.Open("mysql", dbDSN)
	if err != nil {
		status.Status = "connection_failed"
		status.Message = err.Error()
		return status
	}
	defer db2.Close()

	// 检查 _prisma_migrations 表是否存在
	var tableExists int
	err = db2.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = '_prisma_migrations'",
		a.config.Database.DBName).Scan(&tableExists)
	if err != nil || tableExists == 0 {
		status.Status = "uninitialized"
		status.Message = "数据库已存在但尚未执行迁移"
		return status
	}

	// 统计已执行的迁移数量
	err = db2.QueryRow("SELECT COUNT(*) FROM _prisma_migrations WHERE migration_name IS NOT NULL").Scan(&status.MigrationCount)
	if err != nil {
		status.MigrationCount = 0
	}

	status.Status = "initialized"
	status.Message = fmt.Sprintf("数据库结构已初始化，已完成 %d 个版本步骤", status.MigrationCount)
	return status
}

// InitDatabase 初始化数据库（创建数据库 + Prisma 迁移 + 首次管理员）
// 仅用于首次部署空数据库，失败时不写入「已初始化」状态
func (a *App) InitDatabase(initialAdminUsername, initialAdminPassword string) string {
	webDir := a.findWebDir()
	if webDir == "" {
		return "错误: 未找到 Web 服务目录"
	}

	// 检查迁移文件是否存在
	if err := a.checkMigrationsExist(webDir); err != nil {
		return "错误: " + err.Error()
	}

	// 校验数据库名
	if err := validateDatabaseName(a.config.Database.DBName); err != nil {
		return "错误: " + err.Error()
	}

	password, err := a.getDecryptedPassword()
	if err != nil || password == "" {
		return "错误: 未配置数据库密码，请先保存配置"
	}
	if a.config.Database.Host == "" {
		return "错误: 未配置数据库主机地址"
	}
	if strings.TrimSpace(initialAdminUsername) == "" {
		return "错误: 请输入初始管理员账号"
	}
	if len(initialAdminPassword) < 6 {
		return "错误: 初始管理员密码至少需要 6 位"
	}

	// 检查 Bun 运行时
	bunExe := a.findBunExe()
	if bunExe == "" {
		return "错误: 未找到 Bun 运行时，请确保发布包包含 bun/bun.exe"
	}

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 开始初始化数据库 %s@%s:%d/%s\n",
		timestamp(), a.config.Database.Username,
		a.config.Database.Host, a.config.Database.Port, a.config.Database.DBName))
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 运行时: Bun (%s)\n", timestamp(), bunExe))

	// 第一步：删除旧数据库（如果存在，清理可能失败的状态）并重新创建，字符集 utf8mb4
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 重建数据库 %s (utf8mb4)...\n", timestamp(), a.config.Database.DBName))
	serverDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true",
		a.config.Database.Username, password,
		a.config.Database.Host, a.config.Database.Port)
	db, err := sql.Open("mysql", serverDSN)
	if err != nil {
		return "连接 MySQL 服务器失败: " + err.Error()
	}
	dropSQL := fmt.Sprintf("DROP DATABASE IF EXISTS `%s`", a.config.Database.DBName)
	if _, err = db.Exec(dropSQL); err != nil {
		db.Close()
		return "删除旧数据库失败: " + err.Error()
	}
	createSQL := fmt.Sprintf("CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
		a.config.Database.DBName)
	if _, err = db.Exec(createSQL); err != nil {
		db.Close()
		return "创建数据库失败: " + err.Error()
	}
	db.Close()
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 数据库 %s 已就绪\n", timestamp(), a.config.Database.DBName))

	// 第二步：执行 Prisma 迁移
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 执行 Prisma 迁移 (bun x prisma migrate deploy)...\n", timestamp()))
	output, err := a.runPrismaCommand(webDir, []string{"migrate", "deploy"})
	runtime.EventsEmit(a.ctx, "log", output+"\n")
	if err != nil {
		// 迁移失败，不写入「已初始化」状态
		return "Prisma 迁移失败: " + err.Error() + "（数据库状态保持未初始化）"
	}

	// 第三步：创建唯一的初始管理员。不导入任何业务或演示数据。
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 创建初始管理员...\n", timestamp()))
	output, err = a.runBootstrapAdmin(webDir, initialAdminUsername, initialAdminPassword, false)
	runtime.EventsEmit(a.ctx, "log", output+"\n")
	if err != nil {
		return "初始管理员创建失败: " + err.Error()
	}

	// 全部成功，更新初始化时间
	a.config.LastInitTime = timestamp()
	a.saveConfig()

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 数据库初始化完成！\n", timestamp()))
	return "数据库初始化成功！已创建表结构和初始管理员。"
}

// UpgradeDatabase 升级数据库（仅执行 Prisma 迁移，不执行 seed/reset/drop）
func (a *App) UpgradeDatabase() string {
	webDir := a.findWebDir()
	if webDir == "" {
		return "错误: 未找到 Web 服务目录"
	}

	// 检查迁移文件是否存在
	if err := a.checkMigrationsExist(webDir); err != nil {
		return "错误: " + err.Error()
	}

	// 校验数据库名
	if err := validateDatabaseName(a.config.Database.DBName); err != nil {
		return "错误: " + err.Error()
	}

	password, err := a.getDecryptedPassword()
	if err != nil || password == "" {
		return "错误: 未配置数据库密码，请先保存配置"
	}

	// 检查 Bun 运行时
	bunExe := a.findBunExe()
	if bunExe == "" {
		return "错误: 未找到 Bun 运行时，请确保发布包包含 bun/bun.exe"
	}

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 开始升级数据库...\n", timestamp()))
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 运行时: Bun (%s)\n", timestamp(), bunExe))

	// 执行 Prisma 迁移（仅 migrate deploy，不执行 seed/reset/drop）
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 执行 Prisma 迁移 (bun x prisma migrate deploy)...\n", timestamp()))
	output, err := a.runPrismaCommand(webDir, []string{"migrate", "deploy"})
	runtime.EventsEmit(a.ctx, "log", output+"\n")
	if err != nil {
		return "数据库升级失败: " + err.Error()
	}

	// 更新升级时间
	a.config.LastUpgradeTime = timestamp()
	a.saveConfig()

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 数据库升级完成！\n", timestamp()))
	return "数据库升级成功！"
}

// ProvisionInitialAdmin 为已完成建表、但尚无任何用户的旧环境补建首次管理员。
// 不执行删库、迁移或密码覆盖；若已有用户，脚本会安全跳过。
func (a *App) ProvisionInitialAdmin(username, password string) string {
	webDir := a.findWebDir()
	if webDir == "" {
		return "错误: 未找到 Web 服务目录"
	}
	if strings.TrimSpace(username) == "" {
		return "错误: 请输入首次管理员账号"
	}
	if len(password) < 6 {
		return "错误: 首次管理员密码至少需要 6 位"
	}
	if _, err := a.getDecryptedPassword(); err != nil {
		return "错误: 未配置数据库密码，请先保存配置"
	}
	if a.config.Database.Host == "" {
		return "错误: 未配置数据库主机地址"
	}

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 检查并补建首次管理员...\n", timestamp()))
	output, err := a.runBootstrapAdmin(webDir, username, password, false)
	runtime.EventsEmit(a.ctx, "log", output+"\n")
	if err != nil {
		return "补建首次管理员失败: " + err.Error()
	}
	return "首次管理员处理完成：" + strings.TrimSpace(output)
}

// ResetAdminPassword 显式重置指定管理员密码，不重建数据库也不修改其他用户。
func (a *App) ResetAdminPassword(username, password string) string {
	webDir := a.findWebDir()
	if webDir == "" {
		return "错误: 未找到 Web 服务目录"
	}
	if strings.TrimSpace(username) == "" {
		return "错误: 请输入管理员账号"
	}
	if len(password) < 6 {
		return "错误: 新密码至少需要 6 位"
	}
	if _, err := a.getDecryptedPassword(); err != nil {
		return "错误: 未配置数据库密码，请先保存配置"
	}
	if a.config.Database.Host == "" {
		return "错误: 未配置数据库主机地址"
	}

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] 正在重置管理员 %s 的密码...\n", timestamp(), username))
	output, err := a.runBootstrapAdmin(webDir, username, password, true)
	runtime.EventsEmit(a.ctx, "log", output+"\n")
	if err != nil {
		return "管理员密码重置失败: " + err.Error()
	}
	return "管理员密码重置成功，请立即使用新密码登录并修改密码。"
}

// runPrismaCommand 使用 Bun 运行时执行 Prisma CLI 命令
// 不依赖 npx/Node.js，密码通过环境变量传递，不打印到日志
func (a *App) runPrismaCommand(webDir string, args []string) (string, error) {
	bunExe := a.findBunExe()
	if bunExe == "" {
		return "", fmt.Errorf("未找到 Bun 运行时，请确保发布包包含 bun/bun.exe")
	}

	dbURL, err := a.buildDatabaseURL()
	if err != nil {
		return "", err
	}
	password, _ := a.getDecryptedPassword()
	bunDir := filepath.Dir(bunExe)

	// 使用 bun x prisma 执行命令
	cmd := exec.Command(bunExe, append([]string{"x", "prisma"}, args...)...)
	cmd.Dir = webDir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true} // 隐藏 CMD 黑框
	// 将 Bun 目录添加到 PATH，确保 Prisma CLI 能找到 Bun；同时避免 Windows 下重复 PATH 键。
	cmd.Env = commandEnv(bunDir, map[string]string{
		"DATABASE_URL":      dbURL,
		"DATABASE_HOST":     a.config.Database.Host,
		"DATABASE_PORT":     fmt.Sprintf("%d", a.config.Database.Port),
		"DATABASE_USER":     a.config.Database.Username,
		"DATABASE_PASSWORD": password,
		"DATABASE_NAME":     a.config.Database.DBName,
		"JWT_SECRET":        a.config.JWTSecret,
	})

	output, err := cmd.CombinedOutput()
	cleanOutput := sanitizeLog(string(output))
	return cleanOutput, err
}

// runBootstrapAdmin 使用与 Docker 共用的脚本创建首个管理员。
// 密码只通过子进程环境变量传递，不写入配置文件或日志。
func (a *App) runBootstrapAdmin(webDir, username, password string, reset bool) (string, error) {
	bunExe := a.findBunExe()
	if bunExe == "" {
		return "", fmt.Errorf("未找到 Bun 运行时，请确保发布包包含 bun/bun.exe")
	}

	dbURL, err := a.buildDatabaseURL()
	if err != nil {
		return "", err
	}
	dbPassword, err := a.getDecryptedPassword()
	if err != nil {
		return "", err
	}

	args := []string{"scripts/bootstrap-admin.mjs"}
	if reset {
		args = append(args, "--reset")
	}
	cmd := exec.Command(bunExe, args...)
	cmd.Dir = webDir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd.Env = commandEnv(filepath.Dir(bunExe), map[string]string{
		"DATABASE_URL":           dbURL,
		"DATABASE_HOST":          a.config.Database.Host,
		"DATABASE_PORT":          fmt.Sprintf("%d", a.config.Database.Port),
		"DATABASE_USER":          a.config.Database.Username,
		"DATABASE_PASSWORD":      dbPassword,
		"DATABASE_NAME":          a.config.Database.DBName,
		"INITIAL_ADMIN_USERNAME": username,
		"INITIAL_ADMIN_PASSWORD": password,
	})

	output, err := cmd.CombinedOutput()
	return sanitizeLog(string(output)), err
}

// commandEnv 构造子进程环境变量，避免 Windows 下出现重复的 PATH/Path 键。
func commandEnv(bunDir string, overrides map[string]string) []string {
	pathValue := bunDir + ";" + os.Getenv("PATH")
	env := make([]string, 0, len(os.Environ())+len(overrides)+1)
	env = append(env, "PATH="+pathValue)
	for _, item := range os.Environ() {
		key, _, ok := strings.Cut(item, "=")
		if !ok || strings.EqualFold(key, "PATH") {
			continue
		}
		skip := false
		for overrideKey := range overrides {
			if strings.EqualFold(key, overrideKey) {
				skip = true
				break
			}
		}
		if !skip {
			env = append(env, item)
		}
	}
	for key, value := range overrides {
		env = append(env, key+"="+value)
	}
	return env
}

// sanitizeLog 清理日志输出，移除可能包含密码的信息
func sanitizeLog(log string) string {
	// 移除连接字符串中的密码部分
	lines := strings.Split(log, "\n")
	for i, line := range lines {
		// 移除 mysql://user:password@ 格式的连接字符串
		if strings.Contains(line, "mysql://") {
			lines[i] = "[已隐藏连接字符串]"
		}
	}
	return strings.Join(lines, "\n")
}

// StartService 启动Web服务
func (a *App) StartService() string {
	a.cmdMutex.Lock()
	defer a.cmdMutex.Unlock()

	if a.isRunning {
		return "服务已在运行中"
	}

	// 校验 JWT 密钥已配置
	if a.config.JWTSecret == "" {
		return "错误: 未配置 JWT 密钥，请先在配置中设置"
	}

	// 查找 Bun 运行时
	bunExe := a.findBunExe()
	if bunExe == "" {
		return "错误: 未找到 Bun 运行时，请确保发布包包含 bun/bun.exe"
	}
	bunDir := filepath.Dir(bunExe)

	// 查找 Web 服务目录（与 InitDatabase/UpgradeDatabase 使用相同的查找逻辑）
	nodeDir := a.findWebDir()
	if nodeDir == "" {
		return "错误: 未找到 Web 服务目录"
	}

	// 查找 Web 服务入口（优先 .output/server/index.mjs）
	serverEntry := filepath.Join(nodeDir, ".output", "server", "index.mjs")
	if _, err := os.Stat(serverEntry); err != nil {
		return "未找到Web服务入口，请先构建Nuxt应用（.output/server/index.mjs 不存在）"
	}

	cmd := exec.Command(bunExe, serverEntry)
	cmd.Dir = nodeDir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true} // 隐藏 CMD 黑框

	// 环境变量传递数据库配置（Prisma 7 需要 DATABASE_URL + 单独参数）
	password, _ := a.getDecryptedPassword()
	dbURL := fmt.Sprintf("mysql://%s:%s@%s:%d/%s",
		a.config.Database.Username, password,
		a.config.Database.Host, a.config.Database.Port, a.config.Database.DBName)
	cmd.Env = commandEnv(bunDir, map[string]string{
		"NUXT_PUBLIC_APP_NAME": a.config.AppName,
		"PORT":                 fmt.Sprintf("%d", a.config.WebPort),
		"DATABASE_URL":         dbURL,
		"DATABASE_HOST":        a.config.Database.Host,
		"DATABASE_PORT":        fmt.Sprintf("%d", a.config.Database.Port),
		"DATABASE_USER":        a.config.Database.Username,
		"DATABASE_PASSWORD":    password,
		"DATABASE_NAME":        a.config.Database.DBName,
		"JWT_SECRET":           a.config.JWTSecret,
	})

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "启动失败: " + err.Error()
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "启动失败: " + err.Error()
	}

	if err = cmd.Start(); err != nil {
		return "启动失败: " + err.Error()
	}

	a.cmd = cmd
	a.isRunning = true

	// 异步读取日志并推送到前端
	go a.readLog(stdout)
	go a.readLog(stderr)

	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] Web服务已启动，端口: %d\n", timestamp(), a.config.WebPort))
	return fmt.Sprintf("服务已启动，端口: %d", a.config.WebPort)
}

// StopService 停止Web服务
// 使用 taskkill /F /T 强制杀整个进程树（Bun → Nuxt 子进程）
// 避免 TerminateProcess "Access is denied" 问题
func (a *App) StopService() string {
	a.cmdMutex.Lock()
	defer a.cmdMutex.Unlock()

	if !a.isRunning || a.cmd == nil {
		return "服务未运行"
	}

	pid := a.cmd.Process.Pid

	// Windows: 使用 taskkill 强制杀进程树
	// /F = 强制终止, /T = 包含子进程树
	killCmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", pid))
	killCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true} // 隐藏 CMD 黑框
	if err := killCmd.Run(); err != nil {
		// taskkill 失败时回退到 Process.Kill
		if err2 := a.cmd.Process.Kill(); err2 != nil {
			return "停止失败: " + err2.Error()
		}
	}

	// 等待进程完全退出，清理僵尸进程
	a.cmd.Wait()

	a.cmd = nil
	a.isRunning = false
	runtime.EventsEmit(a.ctx, "log", fmt.Sprintf("[%s] Web服务已停止\n", timestamp()))
	return "服务已停止"
}

// GetServiceStatus 获取服务状态
func (a *App) GetServiceStatus() bool {
	a.cmdMutex.Lock()
	defer a.cmdMutex.Unlock()
	return a.isRunning
}

// readLog 读取进程输出并推送到前端
func (a *App) readLog(reader interface{ Read([]byte) (int, error) }) {
	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			runtime.EventsEmit(a.ctx, "log", string(buf[:n]))
		}
		if err != nil {
			break
		}
	}
}

// timestamp 当前时间戳
func timestamp() string {
	return time.Now().Format("2006-01-02 15:04:05")
}
