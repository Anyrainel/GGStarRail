param(
  [ValidateRange(1, 65535)]
  [int]$Port = 41737,
  [ValidateRange(1, 65535)]
  [int]$WorkerPort = 41738
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$demoUrl = "http://127.0.0.1:$Port"
$workerUrl = "http://127.0.0.1:$WorkerPort"
$logDirectory = Join-Path $env:TEMP "ggstarrail-demo"
$mutex = [System.Threading.Mutex]::new($false, "Local\GGStarRailDemo-$Port")
$mutexAcquired = $false
$launchedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

function Test-ProjectProcess {
  param([int]$ProcessId)

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
  $commandLine = if ($process) { [string]$process.CommandLine } else { "" }
  return $commandLine -and
    $commandLine.IndexOf(
      $projectRoot,
      [System.StringComparison]::OrdinalIgnoreCase
    ) -ge 0
}

function Get-LocalListener {
  param([int]$LocalPort)

  return Get-NetTCPConnection `
    -LocalAddress "127.0.0.1" `
    -LocalPort $LocalPort `
    -State Listen `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Test-WebDemo {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$demoUrl/" -TimeoutSec 2
    return $response.StatusCode -eq 200 -and
      $response.Content.Contains("<title>GGStarRail</title>")
  } catch {
    return $false
  }
}

function Test-WorkerDemo {
  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "$workerUrl/api/health" `
      -TimeoutSec 2
    return $response.StatusCode -eq 200 -and
      $response.Content.Contains('"product":"GGStarRail"')
  } catch {
    return $false
  }
}

function Start-DemoProcess {
  param(
    [string[]]$Arguments,
    [string]$Name,
    [string]$RunId
  )

  $npm = (Get-Command npm.cmd).Source
  $standardOutput = Join-Path $logDirectory "$Name-stdout-$RunId.log"
  $standardError = Join-Path $logDirectory "$Name-stderr-$RunId.log"
  $process = Start-Process `
    -FilePath $npm `
    -ArgumentList $Arguments `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $standardOutput `
    -RedirectStandardError $standardError `
    -WindowStyle Hidden `
    -PassThru
  $launchedProcesses.Add($process)
  return $process
}

try {
  $mutexAcquired = $mutex.WaitOne([TimeSpan]::FromSeconds(15))
  if (-not $mutexAcquired) {
    throw "Timed out waiting for another GGStarRail demo start to finish."
  }

  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  $runId = Get-Date -Format "yyyyMMdd-HHmmss"
  $workerListener = Get-LocalListener -LocalPort $WorkerPort
  if ($workerListener) {
    if (-not (Test-ProjectProcess -ProcessId $workerListener.OwningProcess)) {
      throw "Worker port $WorkerPort is already used by another process."
    }
    if (-not (Test-WorkerDemo)) {
      throw "A project process owns Worker port $WorkerPort, but its health check failed."
    }
  } else {
    $workerProcess = Start-DemoProcess `
      -Arguments @(
        "run", "dev:worker", "--", "--ip", "127.0.0.1", "--port", "$WorkerPort"
      ) `
      -Name "worker-$WorkerPort" `
      -RunId $runId
  }

  $webListener = Get-LocalListener -LocalPort $Port
  if ($webListener) {
    if (-not (Test-ProjectProcess -ProcessId $webListener.OwningProcess)) {
      throw "Web port $Port is already used by another process."
    }
    if (-not (Test-WebDemo)) {
      throw "A project process owns web port $Port, but its health check failed."
    }
  } else {
    $webProcess = Start-DemoProcess `
      -Arguments @(
        "run", "dev", "--", "--host", "127.0.0.1", "--port", "$Port", "--strictPort"
      ) `
      -Name "web-$Port" `
      -RunId $runId
  }

  $deadline = (Get-Date).AddSeconds(20)
  do {
    if ((Test-WebDemo) -and (Test-WorkerDemo)) {
      Write-Output "GGStarRail is running at $demoUrl"
      Write-Output "Import Worker is running at $workerUrl"
      Write-Output "Logs: $logDirectory"
      exit 0
    }
    $exitedProcess = $launchedProcesses |
      Where-Object { $_.HasExited } |
      Select-Object -First 1
    if ($exitedProcess) {
      break
    }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)

  throw "GGStarRail web and Worker processes did not both become healthy. Logs: $logDirectory"
} catch {
  foreach ($process in $launchedProcesses) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
    }
  }
  throw
} finally {
  if ($mutexAcquired) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
