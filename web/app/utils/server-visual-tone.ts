/**
 * 服务器视觉 Tone 统一映射（三卡片 + 树形/分页列表共用，禁止各页面另写一套）。
 * 业务语义：VM 按平台（PVE 蓝 / ESXi 橙，平台继承自宿主）；
 *           物理机按 hypervisor（PVE/ESXi）优先，否则按 serverType（阿里云橙黄/腾讯云绿/华为云紫/本地灰蓝）。
 */

/** Tone 键：与 tokens.css 的 --tone-<key>-{bg,border,text} 对应 */
export type ServerTone = 'pve' | 'esxi' | 'aliyun' | 'tencent' | 'huawei' | 'local' | 'other'

export interface ServerToneValue {
  /** 平台显示文案（PVE / ESXi / null） */
  platform: 'PVE' | 'ESXi' | null
  tone: ServerTone
}

export interface VisualServerLike {
  isVirtual?: boolean
  hypervisor?: string | null
  serverType?: string | null
}

/** 归一化平台：PVE / ESXi / null */
export function platformOf(server: VisualServerLike): 'PVE' | 'ESXi' | null {
  const hv = (server.hypervisor || '').toUpperCase()
  if (hv.includes('PVE')) return 'PVE'
  if (hv.includes('ESXI')) return 'ESXi'
  return null
}

/**
 * 服务器视觉 Tone 映射（唯一来源）。
 * - 物理机：PVE 蓝 → ESXi 橙 → 云厂商/本地按 serverType → other
 * - 虚拟机：按平台（继承自宿主）
 */
export function serverVisualTone(server: VisualServerLike): ServerToneValue {
  const platform = platformOf(server)
  if (platform) return { platform, tone: platform === 'PVE' ? 'pve' : 'esxi' }

  if (!server.isVirtual) {
    switch (server.serverType) {
      case '阿里云': return { platform: null, tone: 'aliyun' }
      case '腾讯云': return { platform: null, tone: 'tencent' }
      case '华为云': return { platform: null, tone: 'huawei' }
      case '本地': return { platform: null, tone: 'local' }
      default: return { platform: null, tone: 'other' }
    }
  }
  return { platform: null, tone: 'other' }
}

/** 生成卡片 class：`server-tone-pve` 等（配合全局 CSS 使用 --tone-* 变量） */
export function serverToneClass(server: VisualServerLike): string {
  return `server-tone-${serverVisualTone(server).tone}`
}
