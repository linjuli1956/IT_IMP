/**
 * PDF 文本提取模块
 * 使用 pdfjs-dist v4.10.38 的 legacy/build/pdf.mjs 入口
 * extractPdfText(buffer): 逐页 getTextContent，按坐标排序拼接文本行
 */
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'

// Node.js 环境下设置 Worker 绝对路径，避免 Nitro 打包后相对路径失效
// Windows 下必须转成 file:// URL，否则 ESM loader 将盘符 E: 误解为协议
try {
  const require = createRequire(import.meta.url)
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
} catch {
  GlobalWorkerOptions.workerSrc = ''
}

/**
 * 从 PDF Buffer 提取文本
 * 逐页读取，按 Y 降序（从上到下）+ X 升序（从左到右）排序
 * 同一行的文本项用空格拼接，不同行换行
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer)
  const doc = await getDocument({
    data,
    useSystemFonts: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise

  const lines: string[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()

    // 按 Y 降序（视觉上从上到下）+ X 升序（从左到右）排序
    const items = (content.items as any[])
      .filter(item => 'str' in item && 'transform' in item)
      .map(item => ({
        str: item.str as string,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
        hasEOL: (item.hasEOL ?? false) as boolean,
      }))
      .sort((a, b) => {
        // Y 降序（PDF 坐标系 Y 向上，值越大越靠上）
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y
        // 同行按 X 升序
        return a.x - b.x
      })

    // 按行分组：Y 差值 ≤ 2 视为同一行
    let currentLine = ''
    let currentY: number | null = null

    for (const item of items) {
      if (currentY !== null && Math.abs(item.y - currentY) > 2) {
        // 换行
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = ''
      }
      currentY = item.y
      if (item.hasEOL) {
        currentLine += item.str
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = ''
        currentY = null
      } else {
        // 同行文本项之间加空格（如果当前行末尾不是空格/标点）
        if (currentLine && !currentLine.endsWith(' ') && item.str && !item.str.startsWith(' ')) {
          currentLine += ' '
        }
        currentLine += item.str
      }
    }
    // 页面最后一行
    if (currentLine.trim()) lines.push(currentLine.trim())

    // 页面间加空行
    if (pageNum < doc.numPages) lines.push('')
  }

  await doc.destroy()
  return lines.join('\n')
}
