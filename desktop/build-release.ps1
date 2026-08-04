param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"
$desktopDirectory = Split-Path -Parent $PSScriptRoot
$webDirectory = Join-Path $desktopDirectory "web"
$desktopSourceDirectory = Join-Path $desktopDirectory "desktop"

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $desktopSourceDirectory "build\release\IT_IMP-v0.0001"
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

$bunExecutable = Find-BunExecutable
$stagedBunExecutable = Join-Path $env:TEMP ("it-imp-bun-{0}.exe" -f $PID)
Copy-Item -LiteralPath $bunExecutable -Destination $stagedBunExecutable -Force

Write-Host "[1/5] Installing web dependencies and generating Prisma Client"
npm.cmd --prefix $webDirectory ci
npx.cmd --prefix $webDirectory prisma generate

Write-Host "[2/5] Building Nuxt server"
npm.cmd --prefix $webDirectory run build

Write-Host "[3/5] Building Wails EXE"
Push-Location $desktopSourceDirectory
try {
    wails build -clean
}
finally {
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
Copy-Item (Join-Path $desktopSourceDirectory "build\bin\config.json") (Join-Path $OutputDirectory "config.json") -ErrorAction SilentlyContinue
Copy-Item $stagedBunExecutable (Join-Path $releaseBunDirectory "bun.exe")

foreach ($directoryName in @(".output", "generated", "node_modules", "prisma", "scripts")) {
    Copy-Item (Join-Path $webDirectory $directoryName) (Join-Path $releaseWebDirectory $directoryName) -Recurse -Force
}
foreach ($fileName in @("package.json", "package-lock.json", "prisma.config.ts", "nuxt.config.ts")) {
    Copy-Item (Join-Path $webDirectory $fileName) (Join-Path $releaseWebDirectory $fileName) -Force
}

Write-Host "[5/5] Release package created: $OutputDirectory"
Write-Host "Launch: double-click platform-config.exe"
Remove-Item -LiteralPath $stagedBunExecutable -Force -ErrorAction SilentlyContinue
