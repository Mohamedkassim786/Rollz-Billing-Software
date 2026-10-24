@echo off
setlocal enabledelayedexpansion

title ROLLZ Restaurant POS - Clear Test Sales & Billing Data

echo ====================================================================
echo         ROLLZ RESTAURANT POS - CLEAR TEST SALES DATA
echo ====================================================================
echo.
echo This tool will CLEAR all test orders, bills, invoices, payments,
echo test customers, and cash register shifts.
echo.
echo What is KEPT (NOT DELETED):
echo  - Your Menu Items, Categories, and Modifiers
echo  - Your Staff Accounts and Passwords
echo  - Your Store Logo, Name, and Settings
echo.
echo All sales reports and invoice numbers will reset back to 0.
echo.
set /p CONFIRM="Are you sure you want to clear all test sales? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo Operation cancelled. No data was changed.
    pause
    exit /b 0
)

echo.
echo Clearing test transactions from PostgreSQL database...
cd server
call npm run reset:sales
set EXIT_CODE=%ERRORLEVEL%
cd ..

echo.
if %EXIT_CODE% equ 0 (
    echo ====================================================================
    echo  SUCCESS: All test sales data has been cleared!
    echo  The system is now fresh and ready for live restaurant billing.
    echo ====================================================================
) else (
    echo [ERROR] Encountered an issue while clearing sales data.
)
echo.
pause
