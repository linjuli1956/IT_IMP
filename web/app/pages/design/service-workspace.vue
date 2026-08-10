<!--
  服务型资产工作台静态设计稿（阶段 0 交付物）。
  设计依据：docs/IT资产页面分型与交互规范.md §6.6 / §6.7
  范式：不请求 API / 假数据 / 筛选真实生效 / 角色可切换 / 自然响应式不用视口模拟器。
  覆盖：域名 / 小程序（卡片网格 + 点击卡片→AssetDetailDrawer）。
  敏感字段（主账号/主账号密码、邮箱密码）仅在抽屉按需显示，不进卡片。
  冻结边界：不改 it/*.vue 正式页面、不改数据库/API。
-->
<template>
  <div class="service-workspace">
    <PageHeader title="服务型资产工作台" subtitle="域名 / 小程序卡片网格（设计稿）">
      <template #actions>
        <el-radio-group v-model="currentRole" size="small" class="role-switcher">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="viewer">查看者</el-radio-button>
        </el-radio-group>
      </template>
    </PageHeader>

    <div class="quick-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>点击卡片打开详情抽屉 · 敏感字段仅在抽屉按需显示 · 卡片右上角"更多"含编辑/删除</span>
    </div>

    <el-tabs v-model="activeModule" class="service-tabs">
      <!-- ============ 域名 ============ -->
      <el-tab-pane label="域名" name="domain">
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6"><StatCard :icon="Document" :color="vars.primary" :bg="vars.primaryLight" :value="mockDomains.length" label="域名总数" /></el-col>
          <el-col :span="6"><StatCard :icon="CircleCheck" :color="vars.success" :bg="vars.successLight" :value="domainActive" label="正常" /></el-col>
          <el-col :span="6"><StatCard :icon="WarningFilled" :color="vars.warning" :bg="vars.warningLight" :value="domainExpiring" label="即将到期" /></el-col>
          <el-col :span="6"><StatCard :icon="CircleClose" :color="vars.danger" :bg="vars.dangerLight" :value="domainExpired" label="已过期" /></el-col>
        </el-row>
        <div class="card filter-bar">
          <el-input v-model="domainKeyword" placeholder="搜索域名/颁发机构/备注" clearable style="width: 320px" :prefix-icon="Search" />
          <span class="filter-count">{{ filteredDomains.length }} 个结果</span>
        </div>
        <div class="card">
          <div class="card-grid">
            <ServiceAssetCard
              v-for="d in filteredDomains" :key="d.id"
              :title="d.domain" :subtitle="d.certIssuer || '服务商未填'"
              :tags="domainTags(d)" :fields="domainFields(d)" :can-edit="canEdit"
              @click="openDrawer('domain', d)" @edit="onMockEdit" @delete="onMockDelete"
            />
          </div>
          <EmptyState v-if="filteredDomains.length === 0" description="暂无域名数据" />
        </div>
      </el-tab-pane>

      <!-- ============ 小程序 ============ -->
      <el-tab-pane label="小程序" name="miniapp">
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6"><StatCard :icon="Cellphone" :color="vars.primary" :bg="vars.primaryLight" :value="mockMiniapps.length" label="小程序总数" /></el-col>
          <el-col :span="6"><StatCard :icon="CircleCheck" :color="vars.success" :bg="vars.successLight" :value="miniappActive" label="正常" /></el-col>
          <el-col :span="6"><StatCard :icon="CircleClose" :color="vars.danger" :bg="vars.dangerLight" :value="miniappInactive" label="停用" /></el-col>
          <el-col :span="6"><StatCard :icon="PieChart" :color="vars.info" :bg="vars.infoLight" :value="miniappRate" label="正常率" /></el-col>
        </el-row>
        <div class="card filter-bar">
          <el-input v-model="miniappKeyword" placeholder="搜索名称/邮箱/备注" clearable style="width: 320px" :prefix-icon="Search" />
          <span class="filter-count">{{ filteredMiniapps.length }} 个结果</span>
        </div>
        <div class="card">
          <div class="card-grid">
            <ServiceAssetCard
              v-for="m in filteredMiniapps" :key="m.id"
              :title="m.name" :subtitle="m.email"
              :tags="miniappTags(m)" :fields="miniappFields(m)" :can-edit="canEdit"
              @click="openDrawer('miniapp', m)" @edit="onMockEdit" @delete="onMockDelete"
            />
          </div>
          <EmptyState v-if="filteredMiniapps.length === 0" description="暂无小程序数据" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 统一详情抽屉（敏感字段按需显示） ============ -->
    <AssetDetailDrawer v-model="drawerVisible" :title="drawerTitle" :can-edit="canEdit">
      <template #header>
        <span class="drawer-id">{{ drawerHeaderLabel }}</span>
        <el-tag :type="getAssetStatusTagType(currentRow?.status || '')" size="small">{{ currentRow?.status }}</el-tag>
      </template>
      <el-descriptions v-if="currentRow" :column="2" border size="small">
        <el-descriptions-item v-for="f in drawerItems" :key="f.label" :label="f.label" :span="f.span || 1">
          <SensitiveValue v-if="f.sensitive" :value="f.value" />
          <span v-else>{{ f.value || '—' }}</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button v-if="canEdit" type="primary" @click="onMockEdit">编辑</el-button>
        <el-button v-if="canEdit" type="danger" @click="onMockDelete">删除</el-button>
      </template>
    </AssetDetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { InfoFilled, Search, Document, CircleCheck, WarningFilled, CircleClose, Cellphone, PieChart } from '@element-plus/icons-vue'
import { getExpireInfo, getAssetStatusTagType } from '~/utils/asset-utils'
import type { ServiceTag, ServiceField } from '~/components/common/ServiceAssetCard.vue'

// —— 角色切换 ——
const currentRole = ref<'admin' | 'viewer'>('admin')
const canEdit = computed(() => currentRole.value === 'admin')

const vars = {
  primary: 'var(--color-primary)', primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)', successLight: 'var(--color-success-light)',
  warning: 'var(--color-warning)', warningLight: 'var(--color-warning-light)',
  danger: 'var(--color-danger)', dangerLight: 'var(--color-danger-light)',
  info: 'var(--color-info)', infoLight: 'var(--color-info-light)',
}

// —— Mock 数据 ——
const mockDomains: any[] = [
  { id: 1, domain: 'taixing-mart.invalid', mainAccount: 'taixingadmin@aliyun', mainPassword: 'SecRet#2026', certType: 'OV', certIssuer: '阿里云SSL', certRenewDate: '2026-02-10', certExpireDate: '2026-08-15', status: '正常', remark: '主站' },
  { id: 2, domain: 'api.taixing-mart.invalid', mainAccount: 'taixingadmin@aliyun', mainPassword: 'SecRet#2026', certType: 'DV', certIssuer: "Let's Encrypt", certRenewDate: '2026-07-20', certExpireDate: '2026-09-20', status: '正常', remark: '接口' },
  { id: 3, domain: 'hq.taixing-mart.invalid', mainAccount: 'hqadmin@aliyun', mainPassword: 'HQpass2024!', certType: 'EV', certIssuer: 'DigiCert', certRenewDate: '2025-11-01', certExpireDate: '2026-12-01', status: '正常', remark: '总部系统' },
  { id: 4, domain: 'legacy.taixing-mart.invalid', mainAccount: 'oldadmin@aliyun', mainPassword: 'Old123456', certType: 'DV', certIssuer: "Let's Encrypt", certRenewDate: '2025-11-01', certExpireDate: '2026-05-01', status: '停用', remark: '旧域名待注销' },
  { id: 5, domain: 'pay.taixing-mart.invalid', mainAccount: 'payadmin@aliyun', mainPassword: 'Pay#Secure9', certType: 'OV', certIssuer: '阿里云SSL', certRenewDate: '2026-01-01', certExpireDate: '2027-01-01', status: '正常', remark: '支付' },
]
const mockMiniapps: any[] = [
  { id: 1, name: '泰兴超市会员小程序', email: 'member@taixing-mart.invalid', emailPassword: 'Mini#Member2026', status: '正常', remark: '会员中心' },
  { id: 2, name: '泰兴购物小程序', email: 'shop@taixing-mart.invalid', emailPassword: 'Shop2026Pass', status: '正常', remark: '线上购物' },
  { id: 3, name: '泰兴员工助手', email: 'hr@taixing-mart.invalid', emailPassword: 'Hr#Internal1', status: '停用', remark: '内部应用停用' },
  { id: 4, name: '泰兴售后小程序', email: 'service@taixing-mart.invalid', emailPassword: 'Svc#2026Safe', status: '正常', remark: '' },
]

// —— 概览统计 ——
const domainActive = computed(() => mockDomains.filter(d => d.status === '正常').length)
const domainExpiring = computed(() => mockDomains.filter((d) => { const e = getExpireInfo(d.certExpireDate); return e.days !== null && e.days > 0 && e.days <= 30 }).length)
const domainExpired = computed(() => mockDomains.filter((d) => { const e = getExpireInfo(d.certExpireDate); return e.days !== null && e.days < 0 }).length)
const miniappActive = computed(() => mockMiniapps.filter(m => m.status === '正常').length)
const miniappInactive = computed(() => mockMiniapps.filter(m => m.status !== '正常').length)
const miniappRate = computed(() => mockMiniapps.length === 0 ? '0%' : Math.round(miniappActive.value / mockMiniapps.length * 100) + '%')

// —— 搜索 ——
const domainKeyword = ref('')
const filteredDomains = computed(() => {
  const kw = domainKeyword.value.toLowerCase()
  if (!kw) return mockDomains
  return mockDomains.filter(d => [d.domain, d.certIssuer, d.remark].filter(Boolean).join(' ').toLowerCase().includes(kw))
})
const miniappKeyword = ref('')
const filteredMiniapps = computed(() => {
  const kw = miniappKeyword.value.toLowerCase()
  if (!kw) return mockMiniapps
  return mockMiniapps.filter(m => [m.name, m.email, m.remark].filter(Boolean).join(' ').toLowerCase().includes(kw))
})

// —— 卡片字段构造 ——
function certTagType(t: string | null): ServiceTag['type'] {
  if (t === 'EV') return 'success'
  if (t === 'OV') return 'warning'
  if (t === 'DV') return 'info'
  return 'info'
}
function expireTagType(date: string): ServiceTag['type'] {
  const t = getExpireInfo(date).tagType
  if (t === 'danger') return 'danger'
  if (t === 'warning') return 'warning'
  return 'success'
}
function expireLabel(date: string): string {
  const e = getExpireInfo(date)
  if (e.days === null) return '—'
  if (e.days < 0) return `已过期${Math.abs(e.days)}天`
  if (e.days === 0) return '今天到期'
  return `${e.days}天后到期`
}
function domainTags(d: any): ServiceTag[] {
  return [
    { label: d.certType || '无证书', type: certTagType(d.certType) },
    { label: expireLabel(d.certExpireDate), type: expireTagType(d.certExpireDate) },
    { label: d.status, type: d.status === '正常' ? 'success' : 'danger' },
  ]
}
function domainFields(d: any): ServiceField[] {
  return [
    { label: '管理入口', value: '阿里云控制台', link: true },
    { label: '备注', value: d.remark || '—' },
  ]
}
function miniappTags(m: any): ServiceTag[] {
  return [{ label: m.status, type: m.status === '正常' ? 'success' : 'danger' }]
}
function miniappFields(m: any): ServiceField[] {
  return [
    { label: '管理入口', value: '微信公众平台', link: true },
    { label: '备注', value: m.remark || '—' },
  ]
}

// —— 抽屉 ——
const activeModule = ref<'domain' | 'miniapp'>('domain')
const drawerVisible = ref(false)
const currentRow = ref<any>(null)
const currentDrawerModule = ref<'domain' | 'miniapp'>('domain')
function openDrawer(module: 'domain' | 'miniapp', row: any) {
  currentDrawerModule.value = module
  currentRow.value = row
  drawerVisible.value = true
}
const drawerTitle = computed(() => currentRow.value ? (currentDrawerModule.value === 'domain' ? currentRow.value.domain : currentRow.value.name) : '详情')
const drawerHeaderLabel = computed(() => currentRow.value ? (currentDrawerModule.value === 'domain' ? `域名 · ${currentRow.value.certIssuer || ''}` : `小程序 · ${currentRow.value.email}`) : '')
const drawerItems = computed<{ label: string; value: string; span?: number; sensitive?: boolean }[]>(() => {
  const r = currentRow.value
  if (!r) return []
  if (currentDrawerModule.value === 'domain') return [
    { label: '域名', value: r.domain }, { label: '服务商', value: r.certIssuer || '—' },
    { label: '证书类型', value: r.certType || '—' }, { label: '状态', value: r.status },
    { label: '更换日期', value: r.certRenewDate || '—' }, { label: '到期日期', value: r.certExpireDate || '—' },
    { label: '主账号', value: r.mainAccount || '—', sensitive: true }, { label: '主账号密码', value: r.mainPassword || '—', sensitive: true },
    { label: '备注', value: r.remark || '—', span: 2 },
  ]
  return [
    { label: '小程序名称', value: r.name }, { label: '状态', value: r.status },
    { label: '绑定邮箱', value: r.email || '—' }, { label: '邮箱密码', value: r.emailPassword || '—', sensitive: true },
    { label: '备注', value: r.remark || '—', span: 2 },
  ]
})

function onMockEdit() { ElMessage.info('设计稿：编辑入口（阶段1接入正式表单）') }
function onMockDelete() { ElMessage.info('设计稿：删除入口（阶段1接入二次确认）') }
</script>

<style scoped>
.quick-tip { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: var(--font-size-small); margin-bottom: var(--spacing-card); }
.role-switcher { margin-right: 8px; }
.stat-row { margin-bottom: var(--spacing-card); }
.service-tabs :deep(.el-tabs__header) { margin-bottom: var(--spacing-card); }
.filter-bar { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; margin-bottom: var(--spacing-card); }
.filter-count { margin-left: auto; color: var(--text-secondary); font-size: var(--font-size-small); }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--spacing-card); }
.drawer-id { font-weight: 600; color: var(--text-primary); margin-right: 8px; }
</style>
