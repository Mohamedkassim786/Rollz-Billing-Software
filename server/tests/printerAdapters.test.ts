/// <reference types="node" />
import { test, describe } from "node:test";
import assert from "node:assert";
import { UsbPrinterAdapter } from "../src/services/printer/usbPrinterAdapter";
import { BluetoothPrinterAdapter } from "../src/services/printer/bluetoothPrinterAdapter";
import { NetworkTcpPrinterAdapter } from "../src/services/printer/networkTcpPrinterAdapter";
import { mockPrinterAdapter } from "../src/services/printer/mockPrinterAdapter";
import { discoverPrinterDevices } from "../src/services/printer/printerDiscovery";

describe("Printer Adapters & Hardware Discovery Tests", () => {
  test("1. UsbPrinterAdapter initializes with printer name and sets type to USB", () => {
    const adapter = new UsbPrinterAdapter({
      printerName: "TVS-E RP 3230",
      paperWidth: 80,
      openCashDrawerOnReceipt: true,
    });

    assert.strictEqual(adapter.type, "USB");
    assert.ok(adapter.name.includes("TVS-E RP 3230"));
  });

  test("2. BluetoothPrinterAdapter initializes with COM port and sets type to BLUETOOTH", () => {
    const adapter = new BluetoothPrinterAdapter({
      address: "COM3",
      baudRate: 9600,
      paperWidth: 80,
    });

    assert.strictEqual(adapter.type, "BLUETOOTH");
    assert.ok(adapter.name.includes("COM3"));
  });

  test("3. NetworkTcpPrinterAdapter initializes with IP:port", () => {
    const adapter = new NetworkTcpPrinterAdapter({
      host: "192.168.1.200",
      port: 9100,
    });

    assert.strictEqual(adapter.type, "NETWORK_TCP");
    assert.ok(adapter.name.includes("192.168.1.200:9100"));
  });

  test("4. MockPrinterAdapter logs print jobs and supports failure simulation", async () => {
    mockPrinterAdapter.clearHistory();
    mockPrinterAdapter.setSimulateFailure(false);

    const res = await mockPrinterAdapter.print("job-1", "CUSTOMER_RECEIPT", "TEST RECEIPT");
    assert.strictEqual(res.success, true);
    assert.strictEqual(mockPrinterAdapter.getPrintHistory().length, 1);

    mockPrinterAdapter.setSimulateFailure(true, "Paper empty");
    const failRes = await mockPrinterAdapter.print("job-2", "CUSTOMER_RECEIPT", "TEST 2");
    assert.strictEqual(failRes.success, false);
    assert.strictEqual(failRes.error, "Paper empty");

    mockPrinterAdapter.setSimulateFailure(false);
  });

  test("5. discoverPrinterDevices returns device lists cleanly", async () => {
    const devices = await discoverPrinterDevices();
    assert.ok(Array.isArray(devices.printers));
    assert.ok(Array.isArray(devices.serialPorts));
    assert.strictEqual(typeof devices.defaultPrinter, "string");
  });
});
