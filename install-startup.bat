@echo off
title Pasang Auto-Startup Odoo Print Proxy
chcp 65001 >nul
cls

echo ===================================================================
echo       MEMASANG ODOO PRINT PROXY KE WINDOWS AUTO-STARTUP
echo ===================================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_TARGET=%SCRIPT_DIR%start-hidden.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\OdooPrintProxy.lnk

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_TARGET%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.WindowStyle = 7; $s.Save();"

if exist "%SHORTCUT_PATH%" (
    echo [SUKSES] Auto-Startup berhasil dipasang!
    echo Print Proxy akan otomatis aktif di background setiap komputer kasir dinyalakan.
) else (
    echo [ERROR] Gagal memasang shortcut ke folder startup.
)

echo.
pause
