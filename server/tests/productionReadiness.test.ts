import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import fs from "fs";
import { app } from "../src/app";
import { setupTestEnvironment, testPrisma, TestAuthContext } from "./setup";
import { printerService } from "../src/services/printer/printerService";
import { backupService } from "../src/services/backupService";

let context: TestAuthContext;

test.before(async () => {
  context = await setupTestEnvironment();
});

test("Phase 9: Security Headers & Server Hardening", async (t) => {
  await t.test("Responses include standard defensive security headers and omit X-Powered-By", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.strictEqual(res.headers["x-frame-options"], "SAMEORIGIN");
    assert.strictEqual(res.headers["x-xss-protection"], "1; mode=block");
    assert.strictEqual(res.headers["x-powered-by"], undefined);
  });
});

test("Phase 9: Settings API & Role-Based Access", async (t) => {
  await t.test("GET /api/settings requires authentication", async () => {
    const res = await request(app).get("/api/settings");
    assert.strictEqual(res.status, 401);
  });

  await t.test("Owner can view branch settings, host info, and backups", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${context.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.branch);
    assert.strictEqual(res.body.branch.id, context.branch.id);
    assert.ok(res.body.hostInfo);
    assert.strictEqual(typeof res.body.hostInfo.port, "number");
    assert.ok(Array.isArray(res.body.backups));
  });

  await t.test("Cashier cannot update restaurant or printer settings", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${context.cashierToken}`)
      .send({
        name: "Unauthorized Update",
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, "FORBIDDEN");
  });

  await t.test("Owner can update printer configuration and branch details", async () => {
    const res = await request(app)
      .put("/api/settings")
      .set("Authorization", `Bearer ${context.ownerToken}`)
      .send({
        name: "ROLLZ Flagship Store",
        customerPrinterType: "MOCK",
        customerPrinterAddress: "192.168.1.150:9100",
        customerPrinterPaperWidth: 80,
        customerPrinterEnabled: true,
        kitchenPrinterType: "MOCK",
        kitchenPrinterAddress: "192.168.1.151:9100",
        kitchenPrinterPaperWidth: 80,
        kitchenPrinterEnabled: true,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.branch.name, "ROLLZ Flagship Store");
    assert.strictEqual(res.body.branch.customerPrinterAddress, "192.168.1.150:9100");
    assert.strictEqual(res.body.branch.kitchenPrinterAddress, "192.168.1.151:9100");
  });
});

test("Phase 9: Printer Integration & Test Ticket Dispatch", async (t) => {
  await t.test("Can dispatch test print for customer receipt printer", async () => {
    const res = await request(app)
      .post("/api/settings/printers/test")
      .set("Authorization", `Bearer ${context.ownerToken}`)
      .send({ destination: "CUSTOMER_RECEIPT" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.destination, "CUSTOMER_RECEIPT");
  });

  await t.test("Can dispatch test print for kitchen ticket printer", async () => {
    const res = await request(app)
      .post("/api/settings/printers/test")
      .set("Authorization", `Bearer ${context.ownerToken}`)
      .send({ destination: "KITCHEN" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.destination, "KITCHEN");
  });

  await t.test("Rejects test print with invalid destination", async () => {
    const res = await request(app)
      .post("/api/settings/printers/test")
      .set("Authorization", `Bearer ${context.ownerToken}`)
      .send({ destination: "INVALID_DEST" });

    assert.strictEqual(res.status, 400);
  });
});

test("Phase 9: Print Queue Crash Recovery", async (t) => {
  await t.test("Stale jobs stuck in PRINTING state recover back to PENDING", async () => {
    // 1. Create a dummy order and invoice to anchor the test print job
    const order = await testPrisma.order.create({
      data: {
        orderNumber: `ORD-REC-${Date.now()}`,
        branch: { connect: { id: context.branch.id } },
        cashier: { connect: { id: context.cashier.id } },
        status: "CONFIRMED",
        orderType: "DINE_IN",
        subtotal: 25000,
        taxTotal: 1250,
        discountTotal: 0,
        grandTotal: 26250,
      },
    });

    const invoice = await testPrisma.invoice.create({
      data: {
        invoiceNumber: `INV-REC-${Date.now()}`,
        order: { connect: { id: order.id } },
        branch: { connect: { id: context.branch.id } },
        cashier: { connect: { id: context.cashier.id } },
        subtotal: 25000,
        taxTotal: 1250,
        discountTotal: 0,
        grandTotal: 26250,
        snapshot: { orderId: order.id, grandTotal: 26250 },
      },
    });

    // 2. Insert a print job simulating a crash during physical printing
    const staleJob = await testPrisma.printJob.create({
      data: {
        branchId: context.branch.id,
        orderId: order.id,
        invoiceId: invoice.id,
        destination: "KITCHEN",
        status: "PRINTING", // Simulates crash while job was mid-flight
        payloadSnapshot: { text: "STALE TICKET CONTENT" },
        attemptCount: 1,
      },
    });

    // 3. Trigger queue recovery
    const recoveryResult = await printerService.recoverStalePrintJobs(context.branch.id, testPrisma);
    assert.ok(recoveryResult.recoveredCount >= 1);

    // 4. Verify job transitioned back to PENDING
    const updatedJob = await testPrisma.printJob.findUnique({
      where: { id: staleJob.id },
    });

    assert.ok(updatedJob);
    assert.strictEqual(updatedJob.status, "PENDING");
  });

  await t.test("POST /api/settings/queue/recover executes recovery via endpoint", async () => {
    const res = await request(app)
      .post("/api/settings/queue/recover")
      .set("Authorization", `Bearer ${context.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.recoveredCount === "number");
  });
});

