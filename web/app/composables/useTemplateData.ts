/**
 * 计提模板 共享数据源
 * 数据来自后端 API，全局单例共享
 * 参照 useStoreData.ts / useDetailData.ts 模式
 *
 * 模板数据结构说明：
 * - 每个运营商+门店一套模板
 * - 电信模板“名称”列填演示号码（如 DEMO_PHONE），用于匹配明细表
 * - 联通/移动模板"名称"列填费用类型（如宽带固话），直接填发票金额
 * - 非号码行（如"固话及其他费用"）通过倒推计算
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { TemplateItem, AccrualTemplate } from '~/types/template'
export type { TemplateItem, AccrualTemplate }

// 全局共享（单例）
const templateList = ref<AccrualTemplate[]>([])
const loading = ref(false)

/** 查询参数 */
export interface TemplateQueryParams {
  carrier?: string
  store?: string
}

/**
 * 获取模板列表
 * @param params 筛选条件（可选）
 */
async function fetchTemplates(params?: TemplateQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    templateList.value = await get<AccrualTemplate[]>('/api/templates', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 获取模板详情（含 items JSON 数据）
 * @param id 模板ID
 */
async function fetchTemplateById(id: number): Promise<AccrualTemplate | null> {
  try {
    const { get } = useApi()
    return await get<AccrualTemplate>(`/api/templates/${id}`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 新增模板
 * @param data 模板数据（carrier, store 必填；其余可选）
 * @returns 创建成功返回模板，失败返回 null
 */
async function createTemplate(data: {
  carrier: string
  store: string
  reimbursementFormat?: string
  reimbursementCustom?: string
  items?: TemplateItem[]
}): Promise<AccrualTemplate | null> {
  try {
    const { post } = useApi()
    const result = await post<AccrualTemplate>('/api/templates', data)
    // 添加到本地列表
    templateList.value.push(result)
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 更新模板
 * @param id 模板ID
 * @param data 更新字段（部分更新）
 * @returns 成功返回 true，失败返回 false
 */
async function updateTemplate(id: number, data: {
  carrier?: string
  store?: string
  reimbursementFormat?: string
  reimbursementCustom?: string
  items?: TemplateItem[]
}): Promise<boolean> {
  try {
    const { put } = useApi()
    const result = await put<AccrualTemplate>(`/api/templates/${id}`, data)
    // 更新本地列表
    const idx = templateList.value.findIndex(t => t.id === id)
    if (idx > -1) {
      templateList.value[idx] = result
    }
    return true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return false
  }
}

/**
 * 删除模板
 * @param id 模板ID
 * @returns 成功返回 true，失败返回 false
 */
async function deleteTemplate(id: number): Promise<boolean> {
  try {
    const { delete: del } = useApi()
    await del(`/api/templates/${id}`)
    // 从本地列表移除
    const idx = templateList.value.findIndex(t => t.id === id)
    if (idx > -1) {
      templateList.value.splice(idx, 1)
    }
    return true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return false
  }
}

export function useTemplateData() {
  /**
   * 根据运营商+门店查找模板（同步，从内存列表查找）
   * 注意：需先调用 fetchTemplates() 加载数据
   */
  function findByCarrierStore(carrier: string, store: string): AccrualTemplate | undefined {
    return templateList.value.find(t => t.carrier === carrier && t.store === store)
  }

  /**
   * 根据运营商+门店查找模板（增强匹配）
   * 先精确匹配 template.store 字段，找不到再检查 items 中是否有 dept 包含该门店
   * 支持一个模板覆盖多个门店的场景
   */
  function findByCarrierStoreOrDept(carrier: string, store: string): AccrualTemplate | undefined {
    // 1. 先精确匹配 store 字段
    const exact = templateList.value.find(t => t.carrier === carrier && t.store === store)
    if (exact) return exact
    // 2. 再检查 items 中是否有 dept 包含该门店
    return templateList.value.find(t =>
      t.carrier === carrier &&
      (t.items || []).some(item => (item.dept || []).includes(store)),
    )
  }

  /**
   * 过滤模板 items：按门店筛选
   * 如果模板中有 items 的 dept 包含该门店，则只返回匹配的 items（+空 dept 的兜底项）
   * 如果没有匹配项，返回全部 items（向后兼容）
   */
  function filterItemsByStore(items: TemplateItem[], store: string): TemplateItem[] {
    const hasMatchingDept = items.some(item => (item.dept || []).includes(store))
    if (!hasMatchingDept) return items
    return items.filter(item => {
      const depts = item.dept || []
      // 包含该门店的项，或空 dept 的兜底项
      return depts.includes(store) || depts.length === 0
    })
  }

  /**
   * 根据运营商查找所有模板（同步，从内存列表查找）
   * 注意：需先调用 fetchTemplates() 加载数据
   */
  function findByCarrier(carrier: string): AccrualTemplate[] {
    return templateList.value.filter(t => t.carrier === carrier)
  }

  /**
   * 从模板明细行中提取所有涉及的承担部门（去重）
   */
  function getInvolvedDepts(template: AccrualTemplate): string {
    if (!template.items || template.items.length === 0) return template.store
    const depts = new Set<string>()
    for (const item of template.items) {
      for (const d of item.dept) {
        if (d) depts.add(d)
      }
    }
    return Array.from(depts).join('、')
  }

  return {
    templateList,
    loading,
    fetchTemplates,
    fetchTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    findByCarrierStore,
    findByCarrierStoreOrDept,
    filterItemsByStore,
    findByCarrier,
    getInvolvedDepts,
  }
}
