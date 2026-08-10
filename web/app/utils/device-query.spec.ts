/**
 * 网络设备筛选查询 单元测试
 * 覆盖：增量 patch 合并、切筛选回第 1 页、keyword/deviceType/status/storeId 进入 API 参数、数字 storeId 透传。
 */
import { describe, it, expect } from 'vitest'
import { applyDeviceFilterPatch, buildDeviceQuery, type DeviceFilters } from './device-query'

describe('applyDeviceFilterPatch', () => {
  it('合并增量 patch，未修改的筛选保留', () => {
    const base: DeviceFilters = { keyword: '华为', status: '正常' }
    const next = applyDeviceFilterPatch(base, { deviceType: '交换机' })
    expect(next).toEqual({ keyword: '华为', status: '正常', deviceType: '交换机' })
  })

  it('patch 清空（undefined）时对应筛选重置', () => {
    const base: DeviceFilters = { deviceType: '交换机' }
    const next = applyDeviceFilterPatch(base, { deviceType: undefined })
    expect(next.deviceType).toBeUndefined()
  })

  it('storeId 数字值透传（不转字符串）', () => {
    const next = applyDeviceFilterPatch({}, { storeId: 3 })
    expect(next.storeId).toBe(3)
  })
})

describe('buildDeviceQuery', () => {
  it('筛选参数全部进入 API query，默认 page=1', () => {
    const q = buildDeviceQuery({ keyword: '华为', deviceType: '交换机', status: '正常', storeId: 3 })
    expect(q).toEqual({ page: 1, keyword: '华为', deviceType: '交换机', status: '正常', storeId: 3 })
  })

  it('空筛选只带 page（参数不残留）', () => {
    expect(buildDeviceQuery({})).toEqual({ page: 1 })
  })

  it('可指定 page 与 pageSize（分页切换用）', () => {
    expect(buildDeviceQuery({ keyword: 'AP' }, 3, 50)).toEqual({ page: 3, pageSize: 50, keyword: 'AP' })
  })

  it('pageSize 从 20 切换到 100 时透传新值', () => {
    expect(buildDeviceQuery({}, 1, 100).pageSize).toBe(100)
  })

  it('筛选条件与 page/pageSize 同时进入 API', () => {
    expect(buildDeviceQuery({ deviceType: '交换机', storeId: 3, status: '正常' }, 2, 50))
      .toEqual({ page: 2, pageSize: 50, deviceType: '交换机', storeId: 3, status: '正常' })
  })
})