test("Phase 9: Database Backups & Safe Test Restoration", async (t) => {
  let createdBackupFilename = "";

  await t.test("Manual backup execution creates timestamped dump file and BackupRecord", async () => {
    const backupResult = await backupService.createBackup({
      dbUrl: process.env.DATABASE_URL || "postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos_test?schema=public",
      clientDb: testPrisma,
    });

    assert.strictEqual(backupResult.status, "SUCCESS");
    assert.ok(backupResult.sizeBytes > 0);
    assert.ok(fs.existsSync(backupResult.filepath));
    createdBackupFilename = backupResult.filename;

    // Verify record in BackupRecord table
    const record = await testPrisma.backupRecord.findFirst({
      where: { filename: backupResult.filename },
    });
    assert.ok(record);
    assert.strictEqual(record.status, "SUCCESS");
  });

  await t.test("GET /api/settings/backups lists recorded database backups", async () => {
    const res = await request(app)
      .get("/api/settings/backups")
      .set("Authorization", `Bearer ${context.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.backups));
    assert.ok(res.body.backups.length >= 1);
  });

  await t.test("POST /api/settings/backup triggers backup via API", async () => {
    const res = await request(app)
      .post("/api/settings/backup")
      .set("Authorization", `Bearer ${context.ownerToken}`);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.backup.status, "SUCCESS");
    assert.ok(res.body.backup.filename.includes("rollz_pos_backup_"));
  });

  await t.test("Safe test restoration executes against rollz_pos_test without touching production", async () => {
    if (!createdBackupFilename) return;

    const restoreResult = await backupService.restoreBackup({
      backupFilename: createdBackupFilename,
      targetDatabase: "rollz_pos_test",
      confirmLiveOverwrite: false,
    });

    assert.strictEqual(restoreResult.success, true);
    assert.strictEqual(restoreResult.targetDatabase, "rollz_pos_test");
  });

  await t.test("Restore safety check rejects overwriting live database without explicit confirmation", async () => {
    await assert.rejects(
      async () => {
        await backupService.restoreBackup({
          backupFilename: createdBackupFilename,
          targetDatabase: "rollz_pos",
          confirmLiveOverwrite: false,
        });
      },
      /Live production restore requires explicit confirmLiveOverwrite: true/
    );
  });
});

test("Phase 9: Branch Isolation on Settings", async (t) => {
  await t.test("Other branch owner only sees and modifies their own branch settings", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${context.otherBranchOwnerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.branch.id, context.otherBranch.id);
    assert.notStrictEqual(res.body.branch.id, context.branch.id);
  });
});
