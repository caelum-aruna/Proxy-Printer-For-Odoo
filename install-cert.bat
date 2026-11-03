@echo off
title Pasang Sertifikat SSL Proxy - Odoo IoT Box
chcp 65001 >nul
cls

echo ===================================================================
echo     PASANG SERTIFIKAT SSL KE TRUSTED ROOT WINDOWS (ODOO POS)
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

set CERT_FILE=%~dp0certs\server.crt

if not exist "%CERT_FILE%" (
    echo [ERROR] File sertifikat '%CERT_FILE%' tidak ditemukan!
    echo Menjalankan node untuk membuat sertifikat baru...
    node -e "const { ensureCertificate } = require('./src/helpers/cert-manager'); ensureCertificate().then(() => console.log('OK'));"
)

if not exist "%CERT_FILE%" (
    echo [ERROR] Gagal menemukan atau membuat sertifikat.
    pause
    exit /b
)

echo [INFO] Memasang '%CERT_FILE%' ke Windows Trusted Root Certification Authorities...

powershell -NoProfile -Command "Import-Certificate -FilePath '%CERT_FILE%' -CertStoreLocation 'Cert:\LocalMachine\Root'"

if %errorlevel% equ 0 (
    echo.
    echo ===================================================================
    echo [SUKSES] Sertifikat SSL berhasil dipasang ke Windows!
    echo Browser Chrome dan Edge di komputer ini kini mempercayai koneksi
    echo HTTPS ke Odoo Print Proxy tanpa peringatan keamanan lagi.
    echo ===================================================================
) else (
    echo.
    echo [ERROR] Gagal memasang sertifikat ke Trusted Root store.
)

echo.
pause
