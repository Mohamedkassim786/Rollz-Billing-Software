@echo off
setlocal enabledelayedexpansion

title ROLLZ Restaurant POS - Automated Database Backup

echo ====================================================================
echo        ROLLZ RESTAURANT POS - DATABASE BACKUP UTILITY
echo ====================================================================
echo.

if not exist "server\package.json" (
    echo [ERROR] Please run this batch script from the root of the ROLLZ project directory.
    pause
    exit /b 1
)

echo Triggering safe compressed PostgreSQL backup...
echo.

cd server
call npm run backup
set BACKUP_EXIT=%ERRORLEVEL%
cd ..

echo.
if %BACKUP_EXIT% equ 0 (
    echo ====================================================================
    echo [SUCCESS] Backup completed and verified.
    echo Backups are stored safely in: server\backups\
    echo Old backups beyond retention limit (7) were cleaned up automatically.
    echo ====================================================================
) else (
    echo ====================================================================
    echo [FAILED] Database backup encountered an error (exit code %BACKUP_EXIT%).
    echo Check PostgreSQL service status and server\backups logs.
    echo ====================================================================
)

echo.
pause
