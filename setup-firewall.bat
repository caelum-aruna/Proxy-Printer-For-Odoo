@echo off
title Buka Port Windows Firewall - Odoo Print Proxy
chcp 65001 >nul
cls

echo ===================================================================
echo     KONFIGURASI WINDOWS DEFENDER FIREWALL (MULTI-KASIR)
echo ===================================================================
echo.

:: Cek hak akses administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Membutuhkan hak akses Administrator...
    echo Membuka prompt konfirmasi hak Administrator (UAC)...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [INFO] Menambahkan aturan Inbound Rule ke Windows Defender Firewall...
echo Rule Name  : Odoo Print Proxy (Ports 8000-8020)
echo Protocol   : TCP
echo Ports      : 8000-8020
echo.

:: Hapus rule lama jika sudah ada
netsh advfirewall firewall delete rule name="Odoo Print Proxy (Ports 8000-8020)" >nul 2>&1

:: Tambah rule baru
netsh advfirewall firewall add rule name="Odoo Print Proxy (Ports 8000-8020)" dir=in action=allow protocol=TCP localport=8000-8020 profile=any >nul

if %errorlevel% equ 0 (
    echo [SUKSES] Port 8000 s/d 8020 berhasil dibuka di Windows Firewall!
    echo Laptop kasir lain atau tablet di jaringan toko kini dapat terhubung lancar.
) else (
    echo [ERROR] Gagal menambahkan aturan firewall. Pastikan dijalankan sebagai Administrator.
)

echo.
pause
