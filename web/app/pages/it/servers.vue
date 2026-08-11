<template>
  <div class="page-container">
    <PageHeader title="服务器管理" subtitle="物理机与虚拟机综合管理">
      <template #actions>
        <el-button v-if="canEdit" type="primary" plain @click="handleAddVirtual()">
          <el-icon><Plus /></el-icon>
          新增虚拟机
        </el-button>
        <el-button v-if="canEdit" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增服务器
        </el-button>
      </template>
    </PageHeader>

    <!-- 一行提示 -->
    <div class="quick-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>点击卡片打开详情抽屉 · hover 名称快速预览 · 物理机可展开查看虚拟机</span>
    </div>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Monitor" :color="vars.primary" :bg="vars.primaryLight" :value="statsUnavailable ? '--' : (physicalCount + virtualCount)" label="服务器总数(正常)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="HomeFilled" :color="vars.info" :bg="vars.infoLight" :value="statsUnavailable ? '--' : physicalCount" label="物理机(正常)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="Cloudy" :color="vars.success" :bg="vars.successLight" :value="statsUnavailable ? '--' : virtualCount" label="虚拟机(正常)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="WarningFilled" :color="vars.danger" :bg="vars.dangerLight" :value="statsUnavailable ? '--' : expiringSoonCount" label="即将到期(30天)" />
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="card filter-bar">
      <el-radio-group v-model="query.activeTab" class="tab-group" @change="onTabChange">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="physical">物理机</el-radio-button>
        <el-radio-button value="virtual">虚拟机</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="viewMode" class="view-mode">
        <el-radio-button value="card">卡片总览</el-radio-button>
        <el-radio-button value="tree">树形列表</el-radio-button>
      </el-radio-group>
      <el-input v-model="query.keyword" placeholder="搜索名称/IP/用途/账号/备注" clearable style="width: 240px" @input="debouncedSearch" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 110px" @change="handleFilterChange">
        <el-option v-for="s in serverStatusOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <el-select v-model="query.hypervisor" placeholder="虚拟化平台" clearable style="width: 130px" @change="handleFilterChange">
        <el-option v-for="h in hypervisorOptions" :key="h" :label="h" :value="h" />
      </el-select>
      <el-select v-model="query.hostServerId" placeholder="宿主机" clearable filterable style="width: 180px" @change="handleFilterChange">
        <el-option v-for="h in hostOptions" :key="h.id" :label="h.name" :value="h.id" />
      </el-select>
      <span class="filter-count">{{ filterResultCount }} 条结果</span>
    </div>

    <!-- ========== 卡片总览模式 ========== -->
    <template v-if="viewMode === 'card'">
      <!-- 全部：宿主卡 + 孤儿 VM 卡（前端分页） -->
      <div class="card" v-if="query.activeTab === 'all'">
        <div v-loading="treeLoading" class="server-card-grid">
          <ServerHostCard
            v-for="h in cardPageHosts" :key="h.id"
            :server="h" :can-edit="canEdit"
            :is-selected="selectedServer?.id === h.id"
            @click="openDrawer" @edit="handleEdit" @delete="handleDelete"
          />
          <ServerVmCard
            v-for="vm in filteredOrphanVms" :key="vm.id"
            :server="vm" :host-manage-url="vm.hostManageUrl" :can-edit="canEdit"
            :is-selected="selectedServer?.id === vm.id"
            @click="openDrawer" @click-host="onVmHostClick" @edit="handleEdit" @delete="handleDelete"
          />
        </div>
        <el-empty v-if="!treeLoading && cardHosts.length === 0 && filteredOrphanVms.length === 0" description="暂无服务器" :image-size="80" />
        <div v-if="cardHosts.length > CARD_PAGE_SIZE" class="card-pagination">
          <el-pagination layout="prev, pager, next" :total="cardHosts.length" :page-size="CARD_PAGE_SIZE" :current-page="cardPage" @current-change="cardPage = $event" background />
        </div>
      </div>

      <!-- 物理机（后端分页） -->
      <div class="card" v-else-if="query.activeTab === 'physical'">
        <div v-loading="loading" class="server-card-grid">
          <ServerHostCard
            v-for="p in physicalServerList" :key="p.id"
            :server="p" :can-edit="canEdit"
            :is-selected="selectedServer?.id === p.id"
            @click="openDrawer" @edit="handleEdit" @delete="handleDelete"
          />
          <el-empty v-if="!loading && physicalServerList.length === 0" description="暂无物理机" :image-size="80" />
        </div>
        <div class="card-pagination">
          <el-pagination layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="handleCardPageChange" background />
        </div>
      </div>

      <!-- 虚拟机（后端分页） -->
      <div class="card" v-else>
        <div v-loading="loading" class="server-card-grid">
          <ServerVmCard
            v-for="v in virtualServerList" :key="v.id"
            :server="v" :host-manage-url="v.hostManageUrl" :can-edit="canEdit"
            :is-selected="selectedServer?.id === v.id"
            @click="openDrawer" @click-host="onVmHostClick" @edit="handleEdit" @delete="handleDelete"
          />
          <el-empty v-if="!loading && virtualServerList.length === 0" description="暂无虚拟机" :image-size="80" />
        </div>
        <div class="card-pagination">
          <el-pagination layout="total, prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="handleCardPageChange" background />
        </div>
      </div>
    </template>

    <!-- ========== 树形列表模式（字段级信息着色） ========== -->
    <div class="card" v-else>
      <el-table
        :data="treeData"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        v-loading="treeLoading"
        border
        size="small"
        style="width: 100%"
      >
        <!-- 名称：平台语义色 -->
        <el-table-column prop="name" label="名称" width="200">
          <template #default="{ row }">
            <button class="tree-name" :style="{ color: toneTextVar(row as ServerListItem) }" @click="openDrawer(row as ServerListItem)">{{ row.name }}</button>
          </template>
        </el-table-column>
        <!-- 身份 -->
        <el-table-column label="身份" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isVirtual ? 'warning' : 'primary'" size="small" effect="light">{{ row.isVirtual ? '虚拟机' : '物理机' }}</el-tag>
          </template>
        </el-table-column>
        <!-- 平台 -->
        <el-table-column label="平台" width="100" align="center">
          <template #default="{ row }">
            <span v-if="platformOf(row as ServerListItem)" class="platform-tag" :class="platformOf(row as ServerListItem) === 'PVE' ? 'platform-tag--pve' : 'platform-tag--esxi'">{{ platformOf(row as ServerListItem) }}</span>
            <el-tag v-else size="small" effect="plain">{{ row.serverType }}</el-tag>
          </template>
        </el-table-column>
        <!-- 内网IP -->
        <el-table-column label="内网IP" width="140">
          <template #default="{ row }">
            <div v-if="row.internalIp" class="tree-ip tree-ip--internal">
              <el-icon><Monitor /></el-icon>
              <span class="ip-value">{{ row.internalIp }}</span>
            </div>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <!-- 外网IP -->
        <el-table-column label="外网IP" width="140">
          <template #default="{ row }">
            <div v-if="row.externalIp" class="tree-ip tree-ip--external">
              <el-icon><Connection /></el-icon>
              <span class="ip-value">{{ row.externalIp }}</span>
            </div>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <!-- 配置摘要 -->
        <el-table-column label="配置摘要" min-width="220">
          <template #default="{ row }">
            <div class="tree-specs">
              <span class="tree-spec"><span class="spec-label spec-label--cpu">CPU</span><span class="spec-val">{{ specCpuOf(row as ServerListItem) }}</span></span>
              <span class="tree-spec"><span class="spec-label spec-label--memory">内存</span><span class="spec-val">{{ specMemOf(row as ServerListItem) }}</span></span>
              <span class="tree-spec"><span class="spec-label spec-label--disk">磁盘</span><span class="spec-val">{{ specDiskOf(row as ServerListItem) }}</span></span>
            </div>
          </template>
        </el-table-column>
        <!-- 宿主机 -->
        <el-table-column label="宿主机" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <button v-if="row.hostServerName" class="tree-link" @click="onVmHostClick(row as ServerListItem)">{{ row.hostServerName }}</button>
            <button v-else-if="!row.isVirtual && row.vmCount > 0" class="tree-link" @click="openDrawer(row as ServerListItem)">{{ row.vmCount }} 台虚拟机</button>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <!-- 状态 -->
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small" effect="light">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <!-- 操作 -->
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <template v-if="canEdit">
              <button class="action-text action-text--primary" @click="handleEdit(row)">编辑</button>
              <button class="action-text action-text--danger" @click="handleDelete(row)">删除</button>
              <el-dropdown trigger="click" @command="(cmd: string) => handleRowAction(cmd, row as ServerListItem)">
                <button type="button" class="action-text action-text--info">更多<el-icon class="action-text__caret"><ArrowDown /></el-icon></button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="password">
                      <el-icon class="dropdown-icon dropdown-icon--credential"><Lock /></el-icon>服务器凭据（可选）
                    </el-dropdown-item>
                    <el-dropdown-item v-if="manageUrlOf(row as ServerListItem)" command="manage">
                      <el-icon class="dropdown-icon dropdown-icon--external"><Link /></el-icon>进入管理
                    </el-dropdown-item>
                    <el-dropdown-item command="detail">
                      <el-icon class="dropdown-icon dropdown-icon--info"><View /></el-icon>打开详情页
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
            <button v-else class="action-text action-text--info" @click="goDetail(row.id)">详情</button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ========== 右侧详情 Drawer ========== -->
    <AssetDetailDrawer v-model="drawerVisible" :title="selectedServer?.name" :can-edit="canEdit" @close="onDrawerClose">
      <template #header>
        <el-tag :type="selectedServer?.isVirtual ? 'warning' : 'primary'" size="small">{{ selectedServer?.isVirtual ? '虚拟机' : '物理机' }}</el-tag>
        <span v-if="selectedServer && platformOf(selectedServer)" class="platform-tag" :class="platformOf(selectedServer) === 'PVE' ? 'platform-tag--pve' : 'platform-tag--esxi'">{{ platformOf(selectedServer) }}</span>
        <el-tag v-if="selectedServer" :type="getStatusTagType(selectedServer.status)" size="small">{{ selectedServer.status }}</el-tag>
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

      <!-- 物理机：紧凑 VM 行 -->
      <template v-if="selectedServer && !selectedServer.isVirtual">
        <div class="drawer-section-title">全部虚拟机（{{ vmListOf(selectedServer).length }} 台）</div>
        <div class="vm-compact-list">
          <button v-for="vm in visibleDrawerVms(selectedServer)" :key="vm.id" class="vm-compact-row" @click="openDrawer(vm)">
            <div class="vm-row-1">
              <span class="vm-name-text">{{ vm.name }}</span>
              <el-tag :type="getStatusTagType(vm.status)" size="small">{{ vm.status }}</el-tag>
            </div>
            <div class="vm-row-2">{{ vm.internalIp || '—' }} · {{ vm.purpose || '—' }}</div>
            <div class="vm-row-3">{{ vm.cpuCoresAllocated ?? '—' }}核 / {{ vm.memoryAllocatedGB ?? '—' }}GB / {{ vm.diskAllocatedGB ?? '—' }}GB</div>
          </button>
          <button v-if="vmListOf(selectedServer).length > 8" class="vm-compact-more" @click="goDetail(selectedServer.id)">
            查看全部虚拟机（{{ vmListOf(selectedServer).length }} 台）
          </button>
        </div>
      </template>

      <!-- 虚拟机：宿主信息 -->
      <template v-else-if="selectedServer">
        <div class="drawer-section-title">所属宿主机</div>
        <div class="drawer-host-card" v-if="hostOf(selectedServer)">
          <button class="tree-link" @click="openDrawer(hostOf(selectedServer)!)">{{ hostOf(selectedServer)!.name }}</button>
          <span class="drawer-host-meta">{{ hostOf(selectedServer)!.internalIp }} · {{ platformOf(hostOf(selectedServer)!) || '—' }}</span>
        </div>
        <el-empty v-else description="未关联宿主机" :image-size="40" />
      </template>

      <!-- 底部操作区 -->
      <template #footer>
        <ActionButton variant="close" size="small" @click="drawerVisible = false">关闭</ActionButton>
        <ActionButton v-if="canEdit" variant="primary" size="small" :icon="Edit" @click="handleEdit(selectedServer!)">编辑</ActionButton>
        <ActionButton v-if="selectedServer && manageUrlOf(selectedServer)" variant="external" size="small" :href="manageUrlOf(selectedServer!)!">进入管理</ActionButton>
        <el-dropdown v-if="canEdit" trigger="click" @command="handleFooterAction">
          <button type="button" class="action-text action-text--info">更多<el-icon class="action-text__caret"><ArrowDown /></el-icon></button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="credential">
                <el-icon class="dropdown-icon dropdown-icon--credential"><Lock /></el-icon>服务器凭据（可选）
              </el-dropdown-item>
              <el-dropdown-item command="detail">
                <el-icon class="dropdown-icon dropdown-icon--info"><View /></el-icon>打开详情页
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <ActionButton v-else variant="info" size="small" @click="goDetail(selectedServer!.id)">打开详情页</ActionButton>
      </template>
    </AssetDetailDrawer>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="800px" destroy-on-close>
      <el-form :model="formData" label-width="100px" :rules="rules" ref="formRef">
        <el-alert type="info" :closable="false" show-icon class="form-alert">
          <template #title>密码不在此处填写：登录/数据库密码通过"服务器凭据"独立操作（仅管理员/操作员）</template>
        </el-alert>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="身份" prop="isVirtual">
              <el-radio-group v-model="formData.isVirtual">
                <el-radio :value="false">物理机</el-radio>
                <el-radio :value="true">虚拟机</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="名称" prop="name">
              <el-input v-model="formData.name" placeholder="如：机房PVE宿主机 / 财务虚拟机" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="formData.isVirtual" :gutter="16">
          <el-col :span="12">
            <el-form-item label="宿主机" prop="hostServerId">
              <el-select v-model="formData.hostServerId" filterable placeholder="选择物理宿主机" style="width: 100%" @change="onHostChange">
                <el-option v-for="h in hostOptions" :key="h.id" :label="h.name" :value="h.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="虚拟化平台">
          <el-select v-model="formData.hypervisor" placeholder="PVE/ESXi（物理机可填；虚拟机继承宿主机）" clearable style="width: 100%" :disabled="formData.isVirtual && !!formData.hostServerId">
            <el-option v-for="h in hypervisorOptions" :key="h" :label="h" :value="h" />
          </el-select>
          <div v-if="formData.isVirtual" class="form-tip">虚拟机平台继承自宿主机（只读）</div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="服务器类型" prop="serverType">
              <el-select v-model="formData.serverType" placeholder="选择或输入" filterable allow-create default-first-option style="width: 100%" @change="onServerTypeChange">
                <el-option v-for="t in serverTypeOptions" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="formData.status">
                <el-radio v-for="s in serverStatusOptions" :key="s" :value="s">{{ s }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="厂商">
              <el-input v-model="formData.manufacturer" placeholder="戴尔/惠普/浪潮/华为等" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="型号">
              <el-input v-model="formData.model" placeholder="如：PowerEdge R740" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="序列号">
              <el-input v-model="formData.serialNo" placeholder="可空；留空提交为 NULL" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="RAID">
              <el-select v-model="formData.raidType" placeholder="RAID0/1/5/10/无" clearable style="width: 100%">
                <el-option v-for="r in ['RAID0', 'RAID1', 'RAID5', 'RAID10', '无']" :key="r" :label="r" :value="r" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="内网IP">
              <el-input v-model="formData.internalIp" placeholder="如：192.168.0.100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="外网IP">
              <el-input v-model="formData.externalIp" placeholder="云服务器公网IP，本地可空" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="端口" prop="port">
              <el-input v-model="formData.port" placeholder="如：22" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="操作系统">
              <el-input v-model="formData.os" placeholder="如：CentOS 7.9" />
            </el-form-item>
          </el-col>
        </el-row>
        <template v-if="formData.isVirtual">
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="分配CPU">
                <el-input-number v-model="formData.cpuCoresAllocated" :min="0" :precision="0" :controls="false" placeholder="核" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="分配内存GB">
                <el-input-number v-model="formData.memoryAllocatedGB" :min="0" :precision="2" :controls="false" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="分配磁盘GB">
                <el-input-number v-model="formData.diskAllocatedGB" :min="0" :precision="2" :controls="false" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="CPU型号">
              <el-input v-model="formData.cpuModel" placeholder="如：Intel Xeon E5-2620 v4" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="CPU核数">
              <el-input v-model="formData.cpuCores" placeholder="如：8核" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="内存大小">
              <el-input v-model="formData.memorySize" placeholder="如：32GB" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="硬盘类型">
              <el-select v-model="formData.diskType" placeholder="SSD/HDD" clearable style="width: 100%">
                <el-option v-for="t in diskTypeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="系统盘">
              <el-input v-model="formData.systemDiskSize" placeholder="如：100GB" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据盘">
              <el-input v-model="formData.dataDiskSize" placeholder="如：1TB" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="云账号">
              <el-input v-model="formData.cloudAccount" placeholder="本地可空" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期">
              <el-date-picker v-model="formData.expireDate" type="date" value-format="YYYY-MM-DD" placeholder="云服务器续费日期" clearable style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="保修到期">
              <el-date-picker v-model="formData.warrantyEndDate" type="date" value-format="YYYY-MM-DD" placeholder="硬件保修到期" clearable style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="网卡信息">
              <el-input v-model="formData.networkCards" placeholder="如：2×1G + 2×10G" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="用途" prop="purpose">
              <el-input v-model="formData.purpose" placeholder="如：MySQL主数据库" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="登录账号">
              <el-input v-model="formData.account" placeholder="如：root" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="数据库账号">
              <el-input v-model="formData.dbAccount" placeholder="无数据库可空" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据库端口">
              <el-input v-model="formData.dbPort" placeholder="如：3306" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
        <el-form-item v-if="!formData.isVirtual" label="管理地址">
          <el-input v-model="formData.manageUrl" placeholder="如 https://192.168.1.10:8006 （宿主机控制台，进入管理时新窗口打开）" />
        </el-form-item>
        <el-form-item v-else label="管理地址">
          <span class="text-secondary">虚拟机不保存管理地址；入口来自宿主机（见详情页"宿主机管理地址"）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 服务器凭据弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="服务器凭据" width="520px" destroy-on-close>
      <el-form :model="passwordForm" label-width="110px">
        <el-form-item label="登录账号">
          <span class="credential-account">{{ passwordTarget?.account || '—' }}</span>
        </el-form-item>
        <el-form-item label="数据库账号">
          <span class="credential-account">{{ passwordTarget?.dbAccount || '—' }}</span>
        </el-form-item>
        <el-form-item label="登录密码">
          <el-input v-model="passwordForm.password" type="password" show-password placeholder="可选填写。留空表示不修改" />
        </el-form-item>
        <el-form-item label="数据库密码">
          <el-input v-model="passwordForm.dbPassword" type="password" show-password placeholder="可选填写。留空表示不修改" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          <template #title>可选填写。留空表示不保存或不修改现有凭据。内网可选保存的服务器凭据。</template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">关闭</el-button>
        <el-button @click="handleViewPassword" :loading="viewingPassword">查看已保存凭据</el-button>
        <el-button @click="handleClearPassword" type="danger" plain>清除已保存凭据</el-button>
        <el-button type="primary" :loading="savingPassword" @click="handleSavePassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDebounceFn } from '@vueuse/core'
import { Plus, Monitor, Connection, HomeFilled, Cloudy, WarningFilled, InfoFilled, Lock, Link, View, ArrowDown, Edit } from '@element-plus/icons-vue'
import { useServerWorkspace } from '~/composables/useServerWorkspace'
import type { ServerItem, ServerListItem } from '~/types/server'
import { serverVisualTone, platformOf } from '~/utils/server-visual-tone'
import { buildServerTree, type ServerTreeNode } from '~/utils/server-tree'
import { getApiErrorMessage } from '~/composables/useApi'

const {
  query, resetQuery, buildQuery,
  treeError, workspaceRefreshError,
  serverList, serverTree, treeLoading, total, page, pageSize, loading,
  physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount,
  hostOptions, statsUnavailable,
  refreshWorkspace,
  fetchServers, fetchServerTree, fetchServerStats, fetchPhysicalHosts,
  fetchServerDetail, addServer, updateServer, deleteServer,
  fetchServerPassword, updateServerPassword,
  serverTypeOptions, serverStatusOptions, hypervisorOptions, diskTypeOptions,
  getServerTypeTagAttrs, assignCustomTypeColor, getStatusTagType, getExpireDays,
} = useServerWorkspace()

// —— 角色 ——
const canEdit = ref(false)
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  await refreshWorkspace()
  // 详情页"新增虚拟机"跳转：自动带入宿主机
  if (route.query.addVirtual) {
    handleAddVirtual(Number(route.query.addVirtual))
    navigateTo('/it/servers', { replace: true })
  }
})

