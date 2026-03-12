# Gemini Watermark Tool - Extension Installer
# This script sets up the Native Messaging Host and AUTO-DETECTS the Extension ID.

$currentDir = Get-Location
$jsonPath = Join-Path $currentDir "gwt_host.json"
$batPath = Join-Path $currentDir "gwt_host.bat"
$extName = "Gemini Watermark Remover"

Write-Host "--- Gemini Watermark Tool Setup ---" -ForegroundColor Cyan

# 1. Check for Node.js
try {
    node -v | Out-Null
} catch {
    Write-Host "Error: Node.js is not installed. Please install Node.js first!" -ForegroundColor Red
    Pause
    exit
}

# 2. Attempt to Auto-Detect Extension ID
Write-Host "`nSearching for Extension ID..." -ForegroundColor Yellow

$chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$prefFiles = Get-ChildItem -Path $chromePath -Filter "Preferences" -Recurse -ErrorAction SilentlyContinue

$extId = $null

foreach ($prefFile in $prefFiles) {
    try {
        $json = Get-Content $prefFile.FullName -Raw | ConvertFrom-Json
        $settings = $json.extensions.settings
        
        foreach ($id in $settings.psobject.Properties.Name) {
            $ext = $settings.$id
            # Check if this is our extension by matching the path or name
            if ($ext.path -eq $currentDir.Path -or $ext.manifest.name -eq $extName) {
                $extId = $id
                break
            }
        }
    } catch {}
    if ($extId) { break }
}

if (-not $extId) {
    Write-Host "Auto-detect failed. Please make sure the extension is loaded in Chrome." -ForegroundColor Yellow
    $extId = Read-Host "Manually paste the Extension ID (from chrome://extensions/)"
} else {
    Write-Host "Found Extension ID: $extId" -ForegroundColor Green
}

if (-not $extId) {
    Write-Host "Error: Extension ID is required!" -ForegroundColor Red
    Pause
    exit
}

# 3. Update gwt_host.json
$jsonContent = @{
    name = "com.gwt.native_host"
    description = "Gemini Watermark Tool Native Messaging Host"
    path = $batPath.Replace("\", "\\")
    type = "stdio"
    allowed_origins = @("chrome-extension://$extId/")
} | ConvertTo-Json

$jsonContent | Out-File -FilePath $jsonPath -Encoding utf8

# 4. Register in Windows Registry
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.gwt.native_host"
if (-not (Test-Path $registryPath)) {
    New-Item -Path $registryPath -Force | Out-Null
}
Set-ItemProperty -Path $registryPath -Name "(Default)" -Value $jsonPath

Write-Host "`nSUCCESS: Native Host registered!" -ForegroundColor Green
Write-Host "You can now right-click images in Chrome to remove watermarks."
Pause
