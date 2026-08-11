/**
 * 服务器凭据 API 请求体验证（纯函数，可测试）
 */

export type PasswordUpdateBody = {
  action?: unknown
  password?: unknown
  dbPassword?: unknown
}

export type ValidationResult =
  | { valid: true; action: 'view' }
  | { valid: true; action: 'update'; data: { password?: string; dbPassword?: string } }
  | { valid: false; statusCode: number; message: string }

/**
 * 验证服务器凭据 API 请求体
 * - action 必须为 'view' 或 'update'
 * - update 时 password/dbPassword 必须为字符串（如果提供）
 * - update 时至少提供一个字段
 * - 空字符串视为合法（表示清除）
 */
export function validatePasswordBody(body: PasswordUpdateBody | null | undefined): ValidationResult {
  if (!body) {
    return { valid: false, statusCode: 400, message: '请求体不能为空' }
  }

  const action = body.action
  if (action !== 'view' && action !== 'update') {
    return { valid: false, statusCode: 400, message: 'action 必须为 view 或 update' }
  }

  if (action === 'view') {
    return { valid: true, action: 'view' }
  }

  // update：类型校验 + 收集合法字段
  const data: { password?: string; dbPassword?: string } = {}

  if (body.password !== undefined) {
    if (typeof body.password !== 'string') {
      return { valid: false, statusCode: 400, message: 'password 必须为字符串' }
    }
    data.password = body.password
  }

  if (body.dbPassword !== undefined) {
    if (typeof body.dbPassword !== 'string') {
      return { valid: false, statusCode: 400, message: 'dbPassword 必须为字符串' }
    }
    data.dbPassword = body.dbPassword
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, statusCode: 400, message: '未提供要更新的密码字段' }
  }

  return { valid: true, action: 'update', data }
}
