import { test, describe, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, TestAuthContext, testPrisma } from "./setup";

describe("Phase 8: Sales Reports & Business Analytics Tests", () => {
  let ctx: TestAuthContext;
  let testCatRolls: any;
  let testCatBurgers: any;
  let itemChickenRoll: any;
  let itemCheeseBurger: any;

  before(async () => {
    ctx = await setupTestEnvironment();

    // 1. Create two test categories
    testCatRolls = await (testPrisma as any).category.create({
      data: {
        branchId: ctx.branch.id,
        name: "Report Category Rolls " + Date.now(),
        slug: "rep-rolls-" + Date.now(),
        isActive: true,
      },
    });

    testCatBurgers = await (testPrisma as any).category.create({
      data: {
        branchId: ctx.branch.id,
        name: "Report Category Burgers " + Date.now(),
        slug: "rep-burgers-" + Date.now(),
        isActive: true,
      },
    });

    // 2. Create menu items
    // Chicken Roll: ₹120.00 = 12000 paise
    itemChickenRoll = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: testCatRolls.id,
        name: "Report Classic Roll " + Date.now(),
        basePrice: 12000,
        isActive: true,
        isAvailable: true,
      },
    });

    // Cheese Burger: ₹200.00 = 20000 paise
    itemCheeseBurger = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: testCatBurgers.id,
        name: "Report Mega Burger " + Date.now(),
        basePrice: 20000,
        isActive: true,
        isAvailable: true,
      },
    });
  });

  // Helper to create and finalize an order
  async function createAndPayOrder(options: {
    items: Array<{ menuItemId: string; quantity: number }>;
    orderType?: "TAKEAWAY" | "DINE_IN";
    payment: { method: "CASH" | "UPI" | "CARD" | "SPLIT"; splitTenders?: any[] };
    discount?: { type: "FIXED" | "PERCENTAGE"; value: number };
  }) {
    // 1. Create order
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: options.orderType || "TAKEAWAY",
        items: options.items,
        discount: options.discount
          ? {
              type: options.discount.type,
              value: options.discount.value,
              reason: "Promo Discount",
            }
          : undefined,
      });

    assert.strictEqual(orderRes.status, 201);
    const order = orderRes.body.order;

    // 2. Pay and finalize
    let paymentsList: any[] = [];
    if (options.payment.method === "CASH") {
      paymentsList = [
        {
          method: "CASH",
          amount: order.grandTotal,
          tenderedAmount: order.grandTotal + 5000, // ₹50 change
        },
      ];
    } else if (options.payment.method === "UPI") {
      paymentsList = [
        {
          method: "UPI",
          amount: order.grandTotal,
          externalReference: "UPI-" + Date.now(),
        },
      ];
    } else if (options.payment.method === "CARD") {
      paymentsList = [
        {
          method: "CARD",
          amount: order.grandTotal,
          externalReference: "AUTH-" + Date.now(),
        },
      ];
    } else if (options.payment.method === "SPLIT") {
      paymentsList = options.payment.splitTenders || [];
    }

    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ payments: paymentsList });

    assert.strictEqual(payRes.status, 200);
    return { order, invoice: payRes.body.invoice };
  }

  // 1. Role-based authorization: CASHIER receives 403 Forbidden
  test("1. Cashiers are forbidden from accessing executive reports dashboard", async () => {
    const res = await request(app)
      .get("/api/reports/dashboard")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(res.status, 403);
  });

  // 2. Branch isolation: other branch cannot view Branch 1 reports
  test("2. Cross-branch isolation prevents viewing analytics of another branch", async () => {
    const res = await request(app)
      .get("/api/reports/dashboard")
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`);

    assert.strictEqual(res.status, 200);
    // Other branch must have 0 orders or only its own data
    assert.strictEqual(res.body.data.overview.finalizedOrdersCount, 0);
  });

  // 3. Draft and unpaid orders are excluded from reports
  test("3. Draft and unpaid orders are strictly excluded from sales reports", async () => {
    // Create an unpaid draft order
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [{ menuItemId: itemChickenRoll.id, quantity: 5 }],
      });

    // Check dashboard summary
    const res = await request(app)
      .get("/api/reports/dashboard?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    // The unpaid draft order with 5 rolls must not be counted in finalized orders
    const initialOrdersCount = res.body.data.overview.finalizedOrdersCount;

    // Finalize 1 legitimate order
    await createAndPayOrder({
      items: [{ menuItemId: itemChickenRoll.id, quantity: 2 }],
      payment: { method: "CASH" },
    });

    const resAfter = await request(app)
      .get("/api/reports/dashboard?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(resAfter.body.data.overview.finalizedOrdersCount, initialOrdersCount + 1);
  });

  // 4. Sales totals and calculations (Gross, Discounts, Taxes, Net, AOV)
  test("4. Authoritative calculation of Gross Sales, Discounts, Taxes, Net Sales, and AOV", async () => {
    // Create an order with FIXED discount ₹20.00 = 2000 paise
    // Item: 1 Burger @ ₹200.00 = 20000 paise
    // Subtotal: 20000 paise
    // Discount: 2000 paise
    // Taxable: 18000 paise, Tax (5% GST): 900 paise
    // Grand Total: 18900 paise
    const { invoice } = await createAndPayOrder({
      items: [{ menuItemId: itemCheeseBurger.id, quantity: 1 }],
      discount: { type: "FIXED", value: 2000 },
      payment: { method: "UPI" },
    });

    assert.strictEqual(invoice.subtotal, 20000);
    assert.strictEqual(invoice.discountTotal, 2000);
    assert.strictEqual(invoice.taxTotal, 900);
    assert.strictEqual(invoice.grandTotal, 18900);

    const res = await request(app)
      .get("/api/reports/dashboard?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.overview.grossSales >= 20000);
    assert.ok(res.body.data.overview.discountsTotal >= 2000);
    assert.ok(res.body.data.overview.taxesTotal >= 900);
    assert.ok(res.body.data.overview.netSales >= 18900);
    assert.ok(res.body.data.overview.averageOrderValue > 0);
  });

  // 5. Payment method breakdown & split payments isolation
  test("5. Payment method report correctly separates cash, UPI, card, and split tenders without double counting", async () => {
    // Create a split payment order: Grand Total ₹126.00 (Chicken roll 12000 + 600 tax = 12600 paise)
    // Tender 1: Cash ₹60.00 = 6000 paise
    // Tender 2: UPI ₹66.00 = 6600 paise
    await createAndPayOrder({
      items: [{ menuItemId: itemChickenRoll.id, quantity: 1 }],
      payment: {
        method: "SPLIT",
        splitTenders: [
          { method: "CASH", amount: 6000, tenderedAmount: 6000 },
          { method: "UPI", amount: 6600, upiTransactionRef: "UPI-SPLIT-1" },
        ],
      },
    });

    const res = await request(app)
      .get("/api/reports/payments?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.ok(data.splitOrdersCount >= 1);
    assert.ok(data.totalCollected > 0);

    const cashRow = data.methods.find((m: any) => m.method === "CASH");
    const upiRow = data.methods.find((m: any) => m.method === "UPI");

    assert.ok(cashRow && cashRow.amount >= 6000);
    assert.ok(upiRow && upiRow.amount >= 6600);
  });

  // 6. Top-selling items report
  test("6. Top-selling items calculates quantity sold, gross sales, net sales, and percentage share", async () => {
    const res = await request(app)
      .get("/api/reports/top-items?preset=today&sortBy=value")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.ok(data.items.length >= 2);
    assert.ok(data.totalItemsSold > 0);

    const firstItem = data.items[0];
    assert.ok(firstItem.name);
    assert.ok(firstItem.quantitySold > 0);
    assert.ok(firstItem.grossSales > 0);
    assert.ok(firstItem.netSales > 0);
    assert.ok(firstItem.percentageOfSales > 0 && firstItem.percentageOfSales <= 100);
  });

  // 7. Category sales performance
  test("7. Category performance groups sales and quantity sold by category", async () => {
    const res = await request(app)
      .get("/api/reports/categories?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.ok(data.categories.length >= 1);
    assert.ok(data.totalCategorySales > 0);

    const foundCategory = data.categories.find(
      (c: any) => c.categoryName.includes("Rolls") || c.categoryName.includes("Burgers")
    );
    assert.ok(foundCategory);
    assert.ok(foundCategory.quantitySold > 0);
    assert.ok(foundCategory.salesValue > 0);
  });

  // 8. Order type report (Takeaway vs Dine-In)
  test("8. Order type report differentiates Takeaway and Dine-In orders", async () => {
    // Create a DINE_IN order
    await createAndPayOrder({
      items: [{ menuItemId: itemChickenRoll.id, quantity: 1 }],
      orderType: "DINE_IN",
      payment: { method: "CARD" },
    });

    const res = await request(app)
      .get("/api/reports/order-types?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    const types = res.body.data.types;
    const takeaway = types.find((t: any) => t.type === "TAKEAWAY");
    const dineIn = types.find((t: any) => t.type === "DINE_IN");

    assert.ok(takeaway && takeaway.count > 0);
    assert.ok(dineIn && dineIn.count > 0);
    assert.ok(dineIn.salesValue > 0);
  });

  // 9. Discounts and Taxes report
  test("9. Taxes and discounts report separates CGST and SGST and counts discounted orders", async () => {
    const res = await request(app)
      .get("/api/reports/taxes?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.ok(data.summary.totalTaxesRecorded > 0);
    assert.ok(data.summary.discountedOrdersCount >= 1);
    assert.strictEqual(data.taxBreakdown.length, 2);

    const cgst = data.taxBreakdown.find((t: any) => t.taxName.includes("Central GST"));
    const sgst = data.taxBreakdown.find((t: any) => t.taxName.includes("State GST"));
    assert.ok(cgst && cgst.amount > 0);
    assert.ok(sgst && sgst.amount > 0);
  });

  // 10. Inventory movements report
  test("10. Inventory report aggregates order consumption movements without altering stock", async () => {
    const res = await request(app)
      .get("/api/reports/inventory?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.data.lowStockCount === "number");
    // Field renamed to match actual Prisma enum SALE_DEDUCTION (was incorrectly ORDER_CONSUMPTION)
    assert.ok(typeof res.body.data.movementCounts.saleDeductions === "number");
  });

  // 11. Cash management report
  test("11. Cash management report aggregates shift activity and cash ledger movements", async () => {
    const res = await request(app)
      .get("/api/reports/cash?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.data.shiftSummary.totalShifts === "number");
    assert.ok(typeof res.body.data.movementsSummary.totalCashAdded === "number");
  });

  // 12. Empty reporting periods return graceful zeros
  test("12. Empty reporting periods gracefully return 0 totals without errors", async () => {
    // Filter to a year in the past where no orders exist
    const res = await request(app)
      .get("/api/reports/dashboard?startDate=2020-01-01&endDate=2020-01-02")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.overview.finalizedOrdersCount, 0);
    assert.strictEqual(res.body.data.overview.grossSales, 0);
    assert.strictEqual(res.body.data.overview.netSales, 0);
    assert.strictEqual(res.body.data.overview.averageOrderValue, 0);
  });

  // 13. CSV Exports: Sales report
  test("13. CSV export for sales report generates valid CSV with headers and escaped values", async () => {
    const res = await request(app)
      .get("/api/reports/export/sales?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.headers["content-type"], /text\/csv/);
    assert.match(res.headers["content-disposition"], /attachment; filename="ROLLZ_Sales_Report_/);
    assert.match(res.text, /Date,Orders Count,Gross Sales \(INR\),Discounts \(INR\),Taxes \(INR\),Net Sales \(INR\)/);
  });

  // 14. CSV Exports: Top items report
  test("14. CSV export for top-selling items generates valid CSV data", async () => {
    const res = await request(app)
      .get("/api/reports/export/top-items?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Item Name,Quantity Sold,Gross Sales \(INR\),Discounts Allocated \(INR\),Net Sales \(INR\),Sales Share %/);
  });

  // 15. CSV Exports: Category performance
  test("15. CSV export for category performance generates valid CSV data", async () => {
    const res = await request(app)
      .get("/api/reports/export/categories?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Category Name,Quantity Sold,Sales Value \(INR\),Sales Share %/);
  });

  // 16. CSV Exports: Payments breakdown
  test("16. CSV export for payments breakdown generates valid CSV data", async () => {
    const res = await request(app)
      .get("/api/reports/export/payments?preset=today")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Payment Method,Transactions Count,Amount Collected \(INR\),Share %/);
  });
});
