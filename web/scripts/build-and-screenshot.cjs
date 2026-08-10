/**
 * 截图构建脚本：基于正常 SSR 构建产物截图（不修改 nuxt.config.ts）。
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

    // 正常 SSR 构建（不修改 nuxt.config.ts）
    log('开始 nuxt build（SSR 模式）...');
    execSync('npx nuxt build', { cwd: WEB_DIR, stdio: 'inherit', timeout: 180000 });
    log('构建完成');
  } else {
    log('跳过构建，使用已有 .output');
    if (!fs.existsSync(path.join(OUTPUT_DIR, 'server', 'index.mjs'))) {
      console.error('错误：.output 不存在，请先构建');
      process.exit(1);
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

  // 运行截图脚本（可指定 --screenshots=design,service 或默认全部）
  const shotArg = process.argv.find(a => a.startsWith('--screenshots='));
  const scripts = shotArg
    ? shotArg.split('=')[1].split(',').map(s => `scripts/screenshot-${s}.cjs`)
    : ['scripts/screenshot-design-stage.cjs', 'scripts/screenshot-service-assets.cjs'];

  let screenshotOk = true;
  try {
    for (const script of scripts) {
      log(`运行 ${script}...`);
      try {
        execSync(`node ${script}`, { cwd: WEB_DIR, stdio: 'inherit', timeout: 300000 });
        log(`${script} 完成`);
      } catch (err) {
        log(`${script} 异常: ${err.message}`);
        screenshotOk = false;
      }
    }
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
