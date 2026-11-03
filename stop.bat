@echo off
title Hentikan Odoo Print Proxy
chcp 65001 >nul
cls

echo ===================================================================
echo             MENGHENTIKAN ODOO PRINT PROXY (BACKGROUND)
echo ===================================================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Menghentikan proses Print Proxy dengan PID: %%a ...
    taskkill /F /PID %%a >nul 2>&1
    set FOUND=1
)

if "%FOUND%"=="1" (
    echo.
    echo [SUKSES] Odoo Print Proxy berhasil dihentikan dengan bersih.
) else (
    echo [INFO] Print Proxy tidak sedang berjalan pada port 8000.
)

echo.
timeout /t 3 >nul
