/**
 * 服务器凭据 API 请求体验证单元测试
 *
 * 覆盖：
 * - password/dbPassword 为对象、数组、布尔时 400
 * - 仅更新一个字段不覆盖另一个
 * - 未提供字段时 400
 * - 空字符串合法（表示清除）
 * - action 为 view 时通过
 */
import { describe, it, expect } from 'vitest'
import { validatePasswordBody } from './password-validation'

describe('validatePasswordBody', () => {
  // —— action 校验 ——
  it('action 为 view → 通过', () => {
    const r = validatePasswordBody({ action: 'view' })
    expect(r.valid).toBe(true)
    if (r.valid) expect(r.action).toBe('view')
  })

  it('action 缺失 → 400', () => {
    const r = validatePasswordBody({ password: '123' })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.statusCode).toBe(400)
  })

  it('action 为非法值 → 400', () => {
    const r = validatePasswordBody({ action: 'delete' })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('action')
  })

  it('body 为 null → 400', () => {
    const r = validatePasswordBody(null)
    expect(r.valid).toBe(false)
  })

  it('body 为 undefined → 400', () => {
    const r = validatePasswordBody(undefined)
    expect(r.valid).toBe(false)
  })

  // —— password 类型校验 ——
  it('password 为对象 → 400', () => {
    const r = validatePasswordBody({ action: 'update', password: { val: 1 } })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('password 必须为字符串')
  })

  it('password 为数组 → 400', () => {
    const r = validatePasswordBody({ action: 'update', password: ['a', 'b'] })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('password 必须为字符串')
  })

  it('password 为布尔 → 400', () => {
    const r = validatePasswordBody({ action: 'update', password: true })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('password 必须为字符串')
  })

  it('password 为数字 → 400', () => {
    const r = validatePasswordBody({ action: 'update', password: 12345 })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('password 必须为字符串')
  })

  // —— dbPassword 类型校验 ——
  it('dbPassword 为对象 → 400', () => {
    const r = validatePasswordBody({ action: 'update', dbPassword: { val: 1 } })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('dbPassword 必须为字符串')
  })

  it('dbPassword 为数组 → 400', () => {
    const r = validatePasswordBody({ action: 'update', dbPassword: ['x'] })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('dbPassword 必须为字符串')
  })

  it('dbPassword 为布尔 → 400', () => {
    const r = validatePasswordBody({ action: 'update', dbPassword: false })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('dbPassword 必须为字符串')
  })

  // —— 仅更新一个字段不覆盖另一个 ——
  it('仅提供 password → 通过，data 只含 password', () => {
    const r = validatePasswordBody({ action: 'update', password: 'secret123' })
    expect(r.valid).toBe(true)
    if (r.valid && r.action === 'update') {
      expect(r.data).toEqual({ password: 'secret123' })
      expect(r.data.dbPassword).toBeUndefined()
    }
  })

  it('仅提供 dbPassword → 通过，data 只含 dbPassword', () => {
    const r = validatePasswordBody({ action: 'update', dbPassword: 'dbpass456' })
    expect(r.valid).toBe(true)
    if (r.valid && r.action === 'update') {
      expect(r.data).toEqual({ dbPassword: 'dbpass456' })
      expect(r.data.password).toBeUndefined()
    }
  })

  it('同时提供两个密码 → 通过，data 含两者', () => {
    const r = validatePasswordBody({ action: 'update', password: 'p1', dbPassword: 'p2' })
    expect(r.valid).toBe(true)
    if (r.valid && r.action === 'update') {
      expect(r.data).toEqual({ password: 'p1', dbPassword: 'p2' })
    }
  })

  // —— 未提供字段 ——
  it('update 但未提供任何字段 → 400', () => {
    const r = validatePasswordBody({ action: 'update' })
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toContain('未提供')
  })

  // —— 空字符串合法（表示清除）——
  it('password 为空字符串 → 通过（清除语义）', () => {
    const r = validatePasswordBody({ action: 'update', password: '' })
    expect(r.valid).toBe(true)
    if (r.valid && r.action === 'update') {
      expect(r.data.password).toBe('')
    }
  })

  it('dbPassword 为空字符串 → 通过（清除语义）', () => {
    const r = validatePasswordBody({ action: 'update', dbPassword: '' })
    expect(r.valid).toBe(true)
    if (r.valid && r.action === 'update') {
      expect(r.data.dbPassword).toBe('')
    }
  })

  it('两个密码都为空字符串 → 通过（清除两者）', () => {
    const r = validatePasswordBody({ action: 'update', password: '', dbPassword: '' })
    expect(r.valid).toBe(true)
    if (r.valid && r.action === 'update') {
      expect(r.data).toEqual({ password: '', dbPassword: '' })
    }
  })
})
