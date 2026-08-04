/**
 * 创建或恢复平台管理员。
 *
 * 本脚本不导入任何业务数据：
 * - 默认模式只在 users 表为空时创建首个管理员；
 * - --reset 模式只在运维人员显式执行时重设指定管理员密码。
 *
 * 支持 INITIAL_ADMIN_PASSWORD_FILE / ADMIN_RESET_PASSWORD_FILE，供 Docker
 * Secrets 使用；EXE 则通过仅对子进程可见的环境变量传入密码。
 */
import { readFileSync } from 'node:fs'
import mariadb from 'mariadb'
import bcrypt from 'bcryptjs'

const isReset = process.argv.includes('--reset')
const prefix = isReset ? 'ADMIN_RESET' : 'INITIAL_ADMIN'

function readSecret(name) {
  const file = process.env[`${name}_FILE`]
  if (file) return readFileSync(file, 'utf8').trim()

  const value = process.env[name]
  return value?.trim() || ''
}

function getRequired(name, label) {
  const value = readSecret(name)
  if (!value) throw new Error(`未配置${label}（${name} 或 ${name}_FILE）`)
  return value
}

function validateCredentials(username, password) {
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) {
    throw new Error('管理员用户名只能包含 3–50 位字母、数字、点、下划线或连字符')
  }
  if (password.length < 6) {
    throw new Error('管理员密码至少需要 6 位')
  }
}

const username = (process.env[`${prefix}_USERNAME`] || process.env.INITIAL_ADMIN_USERNAME || 'admin').trim()
// 基础 Docker 配置开箱即用；生产部署可用 _FILE 形式的 Docker Secret 覆盖。
const password = isReset
  ? (readSecret('ADMIN_RESET_PASSWORD') || readSecret('INITIAL_ADMIN_PASSWORD') || '123456')
  : (readSecret('INITIAL_ADMIN_PASSWORD') || '123456')
validateCredentials(username, password)

const connection = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: getRequired('DATABASE_PASSWORD', '数据库密码'),
  database: process.env.DATABASE_NAME,
})

try {
  if (isReset) {
    const result = await connection.query(
      'UPDATE `users` SET `passwordHash` = ? WHERE `username` = ?',
      [bcrypt.hashSync(password, 10), username],
    )
    if (Number(result.affectedRows) !== 1) {
      throw new Error(`未找到管理员账号「${username}」，未执行密码重置`)
    }
    console.log(`管理员「${username}」密码已重置。请立即登录并修改密码。`)
  } else {
    const rows = await connection.query('SELECT COUNT(*) AS `count` FROM `users`')
    if (Number(rows[0].count) > 0) {
      console.log('检测到已有用户，跳过初始管理员创建。')
    } else {
      await connection.query(
        'INSERT INTO `users` (`username`, `passwordHash`, `name`, `role`, `status`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [username, bcrypt.hashSync(password, 10), '系统管理员', '管理员', 1],
      )
      console.log(`初始管理员「${username}」已创建。请首次登录后立即修改密码。`)
    }
  }
} finally {
  await connection.end()
}
