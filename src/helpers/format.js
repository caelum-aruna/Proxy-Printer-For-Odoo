// src/helpers/format.js
// Fungsi-fungsi formatting yang dipakai di banyak tempat

/**
 * Format angka ke string Rupiah (id-ID).
 * @param {number} num
 * @returns {string} contoh: "Rp1.500.000"
 */
function formatRupiah(num) {
  return "Rp" + Number(num).toLocaleString("id-ID");
}

/**
 * Format nilai XML <value> sesuai atribut Odoo POS receipt
 * (thousands-separator, decimal-separator, autoint, symbol).
 */
function formatXmlValue(valStr, attrs, defaultThousandsSep = '.', defaultDecimalSep = ',') {
  const cleanVal = String(valStr || '').trim();
  const num = parseFloat(cleanVal.replace(/,/g, ''));
  if (isNaN(num)) return cleanVal;

  let decimals = attrs['value-decimals'] !== undefined ? parseInt(attrs['value-decimals'], 10) : 0;
  if (isNaN(decimals)) decimals = 0;

  const autoint = attrs['value-autoint'] === 'on';
  if (autoint && Math.floor(num) === num) {
    decimals = 0;
  }

  const thousandsSep = attrs['value-thousands-separator'] || defaultThousandsSep;
  const decimalSep = attrs['value-decimals-separator'] || attrs['value-decimal-separator'] || defaultDecimalSep;

  const parts = num.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
  let result = parts.join(decimalSep);

  const symbol = attrs['value-symbol'] || '';
  if (symbol) {
    const position = attrs['value-symbol-position'] || 'after';
    result = position === 'after' ? result + symbol : symbol + result;
  }
  return result;
}

/**
 * Cetak dua kolom (kiri-kanan) pada satu baris thermal printer.
 * Jika total karakter melebihi lebar, teks kiri dipotong atau dipindah ke baris baru.
 */
function printLeftRight(printer, leftText, rightText, width = 48) {
  const left = String(leftText || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const right = String(rightText || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  printer.alignLeft();
  if (left.length + right.length + 1 <= width) {
    const spaces = width - left.length - right.length;
    printer.println(left + " ".repeat(spaces) + right);
  } else {
    const maxLeft = width - right.length - 1;
    if (maxLeft >= 6) {
      printer.println(left.substring(0, maxLeft) + " " + right);
    } else {
      printer.println(left);
      printer.println(right.padStart(width, " "));
    }
  }
}

module.exports = { formatRupiah, formatXmlValue, printLeftRight };
