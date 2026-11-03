# scripts/windows-raw-print.ps1
# Mengirim data cetak ke Windows Print Spooler (winspool.drv).
# Mendukung Dual-Mode Engine:
# 1. RAW Mode (Win32 API WritePrinter): Untuk Real Dot Matrix (Epson LX/LQ) & Thermal Printer (ESC/POS)
# 2. Text/GDI Mode (Out-Printer): Untuk Printer Biasa (Inkjet, Laser, Canon, Epson L-Series, PDF)
# Kompatibel dengan Windows 7, 8, 10, 11 (Semua edisi 32-bit & 64-bit).

param (
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,

    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [string]$Mode = "auto" # "auto", "raw", "text"
)

if (-not (Test-Path -LiteralPath $FilePath)) {
    Write-Error "[WinRawPrint] File sumber '$FilePath' tidak ditemukan."
    exit 2
}

# 1. Periksa ketersediaan printer di Windows dan lakukan Smart Resolution jika ada perbedaan penamaan
$installedPrinters = @()
try {
    $installedPrinters = @(Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue)
} catch {
    try {
        $installedPrinters = @(Get-WmiObject Win32_Printer -ErrorAction SilentlyContinue)
    } catch {}
}

$actualPrinter = $null
if ($installedPrinters.Count -gt 0) {
    # a. Exact match
    $actualPrinter = $installedPrinters | Where-Object { $_.Name -eq $PrinterName } | Select-Object -First 1

    # b. Case-insensitive match
    if (-not $actualPrinter) {
        $actualPrinter = $installedPrinters | Where-Object { $_.Name.ToLower() -eq $PrinterName.ToLower() } | Select-Object -First 1
    }

    # c. Smart Partial / Fuzzy match (misal mencari 'POS-80', di Windows terdaftar 'POS-80 Series' atau 'POS80')
    if (-not $actualPrinter) {
        $cleanSearch = ($PrinterName -replace "[-_\s]", "").ToLower()
        $actualPrinter = $installedPrinters | Where-Object {
            $nName = ($_.Name -replace "[-_\s]", "").ToLower()
            $nName -match [regex]::Escape($cleanSearch) -or $cleanSearch -match [regex]::Escape($nName)
        } | Select-Object -First 1
    }

    if ($actualPrinter) {
        $PrinterName = $actualPrinter.Name
    } else {
        $printerNamesList = ($installedPrinters | ForEach-Object { "'$($_.Name)'" }) -join ", "
        Write-Error "[WinRawPrint] Printer '$PrinterName' tidak ditemukan di Windows. Printer yang terpasang di sistem: [$printerNamesList]. Pastikan nama printer di proxy sesuai dengan Windows Devices & Printers atau install driver printer terlebih dahulu."
        exit 1
    }
}

# Fungsi cetak via Text Engine Windows (GDI) untuk Printer Biasa
function Print-ViaTextEngine {
    param([string]$Prn, [string]$File)
    try {
        # Out-Printer merender teks melalui subsistem print Windows (GDI)
        # Bekerja di semua printer biasa (Canon, Epson L-Series, HP, Brother, PDF, dll)
        Get-Content -LiteralPath $File -Encoding UTF8 | Out-Printer -Name $Prn
        Write-Output "OK"
        exit 0
    } catch {
        Write-Error "[TextPrint] Gagal mencetak teks ke '$Prn': $($_.Exception.Message)"
        exit 1
    }
}

# Jika mode eksplisit adalah "text", langsung gunakan Text Engine
if ($Mode -eq "text") {
    Print-ViaTextEngine -Prn $PrinterName -File $FilePath
}

# Jika mode adalah "auto", periksa apakah printer adalah printer dokumen standar (GDI)
if ($Mode -eq "auto") {
    try {
        $pObj = Get-CimInstance Win32_Printer -Filter "Name='$PrinterName'" -ErrorAction SilentlyContinue
        if ($pObj) {
            $driver = ($pObj.DriverName + " " + $pObj.Name).ToLower()
            # Jika driver/nama mengandung indikasi printer biasa / non-ESC/P
            if ($driver -match "pdf|xps|onenote|canon|deskjet|laserjet|ink|color|series|brother|hp |l220|l3210") {
                if (-not ($driver -match "pos|thermal|receipt|lx-|lq-|matrix")) {
                    Print-ViaTextEngine -Prn $PrinterName -File $FilePath
                }
            }
        }
    } catch {
        # Abaikan error query WMI
    }
}

# Mode RAW: Menggunakan Win32 API native WritePrinter
$rawPrintCode = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class WinSpoolerRawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool PrintRawFile(string printerName, string filePath) {
        if (!File.Exists(filePath)) {
            throw new FileNotFoundException("File tidak ditemukan: " + filePath);
        }

        byte[] bytes = File.ReadAllBytes(filePath);
        if (bytes.Length == 0) {
            return true; // Tidak ada data untuk dicetak
        }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "RAW_PRINT_JOB";
        di.pDataType = "RAW";

        bool success = false;
        int lastWin32Error = 0;

        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            try {
                if (StartDocPrinter(hPrinter, 1, di)) {
                    try {
                        if (StartPagePrinter(hPrinter)) {
                            try {
                                int dwWritten = 0;
                                success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                                if (!success) {
                                    lastWin32Error = Marshal.GetLastWin32Error();
                                }
                            } finally {
                                EndPagePrinter(hPrinter);
                            }
                        } else {
                            lastWin32Error = Marshal.GetLastWin32Error();
                        }
                    } finally {
                        EndDocPrinter(hPrinter);
                    }
                } else {
                    lastWin32Error = Marshal.GetLastWin32Error();
                }
            } finally {
                ClosePrinter(hPrinter);
            }
        } else {
            lastWin32Error = Marshal.GetLastWin32Error();
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
            throw new Exception("Gagal membuka printer '" + printerName + "'. Pastikan nama printer tepat sesuai di Windows (Win32 Error: " + lastWin32Error + ").");
        }

        Marshal.FreeCoTaskMem(pUnmanagedBytes);

        if (!success) {
            throw new Exception("Gagal menulis ke antrian printer '" + printerName + "' (Win32 Error: " + lastWin32Error + ").");
        }

        return true;
    }
}
"@

try {
    Add-Type -TypeDefinition $rawPrintCode -ErrorAction Stop
} catch {
    # Type sudah terdefinisi di sesi PowerShell ini
}

try {
    [WinSpoolerRawPrint]::PrintRawFile($PrinterName, $FilePath) | Out-Null
    Write-Output "OK"
    exit 0
} catch {
    $rawError = $_.Exception.Message
    # Hanya fallback ke Text Engine jika mode adalah auto DAN error BUKAN karena printer tidak ditemukan / Spooler mati
    if ($Mode -eq "auto" -and -not ($rawError -match "Win32 Error: 1801|Win32 Error: 1722|tidak ditemukan")) {
        try {
            Print-ViaTextEngine -Prn $PrinterName -File $FilePath
        } catch {
            Write-Error "[WinRawPrint] Gagal cetak RAW ($rawError) dan gagal cetak Text Engine ($($_.Exception.Message))"
            exit 1
        }
    } else {
        Write-Error $rawError
        exit 1
    }
}
