// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  telemetry: false,

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
    '~/assets/styles/element-theme.scss',
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
      title: '泰兴超市信息部综合管理平台',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '泰兴超市信息部综合管理平台 V0.01' },
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
