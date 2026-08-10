<!--
  服务器管理工作台静态设计稿（阶段 0 交付物）。
  阶段 0 验收期：走正常登录鉴权，无额外访问限制。
  不请求 API；筛选条件真实生效；管理员/查看者可切换。
  页面自然响应式，不使用页面内视口模拟器。
-->
<template>
  <div class="server-workspace">
    <!-- 1. 页面标题 + 角色切换 -->
    <PageHeader title="服务器管理" subtitle="服务器管理工作台（设计稿）">
      <template #actions>
        <el-radio-group v-model="currentRole" size="small" class="role-switcher">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="viewer">查看者</el-radio-button>
        </el-radio-group>
        <el-button v-if="canEdit" type="primary" plain @click="onAddVirtual">
          <el-icon><Plus /></el-icon>新增虚拟机
        </el-button>
        <el-button v-if="canEdit" type="primary" @click="onAdd">
          <el-icon><Plus /></el-icon>新增服务器
        </el-button>
      </template>
    </PageHeader>

    <!-- 2. 一行提示（不占用纵向空间） -->
    <div class="quick-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>点击卡片打开详情抽屉 · hover 名称快速预览 · 物理机可展开查看虚拟机</span>
    </div>

    <!-- 3. 指标卡 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Monitor" :color="vars.primary" :bg="vars.primaryLight" :value="statTotal" label="服务器总数(正常)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="HomeFilled" :color="vars.info" :bg="vars.infoLight" :value="statPhysical" label="物理机(正常)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="Cloudy" :color="vars.success" :bg="vars.successLight" :value="statVirtual" label="虚拟机(正常)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="WarningFilled" :color="vars.danger" :bg="vars.dangerLight" :value="statExpiring" label="即将到期(30天)" />
      </el-col>
    </el-row>

    <!-- 4. Tab + 筛选栏 -->
    <div class="card filter-bar">
      <el-radio-group v-model="activeTab" class="tab-group">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="physical">物理机</el-radio-button>
        <el-radio-button value="virtual">虚拟机</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="viewMode" class="view-mode">
        <el-radio-button value="card">卡片总览</el-radio-button>
        <el-radio-button value="tree">树形列表</el-radio-button>
      </el-radio-group>
      <el-input v-model="filterKeyword" placeholder="搜索名称/IP/用途" clearable style="width: 200px" />
      <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 100px">
        <el-option v-for="s in ['正常','停用','报废']" :key="s" :label="s" :value="s" />
      </el-select>
      <el-select v-model="filterHypervisor" placeholder="虚拟化平台" clearable style="width: 120px">
        <el-option v-for="h in ['PVE','ESXi']" :key="h" :label="h" :value="h" />
      </el-select>
      <span class="filter-count">{{ filterResultCount }} 条结果</span>
    </div>

    <!-- 5. 卡片网格 -->
    <template v-if="viewMode === 'card'">
      <!-- 全部 Tab：按宿主分组的树 -->
      <div class="card" v-if="activeTab === 'all'">
        <div class="server-card-grid">
          <MockHostCard
            v-for="h in filteredHosts" :key="h.id"
            :server="h" :can-edit="canEdit"
            :is-selected="selectedServer?.id === h.id"
            @click="openDrawer" @edit="onEdit" @delete="onDelete"
          />
          <MockVmCard
            v-for="vm in filteredOrphanVms" :key="vm.id"
            :server="vm" :can-edit="canEdit"
            :is-selected="selectedServer?.id === vm.id"
            @click="openDrawer" @click-host="onVmHostClick" @edit="onEdit" @delete="onDelete"
          />
        </div>
        <el-empty v-if="filteredHosts.length === 0 && filteredOrphanVms.length === 0" description="暂无服务器" :image-size="80" />
      </div>

      <!-- 物理机 Tab -->
      <div class="card" v-else-if="activeTab === 'physical'">
        <div class="server-card-grid">
          <MockHostCard
            v-for="h in filteredPhysicals" :key="h.id"
            :server="h" :can-edit="canEdit"
            :is-selected="selectedServer?.id === h.id"
            @click="openDrawer" @edit="onEdit" @delete="onDelete"
          />
        </div>
        <el-empty v-if="filteredPhysicals.length === 0" description="暂无物理机" :image-size="80" />
      </div>

      <!-- 虚拟机 Tab -->
      <div class="card" v-else>
        <div class="server-card-grid">
          <MockVmCard
            v-for="vm in filteredVirtuals" :key="vm.id"
            :server="vm" :can-edit="canEdit"
            :is-selected="selectedServer?.id === vm.id"
            @click="openDrawer" @click-host="onVmHostClick" @edit="onEdit" @delete="onDelete"
          />
        </div>
        <el-empty v-if="filteredVirtuals.length === 0" description="暂无虚拟机" :image-size="80" />
      </div>
    </template>

    <!-- 树形列表模式 -->
    <div class="card" v-else>
      <el-table :data="filteredTreeData" row-key="id" :tree-props="{ children: 'children' }" default-expand-all border size="small" style="width: 100%">
        <!-- 名称：平台语义色 -->
        <el-table-column prop="name" label="名称" width="200">
          <template #default="{ row }">
            <span class="tree-name" :style="{ color: toneTextVar(row as MockServer) }" @click="openDrawer(row as MockServer)">{{ row.name }}</span>
          </template>
        </el-table-column>
        <!-- 身份 -->
        <el-table-column label="身份" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isVirtual ? 'warning' : 'primary'" size="small" effect="light">{{ row.isVirtual ? '虚拟机' : '物理机' }}</el-tag>
          </template>
        </el-table-column>
        <!-- 平台：PVE/ESXi Tag 或 serverType -->
        <el-table-column label="平台" width="100" align="center">
          <template #default="{ row }">
            <span v-if="platformOf(row)" class="platform-tag" :class="platformOf(row) === 'PVE' ? 'platform-tag--pve' : 'platform-tag--esxi'">{{ platformOf(row) }}</span>
            <el-tag v-else size="small" effect="plain">{{ row.serverType }}</el-tag>
          </template>
        </el-table-column>
        <!-- 内网IP：info 色图标 + 等宽数值 -->
        <el-table-column label="内网IP" width="140">
          <template #default="{ row }">
            <div v-if="row.internalIp" class="tree-ip tree-ip--internal">
              <el-icon><Monitor /></el-icon>
              <span class="ip-value">{{ row.internalIp }}</span>
            </div>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <!-- 外网IP：warning 色图标 + 等宽数值 -->
        <el-table-column label="外网IP" width="140">
          <template #default="{ row }">
            <div v-if="row.externalIp" class="tree-ip tree-ip--external">
              <el-icon><Connection /></el-icon>
              <span class="ip-value">{{ row.externalIp }}</span>
            </div>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <!-- 配置摘要：CPU 蓝 / 内存 紫 / 磁盘 青绿 -->
        <el-table-column label="配置摘要" min-width="220">
          <template #default="{ row }">
            <div class="tree-specs">
              <span class="tree-spec"><span class="spec-label spec-label--cpu">CPU</span><span class="spec-val">{{ specCpuOf(row as MockServer) }}</span></span>
              <span class="tree-spec"><span class="spec-label spec-label--memory">内存</span><span class="spec-val">{{ specMemOf(row as MockServer) }}</span></span>
              <span class="tree-spec"><span class="spec-label spec-label--disk">磁盘</span><span class="spec-val">{{ specDiskOf(row as MockServer) }}</span></span>
            </div>
          </template>
        </el-table-column>
        <!-- 宿主机 -->
        <el-table-column label="宿主机" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.hostServerName" class="mock-link" @click="onVmHostClick(row as MockServer)">{{ row.hostServerName }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <!-- 状态 -->
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- AssetDetailDrawer（右侧弹出抽屉） -->
    <AssetDetailDrawer v-model="drawerVisible" :title="selectedServer?.name" :can-edit="canEdit" @close="onDrawerClose">
      <template #header>
        <el-tag :type="selectedServer?.isVirtual ? 'warning' : 'primary'" size="small">{{ selectedServer?.isVirtual ? '虚拟机' : '物理机' }}</el-tag>
        <span v-if="selectedServer && platformOf(selectedServer)" class="platform-tag" :class="platformOf(selectedServer) === 'PVE' ? 'platform-tag--pve' : 'platform-tag--esxi'">{{ platformOf(selectedServer) }}</span>
        <el-tag v-if="selectedServer" :type="getStatusType(selectedServer.status)" size="small">{{ selectedServer.status }}</el-tag>
      </template>

      <!-- 基础信息 -->
      <el-descriptions v-if="selectedServer" :column="2" border size="small">
        <el-descriptions-item label="类型">{{ selectedServer.serverType }}</el-descriptions-item>
        <el-descriptions-item label="厂商">{{ selectedServer.manufacturer || '—' }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ selectedServer.model || '—' }}</el-descriptions-item>
        <el-descriptions-item label="序列号">{{ selectedServer.serialNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="内网IP">{{ selectedServer.internalIp || '—' }}</el-descriptions-item>
        <el-descriptions-item label="外网IP">{{ selectedServer.externalIp || '—' }}</el-descriptions-item>
        <el-descriptions-item label="操作系统">{{ selectedServer.os || '—' }}</el-descriptions-item>
        <el-descriptions-item label="用途">{{ selectedServer.purpose || '—' }}</el-descriptions-item>
        <el-descriptions-item label="到期日期">{{ selectedServer.expireDate || '—' }}</el-descriptions-item>
        <el-descriptions-item :label="selectedServer.isVirtual ? '宿主机管理地址' : '管理地址'">
          <el-link v-if="manageUrlOf(selectedServer)" type="primary" :href="manageUrlOf(selectedServer)!" target="_blank" rel="noopener">打开管理地址</el-link>
          <span v-else>—</span>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 物理机：紧凑 VM 行（禁止 6 列 el-table） -->
      <template v-if="selectedServer && !selectedServer.isVirtual">
        <div class="drawer-section-title">全部虚拟机（{{ vmListOf(selectedServer).length }} 台）</div>
        <div class="vm-compact-list">
          <div v-for="vm in visibleDrawerVms(selectedServer)" :key="vm.id" class="vm-compact-row" @click="openDrawer(vm)">
            <div class="vm-row-1">
              <span class="mock-link">{{ vm.name }}</span>
              <el-tag :type="getStatusType(vm.status)" size="small">{{ vm.status }}</el-tag>
            </div>
            <div class="vm-row-2">{{ vm.internalIp || '—' }} · {{ vm.purpose || '—' }}</div>
            <div class="vm-row-3">{{ vm.cpuCoresAllocated ?? '—' }}核 / {{ vm.memoryAllocatedGB ?? '—' }}GB / {{ vm.diskAllocatedGB ?? '—' }}GB</div>
          </div>
          <div v-if="vmListOf(selectedServer).length > 8" class="vm-compact-more" @click="openDrawer(selectedServer)">
            查看全部虚拟机（{{ vmListOf(selectedServer).length }} 台）
          </div>
        </div>
      </template>

      <!-- 虚拟机：宿主信息 -->
      <template v-else-if="selectedServer">
        <div class="drawer-section-title">所属宿主机</div>
        <div class="drawer-host-card" v-if="hostOf(selectedServer)">
          <span class="mock-link" @click="openDrawer(hostOf(selectedServer)!)">{{ hostOf(selectedServer)!.name }}</span>
          <span class="drawer-host-meta">{{ hostOf(selectedServer)!.internalIp }} · {{ platformOf(hostOf(selectedServer)!) || '—' }}</span>
        </div>
        <el-empty v-else description="未关联宿主机" :image-size="40" />
      </template>

      <!-- 底部操作区 -->
      <template #footer>
        <el-button size="small" @click="onDetail(selectedServer!)">详情页</el-button>
        <el-button v-if="canEdit" size="small" @click="onEdit(selectedServer!)">编辑</el-button>
        <el-button v-if="canEdit" size="small" @click="onPassword(selectedServer!)">密码管理</el-button>
        <a v-if="selectedServer && manageUrlOf(selectedServer)" :href="manageUrlOf(selectedServer)!" target="_blank" rel="noopener" class="btn-link">进入管理</a>
      </template>
    </AssetDetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { Plus, Monitor, Connection, HomeFilled, Cloudy, WarningFilled, InfoFilled } from '@element-plus/icons-vue'
import { platformOf, serverVisualTone } from '~/utils/server-visual-tone'
import { buildServerTree, type ServerTreeNode } from '~/utils/server-tree'
import type { ServerListItem } from '~/types/server'

// —— 设计验收期：走正常登录鉴权，无额外访问限制 ——
definePageMeta({})

// —— 角色切换 ——
const currentRole = ref<'admin' | 'viewer'>('admin')
const canEdit = computed(() => currentRole.value === 'admin')

// —— CSS 变量引用 ——
const vars = {
  primary: 'var(--color-primary)', primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)', successLight: 'var(--color-success-light)',
  info: 'var(--color-info)', infoLight: 'var(--color-info-light)',
  danger: 'var(--color-danger)', dangerLight: 'var(--color-danger-light)',
}

// —— Tab 与筛选 ——
const activeTab = ref<'all' | 'physical' | 'virtual'>('all')
const viewMode = ref<'card' | 'tree'>('card')
const filterKeyword = ref('')
const filterStatus = ref('')
const filterHypervisor = ref('')

// —— 假数据 ——
interface MockServer extends ServerListItem {
  children?: MockServer[]
}

const mockServers: MockServer[] = [
  {
    id: 1, name: '机房PVE宿主机-01', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.10', externalIp: '',
    port: '22', cpuModel: 'Intel Xeon E5-2620 v4', cpuCores: '16核', memorySize: '64GB', systemDiskSize: '480GB', dataDiskSize: '4TB', diskType: 'SSD+HDD',
    os: 'Proxmox VE 8.1', expireDate: null, purpose: '主虚拟化平台', account: 'root', dbAccount: '', dbPort: '',
    remark: '机房主力 PVE 宿主机', manageUrl: 'https://192.168.1.10:8006', status: '正常',
    manufacturer: '戴尔', model: 'PowerEdge R740', serialNo: 'DL740X2A001', raidType: 'RAID10', networkCards: '4×1G + 2×10G', warrantyEndDate: '2027-06-30',
    isVirtual: false, hypervisor: 'PVE', hostServerId: null,
    cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
    vmCount: 4, hostServerName: null, hostManageUrl: null,
    createdAt: '', updatedAt: '',
    children: [
      { id: 10, name: 'MySQL主数据库', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.20', externalIp: '', port: '22', cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '', os: 'Ubuntu 22.04 LTS', expireDate: null, purpose: 'MySQL 主数据库', account: 'root', dbAccount: 'root', dbPort: '3306', remark: '主库', manageUrl: null, status: '正常', manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null, isVirtual: true, hypervisor: 'PVE', hostServerId: 1, cpuCoresAllocated: 8, memoryAllocatedGB: 32, diskAllocatedGB: 500, vmCount: 0, hostServerName: '机房PVE宿主机-01', hostManageUrl: 'https://192.168.1.10:8006', createdAt: '', updatedAt: '' },
      { id: 11, name: 'Redis缓存服务', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.21', externalIp: '', port: '22', cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '', os: 'CentOS 7.9', expireDate: null, purpose: 'Redis 缓存', account: 'root', dbAccount: '', dbPort: '', remark: '', manageUrl: null, status: '正常', manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null, isVirtual: true, hypervisor: 'PVE', hostServerId: 1, cpuCoresAllocated: 4, memoryAllocatedGB: 16, diskAllocatedGB: 100, vmCount: 0, hostServerName: '机房PVE宿主机-01', hostManageUrl: 'https://192.168.1.10:8006', createdAt: '', updatedAt: '' },
      { id: 12, name: 'Nginx网关', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.22', externalIp: '', port: '22', cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '', os: 'Debian 12', expireDate: null, purpose: 'Nginx 反向代理', account: 'root', dbAccount: '', dbPort: '', remark: '', manageUrl: null, status: '正常', manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null, isVirtual: true, hypervisor: 'PVE', hostServerId: 1, cpuCoresAllocated: 2, memoryAllocatedGB: 4, diskAllocatedGB: 50, vmCount: 0, hostServerName: '机房PVE宿主机-01', hostManageUrl: 'https://192.168.1.10:8006', createdAt: '', updatedAt: '' },
      { id: 14, name: 'Jenkins构建节点', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.23', externalIp: '', port: '22', cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '', os: 'Ubuntu 22.04 LTS', expireDate: null, purpose: 'Jenkins CI/CD', account: 'root', dbAccount: '', dbPort: '', remark: '已停用', manageUrl: null, status: '停用', manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null, isVirtual: true, hypervisor: 'PVE', hostServerId: 1, cpuCoresAllocated: 4, memoryAllocatedGB: 8, diskAllocatedGB: 100, vmCount: 0, hostServerName: '机房PVE宿主机-01', hostManageUrl: 'https://192.168.1.10:8006', createdAt: '', updatedAt: '' },
    ],
  },
  {
    id: 2, name: '机房ESXi宿主机-02', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.11', externalIp: '',
    port: '22', cpuModel: 'Intel Xeon Gold 5218', cpuCores: '24核', memorySize: '128GB', systemDiskSize: '480GB', dataDiskSize: '8TB', diskType: 'SSD',
    os: 'VMware ESXi 7.0', expireDate: null, purpose: '备用虚拟化平台', account: 'root', dbAccount: '', dbPort: '',
    remark: 'ESXi 宿主机', manageUrl: 'https://192.168.1.11', status: '正常',
    manufacturer: '惠普', model: 'ProLiant DL380 Gen10', serialNo: 'HPL380G10A002', raidType: 'RAID5', networkCards: '4×1G + 2×25G', warrantyEndDate: '2026-09-15',
    isVirtual: false, hypervisor: 'ESXi', hostServerId: null,
    cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
    vmCount: 1, hostServerName: null, hostManageUrl: null,
    createdAt: '', updatedAt: '',
    children: [
      { id: 13, name: 'GitLab代码仓库', serverType: '本地', cloudAccount: '', internalIp: '192.168.1.30', externalIp: '', port: '22', cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '', os: 'Ubuntu 22.04 LTS', expireDate: null, purpose: 'GitLab 代码仓库', account: 'root', dbAccount: '', dbPort: '', remark: '', manageUrl: null, status: '正常', manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null, isVirtual: true, hypervisor: 'ESXi', hostServerId: 2, cpuCoresAllocated: 8, memoryAllocatedGB: 32, diskAllocatedGB: 500, vmCount: 0, hostServerName: '机房ESXi宿主机-02', hostManageUrl: 'https://192.168.1.11', createdAt: '', updatedAt: '' },
    ],
  },
  {
    id: 3, name: '阿里云-Web前端', serverType: '阿里云', cloudAccount: '泰兴超市生产', internalIp: '172.16.0.1', externalIp: '47.108.22.33',
    port: '22', cpuModel: 'Intel Xeon Platinum', cpuCores: '4核', memorySize: '16GB', systemDiskSize: '100GB', dataDiskSize: '200GB', diskType: 'SSD',
    os: 'Alibaba Cloud Linux 3', expireDate: '2026-09-01', purpose: 'Web 前端服务', account: 'root', dbAccount: '', dbPort: '',
    remark: '阿里云 ECS', manageUrl: 'https://ecs.console.aliyun.com', status: '正常',
    manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null,
    isVirtual: false, hypervisor: null, hostServerId: null,
    cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
    vmCount: 0, hostServerName: null, hostManageUrl: null,
    createdAt: '', updatedAt: '',
  },
  {
    id: 4, name: '腾讯云-数据库备份', serverType: '腾讯云', cloudAccount: '泰兴超市备份', internalIp: '10.0.0.2', externalIp: '119.91.22.11',
    port: '22', cpuModel: 'AMD EPYC 7K62', cpuCores: '8核', memorySize: '32GB', systemDiskSize: '200GB', dataDiskSize: '1TB', diskType: 'SSD',
    os: 'TencentOS Server 3.1', expireDate: '2027-03-15', purpose: '数据库异地备份', account: 'root', dbAccount: 'root', dbPort: '3306',
    remark: '腾讯云 CVM', manageUrl: 'https://console.cloud.tencent.com/cvm', status: '正常',
    manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null,
    isVirtual: false, hypervisor: null, hostServerId: null,
    cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
    vmCount: 0, hostServerName: null, hostManageUrl: null,
    createdAt: '', updatedAt: '',
  },
  {
    id: 5, name: '华为云-测试环境', serverType: '华为云', cloudAccount: '泰兴超市测试', internalIp: '192.168.2.50', externalIp: '123.249.55.77',
    port: '22', cpuModel: 'Kunpeng 920', cpuCores: '8核', memorySize: '16GB', systemDiskSize: '100GB', dataDiskSize: '200GB', diskType: 'SSD',
    os: 'Huawei Cloud EulerOS 2.0', expireDate: null, purpose: '测试环境', account: 'root', dbAccount: '', dbPort: '',
    remark: '华为云 ECS（已停用）', manageUrl: 'https://console.huaweicloud.com/ecm', status: '停用',
    manufacturer: null, model: null, serialNo: null, raidType: null, networkCards: null, warrantyEndDate: null,
    isVirtual: false, hypervisor: null, hostServerId: null,
    cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
    vmCount: 0, hostServerName: null, hostManageUrl: null,
    createdAt: '', updatedAt: '',
  },
]

// —— 扁平化全部数据（含 children 中的 VM） ——
const allServers = computed<MockServer[]>(() => {
  const flat: MockServer[] = []
  for (const s of mockServers) {
    flat.push(s)
    if (s.children) flat.push(...s.children)
  }
  return flat
})

// —— 筛选逻辑（真实生效） ——

/** 关键词匹配 */
function matchesKeyword(s: MockServer, kw: string): boolean {
  if (!kw) return true
  return [s.name, s.internalIp, s.externalIp, s.purpose, s.account, s.remark]
    .filter(Boolean).some(v => String(v).toLowerCase().includes(kw))
}

/** 状态匹配 */
function matchesStatus(s: MockServer): boolean {
  return !filterStatus.value || s.status === filterStatus.value
}

/** 平台匹配：VM 以宿主平台为准 */
function matchesHypervisor(s: MockServer): boolean {
  if (!filterHypervisor.value) return true
  if (s.isVirtual) {
    const host = allServers.value.find(h => h.id === s.hostServerId)
    return host ? (host.hypervisor || '') === filterHypervisor.value : false
  }
  return (s.hypervisor || '') === filterHypervisor.value
}

/** 综合匹配 */
function matchesAll(s: MockServer, kw: string): boolean {
  return matchesKeyword(s, kw) && matchesStatus(s) && matchesHypervisor(s)
}

// —— 全部 Tab：筛选 → 包含命中 VM 的宿主 → 构建树 ——
const filteredTreeData = computed<ServerTreeNode[]>(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  const matched = allServers.value.filter(s => matchesAll(s, kw))

  const matchedVmHostIds = new Set(
    matched.filter(s => s.isVirtual && s.hostServerId).map(s => s.hostServerId!)
  )
  const hostsToAdd = allServers.value.filter(s =>
    !s.isVirtual &&
    matchedVmHostIds.has(s.id) &&
    !matched.includes(s) &&
    matchesStatus(s) &&
    matchesHypervisor(s)
  )

  return buildServerTree([...matched, ...hostsToAdd] as ServerListItem[])
})

const filteredHosts = computed(() => filteredTreeData.value.filter(n => !n.isVirtual))
const filteredOrphanVms = computed(() => filteredTreeData.value.filter(n => n.isVirtual))

// —— 物理机 Tab ——
const filteredPhysicals = computed<MockServer[]>(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  return allServers.value
    .filter(s => !s.isVirtual && matchesAll(s, kw))
    .map(p => ({
      ...p,
      children: allServers.value.filter(s => s.isVirtual && s.hostServerId === p.id),
    }))
})

// —— 虚拟机 Tab ——
const filteredVirtuals = computed<MockServer[]>(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  return allServers.value.filter(s => s.isVirtual && matchesAll(s, kw))
})

// —— 筛选结果计数 ——
const filterResultCount = computed(() => {
  if (activeTab.value === 'all') return filteredHosts.value.length + filteredOrphanVms.value.length
  if (activeTab.value === 'physical') return filteredPhysicals.value.length
  return filteredVirtuals.value.length
})

// —— 统计 ——
const statPhysical = computed(() => allServers.value.filter(s => !s.isVirtual && s.status === '正常').length)
const statVirtual = computed(() => allServers.value.filter(s => s.isVirtual && s.status === '正常').length)
const statTotal = computed(() => statPhysical.value + statVirtual.value)
const statExpiring = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return allServers.value.filter(s => {
    if (s.status !== '正常' || !s.expireDate) return false
    const d = new Date(`${s.expireDate}T00:00:00`)
    const days = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 30
  }).length
})

