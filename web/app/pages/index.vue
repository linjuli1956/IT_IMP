<template>
  <div class="page-container">
    <PageHeader title="首页数据大屏" />

    <!-- 第一行：业务指标卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6" v-for="(stat, i) in businessStats" :key="'biz-' + i">
        <StatCard :icon="stat.icon" :color="stat.color" :bg="stat.bg" :value="stat.value" :label="stat.label" />
      </el-col>
    </el-row>

    <!-- 第二行：IT资产指标卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6" v-for="(stat, i) in itStats" :key="'it-' + i">
        <StatCard :icon="stat.icon" :color="stat.color" :bg="stat.bg" :value="stat.value" :label="stat.label" />
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <ChartCard title="月度预算趋势" :option="trendOption" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="各门店年度预算" :option="storeBudgetOption" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :span="12">
        <ChartCard title="发票批次状态分布" :option="batchStatusOption" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="运营商预算排名" :option="carrierRankOption" />
      </el-col>
    </el-row>

    <!-- IT资产概览 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :span="10">
        <div class="card">
          <div class="section-title">服务器类型分布</div>
          <div class="server-type-list">
            <div v-for="item in serverTypeDistribution" :key="item.type" class="server-type-item">
              <el-tag v-bind="getServerTypeTagAttrs(item.type)" size="small">{{ item.type }}</el-tag>
              <span class="type-count">{{ item.count }} 台</span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="14">
        <div class="card">
          <div class="section-title">即将到期服务器（≤90天）</div>
          <el-table :data="expiringServers" border stripe size="small">
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column prop="serverType" label="类型" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-bind="getServerTypeTagAttrs(row.serverType)" size="small">{{ row.serverType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="expireDate" label="到期日期" width="120" align="center" />
            <el-table-column label="剩余天数" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getServerExpireTagType(row.expireDate)" size="small">
                  {{ getExpireDays(row.expireDate) }} 天
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="expiringServers.length === 0" description="暂无即将到期服务器" :image-size="60" />
        </div>
      </el-col>
    </el-row>

    <!-- 合同到期提醒 -->
    <div class="card alert-card">
      <div class="section-title">合同到期提醒</div>
      <el-table :data="contractAlerts" border stripe size="small">
        <el-table-column prop="title" label="合同标题" min-width="180" />
        <el-table-column prop="supplierName" label="客户" width="180" />
        <el-table-column prop="expireDate" label="到期日期" width="120" />
        <el-table-column label="剩余天数" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.days <= 7 ? 'danger' : 'warning'" size="small">
              {{ row.days > 0 ? row.days + ' 天' : '已过期' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="contractAlerts.length === 0" description="暂无即将到期合同" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Money, Document, Files, Bell,
  Monitor, Link, Cellphone, WarningFilled,
} from '@element-plus/icons-vue'
import {
  useBudgetData, getFiscalYearMonths, getMonthLabel,
  isFeeActiveInMonth, budgetCarriers,
} from '~/composables/useBudgetData'
import { useInvoiceData } from '~/composables/useInvoiceData'
import { useAccrualData } from '~/composables/useAccrualData'
import { useContractData, getContractStatus, getDaysLeft } from '~/composables/useContractData'
import {
  useServerData, getServerTypeTagAttrs, getExpireDays,
} from '~/composables/useServerData'
import { useDomainData } from '~/composables/useDomainData'
import { useMiniappData } from '~/composables/useMiniappData'

// ====== 数据源 ======
const { budgetDetails, getSummaryMatrix, fetchDetails: fetchBudgets } = useBudgetData()
const { batchList, fetchBatches } = useInvoiceData()
const { accrualList, fetchAccruals } = useAccrualData()
const { contractList, fetchContracts } = useContractData()
const { serverList, expiringSoonCount, fetchServers } = useServerData()
const { domainList, fetchDomains } = useDomainData()
const { miniappList, fetchMiniapps } = useMiniappData()

onMounted(() => {
  fetchBudgets()
  fetchBatches()
  fetchAccruals()
  fetchContracts()
  fetchServers()
  fetchDomains()
  fetchMiniapps()
})

// ====== 当前时间 ======
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const currentFiscalYear = currentMonth >= 4 ? currentYear : currentYear - 1
const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

// ====== 业务指标卡片 ======
const currentMonthBudget = computed(() => {
  const matrix = getSummaryMatrix(currentFiscalYear)
  return matrix.rows.reduce((sum, row) => sum + (Number(row[currentMonthStr]) || 0), 0)
})

const totalAccrualAmount = computed(() =>
  accrualList.value.reduce((sum, a) => sum + a.totalAmount, 0)
)

const expiringContractCount = computed(() =>
  contractList.value.filter(c => getContractStatus(c.expireDate) === 'expiring').length
)

const businessStats = computed(() => [
  { label: '当月预算', value: '¥ ' + currentMonthBudget.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: Money, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
  { label: '发票批次', value: batchList.value.length + ' 个', icon: Document, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
  { label: '计提金额', value: '¥ ' + totalAccrualAmount.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: Files, color: 'var(--color-info)', bg: 'var(--color-info-light)' },
  { label: '合同即将到期', value: expiringContractCount.value + ' 项', icon: Bell, color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
])

// ====== IT资产指标卡片 ======
const itStats = computed(() => [
  { label: '服务器总数', value: serverList.value.length + ' 台', icon: Monitor, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
  { label: '域名总数', value: domainList.value.length + ' 个', icon: Link, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
  { label: '小程序总数', value: miniappList.value.length + ' 个', icon: Cellphone, color: 'var(--color-info)', bg: 'var(--color-info-light)' },
  { label: '即将到期服务器', value: expiringSoonCount.value + ' 台', icon: WarningFilled, color: 'var(--color-danger)', bg: 'var(--color-danger-light)' },
])

// ECharts 配色（JS 库不支持 CSS 变量，值与 tokens.css 一致）
// #E6A23C = --color-primary, #67C23A = --color-success, #409EFF = --type-operator
// #F56C6C = --color-danger, #909399 = --color-info
const colors = ['#E6A23C', '#67C23A', '#409EFF', '#F56C6C', '#909399']

// ====== 图表数据（从 composable 派生）======

// 当前财年的月份列表
const fiscalMonths = computed(() => getFiscalYearMonths(currentFiscalYear))

// 1. 月度预算趋势（按运营商分组）
// 修复：carrier 使用 budgetCarriers（'电信'/'移动'/'联通'/'其他'），与数据库一致
// 修复：feeRange 解析复用 isFeeActiveInMonth，兼容中文格式（如 '2026年1--12月'）
const trendOption = computed(() => {
  const months = fiscalMonths.value
  const monthLabels = months.map(m => getMonthLabel(m))
  const carriers = budgetCarriers // ['电信', '移动', '联通', '其他']
  const carrierColors = [colors[0], colors[1], colors[2], colors[4]]

  const series = carriers.map((carrier, idx) => {
    const data = months.map(m => {
      const total = budgetDetails.value
        .filter(d => d.fiscalYear === currentFiscalYear && d.carrier === carrier)
        .reduce((sum, d) => isFeeActiveInMonth(d.feeRange, m) ? sum + d.monthlyFee : sum, 0)
      return Math.round(total * 100) / 100
    })
    return {
      name: carrier,
      type: 'line',
      smooth: true,
      data,
      itemStyle: { color: carrierColors[idx] },
      areaStyle: { opacity: 0.1 },
    }
  })

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: carriers, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: monthLabels },
    yAxis: { type: 'value', name: '元' },
    series,
  }
})

// 2. 各门店年度预算（水平柱状图，显示全部门店）
// 修复：饼图改为水平柱状图，去掉5%合并逻辑，所有门店一览无余
const storeBudgetOption = computed(() => {
  const matrix = getSummaryMatrix(currentFiscalYear)
  const storeData = matrix.rows
    .map(row => ({
      value: Math.round(Number(row.subtotal || 0) * 100) / 100,
      name: row.storeName as string,
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => a.value - b.value) // 升序，最大在顶部

  const categories = storeData.map(d => d.name)
  const data = storeData.map((d, idx) => ({
    value: d.value,
    itemStyle: { color: colors[idx % colors.length] },
  }))

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: ¥{c}' },
    grid: { left: '3%', right: '10%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', name: '元/年' },
    yAxis: { type: 'category', data: categories },
    series: [{
      type: 'bar',
      barWidth: '60%',
      data,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: '¥{c}' },
    }],
  }
})

// 3. 发票批次状态分布（饼图，从 batchList 派生）
// 新增：发票→计提流水线可视化，展示批次在各处理阶段的分布
const batchStatusOption = computed(() => {
  const statusLabels: Record<string, string> = {
    pending: '待计提',
    accrued: '已计提',
    printed: '已打印',
  }
  const statusColors: Record<string, string> = {
    pending: colors[3]!,   // #F56C6C 红 — 需处理
    accrued: colors[0]!,   // #E6A23C 橙 — 进行中
    printed: colors[1]!,   // #67C23A 绿 — 已完成
  }

  const statusMap = new Map<string, number>()
  batchList.value.forEach(b => {
    statusMap.set(b.status, (statusMap.get(b.status) || 0) + 1)
  })

  const data = Array.from(statusMap.entries()).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
    itemStyle: { color: statusColors[status] || colors[4] },
  }))

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#FFFFFF', borderWidth: 2 }, // #FFFFFF = --color-white
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data,
    }],
  }
})

