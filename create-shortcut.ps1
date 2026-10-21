$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "ROLLZ Billing Software.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "c:\Users\haafi\Desktop\Billing Software\ROLLZ-POS-Launcher.bat"
$Shortcut.WorkingDirectory = "c:\Users\haafi\Desktop\Billing Software"
$Shortcut.Description = "ROLLZ Fast Food Point of Sale and Billing Software"
$Shortcut.IconLocation = "c:\Users\haafi\Desktop\Billing Software\rollz-logo.ico,0"

$Shortcut.Save()
Write-Host "Updated Desktop Shortcut with ROLLZ logo icon at $ShortcutPath"
