@echo off
title Odoo Print Proxy
chcp 65001 >nul
cls

echo ===================================================================
echo             ODOO PRINT PROXY - HARDWARE BRIDGE (WINDOWS)
echo ===================================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terinstall di komputer ini!
    echo Silakan download dan install Node.js dari: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] Mengunduh dependencies awal (npm install)...
    call npm install --omit=dev
    echo.
)

echo [INFO] Menjalankan Odoo Print Proxy...
echo Dashboard dapat diakses di: http://localhost:8000
echo Tekan CTRL+C untuk menghentikan server.
echo ===================================================================
echo.

node server.js
pause
