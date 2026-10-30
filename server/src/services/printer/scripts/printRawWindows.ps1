param(
    [Parameter(Mandatory=$false)]
    [string]$Target = "",

    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$false)]
    [int]$BaudRate = 9600
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Test-Path $FilePath)) {
    $errObj = @{
        success = $false
        error = "Payload file not found: $FilePath"
        target = $Target
    }
    Write-Output ($errObj | ConvertTo-Json -Compress)
    exit 1
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
if ($bytes.Length -eq 0) {
    $errObj = @{
        success = $false
        error = "Payload file is empty"
        target = $Target
    }
    Write-Output ($errObj | ConvertTo-Json -Compress)
    exit 1
}

# 1. Check if Target is a Serial / COM port (e.g. "COM3", "COM1")
if ($Target -match '^(?i)COM\d+$') {
    try {
        $port = New-Object System.IO.Ports.SerialPort $Target.ToUpper(), $BaudRate, "None", 8, "One"
        $port.WriteTimeout = 5000
        $port.Open()
        $port.Write($bytes, 0, $bytes.Length)
        Start-Sleep -Milliseconds 200
        $port.Close()
        $port.Dispose()

        $okObj = @{
            success = $true
            bytesSent = $bytes.Length
            target = $Target
            type = "SERIAL_COM"
        }
        Write-Output ($okObj | ConvertTo-Json -Compress)
        exit 0
    } catch {
        $errObj = @{
            success = $false
            error = "Failed to write to COM port $($Target): $($_.Exception.Message)"
            target = $Target
            type = "SERIAL_COM"
        }
        Write-Output ($errObj | ConvertTo-Json -Compress)
        exit 1
    }
}

# 2. Target is a Windows Printer (or default printer if target is empty)
$printerName = $Target.Trim()
if ([string]::IsNullOrWhiteSpace($printerName)) {
    try {
        Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
        $settings = New-Object System.Drawing.Printing.PrinterSettings
        $printerName = [string]$settings.PrinterName
    } catch {
        # ignore error
    }
}

if ([string]::IsNullOrWhiteSpace($printerName)) {
    $errObj = @{
        success = $false
        error = "No printer name specified and default Windows printer could not be determined"
        target = $Target
        type = "WINDOWS_RAW"
    }
    Write-Output ($errObj | ConvertTo-Json -Compress)
    exit 1
}

$csharpHelper = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
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

    public static bool SendRawBytes(string printerName, byte[] bytes, out string error) {
        error = "";
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "ROLLZ POS Thermal Print";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            error = "Could not open printer '" + printerName + "' (Win32 Error: " + err + ")";
            return false;
        }

        try {
            if (StartDocPrinter(hPrinter, 1, di)) {
                try {
                    if (StartPagePrinter(hPrinter)) {
                        try {
                            IntPtr pUnmanaged = Marshal.AllocCoTaskMem(bytes.Length);
                            try {
                                Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length);
                                int written = 0;
                                bool ok = WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written);
                                if (!ok || written != bytes.Length) {
                                    int err = Marshal.GetLastWin32Error();
                                    error = "Failed to write raw data to printer '" + printerName + "' (Win32 Error: " + err + ")";
                                    return false;
                                }
                                return true;
                            } finally {
                                Marshal.FreeCoTaskMem(pUnmanaged);
                            }
                        } finally {
                            EndPagePrinter(hPrinter);
                        }
                    } else {
                        int err = Marshal.GetLastWin32Error();
                        error = "StartPagePrinter failed for '" + printerName + "' (Win32 Error: " + err + ")";
                        return false;
                    }
                } finally {
                    EndDocPrinter(hPrinter);
                }
            } else {
                int err = Marshal.GetLastWin32Error();
                error = "StartDocPrinter failed for '" + printerName + "' (Win32 Error: " + err + ")";
                return false;
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
'@

try {
    if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
        Add-Type -TypeDefinition $csharpHelper -Language CSharp
    }
    $rawError = ""
    $res = [RawPrinterHelper]::SendRawBytes($printerName, $bytes, [ref]$rawError)

    if ($res) {
        $okObj = @{
            success = $true
            bytesSent = $bytes.Length
            target = $printerName
            type = "WINDOWS_RAW"
        }
        Write-Output ($okObj | ConvertTo-Json -Compress)
        exit 0
    } else {
        $errObj = @{
            success = $false
            error = $rawError
            target = $printerName
            type = "WINDOWS_RAW"
        }
        Write-Output ($errObj | ConvertTo-Json -Compress)
        exit 1
    }
} catch {
    $errObj = @{
        success = $false
        error = "Raw print execution exception: $($_.Exception.Message)"
        target = $printerName
        type = "WINDOWS_RAW"
    }
    Write-Output ($errObj | ConvertTo-Json -Compress)
    exit 1
}

