/**
 * 截图构建脚本：临时启用 ssr:false 构建 CSR-only 产物用于截图。
 * 不修改 nuxt.config.ts 源文件——构建前临时插入 ssr: false，构建后立即恢复。
 * 用法：node scripts/build-and-screenshot.cjs
 *       node scripts/build-and-screenshot.cjs --skip-build  （跳过构建，直接启动已有 .output）
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const WEB_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(WEB_DIR, '.output');
const PORT = 3124;
const HOST = '127.0.0.1';
const SPA_MARKER = path.join(OUTPUT_DIR, 'server', 'chunks', 'virtual', '_virtual_spa-template.mjs');

function log(msg) { console.log(`[build-screenshot] ${msg}`); }

/** HTTP 健康检查：轮询直到服务器可连接或超时 */
function healthCheck(port, maxRetries = 20) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      const req = http.get(`http://${HOST}:${port}/`, (res) => {
        res.resume();
        if (res.statusCode > 0) {
          log(`健康检查通过（HTTP ${res.statusCode}）`);
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.setTimeout(3000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error(`服务器在 ${maxRetries * 500}ms 内未就绪`));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}

async function main() {
  const skipBuild = process.argv.includes('--skip-build');

  if (!skipBuild) {
    // 清理旧产物
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
      log('清理旧 .output');
    }

    // 临时插入 ssr: false（构建后立即恢复）
    const origConfigPath = path.join(WEB_DIR, 'nuxt.config.ts');
    const origContent = fs.readFileSync(origConfigPath, 'utf-8');

    if (origContent.includes('ssr: false')) {
      log('nuxt.config.ts 已包含 ssr: false，跳过临时覆盖');
    } else {
      const patched = origContent.replace(
        /(  \/\/ 构建优化)/,
        '  // ⚠ 临时截图构建覆盖（构建后自动恢复）\n  ssr: false,\n\n$1'
      );
      fs.writeFileSync(origConfigPath, patched, 'utf-8');
      log('临时插入 ssr: false');
    }

    try {
      log('开始 nuxt build...');
      execSync('npx nuxt build', { cwd: WEB_DIR, stdio: 'inherit', timeout: 180000 });
      log('构建完成');
    } finally {
      // 无论成功失败，都恢复原始配置
      fs.writeFileSync(origConfigPath, origContent, 'utf-8');
      log('已恢复 nuxt.config.ts 原始内容');
    }
  } else {
    log('跳过构建，使用已有 .output');
    if (!fs.existsSync(path.join(OUTPUT_DIR, 'server', 'index.mjs'))) {
      console.error('错误：.output 不存在，请先构建');
      process.exit(1);
    }
    if (fs.existsSync(SPA_MARKER)) {
      log('检测到 SPA 构建产物（ssr:false）');
    } else {
      log('警告：未检测到 SPA 标记，可能是 SSR 构建');
    }
  }

  // 启动 preview server
  log(`启动 preview server（${HOST}:${PORT}）...`);
  const server = spawn('node', [path.join(OUTPUT_DIR, 'server', 'index.mjs')], {
    cwd: WEB_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: HOST,
      NODE_ENV: 'production',
    },
  });

  let serverStderr = '';
  server.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    serverStderr += text;
    if (text.trim()) console.error(`[server stderr] ${text.trim()}`);
  });
  server.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    if (text.trim()) console.log(`[server] ${text.trim()}`);
  });
  server.on('exit', (code, signal) => {
    log(`server 进程退出（code=${code} signal=${signal}）`);
  });

  // 等待 server 就绪 + 健康检查
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('等待 "Listening" 超时（15s）'));
      }, 15000);

      server.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('Listening') || text.includes('listening')) {
          clearTimeout(timeout);
          log('检测到 "Listening" 消息');
          resolve();
        }
      });
      server.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('EADDRINUSE') || text.includes('EACCES')) {
          clearTimeout(timeout);
          reject(new Error(`端口/权限错误: ${text.trim()}`));
        }
      });
      server.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`server 启动后立即退出（code=${code}）\n${serverStderr}`));
        }
      });
    });

    // 额外等待 + 健康检查
    await new Promise((r) => setTimeout(r, 1000));
    await healthCheck(PORT);
    log('server 已就绪');
  } catch (err) {
    log(`server 启动失败: ${err.message}`);
    server.kill();
    process.exit(1);
  }

  // 运行截图脚本
  log('运行截图脚本...');
  let screenshotOk = true;
  try {
    execSync('node scripts/screenshot-design-stage.cjs', {
      cwd: WEB_DIR,
      stdio: 'inherit',
      timeout: 300000,
    });
    log('截图完成');
  } catch (err) {
    log(`截图脚本异常: ${err.message}`);
    screenshotOk = false;
  } finally {
    server.kill();
    log('server 已停止');
  }

  if (!screenshotOk) process.exit(1);
}

main().catch((err) => {
  console.error('构建截图失败:', err);
  process.exit(1);
});
