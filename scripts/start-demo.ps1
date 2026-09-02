param(
  [ValidateRange(1, 65535)]
  [int]$Port = 41737
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$demoUrl = "http://127.0.0.1:$Port"
$logDirectory = Join-Path $env:TEMP "ggstarrail-demo"
$mutex = [System.Threading.Mutex]::new($false, "Local\GGStarRailDemo-$Port")
$mutexAcquired = $false

function Test-GGStarRailEndpoint {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$Url/" -TimeoutSec 2
    return $response.StatusCode -eq 200 -and
      $response.Content.Contains("<title>GGStarRail</title>")
  } catch {
    return $false
  }
}

function Test-GGStarRailProcess {
  param([int]$ProcessId)

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
  $commandLine = if ($process) { [string]$process.CommandLine } else { "" }
  return $commandLine -and
    $commandLine.IndexOf(
      $projectRoot,
      [System.StringComparison]::OrdinalIgnoreCase
    ) -ge 0
}

try {
  $mutexAcquired = $mutex.WaitOne([TimeSpan]::FromSeconds(15))
  if (-not $mutexAcquired) {
    throw "Timed out waiting for another GGStarRail demo start to finish."
  }

  $existing = Get-NetTCPConnection `
    -LocalAddress "127.0.0.1" `
    -LocalPort $Port `
    -State Listen `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if ($existing) {
    if (-not (Test-GGStarRailProcess -ProcessId $existing.OwningProcess)) {
      throw "Port $Port is already used by another process."
    }
    if (-not (Test-GGStarRailEndpoint -Url $demoUrl)) {
      throw "A GGStarRail process owns port $Port, but its HTTP health check failed."
    }
    Write-Output "GGStarRail is already running at $demoUrl"
    exit 0
  }

  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  $runId = Get-Date -Format "yyyyMMdd-HHmmss"
  $standardOutput = Join-Path $logDirectory "stdout-$Port-$runId.log"
  $standardError = Join-Path $logDirectory "stderr-$Port-$runId.log"
  $npm = (Get-Command npm.cmd).Source

  $launcher = Start-Process `
    -FilePath $npm `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "$Port", "--strictPort") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $standardOutput `
    -RedirectStandardError $standardError `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds(12)
  do {
    if (Test-GGStarRailEndpoint -Url $demoUrl) {
      $listener = Get-NetTCPConnection `
        -LocalAddress "127.0.0.1" `
        -LocalPort $Port `
        -State Listen `
        -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($listener -and (Test-GGStarRailProcess -ProcessId $listener.OwningProcess)) {
        Write-Output "GGStarRail is running at $demoUrl"
        Write-Output "Logs: $logDirectory"
        exit 0
      }
    }
    if ($launcher.HasExited) {
      break
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)

  if (-not $launcher.HasExited) {
    Stop-Process -Id $launcher.Id -Force
  }
  $stdout = if (Test-Path -LiteralPath $standardOutput) {
    Get-Content -LiteralPath $standardOutput -Raw
  } else {
    "No standard-output log was written."
  }
  $stderr = if (Test-Path -LiteralPath $standardError) {
    Get-Content -LiteralPath $standardError -Raw
  } else {
    "No standard-error log was written."
  }
  throw "GGStarRail did not become healthy at $demoUrl.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
} finally {
  if ($mutexAcquired) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
