/**
 * 剪贴板 composable：统一 navigator.clipboard + execCommand 降级逻辑。
 * 提取自 ReimbursementText.vue，供全项目复用。
 *
 * v0.2 规范：复制不依赖 canEdit；查看者可复制白名单字段。
 */
import { ElMessage } from 'element-plus'

export function useClipboard() {
  /**
   * 复制文本到剪贴板。
   * @param text  要复制的文本
   * @param label 可选，用于提示语（如 "管理IP"）
   */
  async function copy(text: string, label?: string): Promise<void> {
    if (!text) {
      ElMessage.warning('内容为空，无法复制')
      return
    }
    // 优先使用 Clipboard API（需 HTTPS 或 localhost）
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        ElMessage.success(label ? `已复制${label}` : '已复制到剪贴板')
        return
      } catch {
        // 降级到 execCommand
      }
    }
    // 降级方案：创建临时 textarea + execCommand('copy')
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      ElMessage.success(label ? `已复制${label}` : '已复制到剪贴板')
    } catch {
      ElMessage.error('复制失败，请手动选择文本复制')
    }
  }

  return { copy }
}