// —— CSS 变量 ——
const vars = {
  primary: 'var(--color-primary)', primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)', successLight: 'var(--color-success-light)',
  info: 'var(--color-info)', infoLight: 'var(--color-info-light)',
  danger: 'var(--color-danger)', dangerLight: 'var(--color-danger-light)',
}

// —— 展示模式 ——
const viewMode = ref<'card' | 'tree'>('card')

// —— 卡片前端分页（全部 Tab） ——
const CARD_PAGE_SIZE = 12
const cardPage = ref(1)
watch(() => query.activeTab, () => { cardPage.value = 1 })

// —— 筛选与搜索 ——
const debouncedSearch = useDebounceFn(() => reloadPage(), 300)

function onTabChange() {
  cardPage.value = 1
  query.page = 1
  fetchServers(buildQuery())
}

function handleFilterChange() {
  query.page = 1
  cardPage.value = 1
  fetchServers(buildQuery())
}

function reloadPage() {
  query.page = 1
  cardPage.value = 1
  fetchServers(buildQuery())
}

function handleCardPageChange(p: number) {
  query.page = p
  fetchServers(buildQuery())
}

// —— 树形视图数据：前端筛选后组树 ——
const treeData = computed<ServerTreeNode[]>(() => {
  const kw = query.keyword.trim().toLowerCase()
  const list = serverTree.value.filter(s => {
    if (query.status && s.status !== query.status) return false
    if (query.hypervisor && (s.hypervisor || '') !== query.hypervisor) return false
    if (query.hostServerId) {
      // 宿主机筛选：匹配宿主本身或其下 VM
      if (s.id !== query.hostServerId && s.hostServerId !== query.hostServerId) return false
    }
    if (kw) {
      const hit = [s.name, s.internalIp, s.externalIp, s.purpose, s.account, s.remark]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(kw))
      if (!hit) return false
    }
    return true
  })
  return buildServerTree(list)
})

