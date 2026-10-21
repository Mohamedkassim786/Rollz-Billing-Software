@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
title Create Desktop Shortcut - ROLLZ Billing Software

echo ====================================================================
echo         ROLLZ BILLING SOFTWARE - CREATE DESKTOP SHORTCUT
echo ====================================================================
echo.

set "LAUNCHER_BAT=%~dp0ROLLZ-POS-Launcher.bat"

if not exist "%LAUNCHER_BAT%" (
    echo [ERROR] Launcher script not found: %LAUNCHER_BAT%
    pause
    exit /b 1
)

:: Check for ROLLZ logo icon first, fallback to browser
set "ICON_SOURCE="
if exist "%~dp0rollz-logo.ico" (
    set "ICON_SOURCE=%~dp0rollz-logo.ico,0"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "ICON_SOURCE=C:\Program Files\Google\Chrome\Application\chrome.exe,0"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "ICON_SOURCE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe,0"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "ICON_SOURCE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe,0"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "ICON_SOURCE=C:\Program Files\Microsoft\Edge\Application\msedge.exe,0"
)

echo Creating Desktop Shortcut...
echo Target: %LAUNCHER_BAT%

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$s = $ws.CreateShortcut($desktop + '\ROLLZ Billing Software.lnk'); " ^
  "$s.TargetPath = '%LAUNCHER_BAT%'; " ^
  "$s.WorkingDirectory = '%~dp0'; " ^
  "$s.Description = 'ROLLZ Fast Food Point of Sale and Billing Software'; " ^
  "if ('%ICON_SOURCE%' -ne '') { $s.IconLocation = '%ICON_SOURCE%'; }; " ^
  "$s.Save(); " ^
  "Write-Host 'Shortcut created at: ' ($desktop + '\ROLLZ Billing Software.lnk')"

echo.
echo ====================================================================
echo  SUCCESS! 'ROLLZ Billing Software' shortcut is now on your Desktop!
echo ====================================================================
echo.
echo When you double-click the desktop icon:
echo 1. It automatically starts the backend and billing servers.
echo 2. It opens directly in a clean software window.
echo.
pause
