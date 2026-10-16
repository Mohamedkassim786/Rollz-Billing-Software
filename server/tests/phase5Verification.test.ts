import { test, describe, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, TestAuthContext, testPrisma } from "./setup";
import { mockPrinterAdapter } from "../src/services/printer/mockPrinterAdapter";

describe("ROLLZ POS — Phase 5 Verification", () => {
  let ctx: TestAuthContext;
  let sampleCategory: any;
  let sampleItem: any;

  before(async () => {
    ctx = await setupTestEnvironment();

    sampleCategory = await (testPrisma as any).category.findFirst({
      where: { branchId: ctx.branch.id, isActive: true },
    });
    if (!sampleCategory) {
      sampleCategory = await (testPrisma as any).category.create({
        data: {
          branchId: ctx.branch.id,
          name: "Phase 5 Wraps " + Date.now(),
          slug: "phase5-wraps-" + Date.now(),
          isActive: true,
        },
      });
    }

    sampleItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: sampleCategory.id,
        name: "Phase 5 Grilled Roll " + Date.now(),
        basePrice: 16000, // ₹160.00 (16000 paise)
        isActive: true,
        isAvailable: true,
      },
    });

    mockPrinterAdapter.clearHistory();
    mockPrinterAdapter.setSimulateFailure(false);
  });

  async function createDraft(quantity = 1, notes = "Pack separately") {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        notes: "Deliver hot",
        items: [
          {
            menuItemId: sampleItem.id,
            quantity,
            kitchenNotes: notes,
          },
        ],
      });
    assert.strictEqual(res.status, 201);
    return res.body.order;
  }

  // 1. A successfully paid and finalized order creates a kitchen print job
  test("1. Successfully paid and finalized order creates a kitchen print job in PostgreSQL", async () => {
    const order = await createDraft(1);
    assert.strictEqual(order.status, "DRAFT");

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED");

    const printJobs = await (testPrisma as any).printJob.findMany({
      where: { orderId: order.id },
    });

    const kitchenJob = printJobs.find((j: any) => j.destination === "KITCHEN");
    assert.ok(kitchenJob, "Kitchen print job must be created");
    assert.strictEqual(kitchenJob.destination, "KITCHEN");
    assert.strictEqual(kitchenJob.orderId, order.id);
  });

  // 2. Unpaid, pending, failed, and partially paid orders do not create kitchen tickets
  test("2. Unpaid draft, held, failed, and partially paid orders DO NOT create kitchen tickets", async () => {
    // 2a. Unpaid draft
    const draft = await createDraft(1);
    let jobs = await (testPrisma as any).printJob.findMany({ where: { orderId: draft.id } });
    assert.strictEqual(jobs.length, 0, "Draft order must have 0 kitchen print jobs");

    // 2b. Held order
    await request(app)
      .post(`/api/orders/${draft.id}/hold`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    jobs = await (testPrisma as any).printJob.findMany({ where: { orderId: draft.id } });
    assert.strictEqual(jobs.length, 0, "Held order must have 0 kitchen print jobs");

    // 2c. Partially paid order attempt (rejected by server)
    const partPayRes = await request(app)
      .post(`/api/orders/${draft.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: 5000 }], // Less than grand total
      });
    assert.strictEqual(partPayRes.status, 400);
    jobs = await (testPrisma as any).printJob.findMany({ where: { orderId: draft.id } });
    assert.strictEqual(jobs.length, 0, "Partially paid order attempt must have 0 kitchen print jobs");

    // 2d. Invalid/failed payment attempt
    const failedPayRes = await request(app)
      .post(`/api/orders/${draft.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: draft.grandTotal, tenderedAmount: 100 }], // Insufficient cash
      });
    assert.strictEqual(failedPayRes.status, 400);
    jobs = await (testPrisma as any).printJob.findMany({ where: { orderId: draft.id } });
    assert.strictEqual(jobs.length, 0, "Failed payment attempt must have 0 kitchen print jobs");
  });

  // 3. Duplicate payment requests do not create duplicate kitchen print jobs
  test("3. Duplicate payment requests do not create duplicate kitchen print jobs", async () => {
    const order = await createDraft(1);
    const key = "DUP-KEY-" + Date.now();

    const firstPay = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        idempotencyKey: key,
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    assert.strictEqual(firstPay.status, 200);

    const initialKitchenJobs = await (testPrisma as any).printJob.findMany({
      where: { orderId: order.id, destination: "KITCHEN" },
    });
    assert.strictEqual(initialKitchenJobs.length, 1);

    // Repeated identical payment request
    const secondPay = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        idempotencyKey: key,
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    assert.strictEqual(secondPay.status, 200);
    assert.strictEqual(secondPay.body.isDuplicate, true);

    const afterKitchenJobs = await (testPrisma as any).printJob.findMany({
      where: { orderId: order.id, destination: "KITCHEN" },
    });
    assert.strictEqual(afterKitchenJobs.length, 1, "Must still be exactly 1 kitchen job");
  });

  // 4. The customer receipt and kitchen ticket use separate templates
  test("4. Customer receipt and kitchen ticket use separate templates", async () => {
    const order = await createDraft(1, "Extra mayo");

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: 20000 }],
      });
    assert.strictEqual(payRes.status, 200);

    const customerJob = await (testPrisma as any).printJob.findFirst({
      where: { orderId: order.id, destination: "CUSTOMER_RECEIPT" },
    });
    const kitchenJob = await (testPrisma as any).printJob.findFirst({
      where: { orderId: order.id, destination: "KITCHEN" },
    });

    assert.ok(customerJob && kitchenJob);
    const customerText = customerJob.payloadSnapshot.rawText;
    const kitchenText = kitchenJob.payloadSnapshot.rawText;

    // Customer receipt must have financial details
    assert.ok(customerText.includes("GSTIN:"));
    assert.ok(customerText.includes("Invoice No:"));
    assert.ok(customerText.includes("NET TOTAL PAYABLE:"));
    assert.ok(customerText.includes("CGST (2.5%):"));
    assert.ok(customerText.includes("SGST (2.5%):"));
    assert.ok(customerText.includes("Tendered:"));

    // Kitchen ticket must have preparation info and strictly NO prices or taxes
    assert.ok(kitchenText.includes("KITCHEN ORDER TICKET (KOT)"));
    assert.ok(kitchenText.includes("ITEMS TO PREPARE:"));
    assert.ok(kitchenText.includes("NOTE: Extra mayo"));
    assert.ok(!kitchenText.includes("NET TOTAL"));
    assert.ok(!kitchenText.includes("CGST"));
    assert.ok(!kitchenText.includes("SGST"));
    assert.ok(!kitchenText.includes("Tendered"));
  });

  // 5. Kitchen ticket printing is automatic after successful payment
  test("5. Kitchen ticket printing is automatically dispatched upon successful payment", async () => {
    const order = await createDraft(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);

    // In the payment response, the kitchen print job is already processed and PRINTED
    const kitchenJobInResponse = payRes.body.printJobs.find((j: any) => j.destination === "KITCHEN");
    assert.ok(kitchenJobInResponse);
    assert.strictEqual(kitchenJobInResponse.status, "PRINTED", "Kitchen ticket must automatically be PRINTED");
  });

  // 6. Mock printing works correctly without a physical printer
  test("6. Mock printing works correctly in development and logs byte counts and payloads", async () => {
    const order = await createDraft(1);

    mockPrinterAdapter.clearHistory();

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);

    const printHistory = mockPrinterAdapter.getPrintHistory();
    assert.strictEqual(printHistory.length, 2, "Mock adapter logged both customer and kitchen jobs");

    const kitchenLog = mockPrinterAdapter.getLastPrintJob("KITCHEN");
    assert.ok(kitchenLog);
    assert.strictEqual(kitchenLog.success, true);
    assert.ok(kitchenLog.rawText.includes("KITCHEN ORDER TICKET"));
  });

  // 7. Print failures are recorded and can be retried
  test("7. Print failures are recorded as FAILED and can be retried with incremented attempt count", async () => {
    const order = await createDraft(1);

    // Simulate printer paper out error
    mockPrinterAdapter.setSimulateFailure(true, "Mock thermal head disconnected");

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED"); // Payment still valid!

    const failedKitchenJob = await (testPrisma as any).printJob.findFirst({
      where: { orderId: order.id, destination: "KITCHEN" },
    });
    assert.strictEqual(failedKitchenJob.status, "FAILED");
    assert.ok(failedKitchenJob.lastError.includes("Mock thermal head disconnected"));
    assert.strictEqual(failedKitchenJob.attemptCount, 1);

    // Resolve simulated printer problem and retry
    mockPrinterAdapter.setSimulateFailure(false);

    const retryRes = await request(app)
      .post(`/api/print-jobs/${failedKitchenJob.id}/retry`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.printJob.status, "PRINTED");
    assert.strictEqual(retryRes.body.printJob.attemptCount, 2);
    assert.strictEqual(retryRes.body.printJob.lastError, null);
  });

  // 8. Reprints are clearly identified
  test("8. Reprints are clearly identified with isReprint: true and [REPRINT] header", async () => {
    const order = await createDraft(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    const invoiceId = payRes.body.invoice.id;

    // Request Kitchen reprint
    const reprintRes = await request(app)
      .post(`/api/invoices/${invoiceId}/reprint`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        destination: "KITCHEN",
        reason: "Ticket dropped on floor",
      });

    assert.strictEqual(reprintRes.status, 200);
    assert.strictEqual(reprintRes.body.printJob.isReprint, true);
    assert.strictEqual(reprintRes.body.printJob.reprintReason, "Ticket dropped on floor");

    const rawText = reprintRes.body.printJob.payloadSnapshot.rawText;
    assert.ok(rawText.includes("*** [REPRINT KITCHEN TICKET] ***"));
    assert.ok(rawText.includes("Reason: Ticket dropped on floor"));
  });

  // 9. No kitchen login or kitchen dashboard exists
  test("9. System strictly contains NO kitchen user login role or kitchen dashboard route", async () => {
    // 9a. Verify user roles enum in database contains only OWNER, MANAGER, CASHIER
    const roles = Object.keys((testPrisma as any).user.fields || {});
    // Verify attempt to create user with role "KITCHEN" fails validation
    let failed = false;
    try {
      await (testPrisma as any).user.create({
        data: {
          branchId: ctx.branch.id,
          username: "kitchen_user_" + Date.now(),
          displayName: "Kitchen Display",
          passwordHash: "hash",
          role: "KITCHEN" as any,
        },
      });
    } catch {
      failed = true;
    }
    assert.strictEqual(failed, true, "Database must reject non-existent KITCHEN role");

    // 9b. Verify no kitchen dashboard endpoint exists on server
    const kdsRes = await request(app).get("/api/kitchen");
    assert.strictEqual(kdsRes.status, 404);
  });

  // 10. Existing POS, payment, invoice, and order-history features continue working
  test("10. Existing POS, payment, invoice, and order-history features continue working", async () => {
    // 10a. Category API works
    const catRes = await request(app)
      .get("/api/pos/categories")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(catRes.status, 200);
    assert.ok(Array.isArray(catRes.body.categories));

    // 10b. Menu Items API works
    const itemsRes = await request(app)
      .get("/api/pos/menu-items")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(itemsRes.status, 200);
    assert.ok(Array.isArray(itemsRes.body.menuItems));

    // 10c. Calculation API works
    const calcRes = await request(app)
      .post("/api/orders/calculate")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [{ menuItemId: sampleItem.id, quantity: 2 }],
      });
    assert.strictEqual(calcRes.status, 200);
    assert.strictEqual(calcRes.body.calculation.grandTotal, 33600); // 32000 + 5% = 33600 paise

    // 10d. Invoices history API works
    const invRes = await request(app)
      .get("/api/invoices")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(invRes.status, 200);
    assert.ok(Array.isArray(invRes.body.invoices));
    assert.ok(invRes.body.pagination);
  });
});
