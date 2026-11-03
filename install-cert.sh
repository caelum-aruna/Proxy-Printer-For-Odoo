#!/bin/bash
# install-cert.sh - Pasang sertifikat SSL proxy ke Chrome dan Firefox di Linux
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CERT="$DIR/certs/server.crt"

if [ ! -f "$CERT" ]; then
    echo "[ERROR] File $CERT tidak ditemukan!"
    exit 1
fi

echo "==================================================================="
echo "[1/2] Memasang sertifikat ke Chrome/Chromium (~/.pki/nssdb)..."
mkdir -p "$HOME/.pki/nssdb"
certutil -d sql:"$HOME/.pki/nssdb" -A -t "C,," -n "Odoo-Print-Proxy" -i "$CERT" 2>/dev/null || true

echo "[2/2] Memasang sertifikat ke semua profil Firefox..."
FIREFOX_DIRS=(
    "$HOME/.mozilla/firefox"
    "$HOME/.config/mozilla/firefox"
    "$HOME/.var/app/org.mozilla.firefox/.mozilla/firefox"
)

found_ff=0
for base in "${FIREFOX_DIRS[@]}"; do
    if [ -d "$base" ]; then
        for profile in "$base"/*; do
            if [ -d "$profile" ] && [ -f "$profile/cert9.db" ]; then
                echo "  -> Menambahkan ke profil Firefox: $(basename "$profile")"
                certutil -d sql:"$profile" -A -t "C,," -n "Odoo-Print-Proxy" -i "$CERT" 2>/dev/null || true
                
                # Konfigurasi Firefox Local Network Access (LNA) agar situs online (karyajayasantosa.com) diizinkan akses proxy lokal
                USER_JS="$profile/user.js"
                echo "  -> Mengonfigurasi Local Network Access di $(basename "$profile")/user.js"
                grep -q "network.lna.blocking" "$USER_JS" 2>/dev/null || echo 'user_pref("network.lna.blocking", false);' >> "$USER_JS"
                grep -q "network.lna.enabled" "$USER_JS" 2>/dev/null || echo 'user_pref("network.lna.enabled", false);' >> "$USER_JS"
                grep -q "karyajayasantosa.com" "$USER_JS" 2>/dev/null || echo 'user_pref("network.lna.skip-domains", "karyajayasantosa.com");' >> "$USER_JS"
                grep -q "security.enterprise_roots.enabled" "$USER_JS" 2>/dev/null || echo 'user_pref("security.enterprise_roots.enabled", true);' >> "$USER_JS"
                found_ff=1
            fi
        done
    fi
done

if [ "$found_ff" -eq 0 ]; then
    echo "  [INFO] Tidak ditemukan profil Firefox dengan cert9.db otomatis."
fi

echo "==================================================================="
echo "[SUKSES] Sertifikat SSL berhasil dipasang ke Chrome dan Firefox di Linux!"
echo "PENTING: Silakan RESTART browser (tutup semua jendela Firefox/Chrome) lalu buka kembali."
echo "==================================================================="
