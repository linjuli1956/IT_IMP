/**
 * 系统设置数据源（全局单例）
 * 提供系统参数（如财年起始月）的读取与保存，供预算、首页等模块共享。
 * 未加载或未配置时按默认值计算（财年起始月默认 4），加载成功后各 computed 自动重算。
 */
import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'

// 全局共享状态（单例）
const settings = ref<Record<string, string>>({})
const loading = ref(false)

/** 财年起始月（1~12）：从设置读取，未加载/未配置/非法值时默认 4 */
const fiscalYearStartMonth = computed(() => {
  const n = Number(settings.value.startMonth)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 4
})

/** 拉取全部系统设置 */
async function fetchSettings() {
  loading.value = true
  try {
    const { get } = useApi()
    settings.value = await get<Record<string, string>>('/api/settings')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/** 保存系统设置（仅管理员后端会放行），成功后刷新本地状态 */
async function saveSettings(patch: Record<string, string | number>): Promise<boolean> {
  try {
    const { put } = useApi()
    settings.value = await put<Record<string, string>>('/api/settings', patch)
    ElMessage.success('设置已保存')
    return true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return false
  }
}

export function useSettingsData() {
  return {
    settings,
    loading,
    fiscalYearStartMonth,
    fetchSettings,
    saveSettings,
  }
}
