param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$Base64Data,
  [string]$DocumentName = "La Barra RAW"
)

$ErrorActionPreference = "Stop"

$source = @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOC_INFO_1 {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string printerName, out IntPtr printerHandle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr printerHandle);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr printerHandle, int level, [In] DOC_INFO_1 docInfo);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr printerHandle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr printerHandle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr printerHandle);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr printerHandle, byte[] bytes, int count, out int written);

  public static void Send(string printerName, byte[] bytes, string documentName) {
    IntPtr handle;
    if (!OpenPrinter(printerName, out handle, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      var info = new DOC_INFO_1 { pDocName = documentName, pDataType = "RAW", pOutputFile = null };
      if (StartDocPrinter(handle, 1, info) == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(handle)) throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
          int written;
          if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length)
            throw new Win32Exception(Marshal.GetLastWin32Error());
        } finally { EndPagePrinter(handle); }
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
"@

Add-Type -TypeDefinition $source -Language CSharp
[RawPrinter]::Send($PrinterName, [Convert]::FromBase64String($Base64Data), $DocumentName)