// —— 卡片数据 ——
const cardHosts = computed(() => treeData.value.filter(n => !n.isVirtual))
const filteredOrphanVms = computed(() => treeData.value.filter(n => n.isVirtual))
const cardPageHosts = computed(() => cardHosts.value.slice((cardPage.value - 1) * CARD_PAGE_SIZE, cardPage.value * CARD_PAGE_SIZE))
const physicalServerList = computed(() => serverList.value.filter(s => !s.isVirtual))
const virtualServerList = computed(() => serverList.value.filter(s => s.isVirtual))

// —— 筛选结果计数 ——
const filterResultCount = computed(() => {
  if (query.activeTab === 'all') return cardHosts.value.length + filteredOrphanVms.value.length
  return total.value
})

// —— 详情抽屉 ——
const drawerVisible = ref(false)
const selectedServer = ref<ServerListItem | null>(null)

function openDrawer(server: ServerListItem) {
  selectedServer.value = server
  drawerVisible.value = true
}

function onDrawerClose() {
  selectedServer.value = null
}

/** VM 卡/树宿主机名称点击：打开宿主机 Drawer */
function onVmHostClick(vm: ServerListItem) {
  const host = hostOf(vm)
  if (host) {
    selectedServer.value = host
    drawerVisible.value = true
  }
}