// 4. 运营商预算排名（条形图）
const carrierRankOption = computed(() => {
  const carrierMap = new Map<string, number>()
  budgetDetails.value
    .filter(d => d.fiscalYear === currentFiscalYear)
    .forEach(d => {
      const current = carrierMap.get(d.carrier) || 0
      carrierMap.set(d.carrier, current + d.annualFee)
    })

  const sorted = Array.from(carrierMap.entries()).sort((a, b) => a[1] - b[1])
  const categories = sorted.map(([name]) => name)
  const data = sorted.map(([name, value]) => ({
    value: Math.round(value * 100) / 100,
    itemStyle: { color: colors[0] },
  }))

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '8%', containLabel: true },
    xAxis: { type: 'value', name: '元/年' },
    yAxis: { type: 'category', data: categories },
    series: [{
      type: 'bar',
      barWidth: '50%',
      data,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: '¥{c}' },
    }],
  }
})

// ====== IT资产概览 ======

// 服务器类型分布
const serverTypeDistribution = computed(() => {
  const map = new Map<string, number>()
  serverList.value.forEach(s => {
    map.set(s.serverType, (map.get(s.serverType) || 0) + 1)
  })
  return Array.from(map.entries()).map(([type, count]) => ({ type, count }))
})

// 即将到期服务器（≤90天）
const expiringServers = computed(() =>
  serverList.value
    .filter(s => {
      const days = getExpireDays(s.expireDate)
      return days !== null && days >= 0 && days <= 90
    })
    .sort((a, b) => (getExpireDays(a.expireDate) || 0) - (getExpireDays(b.expireDate) || 0))
)

function getServerExpireTagType(date: string): 'info' | 'danger' | 'warning' {
  const days = getExpireDays(date)
  if (days === null) return 'info'
  if (days <= 30) return 'danger'
  return 'warning'
}

// ====== 合同到期提醒（从真实数据派生）======
const contractAlerts = computed(() => {
  return contractList.value
    .map(c => ({
      title: c.title,
      supplierName: c.supplierName,
      expireDate: c.expireDate,
      days: getDaysLeft(c.expireDate),
      status: getContractStatus(c.expireDate),
    }))
    .filter(c => c.status === 'expiring' || c.status === 'expired')
    .sort((a, b) => a.days - b.days)
})
</script>

<style scoped>
.server-type-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.server-type-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-page);
  border-radius: var(--radius-input);
}

.type-count {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--text-primary);
}
</style>
