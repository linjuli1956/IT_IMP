<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  GenerateJWTSecret, GetConfig, SaveAppName, SaveDatabaseConfig, SaveWebPort, SaveJWTSecret,
  TestConnection, InitDatabase, UpgradeDatabase, GetDatabaseStatus,
  ProvisionInitialAdmin, ResetAdminPassword, StartService, StopService, GetServiceStatus
} from '../wailsjs/go/main/App'
import { EventsOn } from '../wailsjs/runtime/runtime'
import InitialAdminConfig from './components/InitialAdminConfig.vue'
import DatabaseStatusSummary from './components/DatabaseStatusSummary.vue'

const dbConfig = ref({ host: '', port: 3306, username: 'root', password: '', dbname: 'it_imp' })
const passwordConfigured = ref(false)
const defaultAppName = '综合管理平台'
const appName = ref(defaultAppName)
const configToolTitle = computed(() => `${appName.value.trim() || defaultAppName}-配置工具V0.01`)
const jwtSecret = ref('')
const initialAdmin = ref({ username: 'admin', password: '123456' })
const webPort = ref(3000)
const activeTab = ref('database')
const serviceRunning = ref(false)
const testing = ref(false)
const initializing = ref(false)
const upgrading = ref(false)
const provisioningAdmin = ref(false)
const resettingAdmin = ref(false)
const starting = ref(false)
const stopping = ref(false)
const logs = ref([])
const logContainer = ref(null)
const dbStatus = ref({ status: 'uninitialized', migrationCount: 0, lastInitTime: '', lastUpgradeTime: '', message: '' })

onMounted(async () => {
  try {
    const config = await GetConfig()
    if (config?.appName) appName.value = config.appName
    if (config?.database) {
      dbConfig.value.host = config.database.host || ''
      dbConfig.value.port = config.database.port || 3306
      dbConfig.value.username = config.database.username || 'root'
      dbConfig.value.dbname = config.database.dbname || 'it_imp'
      passwordConfigured.value = Boolean(config.database.passwordConfigured)
      // 密码不从配置返回，保持为空；已保存状态单独展示。
    }
    if (config?.webPort) webPort.value = config.webPort
    if (config?.jwtSecret) jwtSecret.value = config.jwtSecret
  } catch (e) { /* 使用默认配置 */ }

  serviceRunning.value = await GetServiceStatus()
  await refreshDbStatus()

  EventsOn('log', (msg) => {
    logs.value.push(msg)
    if (logs.value.length > 500) logs.value = logs.value.slice(-500)
    nextTick(() => {
      if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
    })
  })
})

const refreshDbStatus = async () => {
  try {
    dbStatus.value = await GetDatabaseStatus()
  } catch (e) {
    dbStatus.value = { status: 'connection_failed', migrationCount: 0, lastInitTime: '', lastUpgradeTime: '', message: '无法获取数据库状态' }
  }
}

const handleTestConnection = async () => {
  testing.value = true
  try {
    const result = await TestConnection(dbConfig.value.host, dbConfig.value.port, dbConfig.value.username, dbConfig.value.password, dbConfig.value.dbname)
    if (result.includes('连接成功')) {
      ElMessage.success(result)
    } else {
      ElMessage.warning(result)
    }
    await refreshDbStatus()
  } catch (e) { ElMessage.error('测试失败: ' + e) }
  testing.value = false
}

const handleSaveDbConfig = async () => {
  try {
    await SaveAppName(appName.value)
    await SaveDatabaseConfig(dbConfig.value.host, dbConfig.value.port, dbConfig.value.username, dbConfig.value.password, dbConfig.value.dbname)
    await SaveJWTSecret(jwtSecret.value)
    if (dbConfig.value.password) {
      passwordConfigured.value = true
      dbConfig.value.password = ''
    }
    ElMessage.success('数据库配置已保存（密码已加密存储）')
    await refreshDbStatus()
  } catch (e) { ElMessage.error('保存失败: ' + e) }
}

const handleGenerateJWTSecret = async () => {
  try {
    jwtSecret.value = await GenerateJWTSecret()
    ElMessage.success('已生成 JWT 密钥，请点击“保存配置”')
  } catch (e) {
    ElMessage.error('生成 JWT 密钥失败: ' + e)
  }
}

