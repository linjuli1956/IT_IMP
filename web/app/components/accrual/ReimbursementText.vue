<script setup lang="ts">
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Props {
  text: string
  label?: string
  copyable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '报销说明',
  copyable: false,
})

async function copyText() {
  // 优先使用 Clipboard API（需 HTTPS 或 localhost）
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(props.text)
      ElMessage.success('已复制到剪贴板')
      return
    } catch {
      // 降级到 execCommand
    }
  }
  // 降级方案：创建临时 textarea + execCommand('copy')
  try {
    const textarea = document.createElement('textarea')
    textarea.value = props.text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}
</script>

<template>
  <div class="reimbursement-box">
    <div class="reimbursement-header">
      <span class="reimbursement-label">{{ label }}</span>
      <el-button v-if="copyable" size="small" text @click="copyText">
        <el-icon><CopyDocument /></el-icon>
        复制
      </el-button>
    </div>
    <div class="reimbursement-text">{{ text }}</div>
  </div>
</template>

<style scoped>
.reimbursement-box {
  margin-top: var(--spacing-card);
  padding: 12px 16px;
  background: var(--color-primary-light);
  border-radius: var(--radius-input);
  border: 1px dashed var(--color-primary-border);
}

.reimbursement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.reimbursement-label {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--color-primary-active);
}

.reimbursement-text {
  font-size: var(--font-size-body);
  color: var(--text-primary);
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
