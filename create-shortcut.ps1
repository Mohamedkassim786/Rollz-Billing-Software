$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "ROLLZ Billing Software.lnk"

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $ScriptDir "ROLLZ-POS-Launcher.bat"
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "ROLLZ Fast Food Point of Sale and Billing Software"
$Shortcut.IconLocation = (Join-Path $ScriptDir "rollz-logo.ico") + ",0"

$Shortcut.Save()
Write-Host "Updated Desktop Shortcut with ROLLZ logo icon at $ShortcutPath"