// —— 详情抽屉 ——
const drawerVisible = ref(false)
const selectedServer = ref<MockServer | null>(null)

function openDrawer(server: MockServer) {
  selectedServer.value = server
  drawerVisible.value = true
}

function onDrawerClose() {
  selectedServer.value = null
}

/** VM 卡宿主机名称点击：打开宿主机 Drawer，不重新打开当前 VM */
function onVmHostClick(vm: MockServer) {
  const host = hostOf(vm)
  if (host) {
    selectedServer.value = host
    drawerVisible.value = true
  }
}

function vmListOf(host: MockServer): MockServer[] {
  return allServers.value.filter(s => s.isVirtual && s.hostServerId === host.id)
}

/** 抽屉内最多展示 8 台 VM */
function visibleDrawerVms(host: MockServer): MockServer[] {
  return vmListOf(host).slice(0, 8)
}

function hostOf(vm: MockServer): MockServer | null {
  if (!vm.isVirtual || !vm.hostServerId) return null
  return allServers.value.find(s => s.id === vm.hostServerId) ?? null
}

function manageUrlOf(server: MockServer): string | null {
  if (server.isVirtual) return server.hostManageUrl
  return server.manageUrl
}

function getStatusType(status: string): 'success' | 'info' | 'danger' {
  if (status === '正常') return 'success'
  if (status === '报废') return 'danger'
  return 'info'
}

