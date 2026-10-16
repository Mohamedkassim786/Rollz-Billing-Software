import { test, describe, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, TestAuthContext, testPrisma } from "./setup";

describe("Phase 7: Cash Management, Cashier Shifts & Daily Closing Tests", () => {
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
          name: "Cash Test Category " + Date.now(),
          slug: "cash-cat-" + Date.now(),
          isActive: true,
        },
      });
    }

    // 2. Ensure test item: ₹150.00 = 15000 paise basePrice
    testItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: testCategory.id,
        name: "Cash Test Wrap " + Date.now(),
        basePrice: 15000,
        isActive: true,
        isAvailable: true,
      },
    });

    // Close any lingering open shifts in test database
    await (testPrisma as any).cashierShift.updateMany({
      where: { status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  });

  // Helper to create an active draft order
  async function createDraftOrder(quantity = 1) {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [
          {
            menuItemId: testItem.id,
            quantity,
            kitchenNotes: "Phase 7 test order",
          },
        ],
      });
    assert.strictEqual(res.status, 201);
    return res.body.order;
  }

  // 1. Starting a cashier shift
  test("1. Cashier can successfully start a shift with opening cash float", async () => {
    const res = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        openingCash: 200000, // ₹2,000.00
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.openingCash, 200000);
    assert.strictEqual(res.body.data.status, "OPEN");
    assert.ok(res.body.data.shiftNumber.startsWith("SFT-"));
  });

  // 2. Rejecting negative opening cash
  test("2. Rejects negative opening cash amounts", async () => {
    // Attempt with cashier2 on other branch
    const res = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`)
      .send({
        openingCash: -5000,
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error.message, /cannot be negative/);
  });

  // 3. Preventing duplicate open shifts
  test("3. Concurrency-safe guard prevents cashier from starting duplicate open shifts", async () => {
    const res = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        openingCash: 100000,
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error.code, "ACTIVE_SHIFT_EXISTS");
  });

  // 4. Calculating expected drawer cash correctly
  test("4. Calculates expected drawer cash correctly from opening float and sales", async () => {
    const activeRes = await request(app)
      .get("/api/shifts/active")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(activeRes.status, 200);
    assert.ok(activeRes.body.data.shift);
    const initialExpected = activeRes.body.data.financials.expectedDrawerCash;
    assert.strictEqual(initialExpected, 200000); // Only opening cash initially
  });

  // 5. Correctly separating cash, UPI, and card payments
  test("5. Correctly separates cash, UPI, and card tenders without commingling non-cash into drawer", async () => {
    // 5a. Pay Order 1 with UPI (e.g. ₹157.50 = 15750 paise)
    const orderUpi = await createDraftOrder(1);
    const upiPay = await request(app)
      .post(`/api/orders/${orderUpi.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "UPI", amount: orderUpi.grandTotal, externalReference: "UPI-REF-001" }],
      });
    assert.strictEqual(upiPay.status, 200);

    // 5b. Pay Order 2 with CARD (e.g. ₹157.50 = 15750 paise)
    const orderCard = await createDraftOrder(1);
    const cardPay = await request(app)
      .post(`/api/orders/${orderCard.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CARD", amount: orderCard.grandTotal, externalReference: "CARD-AUTH-002" }],
      });
    assert.strictEqual(cardPay.status, 200);

    // 5c. Pay Order 3 with CASH (e.g. ₹157.50 = 15750 paise)
    const orderCash = await createDraftOrder(1);
    const cashPay = await request(app)
      .post(`/api/orders/${orderCash.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: orderCash.grandTotal, tenderedAmount: 20000 }],
      });
    assert.strictEqual(cashPay.status, 200);

    // Check active shift financials
    const activeRes = await request(app)
      .get("/api/shifts/active")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    const fin = activeRes.body.data.financials;
    assert.strictEqual(fin.cashSales, orderCash.grandTotal);
    assert.strictEqual(fin.upiSales, orderUpi.grandTotal);
    assert.strictEqual(fin.cardSales, orderCard.grandTotal);
    assert.strictEqual(fin.totalSales, orderCash.grandTotal + orderUpi.grandTotal + orderCard.grandTotal);

    // Expected drawer cash must increase ONLY by cash sales (not UPI or Card!)
    // 200000 + 15750 = 215750
    assert.strictEqual(fin.expectedDrawerCash, 200000 + orderCash.grandTotal);
  });

  // 6. Correctly calculating split-payment totals
  test("6. Correctly isolates split payment tenders and tracks split-order count", async () => {
    const orderSplit = await createDraftOrder(2); // e.g. 2 * 15000 + 5% = 31500 paise (₹315.00)
    const cashPortion = 15000; // ₹150.00 cash
    const upiPortion = orderSplit.grandTotal - cashPortion; // ₹165.00 UPI

    const splitPay = await request(app)
      .post(`/api/orders/${orderSplit.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          { method: "CASH", amount: cashPortion, tenderedAmount: cashPortion },
          { method: "UPI", amount: upiPortion, externalReference: "SPLIT-UPI-003" },
        ],
      });
    assert.strictEqual(splitPay.status, 200);

    const activeRes = await request(app)
      .get("/api/shifts/active")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    const fin = activeRes.body.data.financials;
    assert.ok(fin.splitPaymentOrderCount >= 1);
  });

  // 7. Accounting for cash change returned
  test("7. Accounts for customer change returned so drawer balance increases by net payment amount", async () => {
    const order = await createDraftOrder(1); // 15750 paise
    const tendered = 50000; // Customer gave ₹500.00 (50000 paise)
    const expectedChange = tendered - order.grandTotal; // Change returned: ₹342.50

    const beforeFin = (
      await request(app).get("/api/shifts/active").set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data.financials;

    const pay = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: tendered }],
      });
    assert.strictEqual(pay.status, 200);
    assert.strictEqual(pay.body.payments[0].changeDue, expectedChange);

    const afterFin = (
      await request(app).get("/api/shifts/active").set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data.financials;

    // The net cash added to the drawer is exactly order.grandTotal
    assert.strictEqual(afterFin.expectedDrawerCash, beforeFin.expectedDrawerCash + order.grandTotal);
  });

  // 8. Recording cash additions (CASH_IN)
  test("8. Cash addition (CASH_IN) increases expected drawer balance", async () => {
    const beforeFin = (
      await request(app).get("/api/shifts/active").set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data.financials;

    const addCash = await request(app)
      .post("/api/shifts/active/cash-movement")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        type: "CASH_IN",
        amount: 50000, // ₹500.00 added to float
        reason: "ADD_FLOAT_CHANGE",
        notes: "Manager supplied additional ₹10 and ₹20 notes",
      });

    assert.strictEqual(addCash.status, 201);
    assert.strictEqual(addCash.body.data.movement.type, "CASH_IN");
    assert.strictEqual(addCash.body.data.expectedDrawerCash, beforeFin.expectedDrawerCash + 50000);
  });

  // 9. Recording cash expenses (CASH_OUT)
  test("9. Cash expense (CASH_OUT) decreases expected drawer balance and preserves audit reason", async () => {
    const beforeFin = (
      await request(app).get("/api/shifts/active").set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data.financials;

    const expense = await request(app)
      .post("/api/shifts/active/cash-movement")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        type: "CASH_OUT",
        amount: 25000, // ₹250.00 paid for ice delivery
        reason: "PETTY_CASH_EXPENSE",
        notes: "Emergency ice bag purchase for beverage counter",
      });

    assert.strictEqual(expense.status, 201);
    assert.strictEqual(expense.body.data.movement.type, "CASH_OUT");
    assert.strictEqual(expense.body.data.expectedDrawerCash, beforeFin.expectedDrawerCash - 25000);
  });

  // 10. Calculating cash surplus
  test("10. Shift closing calculates cash surplus when actual counted cash exceeds expected drawer", async () => {
    const activeRes = await request(app)
      .get("/api/shifts/active")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    const shift = activeRes.body.data.shift;
    const expected = activeRes.body.data.financials.expectedDrawerCash;

    // Counted cash is ₹100.00 (10000 paise) more than expected
    const counted = expected + 10000;

    const previewRes = await request(app)
      .get(`/api/shifts/${shift.id}/closing-preview`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.body.data.expectedDrawerCash, expected);
  });

  // 11. Calculating cash shortage & 12. Closing a reconciled shift
  test("11 & 12. Cashier can close shift, records cash difference, and freezes report snapshot", async () => {
    const activeRes = await request(app)
      .get("/api/shifts/active")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    const shift = activeRes.body.data.shift;
    const expected = activeRes.body.data.financials.expectedDrawerCash;

    // Actual counted cash has a ₹50.00 shortage (5000 paise)
    const actualCash = expected - 5000;

    const closeRes = await request(app)
      .post(`/api/shifts/${shift.id}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        actualCash,
        closingNotes: "End of lunch peak shift. ₹50 minor shortage from coin change.",
      });

    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.body.data.shift.status, "CLOSED");
    assert.strictEqual(closeRes.body.data.shift.expectedCash, expected);
    assert.strictEqual(closeRes.body.data.shift.actualCash, actualCash);
    assert.strictEqual(closeRes.body.data.shift.cashDifference, -5000);
    assert.ok(closeRes.body.data.summarySnapshot);
  });

  // 13. Preventing unauthorized shift closure
  test("13. Prevents ordinary cashier from closing another cashier's shift", async () => {
    // Start shift with owner
    const startRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ openingCash: 100000 });
    assert.strictEqual(startRes.status, 201);
    const ownerShiftId = startRes.body.data.id;

    // Cashier attempts to close owner's shift
    const closeRes = await request(app)
      .post(`/api/shifts/${ownerShiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: 100000 });

    assert.strictEqual(closeRes.status, 403);
    assert.match(closeRes.body.error.message, /cannot close another cashier's shift/);

    // Clean up: close owner shift
    await request(app)
      .post(`/api/shifts/${ownerShiftId}/close`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ actualCash: 100000 });
  });

  // 14. Preventing unauthorized access to another branch
  test("14. Cross-branch isolation prevents viewing or modifying shifts of another branch", async () => {
    // Start shift in branch 2
    const b2ShiftRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`)
      .send({ openingCash: 150000 });
    assert.strictEqual(b2ShiftRes.status, 201);
    const b2ShiftId = b2ShiftRes.body.data.id;

    // Branch 1 owner attempts to access Branch 2 shift
    const getRes = await request(app)
      .get(`/api/shifts/${b2ShiftId}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(getRes.status, 404);

    const movementRes = await request(app)
      .post("/api/shifts/active/cash-movement")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        shiftId: b2ShiftId,
        type: "CASH_IN",
        amount: 10000,
        reason: "CROSS_BRANCH_ATTEMPT",
      });

    assert.strictEqual(movementRes.status, 400);
    assert.match(movementRes.body.error.message, /Shift not found in this branch/);

    // Clean up: Close b2 shift
    await request(app)
      .post(`/api/shifts/${b2ShiftId}/close`)
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`)
      .send({ actualCash: 150000 });
  });

  // 15. Preventing duplicate cash movement submissions
  test("15. Idempotency key prevents duplicate cash movement submissions", async () => {
    // Start fresh cashier shift
    const startRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ openingCash: 100000 });
    assert.strictEqual(startRes.status, 201);
    const shiftId = startRes.body.data.id;

    const idempKey = `idemp-mov-${Date.now()}`;

    // First cash movement
    const mov1 = await request(app)
      .post("/api/shifts/active/cash-movement")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .set("x-idempotency-key", idempKey)
      .send({
        shiftId,
        type: "CASH_IN",
        amount: 20000,
        reason: "COIN_CHANGE",
      });
    assert.strictEqual(mov1.status, 201);

    // Duplicate call with same idempotency key
    const mov2 = await request(app)
      .post("/api/shifts/active/cash-movement")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .set("x-idempotency-key", idempKey)
      .send({
        shiftId,
        type: "CASH_IN",
        amount: 20000,
        reason: "COIN_CHANGE",
      });
    assert.strictEqual(mov2.status, 200);
    assert.strictEqual(mov2.body.data.isDuplicate, true);

    // Verify only 1 movement exists
    const count = await (testPrisma as any).cashMovement.count({
      where: { idempotencyKey: idempKey },
    });
    assert.strictEqual(count, 1);

    // Close shift
    await request(app)
      .post(`/api/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: 120000 });
  });

  // 16. Preventing changes to closed shifts by ordinary users
  test("16. Closed shifts are read-only and reject any new cash movements or re-closings", async () => {
    // Start and close a shift
    const startRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ openingCash: 50000 });
    const shiftId = startRes.body.data.id;

    await request(app)
      .post(`/api/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: 50000 });

    // Attempt cash movement on closed shift
    const movRes = await request(app)
      .post("/api/shifts/active/cash-movement")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        shiftId,
        type: "CASH_IN",
        amount: 5000,
        reason: "LATE_ADDITION",
      });
    assert.strictEqual(movRes.status, 400);
    assert.match(movRes.body.error.message, /Cannot record cash movements for a closed shift/);

    // Attempt second close on already closed shift
    const closeRes = await request(app)
      .post(`/api/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: 50000 });
    assert.strictEqual(closeRes.status, 400);
    assert.match(closeRes.body.error.message, /already closed/);
  });

  // 17. Handling refunds correctly if supported
  test("17. Cash reconciliation handles refund architecture safely without distorting drawer balance", async () => {
    const startRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ openingCash: 100000 });
    const shiftId = startRes.body.data.id;

    const fin = (
      await request(app).get(`/api/shifts/${shiftId}/closing-preview`).set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data;

    assert.strictEqual(fin.cashRefundsTotal, 0);
    assert.strictEqual(fin.expectedDrawerCash, 100000);

    // Close shift
    await request(app)
      .post(`/api/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: 100000 });
  });

  // 18. Excluding draft and failed orders from finalized sales
  test("18. Draft, held, and failed orders NEVER count toward finalized sales or expected cash", async () => {
    const startRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ openingCash: 100000 });
    const shiftId = startRes.body.data.id;

    // Create draft order (unpaid)
    const draft = await createDraftOrder(3);

    // Put on hold
    await request(app)
      .patch(`/api/orders/${draft.id}/hold`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ notes: "Draft held" });

    const fin = (
      await request(app).get(`/api/shifts/${shiftId}/closing-preview`).set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data;

    // Neither sales nor drawer balance must include the draft order
    assert.strictEqual(fin.totalSales, 0);
    assert.strictEqual(fin.expectedDrawerCash, 100000);

    // Close shift
    await request(app)
      .post(`/api/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: 100000 });
  });

  // 19. Preventing receipt reprints from changing financial totals
  test("19. Customer receipt and KOT reprints NEVER affect shift financial totals or drawer cash", async () => {
    const startRes = await request(app)
      .post("/api/shifts/start")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ openingCash: 100000 });
    const shiftId = startRes.body.data.id;

    // Paid cash order
    const order = await createDraftOrder(1);
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);

    const finBefore = (
      await request(app).get(`/api/shifts/${shiftId}/closing-preview`).set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data;

    // Trigger reprint
    const invoice = payRes.body.invoice;
    const reprintRes = await request(app)
      .post(`/api/invoices/${invoice.id}/reprint`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ destination: "CUSTOMER_RECEIPT", reason: "Customer requested second copy" });
    assert.strictEqual(reprintRes.status, 200);

    const finAfter = (
      await request(app).get(`/api/shifts/${shiftId}/closing-preview`).set("Authorization", `Bearer ${ctx.cashierToken}`)
    ).body.data;

    // Reprint MUST NOT change any financials!
    assert.strictEqual(finAfter.totalSales, finBefore.totalSales);
    assert.strictEqual(finAfter.expectedDrawerCash, finBefore.expectedDrawerCash);
    assert.strictEqual(finAfter.cashSales, finBefore.cashSales);

    // Close shift
    await request(app)
      .post(`/api/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ actualCash: finAfter.expectedDrawerCash });
  });

  // 20. Daily summary and printable closing report work correctly
  test("20. Daily sales summary aggregates invoices correctly and printable report formats ASCII receipt", async () => {
    // 20a. Daily summary
    const summaryRes = await request(app)
      .get("/api/shifts/summary/daily")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(summaryRes.status, 200);
    assert.ok(typeof summaryRes.body.data.finalizedOrdersCount === "number");
    assert.ok(typeof summaryRes.body.data.grossSales === "number");
    assert.ok(typeof summaryRes.body.data.paymentBreakdown.cash === "number");
    assert.ok(summaryRes.body.data.shiftsOpenedCount > 0);

    // 20b. Printable closing report for last closed shift
    const lastShift = await (testPrisma as any).cashierShift.findFirst({
      where: { branchId: ctx.branch.id, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
    });
    assert.ok(lastShift);

    const reportRes = await request(app)
      .get(`/api/shifts/${lastShift.id}/report`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(reportRes.status, 200);
    assert.ok(typeof reportRes.body.reportText === "string");
    assert.match(reportRes.body.reportText, /SHIFT CLOSING & CASH REPORT/);
    assert.match(reportRes.body.reportText, /EXPECTED DRAWER CASH/);
  });
});
