# Installs (or refreshes) the "CSIE Prep Hub" logon shortcut so the server
# starts and the hub opens in the browser every time this user logs on.
# Idempotent: re-run it after moving the repo to point the shortcut at the
# new location. Run with:  powershell -ExecutionPolicy Bypass -File tools\autostart\install-startup.ps1
$ErrorActionPreference = 'Stop'
$autostartDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir   = Split-Path -Parent (Split-Path -Parent $autostartDir)
$script       = Join-Path $autostartDir 'start-and-open.vbs'
$startup      = [Environment]::GetFolderPath('Startup')
$lnkPath      = Join-Path $startup 'CSIE Prep Hub.lnk'

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath       = Join-Path $env:SystemRoot 'System32\wscript.exe'
$lnk.Arguments        = '"' + $script + '"'
$lnk.WorkingDirectory = $projectDir
$lnk.Description      = 'Start the CSIE Prep Hub server and open it in the browser'
$lnk.Save()

Write-Host "Installed: $lnkPath"
Write-Host "  -> wscript.exe $($lnk.Arguments)"