/** 名称平台色：返回 --tone-<tone>-text CSS 变量 */
function toneTextVar(server: MockServer): string {
  const { tone } = serverVisualTone(server)
  return `var(--tone-${tone}-text)`
}

/** 配置摘要：CPU / 内存 / 磁盘 */
function specCpuOf(s: MockServer): string {
  if (s.isVirtual) return s.cpuCoresAllocated != null ? `${s.cpuCoresAllocated}核` : '—'
  return s.cpuCores || '—'
}
function specMemOf(s: MockServer): string {
  if (s.isVirtual) return s.memoryAllocatedGB != null ? `${s.memoryAllocatedGB}GB` : '—'
  return s.memorySize || '—'
}
function specDiskOf(s: MockServer): string {
  if (s.isVirtual) return s.diskAllocatedGB != null ? `${s.diskAllocatedGB}GB` : '—'
  return [s.systemDiskSize, s.dataDiskSize].filter(Boolean).join(' + ') || '—'
}

// —— 操作占位 ——
function onAdd() { ElMessage.info('[设计稿] 新增服务器') }
function onAddVirtual() { ElMessage.info('[设计稿] 新增虚拟机') }
function onEdit(s: MockServer) { ElMessage.info(`[设计稿] 编辑：${s.name}`) }
function onDelete(s: MockServer) { ElMessage.info(`[设计稿] 删除：${s.name}`) }
function onPassword(s: MockServer) { ElMessage.info(`[设计稿] 密码管理：${s.name}`) }
function onDetail(s: MockServer) { ElMessage.info(`[设计稿] 详情页：${s.name}（正式版本将跳转 /it/servers/${s.id}）`) }
</script>