const handleInitDatabase = async () => {
  // 输入库名确认（GitHub 删仓库风格）
  try {
    await ElMessageBox.prompt(
      `即将初始化数据库：\n\n远程主机: ${dbConfig.value.host}:${dbConfig.value.port}\n数据库名: ${dbConfig.value.dbname}\n用户名: ${dbConfig.value.username}\n首次管理员: ${initialAdmin.value.username}\n\n此操作将：\n1. 删除并重建数据库（如已存在，所有数据将被清除）\n2. 创建全部业务表（Prisma 迁移）\n3. 创建首次管理员，不写入业务或演示数据\n\n⚠️ 此操作不可逆，请确认远程 MySQL 服务器已就绪。\n\n请输入数据库名「${dbConfig.value.dbname}」以确认：`,
      '危险操作确认',
      {
        type: 'error',
        confirmButtonText: '确认初始化（不可逆）',
        cancelButtonText: '取消',
        inputPlaceholder: '请输入数据库名以确认（区分大小写）',
        inputValidator: (val) => val === dbConfig.value.dbname || '输入的数据库名不匹配，请重新输入',
      }
    )
  } catch { return }

  initializing.value = true
  try {
    // 先保存配置（确保平台名称、密码和 JWT 密钥已保存）
    await SaveAppName(appName.value)
    await SaveDatabaseConfig(dbConfig.value.host, dbConfig.value.port, dbConfig.value.username, dbConfig.value.password, dbConfig.value.dbname)
    await SaveJWTSecret(jwtSecret.value)
    const result = await InitDatabase(initialAdmin.value.username, initialAdmin.value.password)
    if (result.includes('成功')) {
      await ElMessageBox.alert(
        `数据库初始化成功！\n\n已创建全部表结构和首次管理员。\n登录账号：${initialAdmin.value.username}\n请使用刚才填写的密码登录，并在首次登录后及时修改密码。`,
        '初始化成功',
        { type: 'success', confirmButtonText: '知道了' }
      )
    } else {
      ElMessage.error(result)
    }
    await refreshDbStatus()
  } catch (e) { ElMessage.error('初始化失败: ' + e) }
  initializing.value = false
}

const handleUpgradeDatabase = async () => {
  // 如果服务正在运行，提示先停止
  if (serviceRunning.value) {
    try {
      await ElMessageBox.confirm(
        'Web 服务正在运行，升级数据库前需要先停止服务。是否自动停止服务并继续升级？',
        '服务运行中',
        { type: 'warning', confirmButtonText: '停止服务并升级', cancelButtonText: '取消' }
      )
      const stopResult = await StopService()
      if (stopResult.includes('已停止')) {
        serviceRunning.value = false
      } else {
        ElMessage.warning(stopResult)
        return
      }
    } catch { return }
  }

  // 二次确认
  try {
    await ElMessageBox.confirm(
      `即将升级数据库：\n\n远程主机: ${dbConfig.value.host}:${dbConfig.value.port}\n数据库名: ${dbConfig.value.dbname}\n\n此操作将：\n1. 执行 Prisma 迁移部署（仅更新表结构）\n2. 不导入预置数据，不清空数据\n\n如果没有待执行的迁移，将提示「数据库已是最新版本」。`,
      '确认升级数据库',
      { type: 'warning', confirmButtonText: '确定升级', cancelButtonText: '取消' }
    )
  } catch { return }

  upgrading.value = true
  try {
    const result = await UpgradeDatabase()
    if (result.includes('成功')) {
      ElMessage.success(result)
    } else {
      ElMessage.error(result)
    }
    await refreshDbStatus()
  } catch (e) { ElMessage.error('升级失败: ' + e) }
  upgrading.value = false
}

