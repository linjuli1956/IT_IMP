// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // DevTools 仅开发环境启用，生产构建不携带
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  telemetry: false,

  runtimeConfig: {
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || '综合管理平台',
    },
  },

  // 模块注册
  modules: [
    '@element-plus/nuxt',
    '@pinia/nuxt',
  ],

  // 组件自动导入（取消目录前缀，PageHeader 而非 CommonPageHeader）
  components: [
    { path: '~/components', pathPrefix: false },
  ],

  // 全局样式（顺序：Token → 主题 → 全局）
  css: [
    '~/assets/styles/tokens.css',
    '~/assets/styles/element-theme.css',
    '~/assets/styles/global.css',
  ],

  // Element Plus 配置
  elementPlus: {
    icon: 'ElIcon',
    importStyle: 'css',
  },

  // app 全局配置
  app: {
    head: {
      title: process.env.NUXT_PUBLIC_APP_NAME || '综合管理平台',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '综合管理平台 20260817' },
      ],
    },
  },

  // 构建优化
  vite: {
    optimizeDeps: {
      include: ['echarts', 'vue-echarts'],
    },
  },
})