<style scoped>
.server-workspace {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-card);
}

/* —— 角色切换器 —— */
.role-switcher { margin-right: 8px; }

/* —— 一行提示 —— */
.quick-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  padding: 0 2px;
}
.quick-tip .el-icon { color: var(--color-info); }

/* —— 指标卡 —— */
.stat-row { margin-bottom: 0; }

/* —— 筛选栏 —— */
.tab-group { margin-right: 16px; }
.view-mode { margin-left: auto; }
.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filter-count { font-size: var(--font-size-mini); color: var(--text-secondary); margin-left: auto; }

/* —— 卡片网格：≥1200px 两列，<1200px 一列 —— */
.server-card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-card);
}
@media (min-width: 1200px) {
  .server-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* —— 通用 —— */
.mock-link { color: var(--color-primary); cursor: pointer; text-decoration: none; }
.mock-link:hover { text-decoration: underline; }

/* —— 抽屉内部 —— */
.drawer-section-title {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-lighter);
  padding-bottom: 8px;
}

/* —— 紧凑 VM 行（替代 6 列 el-table）—— */
.vm-compact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vm-compact-row {
  padding: 8px 10px;
  background: var(--bg-page);
  border-radius: var(--radius-input);
  cursor: pointer;
  transition: background 0.15s ease;
}
.vm-compact-row:hover { background: var(--bg-hover); }
.vm-row-1 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vm-row-1 .mock-link { font-weight: 500; }
.vm-row-2 { font-size: var(--font-size-mini); color: var(--text-secondary); margin-top: 2px; }
.vm-row-3 { font-size: var(--font-size-micro); color: var(--text-placeholder); margin-top: 2px; }
.vm-compact-more {
  text-align: center;
  font-size: var(--font-size-small);
  color: var(--color-primary);
  cursor: pointer;
  padding: 8px;
  border-top: 1px solid var(--border-lighter);
}
.vm-compact-more:hover { text-decoration: underline; }

