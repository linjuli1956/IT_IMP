/**
 * PDF打印 composable
 * 使用 pdfjs-dist 将PDF渲染为图片，通过HTML打印窗口实现A5排版打印
 * 依赖：pdfjs-dist（立项规划的业务库，按需引入）
 * 原理：PDF → canvas图片 → HTML打印窗口 → CSS @media print A5排版 → window.print()
 */

export function usePdfPrint() {
  /**
   * 渲染PDF为图片数组（每页一张图片）
   * @param url PDF文件路径
   * @returns data URL数组（JPEG格式）
   */
  async function renderPdfToImages(url: string): Promise<string[]> {
    // Polyfill: URL.parse 在旧浏览器中不存在
    if (typeof URL !== 'undefined' && !URL.parse) {
      URL.parse = function (u: string, base?: string) {
        try { return new URL(u, base) } catch { return null }
      } as any
    }

    // 动态导入 legacy 构建（兼容性更好），避免SSR问题
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const loadingTask = pdfjsLib.getDocument({ url })
    const pdf = await loadingTask.promise
    const images: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      // scale: 2 为高清渲染（相当于2倍DPI）
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      // Canvas API 不支持 CSS 变量，#ffffff = --color-white
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      images.push(canvas.toDataURL('image/jpeg', 0.92))
    }

    return images
  }

  /**
   * 打开打印窗口（A5排版，2张/张A4）并自动触发打印
   * 打印窗口为HTML页面（非PDF），window.print()可靠触发打印对话框
   * 打印完成后自动关闭窗口
   * @param images data URL数组
   */
  function printImages(images: string[]) {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) {
      throw new Error('弹出窗口被浏览器拦截，请允许弹窗后重试')
    }

    const imageHtml = images.map(img =>
      `<div class="page"><img src="${img}" /></div>`
    ).join('')

    win.document.write(`<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>打印</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; } /* 打印窗口独立文档，#fff = --color-white */
  .page {
    width: 210mm;
    height: 148mm;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* 2张A5排1张A4：仅偶数页后分页 */
  .page:nth-child(2n) {
    page-break-after: always;
  }
  .page:last-child {
    page-break-after: auto;
  }
  .page img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
</style>
</head>
<body>
${imageHtml}
</body>
</html>`)
    win.document.close()

    // 等待图片加载后自动打印
    // data URL 加载极快，1秒足够
    setTimeout(() => {
      try {
        win.focus()
        // window.print() 对HTML页面可靠触发打印对话框
        // print()是同步的，打印对话框关闭后才返回
        win.print()
        // 打印对话框关闭后自动关闭窗口
        win.close()
      } catch (e) {
        // 某些浏览器可能阻止win.close()
      }
    }, 1000)
  }

  return {
    renderPdfToImages,
    printImages,
  }
}
