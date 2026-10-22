Add-Type -AssemblyName System.Drawing

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$srcPath = Join-Path $ScriptDir "client\public\rollz-logo.png"
$icoPath = Join-Path $ScriptDir "rollz-logo.ico"

$src = [System.Drawing.Image]::FromFile($srcPath)
$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Draw modern rounded rectangle background (squircle)
$rect = New-Object System.Drawing.Rectangle(8, 8, 240, 240)
$radius = 48

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
$path.AddArc($rect.X + $rect.Width - $radius, $rect.Y, $radius, $radius, 270, 90)
$path.AddArc($rect.X + $rect.Width - $radius, $rect.Y + $rect.Height - $radius, $radius, $radius, 0, 90)
$path.AddArc($rect.X, $rect.Y + $rect.Height - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()

# Fill background with clean white / subtle contrast
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillPath($brush, $path)
$brush.Dispose()

# Subtle outer border
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 226, 232, 240), 3)
$g.DrawPath($pen, $path)
$pen.Dispose()
$path.Dispose()

# Fit logo inside the squircle (padding 28px)
$maxW = 200
$maxH = 180
$scale = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
$newW = [int]($src.Width * $scale)
$newH = [int]($src.Height * $scale)
$posX = [int]((256 - $newW) / 2)
$posY = [int]((256 - $newH) / 2)

$g.DrawImage($src, $posX, $posY, $newW, $newH)

$g.Dispose()
$src.Dispose()

# Save as PNG stream
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()
$bmp.Dispose()

# Write standard ICO file containing the 256x256 PNG
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = Icon
$bw.Write([uint16]1) # 1 image

# Directory Entry (16 bytes)
$bw.Write([byte]0)   # Width: 0 means 256
$bw.Write([byte]0)   # Height: 0 means 256
$bw.Write([byte]0)   # Colors
$bw.Write([byte]0)   # Reserved
$bw.Write([uint16]1) # Planes
$bw.Write([uint16]32) # Bit count
$bw.Write([uint32]$pngBytes.Length) # Image size in bytes
$bw.Write([uint32]22) # Offset (6 header + 16 entry = 22)

$bw.Write($pngBytes)
$bw.Flush()
$bw.Dispose()
$fs.Dispose()

Write-Host "Generated rollz-logo.ico at $icoPath"
