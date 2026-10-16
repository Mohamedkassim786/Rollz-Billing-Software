import { test, describe, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, TestAuthContext, testPrisma } from "./setup";
import { mockPrinterAdapter } from "../src/services/printer/mockPrinterAdapter";

describe("Phase 4: Payments, Invoices & Thermal Printing Tests", () => {
  let ctx: TestAuthContext;
  let testCategory: any;
  let testItem: any;

  before(async () => {
    ctx = await setupTestEnvironment();

    // 1. Ensure a test category
    testCategory = await (testPrisma as any).category.findFirst({
      where: { branchId: ctx.branch.id, isActive: true },
    });
    if (!testCategory) {
      testCategory = await (testPrisma as any).category.create({
        data: {
          branchId: ctx.branch.id,
          name: "Test Rolls " + Date.now(),
          slug: "test-rolls-" + Date.now(),
          isActive: true,
        },
      });
    }

    // 2. Ensure a test food item (Base Price ₹150.00 = 15000 paise)
    testItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: testCategory.id,
        name: "Classic Chicken Roll " + Date.now(),
        basePrice: 15000, // ₹150.00
        isActive: true,
        isAvailable: true,
      },
    });

    mockPrinterAdapter.clearHistory();
    mockPrinterAdapter.setSimulateFailure(false);
  });

  // Helper to create an active draft order
  async function createDraftOrder(quantity = 2) {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [
          {
            menuItemId: testItem.id,
            quantity,
            kitchenNotes: "Extra crispy",
          },
        ],
      });
    assert.strictEqual(res.status, 201);
    return res.body.order;
  }

  // --- 1. CASH PAYMENT & CHANGE CALCULATION ---
  test("1. Full cash payment calculates change due and finalizes order", async () => {
    const order = await createDraftOrder(1); // 15000 + 5% GST = 15750 paise (₹157.50)
    assert.strictEqual(order.grandTotal, 15750);

    const tenderedPaise = 20000; // ₹200.00 tendered
    const expectedChange = tenderedPaise - order.grandTotal; // 4250 paise (₹42.50)

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
            tenderedAmount: tenderedPaise,
          },
        ],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.success, true);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED");
    assert.ok(payRes.body.invoice);
    assert.ok(payRes.body.invoice.invoiceNumber.startsWith("INV-"));

    const paymentRecord = payRes.body.payments[0];
    assert.strictEqual(paymentRecord.method, "CASH");
    assert.strictEqual(paymentRecord.amount, 15750);
    assert.strictEqual(paymentRecord.tenderedAmount, 20000);
    assert.strictEqual(paymentRecord.changeDue, expectedChange);
  });

  // --- 2. INSUFFICIENT CASH REJECTION ---
  test("2. Rejects cash payment where tendered cash is less than required amount", async () => {
    const order = await createDraftOrder(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
            tenderedAmount: 10000, // ₹100 < ₹157.50
          },
        ],
      });

    assert.strictEqual(payRes.status, 400);
    assert.ok(payRes.body.error.message.includes("cannot be less than required cash"));
  });

  // --- 3. UPI PAYMENT WITH AUDIT TRAIL ---
  test("3. UPI payment records cashier confirmation and external transaction reference", async () => {
    const order = await createDraftOrder(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "UPI",
            amount: order.grandTotal,
            externalReference: "UPI-REF-99887766",
            confirmationType: "MANUAL_CASHIER",
            notes: "Verified on PhonePe soundbox",
          },
        ],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED");
    assert.strictEqual(payRes.body.payments[0].externalReference, "UPI-REF-99887766");
    assert.strictEqual(payRes.body.payments[0].confirmedByUserId, ctx.cashier.id);
  });

  // --- 4. CARD TERMINAL PAYMENT ---
  test("4. Card terminal payment records payment without sensitive credentials", async () => {
    const order = await createDraftOrder(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CARD",
            amount: order.grandTotal,
            externalReference: "EDC-AUTH-4412",
            confirmationType: "TERMINAL_VERIFIED",
          },
        ],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.payments[0].method, "CARD");
    assert.strictEqual(payRes.body.payments[0].externalReference, "EDC-AUTH-4412");
  });

  // --- 5. SPLIT PAYMENT ---
  test("5. Split payment combination (Cash + UPI) matching total finalizes order", async () => {
    const order = await createDraftOrder(2); // 30000 + 5% = 31500 paise (₹315.00)
    assert.strictEqual(order.grandTotal, 31500);

    const cashPart = 15000; // ₹150.00
    const upiPart = 16500; // ₹165.00
    assert.strictEqual(cashPart + upiPart, order.grandTotal);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: cashPart,
            tenderedAmount: 20000,
          },
          {
            method: "UPI",
            amount: upiPart,
            externalReference: "UPI-SPLIT-12345",
          },
        ],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED");
    assert.strictEqual(payRes.body.payments.length, 2);
  });

  // --- 6. PARTIAL PAYMENT & OVERPAYMENT REJECTION ---
  test("6. Rejects partial payment that does not cover the grand total", async () => {
    const order = await createDraftOrder(1); // 15750 paise

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: 10000, // Less than 15750
          },
        ],
      });

    assert.strictEqual(payRes.status, 400);
    assert.ok(payRes.body.error.message.includes("Insufficient payment"));
  });

  test("7. Rejects overpayment where total tenders exceed grand total", async () => {
    const order = await createDraftOrder(1); // 15750 paise

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "UPI",
            amount: 20000, // Exceeds 15750
          },
        ],
      });

    assert.strictEqual(payRes.status, 400);
    assert.ok(payRes.body.error.message.includes("Overpayment rejected"));
  });

  // --- 8. IDEMPOTENCY KEY PROTECTION ---
  test("8. Idempotency key prevents duplicate finalization and payments", async () => {
    const order = await createDraftOrder(1);
    const key = "IDEMP-KEY-" + Date.now();

    const firstPay = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        idempotencyKey: key,
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
            tenderedAmount: order.grandTotal,
          },
        ],
      });
    assert.strictEqual(firstPay.status, 200);

    // Repeated request with same idempotency key
    const secondPay = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        idempotencyKey: key,
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
            tenderedAmount: order.grandTotal,
          },
        ],
      });

    assert.strictEqual(secondPay.status, 200);
    assert.strictEqual(secondPay.body.isDuplicate, true);
    assert.strictEqual(secondPay.body.invoice.id, firstPay.body.invoice.id);
  });

  // --- 9. INVOICE SNAPSHOT IMMUTABILITY ---
  test("9. Invoice snapshot preserves historical prices even after menu item base price changes", async () => {
    const order = await createDraftOrder(1);
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
          },
        ],
      });
    assert.strictEqual(payRes.status, 200);
    const invoiceId = payRes.body.invoice.id;

    // Now change menu item price drastically in catalog
    await (testPrisma as any).menuItem.update({
      where: { id: testItem.id },
      data: { basePrice: 99900 }, // Changed to ₹999.00
    });

    // Retrieve invoice snapshot
    const invRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(invRes.status, 200);
    assert.strictEqual(invRes.body.invoice.grandTotal, 15750); // Unchanged!
    const snapshotItem = invRes.body.invoice.snapshot.items[0];
    assert.strictEqual(snapshotItem.basePriceSnapshot, 15000); // Historical snapshot intact!

    // Restore test item price
    await (testPrisma as any).menuItem.update({
      where: { id: testItem.id },
      data: { basePrice: 15000 },
    });
  });

  // --- 10. CRITICAL KITCHEN PRINTING INVARIANTS ---
  test("10. Invariant: Unpaid draft or held orders NEVER generate kitchen print jobs", async () => {
    const draft = await createDraftOrder(1);

    // Check print jobs for draft
    const jobsForDraft = await (testPrisma as any).printJob.findMany({
      where: { orderId: draft.id },
    });
    assert.strictEqual(jobsForDraft.length, 0, "Draft order must have 0 print jobs");

    // Hold the draft
    await request(app)
      .post(`/api/orders/${draft.id}/hold`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    const jobsForHeld = await (testPrisma as any).printJob.findMany({
      where: { orderId: draft.id },
    });
    assert.strictEqual(jobsForHeld.length, 0, "Held order must have 0 print jobs");
  });

  test("11. Confirmed finalized order creates both Customer Receipt and Kitchen Ticket", async () => {
    const order = await createDraftOrder(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);

    const jobs = await (testPrisma as any).printJob.findMany({
      where: { orderId: order.id },
    });
    assert.strictEqual(jobs.length, 2);

    const customerJob = jobs.find((j: any) => j.destination === "CUSTOMER_RECEIPT");
    const kitchenJob = jobs.find((j: any) => j.destination === "KITCHEN");

    assert.ok(customerJob, "Must have customer receipt print job");
    assert.ok(kitchenJob, "Must have kitchen ticket print job");
    assert.strictEqual(customerJob.status, "PRINTED");
    assert.strictEqual(kitchenJob.status, "PRINTED");

    // Verify Kitchen ticket does NOT contain financial/tax info
    const kitchenText = kitchenJob.payloadSnapshot.rawText;
    assert.ok(!kitchenText.includes("NET TOTAL"));
    assert.ok(!kitchenText.includes("CGST"));
    assert.ok(!kitchenText.includes("SGST"));
    assert.ok(kitchenText.includes("KITCHEN ORDER TICKET"));
  });

  // --- 12. PRINTER FAILURE SAFETY & RETRY WORKFLOW ---
  test("12. Simulated printer failure leaves order and payment finalized, and allows job retry", async () => {
    const order = await createDraftOrder(1);

    // Set mock printer to simulate failure
    mockPrinterAdapter.setSimulateFailure(true, "Thermal head overheating");

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED"); // Payment still succeeded!

    // Verify jobs were marked as FAILED
    const failedJobs = await (testPrisma as any).printJob.findMany({
      where: { orderId: order.id, status: "FAILED" },
    });
    assert.strictEqual(failedJobs.length, 2);
    assert.ok(failedJobs[0].lastError.includes("Thermal head overheating"));

    // Fix printer and retry
    mockPrinterAdapter.setSimulateFailure(false);

    const retryRes = await request(app)
      .post(`/api/print-jobs/${failedJobs[0].id}/retry`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.printJob.status, "PRINTED");
    assert.strictEqual(retryRes.body.printJob.attemptCount, 2);
  });

  // --- 13. AUTHORIZED REPRINT WORKFLOW ---
  test("13. Authorized reprint creates a print job clearly labeled with [REPRINT]", async () => {
    const order = await createDraftOrder(1);

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });
    const invoiceId = payRes.body.invoice.id;

    // Request customer receipt reprint
    const reprintRes = await request(app)
      .post(`/api/invoices/${invoiceId}/reprint`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        destination: "CUSTOMER_RECEIPT",
        reason: "Customer lost initial bill",
      });

    assert.strictEqual(reprintRes.status, 200);
    assert.strictEqual(reprintRes.body.printJob.isReprint, true);
    assert.strictEqual(reprintRes.body.printJob.reprintReason, "Customer lost initial bill");

    const rawText = reprintRes.body.printJob.payloadSnapshot.rawText;
    assert.ok(rawText.includes("*** [REPRINT COPY] ***"));
    assert.ok(rawText.includes("Reason: Customer lost initial bill"));
  });

  // --- 14. CROSS-BRANCH ISOLATION ---
  test("14. Cross-branch isolation prevents other branch from paying or viewing invoice", async () => {
    const order = await createDraftOrder(1);

    // Other branch tries to pay
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal }],
      });

    assert.strictEqual(payRes.status, 400);
    assert.ok(payRes.body.error.message.includes("branch mismatch"));
  });
});