function vmListOf(host: ServerListItem): ServerListItem[] {
  return serverTree.value.filter(s => s.isVirtual && s.hostServerId === host.id)
}

function visibleDrawerVms(host: ServerListItem): ServerListItem[] {
  return vmListOf(host).slice(0, 8)
}

function hostOf(vm: ServerListItem): ServerListItem | null {
  if (!vm.isVirtual || !vm.hostServerId) return null
  return serverTree.value.find(s => s.id === vm.hostServerId) ?? null
}

function manageUrlOf(server: ServerListItem): string | null {
  if (server.isVirtual) return server.hostManageUrl
  return server.manageUrl
}

// —— 树形/抽屉辅助函数 ——
function toneTextVar(server: ServerListItem): string {
  const { tone } = serverVisualTone(server)
  return `var(--tone-${tone}-text)`
}

function specCpuOf(s: ServerListItem): string {
  if (s.isVirtual) return s.cpuCoresAllocated != null ? `${s.cpuCoresAllocated}核` : '—'
  return s.cpuCores || '—'
}
function specMemOf(s: ServerListItem): string {
  if (s.isVirtual) return s.memoryAllocatedGB != null ? `${s.memoryAllocatedGB}GB` : '—'
  return s.memorySize || '—'
}
function specDiskOf(s: ServerListItem): string {
  if (s.isVirtual) return s.diskAllocatedGB != null ? `${s.diskAllocatedGB}GB` : '—'
  return [s.systemDiskSize, s.dataDiskSize].filter(Boolean).join(' + ') || '—'
}