const handleResetAdminPassword = async () => {
  try {
    await ElMessageBox.confirm(
      `即将重置管理员「${initialAdmin.value.username}」的登录密码。\n\n不会重建数据库，不会删除业务数据，也不会影响其他用户。\n\n请确认“初始密码”输入框中已填写新的临时密码。`,
      '重置管理员密码',
      { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
    )
  } catch { return }

  resettingAdmin.value = true
  try {
    const result = await ResetAdminPassword(initialAdmin.value.username, initialAdmin.value.password)
    if (result.includes('成功')) ElMessage.success(result)
    else ElMessage.error(result)
  } catch (e) { ElMessage.error('重置失败: ' + e) }
  resettingAdmin.value = false
}

const handleProvisionInitialAdmin = async () => {
  try {
    await ElMessageBox.confirm(
      `将检查数据库是否还没有任何用户。\n\n若没有用户，会创建首次管理员「${initialAdmin.value.username}」。\n若已有用户，则不会修改账号、密码或业务数据。\n\n不会删除数据库。`,
      '补建首次管理员',
      { type: 'info', confirmButtonText: '确认补建', cancelButtonText: '取消' }
    )
  } catch { return }

  provisioningAdmin.value = true
  try {
    const result = await ProvisionInitialAdmin(initialAdmin.value.username, initialAdmin.value.password)
    if (result.includes('完成')) ElMessage.success(result)
    else ElMessage.error(result)
  } catch (e) { ElMessage.error('补建失败: ' + e) }
  provisioningAdmin.value = false
}

const handleSavePort = async () => {
  try {
    await SaveWebPort(webPort.value)
    ElMessage.success('端口配置已保存')
  } catch (e) { ElMessage.error('保存失败: ' + e) }
}

const handleStart = async () => {
  starting.value = true
  try {
    const result = await StartService()
    if (result.includes('已启动')) { ElMessage.success(result); serviceRunning.value = true }
    else ElMessage.warning(result)
  } catch (e) { ElMessage.error('启动失败: ' + e) }
  starting.value = false
}

const handleStop = async () => {
  stopping.value = true
  try {
    const result = await StopService()
    if (result.includes('已停止')) { ElMessage.success(result); serviceRunning.value = false }
    else ElMessage.warning(result)
  } catch (e) { ElMessage.error('停止失败: ' + e) }
  stopping.value = false
}

const handleClearLogs = () => { logs.value = [] }
</script>

<template>
  <div class="app-container">
    <div class="app-header">
      <h1>{{ configToolTitle }}</h1>
    </div>

    <el-tabs v-model="activeTab" class="app-tabs">
      <!-- 数据库配置 -->
      <el-tab-pane label="数据库配置" name="database">
        <el-form :model="dbConfig" label-width="100px" class="config-form">
          <el-form-item label="平台名称">
            <el-input v-model="appName" :placeholder="defaultAppName" />
          </el-form-item>
          <el-form-item label="数据库主机">
            <el-input v-model="dbConfig.host" placeholder="请填写远程 MySQL 服务器 IP 或域名" />
          </el-form-item>
          <el-form-item label="端口">
            <el-input-number v-model="dbConfig.port" :min="1" :max="65535" controls-position="right" />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="dbConfig.username" placeholder="root" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="dbConfig.password"
              type="password"
              show-password
              :placeholder="passwordConfigured ? '密码已保存；如需更换请输入新密码' : '请输入数据库密码（加密保存到本机）'"
            />
            <el-text v-if="passwordConfigured" type="info" size="small">
              密码已使用 Windows 加密保存，为安全起见不会回显；留空不会覆盖已保存的密码。
            </el-text>
          </el-form-item>
          <el-form-item label="JWT密钥">
            <el-input v-model="jwtSecret" type="password" show-password placeholder="用于登录认证；可点击右侧随机生成">
              <template #append>
                <el-button @click="handleGenerateJWTSecret">随机生成</el-button>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="数据库名">
            <el-input v-model="dbConfig.dbname" placeholder="it_imp" />
          </el-form-item>
          <InitialAdminConfig v-model="initialAdmin" />
          <el-form-item>
            <el-button type="primary" @click="handleSaveDbConfig">保存配置</el-button>
            <el-button type="success" @click="handleTestConnection" :loading="testing">测试连接</el-button>
          </el-form-item>
        </el-form>

        <!-- 数据库状态区域 -->
        <el-card class="db-status-card" shadow="never">
          <template #header>
            <div class="db-status-header">
              <span>数据库操作</span>
              <el-button size="small" text @click="refreshDbStatus">刷新状态</el-button>
            </div>
          </template>
          <DatabaseStatusSummary :status="dbStatus" />
          <div class="db-actions">
            <el-button type="warning" @click="handleInitDatabase" :loading="initializing" :disabled="!dbConfig.host">初始化数据库</el-button>
            <el-button type="info" @click="handleUpgradeDatabase" :loading="upgrading" :disabled="!dbConfig.host">升级数据库</el-button>
            <el-button type="primary" plain @click="handleProvisionInitialAdmin" :loading="provisioningAdmin" :disabled="dbStatus.status !== 'initialized'">补建首次管理员</el-button>
            <el-button type="danger" plain @click="handleResetAdminPassword" :loading="resettingAdmin" :disabled="!dbConfig.host">重置管理员密码</el-button>
          </div>
        </el-card>

        <el-alert title="使用说明" type="info" :closable="false" show-icon>
          <ol class="usage-steps">
            <li>填写平台名称、远程 MySQL 服务器连接信息（主机、端口、用户名、密码、数据库名）和 JWT 密钥</li>
            <li>点击「保存配置」— 密码使用 Windows 加密方式保存在本机，不写入明文文件</li>
            <li>JWT 密钥用于登录认证，未配置时服务无法启动</li>
            <li>点击「测试连接」确认能连上远程 MySQL 服务器</li>
            <li>首次部署点击「初始化数据库」— 重建数据库、创建表结构和首次管理员，不写入业务或演示数据（会清除已有数据）</li>
            <li>后续版本更新点击「升级数据库」— 仅更新表结构，不导入预置数据</li>
            <li>旧环境已建表但没有用户时，点击「补建首次管理员」；它不删库、不升级、不覆盖已有账号</li>
            <li>忘记唯一管理员密码时，在“初始密码”填写新临时密码后点击「重置管理员密码」；数据库必须可连接，该操作不会清空数据</li>
            <li>数据库密码不会出现在日志中</li>
          </ol>
        </el-alert>
      </el-tab-pane>

      <!-- 服务管理 -->
      <el-tab-pane label="服务管理" name="service">
        <el-form label-width="100px" class="config-form">
          <el-form-item label="Web端口">
            <el-input-number v-model="webPort" :min="1" :max="65535" controls-position="right" />
            <el-button type="primary" @click="handleSavePort" style="margin-left: 12px">保存</el-button>
          </el-form-item>
          <el-form-item label="服务状态">
            <el-tag :type="serviceRunning ? 'success' : 'info'" size="large">
              {{ serviceRunning ? '● 运行中' : '○ 已停止' }}
            </el-tag>
          </el-form-item>
          <el-form-item>
            <el-button type="success" @click="handleStart" :disabled="serviceRunning" :loading="starting">启动服务</el-button>
            <el-button type="danger" @click="handleStop" :disabled="!serviceRunning" :loading="stopping">停止服务</el-button>
          </el-form-item>
        </el-form>

        <el-alert title="服务说明" type="info" :closable="false" show-icon>
          <p>启动后可通过浏览器访问：<strong>http://localhost:{{ webPort }}</strong></p>
          <p>局域网其他电脑访问：<strong>http://本机IP:{{ webPort }}</strong></p>
          <p>如需修改端口，请先停止服务再修改。</p>
        </el-alert>
      </el-tab-pane>

      <!-- 运行日志 -->
      <el-tab-pane label="运行日志" name="logs">
        <div class="logs-toolbar">
          <el-button size="small" @click="handleClearLogs">清空日志</el-button>
          <span class="log-count">共 {{ logs.length }} 条</span>
        </div>
        <div ref="logContainer" class="logs-container">
          <pre v-for="(log, i) in logs" :key="i">{{ log }}</pre>
          <div v-if="logs.length === 0" class="logs-empty">暂无日志，启动服务后可查看运行日志</div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.app-container { padding: 20px; }
.app-header { display: flex; align-items: center; margin-bottom: 20px; gap: 12px; }
.app-header h1 { font-size: var(--font-size-title); color: var(--text-primary); margin: 0; }
.app-header .version { font-size: var(--font-size-mini); color: var(--text-secondary); background: var(--bg-subtle); padding: 2px 8px; border-radius: var(--radius-btn); }
.config-form { max-width: 480px; margin-bottom: 20px; }
.db-status-card { max-width: 580px; margin-bottom: 20px; }
.db-status-header { display: flex; align-items: center; justify-content: space-between; font-weight: 600; color: var(--text-primary); }
.db-actions { margin-top: 12px; display: flex; gap: 12px; }
.usage-steps { margin: 5px 0; padding-left: 20px; line-height: 1.8; }
.logs-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.log-count { font-size: var(--font-size-small); color: var(--text-secondary); }
.logs-container {
  background: var(--bg-log); color: var(--text-log); padding: 12px; border-radius: var(--radius-card);
  height: 380px; overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: var(--font-size-small);
}
.logs-container pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
.logs-empty { color: var(--text-log-dim); text-align: center; padding: 40px; }
</style>
