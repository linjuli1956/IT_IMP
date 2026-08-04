const DEFAULT_APP_NAME = '综合管理平台'
const APP_VERSION = 'V0.01'

export function useAppBrand() {
  const runtimeConfig = useRuntimeConfig()
  const appName = computed(() => {
    const configuredName = String(runtimeConfig.public.appName || '').trim()
    return configuredName || DEFAULT_APP_NAME
  })
  const appTitle = computed(() => `${appName.value} ${APP_VERSION}`)

  return {
    appName,
    appTitle,
    version: APP_VERSION,
  }
}