// —— 详情跳转 ——
function goDetail(id: number | null | undefined) {
  if (!id) return
  router.push(`/it/servers/${id}`).catch(() => {
    ElMessage.error('跳转详情失败，请重试')
  })
}

// —— 到期日期 ——
function getExpireTagType(date: string | null): 'info' | 'danger' | 'warning' {
  const days = getExpireDays(date)
  if (days === null) return 'info'
  if (days <= 30) return 'danger'
  if (days <= 90) return 'warning'
  return 'info'
}

// —— 弹窗 ——
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formRef = ref()

const formData = reactive<Record<string, any>>({
  id: 0, name: '', serverType: '本地', cloudAccount: '',
  internalIp: '', externalIp: '', port: '22',
  cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '',
  os: '', expireDate: null, purpose: '', account: '', dbAccount: '', dbPort: '',
  remark: '', manageUrl: null, status: '正常',
  manufacturer: '', model: '', serialNo: '', raidType: '', networkCards: '', warrantyEndDate: null,
  isVirtual: false, hypervisor: '', hostServerId: null,
  cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
})

const rules = {
  name: [{ required: true, message: '请输入服务器名称', trigger: 'blur' }],
  serverType: [{ required: true, message: '请选择服务器类型', trigger: 'change' }],
  purpose: [{ required: true, message: '请输入用途', trigger: 'blur' }],
  hostServerId: [{ required: true, message: '虚拟机必须选择宿主机', trigger: 'change' }],
}

