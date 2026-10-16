import { test, describe, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, TestAuthContext, testPrisma } from "./setup";

describe("Phase 3: POS Terminal & Order Billing Tests", () => {
  let ctx: TestAuthContext;
  let sampleCategory: any;
  let rollItem: any;
  let burgerItem: any;
  let spiceGroup: any;
  let cheeseOption: any;
  let spicyOption: any;
  let mildOption: any;

  before(async () => {
    ctx = await setupTestEnvironment();

    // 1. Ensure test category
    sampleCategory = await (testPrisma as any).category.findFirst({
      where: { branchId: ctx.branch.id, isActive: true },
    });
    if (!sampleCategory) {
      sampleCategory = await (testPrisma as any).category.create({
        data: {
          branchId: ctx.branch.id,
          name: "Test Wraps " + Date.now(),
          slug: "test-wraps-" + Date.now(),
          isActive: true,
        },
      });
    }

    // 2. Create modifier group: Spice Level (SINGLE choice, required)
    spiceGroup = await (testPrisma as any).modifierGroup.create({
      data: {
        branchId: ctx.branch.id,
        name: "Spice Selection " + Date.now(),
        selectionType: "SINGLE",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        isActive: true,
        options: {
          create: [
            { name: "Mild Spice", extraPrice: 0, isAvailable: true, isActive: true },
            { name: "Super Spicy", extraPrice: 2000, isAvailable: true, isActive: true }, // ₹20.00
          ],
        },
      },
      include: { options: true },
    });
    mildOption = spiceGroup.options.find((o: any) => o.name === "Mild Spice");
    spicyOption = spiceGroup.options.find((o: any) => o.name === "Super Spicy");

    // 3. Create modifier group: Add-ons (MULTIPLE choice, optional)
    const addonGroup = await (testPrisma as any).modifierGroup.create({
      data: {
        branchId: ctx.branch.id,
        name: "Cheese Addons " + Date.now(),
        selectionType: "MULTIPLE",
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        isActive: true,
        options: {
          create: [
            { name: "Cheddar Slice", extraPrice: 3500, isAvailable: true, isActive: true }, // ₹35.00
          ],
        },
      },
      include: { options: true },
    });
    cheeseOption = addonGroup.options[0];

    // 4. Create simple menu item without modifiers: Roll (₹150.00 = 15000 paise)
    rollItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: sampleCategory.id,
        name: "Crunchy Chicken Roll " + Date.now(),
        itemCode: "ROL-01",
        basePrice: 15000,
        isActive: true,
        isAvailable: true,
      },
    });

    // 5. Create menu item with modifiers: Burger (₹220.00 = 22000 paise)
    burgerItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: sampleCategory.id,
        name: "Supreme Loaded Burger " + Date.now(),
        itemCode: "BUR-01",
        basePrice: 22000,
        isActive: true,
        isAvailable: true,
        modifierGroups: {
          create: [
            { modifierGroupId: spiceGroup.id, displayOrder: 0, isEnabled: true },
            { modifierGroupId: addonGroup.id, displayOrder: 1, isEnabled: true },
          ],
        },
      },
    });
  });

  test("1. Cashier can retrieve POS categories with available item counts", async () => {
    const res = await request(app)
      .get("/api/pos/categories")
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.categories));
    assert.ok(res.body.categories.length > 0);

    const found = res.body.categories.find((c: any) => c.id === sampleCategory.id);
    assert.ok(found);
    assert.ok(typeof found.availableItemCount === "number");
  });

  test("2. Cashier can search and filter POS menu items with modifier groups", async () => {
    const res = await request(app)
      .get(`/api/pos/menu-items?categoryId=${sampleCategory.id}`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.menuItems));

    const burger = res.body.menuItems.find((i: any) => i.id === burgerItem.id);
    assert.ok(burger);
    assert.strictEqual(burger.basePrice, 22000);
    assert.strictEqual(burger.modifierGroups.length, 2);
  });

  test("3. Live order calculation validates items and computes server-authoritative totals", async () => {
    const res = await request(app)
      .post("/api/orders/calculate")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [
          {
            menuItemId: rollItem.id,
            quantity: 2, // 2 * 15000 = 30000 paise
          },
          {
            menuItemId: burgerItem.id,
            quantity: 1, // 22000 + 2000 (spicy) + 3500 (cheese) = 27500 paise
            selectedModifiers: [
              { modifierGroupId: spiceGroup.id, optionId: spicyOption.id },
              { modifierGroupId: cheeseOption.modifierGroupId, optionId: cheeseOption.id },
            ],
            kitchenNotes: "Well done burger patty",
          },
        ],
        taxRateBasisPoints: 500, // 5.00% GST
      });

    assert.strictEqual(res.status, 200);
    const calc = res.body.calculation;

    // Subtotal: 30000 + 27500 = 57500 paise
    assert.strictEqual(calc.subtotal, 57500);
    assert.strictEqual(calc.discountTotal, 0);

    // Tax: 5% of 57500 = 2875 paise
    assert.strictEqual(calc.taxTotal, 2875);

    // Grand total: 57500 + 2875 = 60375 paise (₹603.75)
    assert.strictEqual(calc.grandTotal, 60375);
    assert.strictEqual(calc.items.length, 2);
  });

  test("4. Order calculation rejects missing required modifier selection", async () => {
    const res = await request(app)
      .post("/api/orders/calculate")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [
          {
            menuItemId: burgerItem.id,
            quantity: 1,
            selectedModifiers: [], // Missing required spiceGroup selection
          },
        ],
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, "CALCULATION_ERROR");
    assert.ok(res.body.error.message.includes("requires at least one selection"));
  });

  test("5. Order creation rejects inactive and unavailable food items", async () => {
    // Create sold out item
    const soldOutItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: sampleCategory.id,
        name: "Sold Out Lamb Shank " + Date.now(),
        basePrice: 40000,
        isActive: true,
        isAvailable: false, // SOLD OUT
      },
    });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [{ menuItemId: soldOutItem.id, quantity: 1 }],
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.message.includes("sold out"));
  });

  test("6. Cashier can create an order draft with snapshots and custom kitchen notes", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        customerName: "Rahul Sharma",
        customerPhone: "+91 99999 11111",
        notes: "Pack sauces in separate container",
        items: [
          {
            menuItemId: rollItem.id,
            quantity: 2,
          },
          {
            menuItemId: burgerItem.id,
            quantity: 1,
            selectedModifiers: [
              { modifierGroupId: spiceGroup.id, optionId: mildOption.id },
            ],
            kitchenNotes: "No mayonnaise",
          },
        ],
      });

    assert.strictEqual(res.status, 201);
    const order = res.body.order;

    assert.ok(order.id);
    assert.strictEqual(order.status, "DRAFT");
    assert.strictEqual(order.orderType, "TAKEAWAY");
    assert.ok(order.orderNumber.startsWith("ORD-"));
    assert.strictEqual(order.customerName, "Rahul Sharma");

    // Line totals: Roll (2 * 15000 = 30000) + Burger (1 * 22000 = 22000) = 52000 subtotal
    assert.strictEqual(order.subtotal, 52000);
    assert.strictEqual(order.items.length, 2);

    // Verify snapshots are created properly
    const rollLine = order.items.find((i: any) => i.menuItemId === rollItem.id);
    assert.ok(rollLine);
    assert.strictEqual(rollLine.basePriceSnapshot, 15000);
    assert.strictEqual(rollLine.quantity, 2);
    assert.strictEqual(rollLine.lineSubtotal, 30000);

    const burgerLine = order.items.find((i: any) => i.menuItemId === burgerItem.id);
    assert.ok(burgerLine);
    assert.strictEqual(burgerLine.kitchenNotes, "No mayonnaise");
    assert.strictEqual(burgerLine.modifierSnapshot.length, 1);
    assert.strictEqual(burgerLine.modifierSnapshot[0].optionName, "Mild Spice");
  });

  test("7. Cashier can place draft order on hold and resume it", async () => {
    // Create draft
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "DINE_IN",
        tableNumber: "T-04",
        items: [{ menuItemId: rollItem.id, quantity: 1 }],
      });
    assert.strictEqual(createRes.status, 201);
    const orderId = createRes.body.order.id;

    // Hold order
    const holdRes = await request(app)
      .post(`/api/orders/${orderId}/hold`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(holdRes.status, 200);
    assert.strictEqual(holdRes.body.order.status, "HELD");

    // Resume order
    const resumeRes = await request(app)
      .post(`/api/orders/${orderId}/resume`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(resumeRes.status, 200);
    assert.strictEqual(resumeRes.body.order.status, "DRAFT");
  });

  test("8. Updating menu item base price does not alter historical order item snapshots", async () => {
    // 1. Create order at current price 15000
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [{ menuItemId: rollItem.id, quantity: 1 }],
      });
    const orderId = createRes.body.order.id;

    // 2. Modify original menu item price to ₹300.00 (30000 paise)
    await (testPrisma as any).menuItem.update({
      where: { id: rollItem.id },
      data: { basePrice: 30000 },
    });

    // 3. Fetch original order and verify snapshot did NOT change
    const orderRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);
    assert.strictEqual(orderRes.status, 200);

    const savedLine = orderRes.body.order.items[0];
    assert.strictEqual(savedLine.basePriceSnapshot, 15000); // Intact snapshot
    assert.strictEqual(savedLine.lineSubtotal, 15000); // Historical subtotal intact

    // Restore test price
    await (testPrisma as any).menuItem.update({
      where: { id: rollItem.id },
      data: { basePrice: 15000 },
    });
  });

  test("9. Cross-branch isolation: other branch cannot view or modify order", async () => {
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [{ menuItemId: rollItem.id, quantity: 1 }],
      });
    const orderId = createRes.body.order.id;

    // Attempt access from other branch token
    const crossRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`);
    assert.strictEqual(crossRes.status, 404);
  });

  test("10. Cancel draft order marks status as CANCELLED", async () => {
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        orderType: "TAKEAWAY",
        items: [{ menuItemId: rollItem.id, quantity: 1 }],
      });
    const orderId = createRes.body.order.id;

    const cancelRes = await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`);

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.order.status, "CANCELLED");
  });
});
