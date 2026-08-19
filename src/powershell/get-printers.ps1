$ErrorActionPreference = "Stop"

$printers = Get-CimInstance Win32_Printer | ForEach-Object {
  [PSCustomObject]@{
    name       = $_.Name
    portName   = $_.PortName
    driverName = $_.DriverName
    isDefault  = [bool]$_.Default
    offline    = [bool]$_.WorkOffline
    installed  = $true
    status     = if ($_.WorkOffline) { "Sin conexión" } elseif ($_.PrinterStatus -eq 1) { "Otro" } elseif ($_.PrinterStatus -eq 2) { "Desconocido" } elseif ($_.PrinterStatus -eq 3) { "Lista" } elseif ($_.PrinterStatus -eq 4) { "Imprimiendo" } elseif ($_.PrinterStatus -eq 5) { "Calentando" } else { "Instalada" }
  }
}

@($printers) | ConvertTo-Json -Compress
