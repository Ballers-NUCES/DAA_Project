<#
.SYNOPSIS
Packages Submission 2 for classroom submission.

.DESCRIPTION
Includes non-Git-ignored S2 source files, Nice_UI.png, optional dataset files
strictly below 1 MB, and an optional executable of any file type.

.PARAMETER Datasets
Path to the optional dataset folder.

.PARAMETER Executable
Path to the optional executable or bundle.

.PARAMETER Output
Output ZIP path. Defaults to a timestamped Submission2 ZIP beside this script.

.EXAMPLE
.\package_submission2.ps1 -Datasets "C:\Datasets" -Executable "C:\Builds\app.exe"

.EXAMPLE
.\package_submission2.ps1 -Datasets "C:\Datasets" -Output "Submission2.zip"
#>

[CmdletBinding()]
param(
  [Alias("d")]
  [string]$Datasets,

  [Alias("e")]
  [string]$Executable,

  [Alias("o")]
  [string]$Output
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$maxDatasetFileBytes = [long]1000000
$packageName = "Submission2"
$scriptDir = $PSScriptRoot
$callerDir = (Get-Location).Path

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is required so ignore rules can be applied."
}

$sourceDir = Join-Path $scriptDir "S2"
$screenshotPath = Join-Path $scriptDir "Nice_UI.png"

if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
  throw "S2 source folder not found beside the script: $sourceDir"
}
if (-not (Test-Path -LiteralPath $screenshotPath -PathType Leaf)) {
  throw "Nice_UI.png not found beside the script: $screenshotPath"
}

& git -C $scriptDir rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "The project must be inside a Git work tree so ignore rules can be applied."
}

$datasetsDir = $null
if (-not [string]::IsNullOrWhiteSpace($Datasets)) {
  if (-not (Test-Path -LiteralPath $Datasets -PathType Container)) {
    throw "Dataset folder does not exist: $Datasets"
  }
  $datasetsDir = (Resolve-Path -LiteralPath $Datasets).Path
}

$executablePath = $null
if (-not [string]::IsNullOrWhiteSpace($Executable)) {
  if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
    throw "Executable file does not exist: $Executable"
  }
  $executablePath = (Resolve-Path -LiteralPath $Executable).Path
}

if ([string]::IsNullOrWhiteSpace($Output)) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $outputPath = Join-Path $scriptDir "${packageName}_${timestamp}.zip"
} elseif ([System.IO.Path]::IsPathRooted($Output)) {
  $outputPath = [System.IO.Path]::GetFullPath($Output)
} else {
  $outputPath = [System.IO.Path]::GetFullPath((Join-Path $callerDir $Output))
}

if (Test-Path -LiteralPath $outputPath) {
  throw "Output already exists: $outputPath"
}

$outputDir = Split-Path -Parent $outputPath
if (-not (Test-Path -LiteralPath $outputDir -PathType Container)) {
  throw "Output directory does not exist: $outputDir"
}

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) (
  "Submission2_" + [Guid]::NewGuid().ToString("N")
)
New-Item -ItemType Directory -Path $workDir | Out-Null

try {
  $packageRoot = Join-Path $workDir $packageName
  $sourceDestination = Join-Path $packageRoot "Source Code"
  New-Item -ItemType Directory -Path $sourceDestination -Force | Out-Null

  $sourceFiles = @(
    & git -C $scriptDir -c core.quotePath=false ls-files `
      --cached --others --exclude-standard -- S2
  )
  if ($LASTEXITCODE -ne 0) {
    throw "Git could not enumerate non-ignored S2 source files."
  }

  $sourceCount = 0
  foreach ($relativePath in $sourceFiles) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      continue
    }

    $nativeRelativePath = $relativePath -replace '/', '\'
    $sourcePath = Join-Path $scriptDir $nativeRelativePath
    $destination = Join-Path $sourceDestination $nativeRelativePath
    $destinationDir = Split-Path -Parent $destination

    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destination -Force
    $sourceCount++
  }

  if ($sourceCount -eq 0) {
    throw "No non-ignored S2 source files were found."
  }

  Copy-Item -LiteralPath $screenshotPath -Destination (
    Join-Path $packageRoot "Nice_UI.png"
  ) -Force

  $datasetIncluded = 0
  $datasetOmitted = 0

  if ($null -ne $datasetsDir) {
    $datasetDestination = Join-Path $packageRoot "Datasets"
    New-Item -ItemType Directory -Path $datasetDestination -Force | Out-Null

    $datasetFiles = Get-ChildItem -LiteralPath $datasetsDir -File -Recurse -Force |
      Sort-Object FullName

    foreach ($file in $datasetFiles) {
      $relativePath = $file.FullName.Substring($datasetsDir.Length) -replace '^[\\/]+', ''

      if ($file.Length -lt $maxDatasetFileBytes) {
        $destination = Join-Path $datasetDestination $relativePath
        $destinationDir = Split-Path -Parent $destination
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $datasetIncluded++
      } else {
        $datasetOmitted++
      }
    }
  }

  $executableName = "Not supplied"
  if ($null -ne $executablePath) {
    $executableDestination = Join-Path $packageRoot "Executable"
    New-Item -ItemType Directory -Path $executableDestination -Force | Out-Null
    $executableName = Split-Path -Leaf $executablePath
    Copy-Item -LiteralPath $executablePath -Destination (
      Join-Path $executableDestination $executableName
    ) -Force
  }

  Compress-Archive -LiteralPath $packageRoot -DestinationPath $outputPath `
    -CompressionLevel Optimal

  Write-Host "Created: $outputPath"
  Write-Host "Source files: $sourceCount (Git-ignored files excluded)"
  if ($null -ne $datasetsDir) {
    Write-Host "Datasets: $datasetIncluded included, $datasetOmitted omitted for size"
  } else {
    Write-Host "Datasets: not supplied"
  }
  Write-Host "Executable: $executableName"
} finally {
  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force
  }
}