function onHostChange(hostId: number | undefined) {
  if (!hostId) return
  const host = hostOptions.value.find((h) => h.id === hostId)
  if (host?.hypervisor) {
    formData.hypervisor = host.hypervisor
  }
}

function onServerTypeChange(val: string) { assignCustomTypeColor(val) }

function buildPayload(): Record<string, any> {
  const { id: _id, password: _p, dbPassword: _d, ...rest } = formData
  const payload: Record<string, any> = { ...rest }
  payload.serialNo = payload.serialNo === '' ? null : payload.serialNo
  payload.hypervisor = (payload.hypervisor === '' || payload.hypervisor === null) ? null : payload.hypervisor
  payload.raidType = payload.raidType === '' ? null : payload.raidType
  payload.hostServerId = payload.isVirtual ? (payload.hostServerId || null) : null
  if (payload.isVirtual) {
    payload.manageUrl = null
  } else {
    payload.cpuCoresAllocated = null
    payload.memoryAllocatedGB = null
    payload.diskAllocatedGB = null
  }
  return payload
}

function resetForm(isVirtual: boolean) {
  Object.assign(formData, {
    id: 0, name: '', serverType: '本地', cloudAccount: '',
    internalIp: '', externalIp: '', port: '22',
    cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '',
    os: '', expireDate: null, purpose: '', account: '', dbAccount: '', dbPort: '',
    remark: '', manageUrl: null, status: '正常',
    manufacturer: '', model: '', serialNo: '', raidType: '', networkCards: '', warrantyEndDate: null,
    isVirtual, hypervisor: '', hostServerId: null,
    cpuCoresAllocated: null, memoryAllocatedGB: null, diskAllocatedGB: null,
  })
}

