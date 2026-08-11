import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 仅配置 vue SFC 编译插件；DOM 环境由各测试文件用
// `// @vitest-environment happy-dom` 指令按需启用，不影响现有纯函数测试。
export default defineConfig({
  plugins: [vue()],
  test: {
    // element-plus 组件会导入 CSS，vitest 中禁用 CSS 处理避免构建错误
    css: false,
  },
})
