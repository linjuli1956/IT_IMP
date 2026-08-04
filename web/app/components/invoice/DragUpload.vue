<template>
  <div class="drag-upload">
    <!-- 拖拽区域 -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone--active': isDragging }"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <el-icon class="drop-icon"><UploadFilled /></el-icon>
      <p class="drop-text">{{ hintText }}</p>
      <p class="drop-hint">{{ subHint }}</p>
      <input
        ref="fileInputRef"
        type="file"
        :accept="accept"
        multiple
        style="display: none"
        @change="handleFileSelect"
      />
    </div>

    <!-- 文件列表 -->
    <div v-if="files.length > 0" class="file-list">
      <div class="file-list-header">
        <span>已选文件（{{ files.length }}/{{ maxCount }}）</span>
        <el-button text type="primary" size="small" @click="clearFiles">清空</el-button>
      </div>
      <div v-for="(file, index) in files" :key="index" class="file-item">
        <el-icon class="file-icon" :color="getFileColor(file.name)">
          <Document v-if="isPdf(file.name)" />
          <FolderOpened v-else />
        </el-icon>
        <div class="file-info">
          <span class="file-name" :title="file.name">{{ file.name }}</span>
          <span class="file-size">{{ formatSize(file.size) }}</span>
          <!-- ZIP展开的子文件 -->
          <div v-if="file.expanded && file.expanded.length > 0" class="expanded-files">
            <span class="expanded-label">ZIP包含 {{ file.expanded.length }} 个文件：</span>
            <span v-for="(sub, i) in file.expanded" :key="i" class="expanded-item">{{ sub }}</span>
          </div>
        </div>
        <el-button text type="danger" size="small" @click="removeFile(index)">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UploadFilled, Document, FolderOpened, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface DragFile {
  name: string
  size: number
  expanded?: string[]
  raw?: File  // 原始 File 对象，用于实际上传
}

const props = withDefaults(defineProps<{
  maxCount?: number
  accept?: string
  hintText?: string
  subHint?: string
}>(), {
  maxCount: 10,
  accept: '.pdf,.zip',
  hintText: '将 PDF / ZIP 文件拖拽到此处，或点击选择',
  subHint: '',
})

const subHint = computed(() => props.subHint || `支持 ${props.accept.toUpperCase()} 格式，单次最多 ${props.maxCount} 个文件`)

const emit = defineEmits<{
  'files-change': [files: DragFile[]]
}>()

const dragCounter = ref(0)
const isDragging = computed(() => dragCounter.value > 0)
const fileInputRef = ref<HTMLInputElement>()
const files = ref<DragFile[]>([])

// 拖拽计数器（避免子元素 dragleave 闪烁）
function onDragEnter() {
  dragCounter.value++
}

function onDragLeave() {
  dragCounter.value = Math.max(0, dragCounter.value - 1)
}

// 触发文件选择
function triggerFileInput() {
  fileInputRef.value?.click()
}

// 处理文件选择
function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) {
    addFiles(target.files)
    target.value = '' // 重置，允许重复选择同一文件
  }
}

// 处理拖拽放下
function handleDrop(e: DragEvent) {
  dragCounter.value = 0
  if (e.dataTransfer?.files) {
    addFiles(e.dataTransfer.files)
  }
}

// 添加文件
function addFiles(fileList: FileList) {
  const newFiles: DragFile[] = []

  for (const file of Array.from(fileList)) {
    // 检查数量限制
    if (files.value.length + newFiles.length >= props.maxCount) {
      ElMessage.warning(`单次最多上传 ${props.maxCount} 个文件`)
      break
    }

    // 检查文件类型
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = props.accept.split(',').map(e => e.trim().replace('.', '').toLowerCase())
    if (!allowedExts.includes(ext)) {
      ElMessage.warning(`"${file.name}" 不是支持的文件类型，已跳过`)
      continue
    }

    // 添加文件（ZIP 不再前端模拟解压，由服务端处理）
    newFiles.push({ name: file.name, size: file.size, raw: file })
  }

  if (newFiles.length > 0) {
    files.value.push(...newFiles)
    emit('files-change', files.value)
    ElMessage.success(`已添加 ${newFiles.length} 个文件`)
  }
}

// 移除文件
function removeFile(index: number) {
  files.value.splice(index, 1)
  emit('files-change', files.value)
}

// 清空文件
function clearFiles() {
  files.value = []
  emit('files-change', files.value)
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 判断是否为 PDF 文件（大小写不敏感）
function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith('.pdf')
}

// 文件图标颜色
function getFileColor(name: string): string {
  if (isPdf(name)) return 'var(--color-primary)'
  return 'var(--color-info)'
}

// 暴露方法供父组件调用
defineExpose({
  getFiles: () => files.value,
  clear: clearFiles,
})
</script>

<style scoped>
.drag-upload {
  width: 100%;
}

.drop-zone {
  border: 2px dashed var(--border-base);
  border-radius: var(--radius-card);
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--bg-page);
}

.drop-zone:hover {
  border-color: var(--color-primary);
  background: var(--bg-hover);
}

.drop-zone--active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  transform: scale(1.01);
}

.drop-icon {
  font-size: 48px; /* 拖拽区大图标尺寸，非文本字号 */
  color: var(--color-primary);
  margin-bottom: 12px;
}

.drop-text {
  font-size: var(--font-size-subtitle);
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.drop-hint {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  margin: 0;
}

.file-list {
  margin-top: var(--spacing-card);
  border: 1px solid var(--border-lighter);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-page);
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}

.file-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-lighter);
  transition: background 0.2s;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-icon {
  font-size: 24px; /* 文件类型图标尺寸，非文本字号 */
  margin-top: 2px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-size: var(--font-size-body);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
}

.expanded-files {
  margin-top: 6px;
  padding: 6px 10px;
  background: var(--bg-hover);
  border-radius: var(--radius-input);
  font-size: var(--font-size-mini);
}

.expanded-label {
  color: var(--text-secondary);
  display: block;
  margin-bottom: 4px;
}

.expanded-item {
  display: inline-block;
  margin-right: 8px;
  margin-bottom: 2px;
  padding: 2px 8px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-small);
  font-size: var(--font-size-mini);
}
</style>
