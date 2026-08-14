/**
 * 各模块"记录快速预览"行构造（纯函数，可单测）
 * 约束：4~8 行（小程序精简版可更少）、敏感字段绝不进入、空值 —、0/false 正常显示、
 *       使用当前列表 DTO（禁止 hover API）。
 */
import type { PreviewRow } from '~/components/common/RecordPreviewTooltip.vue'
import { getExpireInfo, getCalibrationInfo } from './asset-utils'
import type { ServerListItem } from '~/types/server'
import type { NetworkDeviceItem } from '~/types/network-device'
import type { PhoneItem } from '~/types/phone'
import type { ComputerItem } from '~/types/computer'
import type { ScaleItem } from '~/types/scale'
import type { DomainItem } from '~/types/domain'
import type { MiniappItem } from '~/types/miniapp'
import type { PaymentConfigItem } from '~/types/payment'

/** 状态 → tone（全局统一） */
function statusTone(status: string): PreviewRow['tone'] {
  if (status === '正常') return 'success'
  if (status === '报废') return 'danger'
  return 'info'
}

/** 拼接非空片段（空值合并后整行显示 — 由 formatPreviewValue 兜底） */
function join(parts: Array<string | number | null | undefined>, sep = ' / '): string {
  return parts.filter(p => p !== null && p !== undefined && p !== '').join(sep)
}

/** 服务器（物理机/虚拟机）预览；0 值用 != null 判断，不含任何密码字段 */
export function buildServerPreviewRows(row: ServerListItem): PreviewRow[] {
  if (row.isVirtual) {
    return [
      { label: '身份', value: '虚拟机', tone: 'info' },
      { label: '宿主机/平台', value: join([row.hostServerName, row.hypervisor]) },
      { label: '内网IP', value: row.internalIp || '—' },
      { label: '系统/用途', value: join([row.os, row.purpose]) },
      { label: '分配资源', value: join([
        row.cpuCoresAllocated != null ? `${row.cpuCoresAllocated}核` : null,
        row.memoryAllocatedGB != null ? `${row.memoryAllocatedGB}GB` : null,
        row.diskAllocatedGB != null ? `${row.diskAllocatedGB}GB` : null,
      ]) },
      { label: '到期日期', value: row.expireDate || '—' },
      { label: '状态', value: row.status, tone: statusTone(row.status) },
    ]
  }
  return [
    { label: '身份', value: '物理机', tone: 'info' },
    { label: '厂商/型号/序列号', value: join([row.manufacturer, row.model, row.serialNo]) },
    { label: '内外网IP', value: join([row.internalIp, row.externalIp]) },
    { label: '系统/用途', value: join([row.os, row.purpose]) },
    { label: '平台/虚拟机', value: join([row.hypervisor, row.vmCount != null ? `${row.vmCount}台虚拟机` : null]) },
    { label: '保修到期', value: row.warrantyEndDate || '—' },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
  ]
}

/** 网络设备预览 */
export function buildDevicePreviewRows(row: NetworkDeviceItem): PreviewRow[] {
  return [
    { label: '门店', value: row.storeName || '—' },
    { label: '类型/管理', value: join([row.deviceType, row.manageType]) },
    { label: '品牌/型号/序列号', value: join([row.brand, row.model, row.serialNo]) },
    { label: 'IP/MAC', value: join([row.managementIp, row.macAddress]) },
    { label: '端口/上联', value: join([row.portCount != null ? `${row.portCount}口` : null, row.uplinkPort]) },
    { label: '固件/位置', value: join([row.firmwareVersion, row.installLocation]) },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
  ]
}

/** 域名预览（不显示主账号/主账号密码） */
export function buildDomainPreviewRows(row: DomainItem): PreviewRow[] {
  const expire = getExpireInfo(row.certExpireDate)
  return [
    { label: '证书类型/机构', value: join([row.certType, row.certIssuer]) },
    { label: '更换/到期日期', value: join([row.certRenewDate, row.certExpireDate]) },
    {
      label: '剩余天数',
      value: expire.days !== null ? `${expire.days} 天` : '—',
      tone: expire.tagType === 'danger' ? 'danger' : expire.tagType === 'warning' ? 'warning' : 'info',
    },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
    { label: '备注', value: row.remark || '—' },
  ]
}

