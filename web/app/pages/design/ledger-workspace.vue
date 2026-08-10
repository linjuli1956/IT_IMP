<!--
  IT 资产台账工作台静态设计稿（阶段 0 交付物）。
  设计依据：docs/IT资产页面分型与交互规范.md §6.2–6.5 / §7
  范式：不请求 API / 假数据 / 筛选真实生效 / 角色可切换 / 自然响应式不用视口模拟器。
  覆盖：网络设备 / 电脑 / 固话 / 电子秤（强化表格 + 点击行→AssetDetailDrawer）+ 电子秤校准工作台。
  冻结边界：不改 it/*.vue 正式页面、不改数据库/API。
-->
<template>
  <div class="ledger-workspace">
    <PageHeader title="IT 资产台账工作台" subtitle="台账型资产强化表格（设计稿）">
      <template #actions>
        <el-radio-group v-model="currentRole" size="small" class="role-switcher">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="viewer">查看者</el-radio-button>
        </el-radio-group>
      </template>
    </PageHeader>

    <div class="quick-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>点击行打开详情抽屉 · hover 名称快速预览 · 编辑/删除在操作列，不误开抽屉 · 表格仅字段级着色</span>
    </div>

    <el-tabs v-model="activeModule" class="ledger-tabs">
      <!-- ============ 网络设备 ============ -->
      <el-tab-pane label="网络设备" name="device">
        <div class="card filter-bar">
          <el-input v-model="deviceKeyword" placeholder="搜索品牌/型号/IP/位置" clearable style="width: 260px" :prefix-icon="Search" />
          <el-select v-model="deviceStatus" placeholder="状态" clearable style="width: 110px">
            <el-option v-for="s in assetStatuses" :key="s" :label="s" :value="s" />
          </el-select>
          <span class="filter-count">{{ filteredDevices.length }} 条结果</span>
        </div>
        <div class="card">
          <AssetTable
            :columns="deviceColumns" :data="filteredDevices" :total="filteredDevices.length"
            :loading="false" :page="1" :page-size="100" :can-edit="canEdit" row-clickable
            @row-click="(row: any) => openDrawer('device', row)" @edit="onMockEdit" @delete="onMockDelete"
          >
            <template #name="{ row }">
              <RecordPreviewTooltip :title="formatDeviceName(row)" :rows="buildDevicePreviewRows(row as any)">
                <template #reference>
                  <span class="asset-name" tabindex="0" :aria-label="`预览 ${formatDeviceName(row)}`">{{ formatDeviceName(row) }}</span>
                </template>
              </RecordPreviewTooltip>
            </template>
            <template #deviceType="{ row }">
              <el-tag :type="deviceTypeTagType(row.deviceType)" size="small">{{ row.deviceType }}</el-tag>
            </template>
            <template #managementIp="{ row }">
              <span class="mono">{{ row.managementIp || '—' }}</span>
            </template>
            <template #portCount="{ row }">
              <el-tag v-if="row.portCount != null" type="info" size="small" effect="plain">{{ row.portCount }}口</el-tag>
              <span v-else>—</span>
            </template>
          </AssetTable>
        </div>
      </el-tab-pane>

      <!-- ============ 电脑 ============ -->
      <el-tab-pane label="电脑" name="computer">
        <div class="card filter-bar">
          <el-input v-model="computerKeyword" placeholder="搜索品牌/型号/使用人/资产编号/IP" clearable style="width: 300px" :prefix-icon="Search" />
          <el-select v-model="computerStatus" placeholder="状态" clearable style="width: 110px">
            <el-option v-for="s in assetStatuses" :key="s" :label="s" :value="s" />
          </el-select>
          <span class="filter-count">{{ filteredComputers.length }} 条结果</span>
        </div>
        <div class="card">
          <AssetTable
            :columns="computerColumns" :data="filteredComputers" :total="filteredComputers.length"
            :loading="false" :page="1" :page-size="100" :can-edit="canEdit" row-clickable
            @row-click="(row: any) => openDrawer('computer', row)" @edit="onMockEdit" @delete="onMockDelete"
          >
            <template #name="{ row }">
              <RecordPreviewTooltip :title="formatComputerName(row)" :rows="buildComputerPreviewRows(row as any)">
                <template #reference>
                  <span class="asset-name" tabindex="0" :aria-label="`预览 ${formatComputerName(row)}`">{{ formatComputerName(row) }}</span>
                </template>
              </RecordPreviewTooltip>
            </template>
            <template #ipAddress="{ row }">
              <span class="mono">{{ row.ipAddress || '—' }}</span>
            </template>
            <template #warrantyEndDate="{ row }">
              <div class="expire-cell">
                <span>{{ row.warrantyEndDate || '—' }}</span>
                <el-tag v-if="row.warrantyEndDate" :type="getExpireInfo(row.warrantyEndDate).tagType" size="small">
                  {{ getExpireInfo(row.warrantyEndDate).label.includes('今天') ? '今天到期' : (getExpireInfo(row.warrantyEndDate).days! < 0 ? `已过期${Math.abs(getExpireInfo(row.warrantyEndDate).days!)}天` : `${getExpireInfo(row.warrantyEndDate).days}天`) }}
                </el-tag>
              </div>
            </template>
          </AssetTable>
        </div>
      </el-tab-pane>

      <!-- ============ 固话 ============ -->
      <el-tab-pane label="固话" name="phone">
        <div class="card filter-bar">
          <el-input v-model="phoneKeyword" placeholder="搜索号码/使用人/部门" clearable style="width: 260px" :prefix-icon="Search" />
          <el-select v-model="phoneCarrier" placeholder="运营商" clearable style="width: 110px">
            <el-option v-for="c in carriers" :key="c" :label="c" :value="c" />
          </el-select>
          <span class="filter-count">{{ filteredPhones.length }} 条结果</span>
        </div>
        <div class="card">
          <AssetTable
            :columns="phoneColumns" :data="filteredPhones" :total="filteredPhones.length"
            :loading="false" :page="1" :page-size="100" :can-edit="canEdit" row-clickable
            @row-click="(row: any) => openDrawer('phone', row)" @edit="onMockEdit" @delete="onMockDelete"
          >
            <template #phoneNumber="{ row }">
              <RecordPreviewTooltip :title="row.phoneNumber" :rows="buildPhonePreviewRows(row as any)">
                <template #reference>
                  <span class="phone-number" tabindex="0" :aria-label="`预览固话 ${row.phoneNumber}`">{{ row.phoneNumber }}</span>
                </template>
              </RecordPreviewTooltip>
            </template>
            <template #carrier="{ row }">
              <el-tag :type="carrierTagType(row.carrier)" size="small">{{ row.carrier || '—' }}</el-tag>
            </template>
            <template #extension="{ row }">
              <span class="ext">{{ row.extension || '—' }}</span>
            </template>
          </AssetTable>
        </div>
      </el-tab-pane>

      <!-- ============ 电子秤（含校准工作台） ============ -->
      <el-tab-pane label="电子秤" name="scale">
        <CalibrationWorkbench :scales="mockScales" :active="calibFilter" @select="onCalibSelect" />
        <div class="card filter-bar" style="margin-top: 16px">
          <el-input v-model="scaleKeyword" placeholder="搜索品牌/型号/资产编号/位置" clearable style="width: 300px" :prefix-icon="Search" />
          <el-select v-model="scaleStatus" placeholder="状态" clearable style="width: 110px">
            <el-option v-for="s in assetStatuses" :key="s" :label="s" :value="s" />
          </el-select>
          <el-button v-if="calibFilter" text @click="calibFilter = null">清除校准筛选</el-button>
          <span class="filter-count">{{ filteredScales.length }} 条结果</span>
        </div>
        <div class="card">
          <AssetTable
            :columns="scaleColumns" :data="filteredScales" :total="filteredScales.length"
            :loading="false" :page="1" :page-size="100" :can-edit="canEdit" row-clickable
            @row-click="(row: any) => openDrawer('scale', row)" @edit="onMockEdit" @delete="onMockDelete"
          >
            <template #name="{ row }">
              <RecordPreviewTooltip :title="formatScaleName(row)" :rows="buildScalePreviewRows(row as any)">
                <template #reference>
                  <span class="asset-name" tabindex="0" :aria-label="`预览电子秤 ${formatScaleName(row)}`">{{ formatScaleName(row) }}</span>
                </template>
              </RecordPreviewTooltip>
            </template>
            <template #nextCalibrationDate="{ row }">
              <el-tag :type="calibTagType(row)" size="small">{{ getCalibrationInfo(row.nextCalibrationDate, row.status).label }}</el-tag>
            </template>
          </AssetTable>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 统一详情抽屉 ============ -->
    <AssetDetailDrawer v-model="drawerVisible" :title="drawerTitle" :can-edit="canEdit">
      <template #header>
        <span class="drawer-id">{{ drawerHeaderLabel }}</span>
        <el-tag :type="getAssetStatusTagType(currentRow?.status || '')" size="small">{{ currentRow?.status }}</el-tag>
      </template>
      <el-descriptions v-if="currentRow" :column="2" border size="small">
        <el-descriptions-item v-for="f in drawerItems" :key="f.label" :label="f.label" :span="f.span || 1">
          {{ f.value }}
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
import { InfoFilled, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { buildDevicePreviewRows, buildComputerPreviewRows, buildPhonePreviewRows, buildScalePreviewRows } from '~/utils/preview-utils'
import { getCalibrationInfo, getExpireInfo, getAssetStatusTagType } from '~/utils/asset-utils'
import type { AssetColumn } from '~/components/asset/AssetTable.vue'

// —— 角色切换 ——
const currentRole = ref<'admin' | 'viewer'>('admin')
const canEdit = computed(() => currentRole.value === 'admin')
const assetStatuses = ['正常', '停用', '报废']
const carriers = ['电信', '移动', '联通', '其他']

// —— Mock 数据（覆盖正常/预警/逾期/停用/报废各态）——
const mockDevices: any[] = [
  { id: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: '华为', model: 'S5735', serialNo: 'SN2024HW001', managementIp: '192.168.1.2', macAddress: 'A4-B1-C2-D3-E4-F5', portCount: 24, uplinkPort: 'Gig1/0/1', firmwareVersion: 'V200R019', installLocation: '一楼弱电井', status: '正常', remark: '核心交换' },
  { id: 2, storeName: '泰兴店', deviceType: '路由器', manageType: '网管型', brand: 'H3C', model: 'MSR3600', serialNo: 'SN2024H3C002', managementIp: '192.168.1.1', macAddress: 'B5-C2-D3-E4-F5-A6', portCount: 4, uplinkPort: 'G0/0/1', firmwareVersion: 'V7', installLocation: '收银区', status: '停用', remark: '' },
  { id: 3, storeName: '泰兴店', deviceType: 'AP', manageType: '非网管', brand: '锐捷', model: 'AP720', serialNo: 'SN2024RG003', managementIp: null, macAddress: 'C6-D3-E4-F5-A6-B7', portCount: 1, uplinkPort: null, firmwareVersion: null, installLocation: '卖场', status: '正常', remark: '' },
  { id: 4, storeName: '黄桥店', deviceType: '交换机', manageType: '网管型', brand: 'Cisco', model: 'C9300', serialNo: 'SN2024CS004', managementIp: '10.0.0.2', macAddress: 'D7-E4-F5-A6-B7-C8', portCount: 48, uplinkPort: 'Te1/0/1', firmwareVersion: '17.6', installLocation: '机房', status: '正常', remark: '上联核心' },
  { id: 5, storeName: '总部', deviceType: '防火墙', manageType: '网管型', brand: '深信服', model: 'AF-1000', serialNo: 'SN2024SF005', managementIp: '192.168.1.254', macAddress: 'E8-F5-A6-B7-C8-D9', portCount: 8, uplinkPort: 'GE0', firmwareVersion: 'V8.0', installLocation: '机房入口', status: '正常', remark: '' },
  { id: 6, storeName: '黄桥店', deviceType: 'AP', manageType: '非网管', brand: 'TP-Link', model: 'TL-AP', serialNo: 'SN2023TP006', managementIp: null, macAddress: null, portCount: 1, uplinkPort: null, firmwareVersion: null, installLocation: '仓库', status: '报废', remark: '已替换' },
]
const mockComputers: any[] = [
  { id: 1, storeName: '总部', assetNo: 'PC-2024-001', department: '信息部', brand: '联想', model: 'M920t', serialNo: 'LN001', user: '张三', cpuModel: 'i5-10500', cpuCores: 6, memoryGB: 16, diskSizeGB: 512, diskType: 'SSD', ipAddress: '192.168.1.101', macAddress: 'AA-BB-CC-00-01', os: 'Windows 11', osVersion: '23H2', purchaseDate: '2024-03-01', warrantyEndDate: '2026-08-20', status: '正常', remark: '' },
  { id: 2, storeName: '泰兴店', assetNo: 'PC-2023-018', department: '收银组', brand: '戴尔', model: 'OptiPlex 7090', serialNo: 'DL018', user: '李四', cpuModel: 'i3-10100', cpuCores: 4, memoryGB: 8, diskSizeGB: 256, diskType: 'SSD', ipAddress: '192.168.2.18', macAddress: 'AA-BB-CC-00-02', os: 'Windows 10', osVersion: '22H2', purchaseDate: '2023-06-01', warrantyEndDate: '2026-05-01', status: '正常', remark: '收银机' },
  { id: 3, storeName: '黄桥店', assetNo: 'PC-2022-030', department: '财务', brand: 'HP', model: 'ProDesk 400', serialNo: 'HP030', user: '王五', cpuModel: 'i5-10400', cpuCores: 6, memoryGB: 16, diskSizeGB: 1000, diskType: 'HDD', ipAddress: '192.168.3.30', macAddress: 'AA-BB-CC-00-03', os: 'Windows 10', osVersion: '21H2', purchaseDate: '2022-09-01', warrantyEndDate: '2026-10-01', status: '正常', remark: '' },
  { id: 4, storeName: '总部', assetNo: 'PC-2021-055', department: '行政', brand: '联想', model: 'M70q', serialNo: 'LN055', user: '赵六', cpuModel: 'i3-10100', cpuCores: 4, memoryGB: 8, diskSizeGB: 256, diskType: 'SSD', ipAddress: '192.168.1.155', macAddress: 'AA-BB-CC-00-04', os: 'Windows 10', osVersion: '22H2', purchaseDate: '2021-12-01', warrantyEndDate: '2025-12-01', status: '正常', remark: '已过保' },
  { id: 5, storeName: '泰兴店', assetNo: 'PC-2020-088', department: '仓管', brand: '组装', model: 'i5-9400', serialNo: null, user: '孙七', cpuModel: 'i5-9400', cpuCores: 6, memoryGB: 8, diskSizeGB: 500, diskType: 'HDD', ipAddress: null, macAddress: null, os: 'Windows 7', osVersion: null, purchaseDate: '2020-05-01', warrantyEndDate: '2022-05-01', status: '停用', remark: '老旧待报废' },
]
const mockPhones: any[] = [
  { id: 1, storeName: '总部', department: '前台', phoneNumber: '0523-87654321', extension: '8001', carrier: '电信', monthlyFee: 58, packageInfo: '商务套餐', user: '前台', installLocation: '前台', status: '正常', remark: '' },
  { id: 2, storeName: '泰兴店', department: '信息部', phoneNumber: '0523-87659876', extension: '8012', carrier: '电信', monthlyFee: 35, packageInfo: '基础包', user: '信息部', installLocation: '办公区', status: '正常', remark: '' },
  { id: 3, storeName: '黄桥店', department: '客服', phoneNumber: '0523-87771234', extension: null, carrier: '联通', monthlyFee: 29, packageInfo: null, user: '客服主管', installLocation: '客服中心', status: '正常', remark: '' },
  { id: 4, storeName: '泰兴店', department: '库房', phoneNumber: '0523-87651111', extension: '8045', carrier: '移动', monthlyFee: 19, packageInfo: '短号', user: '库管', installLocation: '库房', status: '停用', remark: '闲置' },
  { id: 5, storeName: '总部', department: '财务', phoneNumber: '0523-87652222', extension: '8008', carrier: '电信', monthlyFee: 88, packageInfo: '企业专线', user: '财务主管', installLocation: '财务室', status: '正常', remark: '' },
]
const mockScales: any[] = [
  { id: 1, storeName: '泰兴店', assetNo: 'SC-2024-001', brand: '寺冈', model: 'SM-300', serialNo: 'TG001', capacityKg: 30, precisionG: 5, interface: '串口', lastCalibrationDate: '2026-02-10', nextCalibrationDate: '2026-08-05', calibrationCycleDays: 180, installLocation: '收银台1', status: '正常', remark: '' },
  { id: 2, storeName: '泰兴店', assetNo: 'SC-2024-002', brand: '顶尖', model: 'DS-252', serialNo: 'DJ002', capacityKg: 15, precisionG: 2, interface: 'USB', lastCalibrationDate: '2026-05-01', nextCalibrationDate: '2026-08-25', calibrationCycleDays: 90, installLocation: '生鲜区', status: '正常', remark: '' },
  { id: 3, storeName: '黄桥店', assetNo: 'SC-2023-010', brand: '大华', model: 'TCS-100', serialNo: 'DH010', capacityKg: 100, precisionG: 10, interface: '网口', lastCalibrationDate: '2025-09-01', nextCalibrationDate: '2026-11-01', calibrationCycleDays: 365, installLocation: '散称区', status: '正常', remark: '' },
  { id: 4, storeName: '总部', assetNo: 'SC-2024-008', brand: '寺冈', model: 'SM-300', serialNo: 'TG008', capacityKg: 30, precisionG: 5, interface: '串口', lastCalibrationDate: '2025-12-01', nextCalibrationDate: '2026-09-01', calibrationCycleDays: 180, installLocation: '收货部', status: '正常', remark: '' },
  { id: 5, storeName: '黄桥店', assetNo: 'SC-2020-020', brand: '顶尖', model: 'DS-252', serialNo: 'DJ020', capacityKg: 15, precisionG: 2, interface: 'USB', lastCalibrationDate: '2024-01-01', nextCalibrationDate: '2025-01-01', calibrationCycleDays: 365, installLocation: '仓库', status: '停用', remark: '待报废' },
  { id: 6, storeName: '总部', assetNo: 'SC-2025-012', brand: '大华', model: 'TCS-100', serialNo: 'DH012', capacityKg: 60, precisionG: 5, interface: '网口', lastCalibrationDate: '2026-08-01', nextCalibrationDate: '2027-02-01', calibrationCycleDays: 180, installLocation: '生鲜区', status: '正常', remark: '' },
]

// —— 搜索/筛选 ——
const deviceKeyword = ref(''); const deviceStatus = ref('')
const filteredDevices = computed(() => mockDevices.filter((d) => {
  const kw = deviceKeyword.value.toLowerCase()
  const hit = !kw || [d.brand, d.model, d.managementIp, d.installLocation].filter(Boolean).join(' ').toLowerCase().includes(kw)
  const stat = !deviceStatus.value || d.status === deviceStatus.value
  return hit && stat
}))
const computerKeyword = ref(''); const computerStatus = ref('')
const filteredComputers = computed(() => mockComputers.filter((c) => {
  const kw = computerKeyword.value.toLowerCase()
  const hit = !kw || [c.brand, c.model, c.user, c.assetNo, c.ipAddress].filter(Boolean).join(' ').toLowerCase().includes(kw)
  const stat = !computerStatus.value || c.status === computerStatus.value
  return hit && stat
}))
const phoneKeyword = ref(''); const phoneCarrier = ref('')
const filteredPhones = computed(() => mockPhones.filter((p) => {
  const kw = phoneKeyword.value.toLowerCase()
  const hit = !kw || [p.phoneNumber, p.user, p.department].filter(Boolean).join(' ').toLowerCase().includes(kw)
  const car = !phoneCarrier.value || p.carrier === phoneCarrier.value
  return hit && car
}))
const scaleKeyword = ref(''); const scaleStatus = ref('')
const calibFilter = ref<'overdue' | 'soon' | 'approaching' | 'normal' | null>(null)
function onCalibSelect(s: 'overdue' | 'soon' | 'approaching' | 'normal') {
  calibFilter.value = calibFilter.value === s ? null : s
}
const filteredScales = computed(() => mockScales.filter((s) => {
  const kw = scaleKeyword.value.toLowerCase()
  const hit = !kw || [s.brand, s.model, s.assetNo, s.installLocation].filter(Boolean).join(' ').toLowerCase().includes(kw)
  const stat = !scaleStatus.value || s.status === scaleStatus.value
  const calib = !calibFilter.value || (() => {
    const c = getCalibrationInfo(s.nextCalibrationDate, s.status)
    if (calibFilter.value === 'overdue') return c.overdue
    if (calibFilter.value === 'soon') return !c.overdue && c.days !== null && c.days <= 30
    if (calibFilter.value === 'approaching') return !c.overdue && c.days !== null && c.days > 30 && c.days <= 90
    return !c.overdue && c.days !== null && c.days > 90
  })()
  return hit && stat && calib
}))

// —— 列配置 ——
const deviceColumns: AssetColumn<any>[] = [
  { virtual: true, key: 'name', label: '名称', minWidth: 160, slot: 'name' },
  { key: 'deviceType', label: '类型', width: 90, align: 'center', slot: 'deviceType' },
  { key: 'storeName', label: '门店', width: 110 },
  { key: 'brand', label: '品牌', width: 90 },
  { key: 'model', label: '型号', width: 110 },
  { key: 'managementIp', label: '管理IP', width: 130, slot: 'managementIp' },
  { key: 'portCount', label: '端口数', width: 80, align: 'center', slot: 'portCount' },
  { key: 'installLocation', label: '位置', minWidth: 110 },
  { key: 'status', label: '状态', width: 80, align: 'center', type: 'status' },
]
const computerColumns: AssetColumn<any>[] = [
  { virtual: true, key: 'name', label: '名称', minWidth: 160, slot: 'name' },
  { key: 'storeName', label: '门店', width: 100 },
  { key: 'user', label: '使用人', width: 80 },
  { key: 'department', label: '部门', width: 90 },
  { key: 'assetNo', label: '资产编号', width: 120 },
  { key: 'ipAddress', label: 'IP', width: 120, slot: 'ipAddress' },
  { key: 'os', label: '系统', width: 110 },
  { key: 'warrantyEndDate', label: '保修到期', width: 150, align: 'center', slot: 'warrantyEndDate' },
  { key: 'status', label: '状态', width: 80, align: 'center', type: 'status' },
]
const phoneColumns: AssetColumn<any>[] = [
  { virtual: true, key: 'phoneNumber', label: '固话号码', minWidth: 150, slot: 'phoneNumber' },
  { key: 'storeName', label: '门店', width: 100 },
  { key: 'department', label: '部门', width: 100 },
  { key: 'carrier', label: '运营商', width: 90, align: 'center', slot: 'carrier' },
  { key: 'user', label: '使用人', width: 90 },
  { key: 'extension', label: '分机号', width: 90, align: 'center', slot: 'extension' },
  { key: 'installLocation', label: '位置', minWidth: 110 },
  { key: 'status', label: '状态', width: 80, align: 'center', type: 'status' },
]
const scaleColumns: AssetColumn<any>[] = [
  { virtual: true, key: 'name', label: '名称', minWidth: 160, slot: 'name' },
  { key: 'storeName', label: '门店', width: 100 },
  { key: 'assetNo', label: '资产编号', width: 120 },
  { key: 'capacityKg', label: '量程(kg)', width: 90, align: 'center' },
  { key: 'precisionG', label: '精度(g)', width: 90, align: 'center' },
  { key: 'interface', label: '接口', width: 80, align: 'center' },
  { virtual: true, key: 'nextCalibrationDate', label: '下次校准', width: 130, align: 'center', slot: 'nextCalibrationDate' },
  { key: 'installLocation', label: '位置', minWidth: 110 },
  { key: 'status', label: '状态', width: 80, align: 'center', type: 'status' },
]

// —— 名称格式化 ——
function formatDeviceName(row: any) { return [row.brand, row.model].filter(Boolean).join(' ') || `未命名${row.deviceType}` }
function formatComputerName(row: any) { return [row.brand, row.model].filter(Boolean).join(' ') || row.assetNo || `电脑#${row.id}` }
function formatScaleName(row: any) { return [row.brand, row.model].filter(Boolean).join(' ') || row.assetNo || `电子秤#${row.id}` }

// —— 类型/运营商语义色 ——
function deviceTypeTagType(t: string): 'primary' | 'success' | 'warning' | 'info' {
  if (t === '交换机') return 'primary'
  if (t === '路由器') return 'warning'
  if (t === 'AP') return 'success'
  return 'info'
}
function carrierTagType(c: string | null): 'primary' | 'success' | 'warning' | 'info' {
  if (c === '电信') return 'primary'
  if (c === '移动') return 'success'
  if (c === '联通') return 'warning'
  return 'info'
}
function calibTagType(row: any): 'danger' | 'warning' | 'info' | 'success' {
  const c = getCalibrationInfo(row.nextCalibrationDate, row.status)
  if (c.tone === 'danger') return 'danger'
  if (c.tone === 'warning') return 'warning'
  if (c.tone === 'info') return 'info'
  return 'info'
}

// —— 抽屉 ——
const activeModule = ref<'device' | 'computer' | 'phone' | 'scale'>('device')
const drawerVisible = ref(false)
const currentRow = ref<any>(null)
const currentDrawerModule = ref<'device' | 'computer' | 'phone' | 'scale'>('device')
function openDrawer(module: 'device' | 'computer' | 'phone' | 'scale', row: any) {
  currentDrawerModule.value = module
  currentRow.value = row
  drawerVisible.value = true
}
const drawerTitle = computed(() => {
  const r = currentRow.value
  if (!r) return '详情'
  if (currentDrawerModule.value === 'device') return formatDeviceName(r)
  if (currentDrawerModule.value === 'computer') return formatComputerName(r)
  if (currentDrawerModule.value === 'phone') return r.phoneNumber
  return formatScaleName(r)
})
const drawerHeaderLabel = computed(() => {
  const r = currentRow.value
  if (!r) return ''
  const tag = { device: '网络设备', computer: '电脑', phone: '固话', scale: '电子秤' }[currentDrawerModule.value]
  return `${tag} · ${r.storeName || ''}`
})
const drawerItems = computed<{ label: string; value: string; span?: number }[]>(() => {
  const r = currentRow.value
  if (!r) return []
  if (currentDrawerModule.value === 'device') return [
    { label: '名称', value: formatDeviceName(r) }, { label: '门店', value: r.storeName || '—' },
    { label: '设备类型', value: r.deviceType }, { label: '管理类型', value: r.manageType || '—' },
    { label: '品牌', value: r.brand || '—' }, { label: '型号', value: r.model || '—' },
    { label: '序列号', value: r.serialNo || '—' }, { label: '管理IP', value: r.managementIp || '—' },
    { label: 'MAC地址', value: r.macAddress || '—' }, { label: '端口数', value: r.portCount != null ? `${r.portCount}口` : '—' },
    { label: '上联口', value: r.uplinkPort || '—' }, { label: '固件版本', value: r.firmwareVersion || '—' },
    { label: '安装位置', value: r.installLocation || '—' }, { label: '状态', value: r.status },
    { label: '备注', value: r.remark || '—', span: 2 },
  ]
  if (currentDrawerModule.value === 'computer') return [
    { label: '名称', value: formatComputerName(r) }, { label: '门店', value: r.storeName || '—' },
    { label: '资产编号', value: r.assetNo || '—' }, { label: '部门', value: r.department || '—' },
    { label: '使用人', value: r.user || '—' }, { label: 'IP地址', value: r.ipAddress || '—' },
    { label: 'MAC地址', value: r.macAddress || '—' }, { label: '操作系统', value: r.os || '—' },
    { label: '系统版本', value: r.osVersion || '—' }, { label: 'CPU型号', value: r.cpuModel || '—' },
    { label: 'CPU核数', value: r.cpuCores != null ? `${r.cpuCores}核` : '—' }, { label: '内存', value: r.memoryGB != null ? `${r.memoryGB}GB` : '—' },
    { label: '硬盘', value: [r.diskSizeGB != null ? `${r.diskSizeGB}GB` : null, r.diskType].filter(Boolean).join(' / ') || '—' }, { label: '序列号', value: r.serialNo || '—' },
    { label: '采购日期', value: r.purchaseDate || '—' }, { label: '保修到期', value: r.warrantyEndDate || '—' },
    { label: '状态', value: r.status }, { label: '备注', value: r.remark || '—', span: 2 },
  ]
  if (currentDrawerModule.value === 'phone') return [
    { label: '固话号码', value: r.phoneNumber }, { label: '门店', value: r.storeName || '—' },
    { label: '部门', value: r.department || '—' }, { label: '运营商', value: r.carrier || '—' },
    { label: '分机号', value: r.extension || '—' }, { label: '使用人', value: r.user || '—' },
    { label: '月租', value: r.monthlyFee != null ? `¥${r.monthlyFee}` : '—' }, { label: '套餐', value: r.packageInfo || '—' },
    { label: '安装位置', value: r.installLocation || '—' }, { label: '状态', value: r.status },
    { label: '备注', value: r.remark || '—', span: 2 },
  ]
  return [
    { label: '名称', value: formatScaleName(r) }, { label: '门店', value: r.storeName || '—' },
    { label: '资产编号', value: r.assetNo || '—' }, { label: '品牌', value: r.brand || '—' },
    { label: '型号', value: r.model || '—' }, { label: '序列号', value: r.serialNo || '—' },
    { label: '量程', value: r.capacityKg != null ? `${r.capacityKg}kg` : '—' }, { label: '精度', value: r.precisionG != null ? `${r.precisionG}g` : '—' },
    { label: '接口', value: r.interface || '—' }, { label: '校准周期', value: r.calibrationCycleDays != null ? `${r.calibrationCycleDays}天` : '—' },
    { label: '上次校准', value: r.lastCalibrationDate || '—' }, { label: '下次校准', value: r.nextCalibrationDate || '—' },
    { label: '安装位置', value: r.installLocation || '—' }, { label: '状态', value: r.status },
    { label: '备注', value: r.remark || '—', span: 2 },
  ]
})

function onMockEdit() { ElMessage.info('设计稿：编辑入口（阶段1接入正式表单）') }
function onMockDelete() { ElMessage.info('设计稿：删除入口（阶段1接入二次确认）') }
</script>

<style scoped>
.quick-tip { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: var(--font-size-small); margin-bottom: var(--spacing-card); }
.role-switcher { margin-right: 8px; }
.ledger-tabs :deep(.el-tabs__header) { margin-bottom: var(--spacing-card); }
.filter-bar { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
.filter-count { margin-left: auto; color: var(--text-secondary); font-size: var(--font-size-small); }
.asset-name { color: var(--color-primary); font-weight: 500; cursor: pointer; }
.phone-number { font-family: var(--font-family-mono); font-weight: 700; color: var(--color-primary); cursor: pointer; letter-spacing: 0.5px; }
.mono { font-family: var(--font-family-mono); color: var(--color-primary); }
.ext { font-family: var(--font-family-mono); color: var(--text-secondary); }
.expire-cell { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.drawer-id { font-weight: 600; color: var(--text-primary); margin-right: 8px; }
</style>
