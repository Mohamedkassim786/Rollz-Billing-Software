@echo off
setlocal enabledelayedexpansion

title ROLLZ Restaurant POS - Safe Test Restoration Utility

echo ====================================================================
echo    ROLLZ RESTAURANT POS - BACKUP RESTORATION VERIFICATION
echo ====================================================================
echo.
echo NOTE: This utility restores backups into the TEST database (rollz_pos_test).
echo It NEVER overwrites the live production database.
echo.

if not exist "server\package.json" (
    echo [ERROR] Please run this batch script from the root of the ROLLZ project directory.
    pause
    exit /b 1
)

cd server
call npm run restore
set RESTORE_EXIT=%ERRORLEVEL%
cd ..

echo.
if %RESTORE_EXIT% equ 0 (
    echo ====================================================================
    echo [SUCCESS] Backup was restored and verified against rollz_pos_test!
    echo The database backup file is valid, intact, and recoverable.
    echo ====================================================================
) else (
    echo ====================================================================
    echo [FAILED] Restoration verification encountered an issue.
    echo ====================================================================
)

echo.
pause
