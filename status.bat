@echo off
title Status Odoo Print Proxy
chcp 65001 >nul
cls

echo ===================================================================
echo             STATUS KONEKSI ODOO PRINT PROXY
echo ===================================================================
echo.

powershell -NoProfile -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:8000/system-info' -TimeoutSec 3; Write-Host '[STATUS] ONLINE' -ForegroundColor Green; Write-Host ('Port Proxy       : ' + $res.port); Write-Host ('Sistem Operasi   : ' + $res.os); Write-Host ('Default Printer  : ' + $res.defaultPrinter); Write-Host ('Jumlah Printer   : ' + $res.registeredCount); } catch { Write-Host '[STATUS] OFFLINE (Server tidak aktif di port 8000)' -ForegroundColor Red; }"

echo.
echo ===================================================================
echo Dashboard Web: http://localhost:8000
echo.
pause
