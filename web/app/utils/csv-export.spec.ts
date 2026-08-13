/**
 * CSV 导出 单元测试
 * 覆盖：BOM 前缀、逗号/引号/换行转义、Excel 公式注入防护（= + - @）、空值处理。
 */
import { describe, it, expect } from 'vitest'
import { escapeCsvCell, serializeCsv, type CsvColumn } from './csv-export'

describe('escapeCsvCell', () => {
  it('普通文本原样返回', () => {
    expect(escapeCsvCell('华为')).toBe('华为')
    expect(escapeCsvCell('S5735')).toBe('S5735')
  })

  it('null / undefined / 空字符串返回空字符串', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
    expect(escapeCsvCell('')).toBe('')
  })

  it('数字转为字符串', () => {
    expect(escapeCsvCell(0)).toBe('0')
    expect(escapeCsvCell(42)).toBe('42')
  })

  it('包含逗号时用双引号包裹', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
  })

  it('包含双引号时转义并包裹', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('包含换行时用双引号包裹', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCsvCell('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  // — 公式注入防护 —
  it('= 开头前置单引号', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
  })

  it('+ 开头前置单引号', () => {
    expect(escapeCsvCell('+1')).toBe("'+1")
  })

  it('- 开头前置单引号', () => {
    expect(escapeCsvCell('-1')).toBe("'-1")
  })

  it('@ 开头前置单引号', () => {
    expect(escapeCsvCell('@username')).toBe("'@username")
  })

  it('公式注入 + 逗号同时存在时两者都处理', () => {
    expect(escapeCsvCell('=SUM(A1,A2)')).toBe('"\'=SUM(A1,A2)"')
  })

  it('非公式字符开头不前置单引号', () => {
    expect(escapeCsvCell('正常文本')).toBe('正常文本')
    expect(escapeCsvCell('#标签')).toBe('#标签')
  })
})

describe('serializeCsv', () => {
  interface Row {
    name: string
    ip: string | null
    remark: string
  }

  const columns: CsvColumn<Row>[] = [
    { prop: 'name', label: '名称' },
    { prop: 'ip', label: '管理IP' },
    { prop: 'remark', label: '备注' },
  ]

  it('输出以 UTF-8 BOM 开头', () => {
    const csv = serializeCsv(columns, [])
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('只有列头时输出 BOM + 表头行', () => {
    const csv = serializeCsv(columns, [])
    expect(csv).toBe('\uFEFF名称,管理IP,备注')
  })

  it('正常数据行正确序列化', () => {
    const data: Row[] = [
      { name: '华为交换机', ip: '10.0.0.1', remark: '一楼弱电井' },
    ]
    expect(serializeCsv(columns, data)).toBe(
      '\uFEFF名称,管理IP,备注\r\n华为交换机,10.0.0.1,一楼弱电井',
    )
  })

  it('null 值导出为空字符串', () => {
    const data: Row[] = [
      { name: '设备A', ip: null, remark: '' },
    ]
    expect(serializeCsv(columns, data)).toBe(
      '\uFEFF名称,管理IP,备注\r\n设备A,,',
    )
  })

  it('公式注入数据被正确防护', () => {
    const data: Row[] = [
      { name: '=SUM(A1:A2)', ip: '+1', remark: '@inject' },
    ]
    const csv = serializeCsv(columns, data)
    expect(csv).toContain("'=SUM(A1:A2)")
    expect(csv).toContain("'+1")
    expect(csv).toContain("'@inject")
  })

  it('包含逗号/引号的数据被正确转义', () => {
    const data: Row[] = [
      { name: '设备,"A"', ip: '10.0.0.1', remark: 'a,b' },
    ]
    const csv = serializeCsv(columns, data)
    expect(csv).toContain('"设备,""A"""')
    expect(csv).toContain('"a,b"')
  })

  it('多行数据用 \\r\\n 分隔', () => {
    const data: Row[] = [
      { name: '设备A', ip: '10.0.0.1', remark: '' },
      { name: '设备B', ip: '10.0.0.2', remark: '' },
    ]
    const csv = serializeCsv(columns, data)
    expect(csv).toBe(
      '\uFEFF名称,管理IP,备注\r\n设备A,10.0.0.1,\r\n设备B,10.0.0.2,',
    )
  })
})
