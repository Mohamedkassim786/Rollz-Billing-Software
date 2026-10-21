@echo off
setlocal enabledelayedexpansion

title Create Desktop Shortcut - ROLLZ Billing Software

echo ====================================================================
echo         ROLLZ BILLING SOFTWARE - CREATE DESKTOP SHORTCUT
echo ====================================================================
echo.

set "TARGET_BROWSER="

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "TARGET_BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "TARGET_BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "TARGET_BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "TARGET_BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if "%TARGET_BROWSER%"=="" (
    echo [ERROR] Neither Google Chrome nor Microsoft Edge was found.
    pause
    exit /b 1
)

echo Browser found: %TARGET_BROWSER%
echo Generating Desktop Shortcut...

powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$s = $ws.CreateShortcut($desktop + '\ROLLZ Billing Software.lnk'); " ^
  "$s.TargetPath = '%TARGET_BROWSER%'; " ^
  "$s.Arguments = '--app=http://localhost:5173'; " ^
  "$s.Description = 'ROLLZ Fast Food Point of Sale and Billing Software'; " ^
  "$s.Save(); " ^
  "Write-Host 'Shortcut created at: ' ($desktop + '\ROLLZ Billing Software.lnk')"

echo.
echo ====================================================================
echo  SUCCESS! 'ROLLZ Billing Software' shortcut is now on your Desktop!
echo ====================================================================
echo.
pause
