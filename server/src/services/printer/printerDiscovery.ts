import { execFile } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

export interface DiscoveredDevices {
  printers: string[];
  serialPorts: string[];
  defaultPrinter: string;
}

export async function discoverPrinterDevices(): Promise<DiscoveredDevices> {
  if (process.platform === "win32") {
    return new Promise<DiscoveredDevices>((resolve) => {
      const scriptName = "discoverDevicesWindows.ps1";
      const direct = path.resolve(__dirname, "scripts", scriptName);
      const scriptPath =
        fs.existsSync(direct)
          ? direct
          : fs.existsSync(path.resolve(__dirname, "../../../src/services/printer/scripts", scriptName))
          ? path.resolve(__dirname, "../../../src/services/printer/scripts", scriptName)
          : fs.existsSync(path.resolve(process.cwd(), "server/src/services/printer/scripts", scriptName))
          ? path.resolve(process.cwd(), "server/src/services/printer/scripts", scriptName)
          : fs.existsSync(path.resolve(process.cwd(), "src/services/printer/scripts", scriptName))
          ? path.resolve(process.cwd(), "src/services/printer/scripts", scriptName)
          : direct;

      execFile(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
        { timeout: 6000 },
        (error, stdout) => {
          if (error) {
            console.warn("Failed to discover Windows printer devices via PowerShell:", error.message);
            resolve({
              printers: [],
              serialPorts: [],
              defaultPrinter: "",
            });
            return;
          }

          try {
            const data = JSON.parse(stdout.trim());
            resolve({
              printers: Array.isArray(data.printers) ? data.printers : [],
              serialPorts: Array.isArray(data.serialPorts) ? data.serialPorts : [],
              defaultPrinter: data.defaultPrinter || "",
            });
          } catch {
            resolve({
              printers: [],
              serialPorts: [],
              defaultPrinter: "",
            });
          }
        }
      );
    });
  }

  // Unix / Linux discovery fallback
  const printers: string[] = [];
  const serialPorts: string[] = [];

  try {
    if (fs.existsSync("/dev")) {
      const devFiles = fs.readdirSync("/dev");
      for (const f of devFiles) {
        if (f.startsWith("usb/lp") || f.startsWith("lp")) {
          printers.push(`/dev/${f}`);
        }
        if (f.startsWith("ttyUSB") || f.startsWith("ttyACM") || f.startsWith("rfcomm")) {
          serialPorts.push(`/dev/${f}`);
        }
      }
    }
  } catch {
    // Ignore file system errors
  }

  return {
    printers,
    serialPorts,
    defaultPrinter: printers[0] || "",
  };
}
