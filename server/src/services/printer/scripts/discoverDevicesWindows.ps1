try {
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    $installed = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
    $printersList = @()
    if ($installed) {
        foreach ($p in $installed) {
            $printersList += [string]$p
        }
    }

    $defaultPrinter = ""
    try {
        $settings = New-Object System.Drawing.Printing.PrinterSettings
        $defaultPrinter = [string]$settings.PrinterName
    } catch {
        # ignore error getting default printer
    }

    $serialList = @()
    try {
        $ports = [System.IO.Ports.SerialPort]::GetPortNames()
        if ($ports) {
            foreach ($pt in $ports) {
                $serialList += [string]$pt
            }
        }
    } catch {
        # ignore error getting serial ports
    }

    $outputObj = @{
        printers = $printersList
        defaultPrinter = $defaultPrinter
        serialPorts = $serialList
    }

    $json = $outputObj | ConvertTo-Json -Compress
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $json
    exit 0
} catch {
    $errObj = @{
        error = $_.Exception.Message
        printers = @()
        defaultPrinter = ""
        serialPorts = @()
    }
    Write-Output ($errObj | ConvertTo-Json -Compress)
    exit 1
}

