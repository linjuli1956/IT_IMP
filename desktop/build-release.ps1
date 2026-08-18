param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$desktopDirectory = Split-Path -Parent $PSScriptRoot
$webDirectory = Join-Path $desktopDirectory "web"
$desktopSourceDirectory = Join-Path $desktopDirectory "desktop"
$versionFile = Join-Path $desktopDirectory "VERSION"

# === fail-fast helper ===
function Check-ExitCode {
    param($Code)
    if ($Code -ne 0) {
        Write-Error "外部命令退出码：$Code。构建中止，不生成/保留发布包。"
        # 尽可能移除半生成的包目录
        if (-not [string]::IsNullOrWhiteSpace($OutputDirectory) -and (Test-Path -LiteralPath $OutputDirectory)) {
            Remove-Item -LiteralPath $OutputDirectory -Recurse -Force -ErrorAction SilentlyContinue
        }
        throw "外部命令失败：$code"
    }
}

if (-not (Test-Path -LiteralPath $versionFile)) {
    throw "Version file was not found: $versionFile"
}
$releaseVersion = (Get-Content -LiteralPath $versionFile -Raw).Trim()
if ($releaseVersion -notmatch '^\d{8}$') {
    throw "VERSION must use YYYYMMDD format, for example 20260818. Current value: $releaseVersion"
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $desktopSourceDirectory ("build\release\IT_IMP-" + $releaseVersion)
}

function Find-BunExecutable {
    $candidates = @(
        $env:BUN_EXE,
        (Join-Path $env:USERPROFILE ".bun\bin\bun.exe"),
        (Join-Path $desktopSourceDirectory "build\bin\bun\bun.exe")
    )
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    $command = Get-Command bun.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }
    throw "Bun was not found. Install Bun for Windows or set the BUN_EXE environment variable."
}

function Ensure-GoAvailable {
    if (Get-Command go.exe -ErrorAction SilentlyContinue) {
        return
    }
    $defaultGoBin = "C:\Program Files\Go\bin"
    if (Test-Path -LiteralPath (Join-Path $defaultGoBin "go.exe")) {
        $env:PATH = $defaultGoBin + ";" + $env:PATH
        return
    }
    throw "Go was not found. Install Go for Windows and ensure go.exe is available."
}

function Find-WailsExecutable {
    $candidates = @(
        (Get-Command wails.exe -ErrorAction SilentlyContinue | ForEach-Object Source),
        (Join-Path $env:USERPROFILE "go\bin\wails.exe")
    )
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw "Wails was not found. Install Wails with: go install github.com/wailsapp/wails/v2/cmd/wails@v2.13.0"
}

$null = Ensure-GoAvailable
$wailsExecutable = Find-WailsExecutable
$bunExecutable = Find-BunExecutable
$stagedBunExecutable = Join-Path $env:TEMP ("it-imp-bun-{0}.exe" -f $PID)
Copy-Item -LiteralPath $bunExecutable -Destination $stagedBunExecutable -Force

Write-Host "[1/5] Installing web dependencies and generating Prisma Client"
npm.cmd --prefix $webDirectory ci
Check-ExitCode $LASTEXITCODE

# Prisma generate 必须在 webDirectory 中执行（--prefix 不切换 cwd）
$currentDir = Get-Location
Push-Location $webDirectory
try {
    npx.cmd prisma generate
    Check-ExitCode $LASTEXITCODE
} finally {
    Pop-Location
    Set-Location $currentDir
}

Write-Host "[2/5] Building Nuxt server"
npm.cmd --prefix $webDirectory run build
Check-ExitCode $LASTEXITCODE

Write-Host "[3/5] Building Wails EXE"
Push-Location $desktopSourceDirectory
try {
    & $wailsExecutable build -clean -ldflags ("-X main.BuildVersion=" + $releaseVersion)
    Check-ExitCode $LASTEXITCODE
} finally {
    Pop-Location
}

Write-Host "[4/5] Preparing release directory"
if (Test-Path -LiteralPath $OutputDirectory) {
    Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$releaseWebDirectory = Join-Path $OutputDirectory "web"
$releaseBunDirectory = Join-Path $OutputDirectory "bun"
New-Item -ItemType Directory -Path $releaseWebDirectory,$releaseBunDirectory -Force | Out-Null

Copy-Item (Join-Path $desktopSourceDirectory "build\bin\platform-config.exe") (Join-Path $OutputDirectory "platform-config.exe")
# 注意：不复制 config.json —— 它含用户数据库密码等敏感配置，且只应在首次运行配置工具时于目标机生成
Copy-Item $stagedBunExecutable (Join-Path $releaseBunDirectory "bun.exe")

foreach ($directoryName in @(".output", "generated", "node_modules", "prisma")) {
    Copy-Item (Join-Path $webDirectory $directoryName) (Join-Path $releaseWebDirectory $directoryName) -Recurse -Force
}
# 运行时仅需要 bootstrap-admin.mjs（首次启动引导管理员账号），截图/演示等开发脚本不进发布包
New-Item -ItemType Directory -Path (Join-Path $releaseWebDirectory "scripts") -Force | Out-Null
Copy-Item (Join-Path $webDirectory "scripts\bootstrap-admin.mjs") (Join-Path $releaseWebDirectory "scripts\bootstrap-admin.mjs") -Force
foreach ($fileName in @("package.json", "package-lock.json", "prisma.config.ts", "nuxt.config.ts")) {
    Copy-Item (Join-Path $webDirectory $fileName) (Join-Path $releaseWebDirectory $fileName) -Force
}

Write-Host "[5/5] Release package created: $OutputDirectory"
Write-Host "Launch: double-click platform-config.exe"
Remove-Item -LiteralPath $stagedBunExecutable -Force -ErrorAction SilentlyContinue