.drawer-host-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--bg-page);
  border-radius: var(--radius-input);
}
.drawer-host-meta { font-size: var(--font-size-mini); color: var(--text-secondary); }

/* —— 平台 Tag —— */
.platform-tag {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: var(--font-size-micro); font-weight: 600;
  padding: 2px 8px; border-radius: var(--radius-small); border: 1px solid;
}
.platform-tag--pve { background: var(--tone-pve-bg); color: var(--tone-pve-text); border-color: var(--tone-pve-border); }
.platform-tag--esxi { background: var(--tone-esxi-bg); color: var(--tone-esxi-text); border-color: var(--tone-esxi-border); }

/* —— 按钮链接 —— */
.btn-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  font-size: var(--font-size-small);
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary-border);
  border-radius: var(--radius-btn);
  text-decoration: none;
  white-space: nowrap;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.btn-link:hover { border-color: var(--color-primary); }

/* —— 树形列表信息着色 —— */
.tree-name { font-weight: 500; cursor: pointer; }
.tree-name:hover { text-decoration: underline; }

.tree-ip { display: inline-flex; align-items: center; gap: 4px; }
.tree-ip--internal .el-icon { color: var(--color-info); }
.tree-ip--external .el-icon { color: var(--color-warning); }
.ip-value { font-family: var(--font-family-mono); color: var(--text-primary); }

.tree-specs { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.tree-spec { display: inline-flex; align-items: baseline; gap: 3px; }
.spec-label { font-size: var(--font-size-micro); color: var(--text-secondary); }
.spec-label--cpu { color: var(--spec-cpu); }
.spec-label--memory { color: var(--spec-memory); }
.spec-label--disk { color: var(--spec-disk); }
.spec-val { font-size: var(--font-size-small); color: var(--text-primary); }

.text-muted { color: var(--text-placeholder); }
</style>
