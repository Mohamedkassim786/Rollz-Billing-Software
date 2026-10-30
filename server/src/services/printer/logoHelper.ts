import fs from "fs";
import path from "path";

let defaultLogoCache: Buffer | null = null;

/**
 * Returns ESC/POS raster bit image bytes for the receipt logo (GS v 0).
 * Pre-centered and ready to prepend to customer receipts.
 */
export function getReceiptLogoBuffer(customLogoPath?: string | null): Buffer {
  // 1. If custom logo path is specified and converted, check for its .bin file
  if (customLogoPath) {
    try {
      const cleanPath = customLogoPath.replace(/^\//, "");
      const customBinPath = path.resolve(process.cwd(), cleanPath + ".bin");
      if (fs.existsSync(customBinPath)) {
        return fs.readFileSync(customBinPath);
      }
    } catch {}
  }

  // 2. Return cached default Rollz logo binary
  if (defaultLogoCache && defaultLogoCache.length > 0) {
    return defaultLogoCache;
  }

  // Look in multiple candidate locations for rollz-logo-escpos.bin
  const candidates = [
    path.resolve(__dirname, "assets", "rollz-logo-escpos.bin"),
    path.resolve(__dirname, "../../../src/services/printer/assets", "rollz-logo-escpos.bin"),
    path.resolve(process.cwd(), "server/src/services/printer/assets", "rollz-logo-escpos.bin"),
    path.resolve(process.cwd(), "server/dist/services/printer/assets", "rollz-logo-escpos.bin"),
    path.resolve(process.cwd(), "src/services/printer/assets", "rollz-logo-escpos.bin"),
    path.resolve(process.cwd(), "dist/services/printer/assets", "rollz-logo-escpos.bin"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const buf = fs.readFileSync(candidate);
        // Safety check: ensure yH (byte 10) is 0 for logos under 256 lines (prevents printer getting stuck waiting for bytes)
        if (buf.length > 10 && buf[10] !== 0) {
          buf[10] = 0;
        }
        defaultLogoCache = buf;
        return defaultLogoCache;
      } catch {}
    }
  }

  return Buffer.alloc(0);
}

