/**
 * Web Printer Utility for ROLLZ POS
 * Supports Web Bluetooth, Web Serial, and System Browser Printing
 */

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

// Common GATT Services used by Bluetooth Thermal POS Printers
const BT_THERMAL_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common ESC/POS POS printer service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent Serial
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Feasycom BLE
  0x18f0,
];

export function sanitizeThermalText(text: string): string {
  return text
    .replace(/₹/g, "Rs.")
    .replace(/[•●]/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...");
}

export async function loadLogoEscPosBytes(logoUrl: string = "/rollz-logo.png"): Promise<Uint8Array | null> {
  try {
    if (typeof window === "undefined" || !document) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = logoUrl;
    });

    const targetWidth = 288;
    const targetHeight = 128;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
    const xBytes = targetWidth / 8;
    const xL = xBytes % 256;
    const xH = Math.floor(xBytes / 256);
    const yL = targetHeight % 256;
    const yH = Math.floor(targetHeight / 256);

    const header = [0x1b, 0x61, 0x01, 0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH];
    const dataBytes = new Uint8Array(xBytes * targetHeight);

    for (let y = 0; y < targetHeight; y++) {
      for (let colByte = 0; colByte < xBytes; colByte++) {
        let currByte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = colByte * 8 + bit;
          const idx = (y * targetWidth + x) * 4;
          const a = imgData[idx + 3];
          if (a > 60) {
            const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
            if (lum < 190) {
              currByte |= 1 << (7 - bit);
            }
          }
        }
        dataBytes[y * xBytes + colByte] = currByte;
      }
    }

    const footer = [0x0a, 0x1b, 0x61, 0x00];
    const total = new Uint8Array(header.length + dataBytes.length + footer.length);
    total.set(header, 0);
    total.set(dataBytes, header.length);
    total.set(footer, header.length + dataBytes.length);
    return total;
  } catch {
    return null;
  }
}

function buildEscPosBuffer(
  input: string | Uint8Array,
  openDrawer: boolean = false,
  logoBytes?: Uint8Array | null
): Uint8Array {
  if (input instanceof Uint8Array) {
    if (!openDrawer) return input;
    // Append drawer kick if needed
    const drawer = [0x1b, 0x70, 0x00, 0x19, 0xfa];
    const combined = new Uint8Array(input.length + drawer.length);
    combined.set(input, 0);
    combined.set(drawer, input.length);
    return combined;
  }

  const cleanText = sanitizeThermalText(input);
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(cleanText + "\n\n\n\n");

  // ESC @: Init (27, 64)
  const init = [0x1b, 0x40];
  // GS V 0: Full cut (29, 86, 0)
  const cut = [0x1d, 0x56, 0x00];
  // ESC p 0 25 250: Drawer kick
  const drawer = openDrawer ? [0x1b, 0x70, 0x00, 0x19, 0xfa] : [];
  const logo = logoBytes || [];

  const totalLength = init.length + logo.length + textBytes.length + cut.length + drawer.length;
  const buffer = new Uint8Array(totalLength);

  let offset = 0;
  buffer.set(init, offset);
  offset += init.length;
  if (logo.length > 0) {
    buffer.set(logo, offset);
    offset += logo.length;
  }
  buffer.set(textBytes, offset);
  offset += textBytes.length;
  buffer.set(cut, offset);
  offset += cut.length;
  if (drawer.length > 0) {
    buffer.set(drawer, offset);
  }

  return buffer;
}

/**
 * Direct print to a Bluetooth Thermal printer via Web Bluetooth API
 */
export async function printViaWebBluetooth(
  input: string | Uint8Array,
  openDrawer: boolean = false
): Promise<{ success: boolean; message: string }> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or pair in Windows.");
  }

  try {
    const nav: any = navigator;
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: [0x18f0] }, { namePrefix: "POS" }, { namePrefix: "RP" }, { namePrefix: "MTP" }, { namePrefix: "MPT" }, { namePrefix: "Bluetooth" }],
      optionalServices: BT_THERMAL_SERVICES,
      acceptAllDevices: false,
    }).catch(async () => {
      // Fallback: accept all devices if filtered request failed
      return await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_THERMAL_SERVICES,
      });
    });

    if (!device || !device.gatt) {
      throw new Error("No Bluetooth device selected.");
    }

    const server = await device.gatt.connect();

    // Look for a writable characteristic in services
    let writeChar: any = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error("No writable printing channel found on this Bluetooth device.");
    }

    const logoBytes = typeof input === "string" ? await loadLogoEscPosBytes() : null;
    const payload = buildEscPosBuffer(input, openDrawer, logoBytes);
    const CHUNK_SIZE = 512; // BLE characteristic packet limit

    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const chunk = payload.slice(i, i + CHUNK_SIZE);
      if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
    }

    // Disconnect after short delay to flush
    setTimeout(() => {
      try {
        if (device.gatt?.connected) device.gatt.disconnect();
      } catch {
        // Ignore disconnect error
      }
    }, 1000);

    return {
      success: true,
      message: `Printed successfully to Bluetooth device '${device.name || "Thermal Printer"}'!`,
    };
  } catch (err: any) {
    if (err.name === "NotFoundError" || err.message?.includes("cancelled")) {
      return { success: false, message: "Bluetooth device selection cancelled." };
    }
    throw err;
  }
}

/**
 * Direct print to a Serial / USB Virtual COM port via Web Serial API
 */
export async function printViaWebSerial(
  input: string | Uint8Array,
  baudRate: number = 9600,
  openDrawer: boolean = false
): Promise<{ success: boolean; message: string }> {
  if (!isWebSerialSupported()) {
    throw new Error("Web Serial is not supported in this browser. Please use Chrome or Edge.");
  }

  try {
    const nav: any = navigator;
    const port = await nav.serial.requestPort();
    await port.open({ baudRate });

    const writer = port.writable.getWriter();
    const logoBytes = typeof input === "string" ? await loadLogoEscPosBytes() : null;
    const payload = buildEscPosBuffer(input, openDrawer, logoBytes);

    await writer.write(payload);
    writer.releaseLock();
    await port.close();

    return {
      success: true,
      message: "Printed successfully via Web Serial port!",
    };
  } catch (err: any) {
    if (err.name === "NotFoundError" || err.message?.includes("cancelled")) {
      return { success: false, message: "Port selection cancelled." };
    }
    throw err;
  }
}

/**
 * Universal browser print fallback (opens printable receipt window)
 */
export function printViaBrowser(rawText: string, title: string = "Receipt"): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 10px;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            width: 76mm;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>${rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1500);
  }, 300);
}