/** 小程序预览（精简版，不显示邮箱密码） */
export function buildMiniappPreviewRows(row: MiniappItem): PreviewRow[] {
  return [
    { label: '绑定邮箱', value: row.email || '—' },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
    { label: '备注', value: row.remark || '—' },
  ]
}

/** 固话预览（门店/部门/号码/运营商/状态） */
export function buildPhonePreviewRows(row: PhoneItem): PreviewRow[] {
  return [
    { label: '门店', value: row.storeName || '—' },
    { label: '部门', value: row.department || '—' },
    { label: '号码/分机', value: join([row.phoneNumber, row.extension]) },
    { label: '运营商', value: row.carrier || '—' },
    { label: '月租', value: row.monthlyFee != null ? `¥${row.monthlyFee}` : '—' },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
    { label: '备注', value: row.remark || '—' },
  ]
}

/** 电脑预览（资产编号/门店/使用人/配置/IP/保修/状态） */
export function buildComputerPreviewRows(row: ComputerItem): PreviewRow[] {
  const expire = row.warrantyEndDate ? getExpireInfo(row.warrantyEndDate) : null
  return [
    { label: '资产编号', value: row.assetNo || '—' },
    { label: '门店', value: row.storeName || '—' },
    { label: '使用人', value: row.user || '—' },
    { label: '品牌/型号', value: join([row.brand, row.model]) },
    { label: '配置', value: join([
      row.cpuModel || row.cpuCores != null ? (row.cpuModel ?? (row.cpuCores != null ? `${row.cpuCores}核` : null)) : null,
      row.memoryGB != null ? `${row.memoryGB}GB` : null,
      row.diskSizeGB != null ? `${row.diskSizeGB}GB` : null,
      row.diskType,
    ]) },
    { label: 'IP', value: row.ipAddress || '—' },
    {
      label: '保修到期',
      value: expire ? `${row.warrantyEndDate} (${expire.days}天)` : '—',
      tone: expire?.tagType === 'danger' ? 'danger' : expire?.tagType === 'warning' ? 'warning' : undefined,
    },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
  ]
}

/** 电子称预览（资产编号/门店/型号/位置/校准/状态；校准用 getCalibrationInfo 统一语义） */
export function buildScalePreviewRows(row: ScaleItem): PreviewRow[] {
  const calib = getCalibrationInfo(row.nextCalibrationDate, row.status)
  return [
    { label: '资产编号', value: row.assetNo || '—' },
    { label: '门店', value: row.storeName || '—' },
    { label: '秤号/IP', value: join([row.scaleNo, row.ipAddress]) },
    { label: '品牌/型号', value: join([row.brand, row.model]) },
    { label: '量程/精度', value: join([
      row.capacityKg != null ? `${row.capacityKg}kg` : null,
      row.precisionG != null ? `${row.precisionG}g` : null,
    ]) },
    { label: '位置', value: row.installLocation || '—' },
    { label: '上次/下次校准', value: join([row.lastCalibrationDate, row.nextCalibrationDate]) },
    { label: '校准状态', value: calib.label, tone: calib.tone ?? undefined },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
  ]
}

/** 支付配置预览（不显示敏感 configValue，即使已解密也不进 tooltip） */
export function buildPaymentPreviewRows(row: PaymentConfigItem): PreviewRow[] {
  return [
    { label: '门店/机构', value: join([row.storeName, row.storeId != null ? `#${row.storeId}` : null]) },
    { label: '支付方式/服务商', value: join([row.payMethodName || row.payMethod, row.provider]) },
    { label: '配置项/POS', value: join([row.configName, row.posNo]) },
    { label: '类型', value: row.isSensitive ? '敏感' : '普通', tone: row.isSensitive ? 'warning' : 'info' },
    { label: '状态', value: row.status, tone: statusTone(row.status) },
  ]
}
