@echo off
title Hapus Auto-Startup Odoo Print Proxy
chcp 65001 >nul
cls

echo ===================================================================
echo       MENGHAPUS ODOO PRINT PROXY DARI WINDOWS AUTO-STARTUP
echo ===================================================================
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\OdooPrintProxy.lnk

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUKSES] Shortcut di folder startup berhasil dihapus.
) else (
    echo [INFO] Shortcut auto-startup tidak ditemukan.
)

echo.
pause