function handleAdd() {
  dialogTitle.value = '新增服务器'
  resetForm(false)
  dialogVisible.value = true
}

function handleAddVirtual(hostId?: number) {
  dialogTitle.value = '新增虚拟机'
  resetForm(true)
  if (hostId) formData.hostServerId = hostId
  dialogVisible.value = true
}

function handleEdit(row: any) {
  const s = row as ServerItem
  dialogTitle.value = '编辑服务器'
  resetForm(s.isVirtual)
  Object.assign(formData, s, {
    expireDate: s.expireDate || null,
    warrantyEndDate: s.warrantyEndDate || null,
    serialNo: s.serialNo || '',
    manageUrl: s.manageUrl || '',
    hypervisor: s.hypervisor || '',
    raidType: s.raidType || '',
    hostServerId: s.hostServerId ?? null,
  })
  dialogVisible.value = true
}

function handleSave() {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      const payload = buildPayload()
      if (formData.id === 0) {
        await addServer(payload)
        ElMessage.success('新增成功')
      } else {
        await updateServer(formData.id, payload)
        ElMessage.success('编辑成功')
      }
      dialogVisible.value = false
      // 仅当刷新成功时才同步 Drawer，避免用旧 tree/list 覆盖已确认数据
      const ok = await refreshWorkspace()
      if (ok) syncDrawerAfterRefresh()
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error))
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: any) {
  const s = row as ServerItem
  try {
    await ElMessageBox.confirm(`确定要删除"${s.name}"吗？${s.isVirtual ? '' : '（如仍有虚拟机将无法删除）'}`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteServer(s.id)
    ElMessage.success('删除成功')
    // 仅当刷新成功时才同步 Drawer，避免用旧 tree/list 覆盖已确认数据
    const ok = await refreshWorkspace()
    if (ok) syncDrawerAfterRefresh()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  }
}

/** 刷新后同步 Drawer：如果 selectedServer 已不存在则关闭 */
function syncDrawerAfterRefresh() {
  if (!drawerVisible.value || !selectedServer.value) return
  const updated = serverTree.value.find(s => s.id === selectedServer.value!.id)
    ?? serverList.value.find(s => s.id === selectedServer.value!.id)
  if (updated) {
    selectedServer.value = updated
  } else {
    drawerVisible.value = false
    selectedServer.value = null
  }
}

// —— 服务器凭据 ——
const passwordDialogVisible = ref(false)
const savingPassword = ref(false)
const viewingPassword = ref(false)
const passwordForm = reactive({ password: '', dbPassword: '' })
const passwordTarget = ref<ServerItem | null>(null)

function openPasswordDialog(row: any) {
  passwordTarget.value = row as ServerItem
  passwordForm.password = ''
  passwordForm.dbPassword = ''
  passwordDialogVisible.value = true
  // 默认进入设置/更新模式，不自动调用 view API
}

async function handleViewPassword() {
  if (!passwordTarget.value) return
  viewingPassword.value = true
  try {
    const data = await fetchServerPassword(passwordTarget.value.id)
    passwordForm.password = data.password
    passwordForm.dbPassword = data.dbPassword
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    viewingPassword.value = false
  }
}

async function handleSavePassword() {
  if (!passwordTarget.value) return
  if (!passwordForm.password && !passwordForm.dbPassword) {
    ElMessage.info('两个密码字段均为空，未做修改。如需清除请使用"清除已保存凭据"')
    return
  }
  savingPassword.value = true
  try {
    await updateServerPassword(passwordTarget.value.id, {
      ...(passwordForm.password ? { password: passwordForm.password } : {}),
      ...(passwordForm.dbPassword ? { dbPassword: passwordForm.dbPassword } : {}),
    })
    ElMessage.success('凭据已保存')
    passwordDialogVisible.value = false
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    savingPassword.value = false
  }
}

async function handleClearPassword() {
  if (!passwordTarget.value) return
  try {
    await ElMessageBox.confirm(
      `确定要清除服务器「${passwordTarget.value.name}」的所有已保存凭据吗？此操作不可撤销。`,
      '清除凭据确认',
      { confirmButtonText: '确定清除', cancelButtonText: '取消', type: 'warning' }
    )
    await updateServerPassword(passwordTarget.value.id, { password: '', dbPassword: '' })
    ElMessage.success('已清除所有凭据')
    passwordForm.password = ''
    passwordForm.dbPassword = ''
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 行操作“更多”下拉 + Drawer footer 操作 ——
function handleRowAction(cmd: string, row: ServerListItem) {
  switch (cmd) {
    case 'password': openPasswordDialog(row); break
    case 'manage': {
      const url = manageUrlOf(row)
      if (url) window.open(url, '_blank', 'noopener')
      break
    }
    case 'detail': goDetail(row.id); break
  }
}

function handleFooterAction(cmd: string) {
  if (cmd === 'detail' && selectedServer.value) {
    goDetail(selectedServer.value.id)
  } else if (cmd === 'credential' && selectedServer.value) {
    openPasswordDialog(selectedServer.value)
  }
}
</script>

<style scoped>
.quick-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  padding: 0 2px;
}
.quick-tip .el-icon { color: var(--color-info); }

.stat-row { margin-bottom: 0; }

.filter-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.tab-group { margin-right: 16px; }
.view-mode { margin-left: auto; }
.filter-count { font-size: var(--font-size-mini); color: var(--text-secondary); }

/* —— 两列卡片网格 —— */
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

.card-pagination {
  display: flex;
  justify-content: center;
  margin-top: var(--spacing-card);
}

.form-alert { margin-bottom: 16px; }
.form-tip {
  font-size: var(--font-size-small, 12px);
  color: var(--text-secondary);
  line-height: 1.4;
  margin-top: 4px;
}

.credential-account {
  font-family: var(--font-family-mono, monospace);
  color: var(--text-primary);
}

/* —— 树形列表信息着色 —— */
.tree-name { font-weight: 500; cursor: pointer; background: none; border: none; padding: 0; font: inherit; text-align: left; color: inherit; }
.tree-name:hover { text-decoration: underline; }
.tree-name:focus-visible { outline: 1px solid var(--color-primary); border-radius: var(--radius-small); }
.tree-link { color: var(--color-primary); cursor: pointer; text-decoration: none; background: none; border: none; padding: 0; font: inherit; text-align: left; }
.tree-link:hover { text-decoration: underline; }
.tree-link:focus-visible { outline: 1px solid var(--color-primary); border-radius: var(--radius-small); }

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
.text-secondary { color: var(--text-secondary); }

/* —— 抽屉内部 —— */
.drawer-section-title {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-lighter);
  padding-bottom: 8px;
}

.vm-compact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vm-compact-row {
  display: block;
  width: 100%;
  padding: 8px 10px;
  background: var(--bg-page);
  border: none;
  border-radius: var(--radius-input);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background 0.15s ease;
}
.vm-compact-row:hover { background: var(--bg-hover); }
.vm-compact-row:focus-visible { outline: 1px solid var(--color-primary); }
.vm-row-1 { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vm-row-1 .vm-name-text { font-weight: 500; color: var(--color-primary); }
.vm-row-2 { font-size: var(--font-size-mini); color: var(--text-secondary); margin-top: 2px; }
.vm-row-3 { font-size: var(--font-size-micro); color: var(--text-placeholder); margin-top: 2px; }
.vm-compact-more {
  display: block;
  width: 100%;
  text-align: center;
  font-size: var(--font-size-small);
  color: var(--color-primary);
  cursor: pointer;
  padding: 8px;
  border: none;
  border-top: 1px solid var(--border-lighter);
  background: none;
  font-family: inherit;
}
.vm-compact-more:hover { text-decoration: underline; }
.vm-compact-more:focus-visible { outline: 1px solid var(--color-primary); }

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

/* btn-link 已由 ActionButton variant="external" 替代 */
</style>
