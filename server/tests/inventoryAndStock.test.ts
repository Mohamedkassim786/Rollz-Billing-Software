import { test, describe, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, TestAuthContext, testPrisma } from "./setup";
import { convertQuantity, areUnitsCompatible } from "../src/utils/unitConverter";
import { calculateStockStatus } from "../src/utils/stockUtils";

describe("Phase 6: Inventory & Stock Management Tests", () => {
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
          name: "Inventory Rolls " + Date.now(),
          slug: "inventory-rolls-" + Date.now(),
          isActive: true,
        },
      });
    }

    // 2. Ensure a test food item (Base Price ₹160.00 = 16000 paise)
    testItem = await (testPrisma as any).menuItem.create({
      data: {
        branchId: ctx.branch.id,
        categoryId: testCategory.id,
        name: "Inventory Chicken Roll " + Date.now(),
        basePrice: 16000,
        isActive: true,
        isAvailable: true,
      },
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
            kitchenNotes: "Phase 6 inventory test",
          },
        ],
      });
    assert.strictEqual(res.status, 201);
    return res.body.order;
  }

  // 1. Ingredient creation and editing
  test("1. Owner can create and edit an ingredient", async () => {
    const sku = `ING-CHK-${Date.now()}`;
    const createRes = await request(app)
      .post("/api/inventory/ingredients")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Boneless Chicken Breast",
        sku,
        category: "Meat",
        unit: "kg",
        currentStock: 10,
        minThreshold: 2.5,
        costPerUnit: 25000, // ₹250.00 / kg
      });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.data.name, "Boneless Chicken Breast");
    assert.strictEqual(createRes.body.data.currentStock, 10);
    assert.strictEqual(createRes.body.data.stockStatus, "IN_STOCK");

    const ingId = createRes.body.data.id;

    // Edit ingredient
    const updateRes = await request(app)
      .patch(`/api/inventory/ingredients/${ingId}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        minThreshold: 3.0,
        costPerUnit: 26000,
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.minThreshold, 3.0);
    assert.strictEqual(updateRes.body.data.costPerUnit, 26000);
  });

  // 2. Duplicate SKU prevention
  test("2. Rejects duplicate ingredient SKU within the same branch", async () => {
    const sku = `DUP-SKU-${Date.now()}`;
    const firstRes = await request(app)
      .post("/api/inventory/ingredients")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Eggpack Small",
        sku,
        unit: "piece",
        currentStock: 30,
        minThreshold: 10,
      });
    assert.strictEqual(firstRes.status, 201);

    const dupRes = await request(app)
      .post("/api/inventory/ingredients")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Eggpack Duplicate",
        sku,
        unit: "piece",
        currentStock: 10,
      });

    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.error.code, "SKU_EXISTS");
  });

  // 3. Unit conversion accuracy
  test("3. Unit conversion accurately converts compatible units and rejects incompatible units", () => {
    // Weight conversions: 1 kg = 1000 g
    assert.strictEqual(convertQuantity(1, "kg", "g"), 1000);
    assert.strictEqual(convertQuantity(250, "g", "kg"), 0.25);
    assert.strictEqual(convertQuantity(1500, "g", "kg"), 1.5);

    // Volume conversions: 1 L = 1000 ml
    assert.strictEqual(convertQuantity(2, "L", "ml"), 2000);
    assert.strictEqual(convertQuantity(500, "ml", "L"), 0.5);

    // Discrete unit: 1:1
    assert.strictEqual(convertQuantity(5, "piece", "piece"), 5);

    // Incompatible conversions must throw
    assert.throws(() => {
      convertQuantity(100, "g", "piece");
    }, /Cannot convert incompatible units/);

    assert.throws(() => {
      convertQuantity(1, "L", "kg");
    }, /Cannot convert incompatible units/);

    assert.strictEqual(areUnitsCompatible("kg", "g"), true);
    assert.strictEqual(areUnitsCompatible("L", "ml"), true);
    assert.strictEqual(areUnitsCompatible("piece", "kg"), false);
  });

  // 4. Recipe creation and editing
  test("4. Owner can configure, view, and edit a menu item recipe", async () => {
    // Create 2 ingredients for the recipe
    const ing1 = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Marinated Chicken " + Date.now(),
        sku: "REC-CHK-" + Date.now(),
        unit: "kg",
        currentStock: 5.0,
        minThreshold: 1.0,
        costPerUnit: 20000, // ₹200.00 / kg => 20 paise/gram
      },
    });

    const ing2 = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Paratha Wrap " + Date.now(),
        sku: "REC-WRAP-" + Date.now(),
        unit: "piece",
        currentStock: 50,
        minThreshold: 10,
        costPerUnit: 1200, // ₹12.00 / piece
      },
    });

    // Configure recipe for testItem: 150g Chicken + 1 Paratha wrap
    const saveRes = await request(app)
      .put(`/api/inventory/recipes/menu-items/${testItem.id}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        items: [
          {
            ingredientId: ing1.id,
            quantity: 150,
            unit: "g",
            notes: "Grilled chicken filling",
          },
          {
            ingredientId: ing2.id,
            quantity: 1,
            unit: "piece",
            notes: "Freshly rolled paratha",
          },
        ],
      });

    assert.strictEqual(saveRes.status, 200);
    assert.strictEqual(saveRes.body.data.recipeItems.length, 2);

    // Verify estimated cost calculation:
    // 150g chicken = 0.15 kg * 20000 paise = 3000 paise (₹30.00)
    // 1 wrap = 1200 paise (₹12.00)
    // Total estimated cost = 4200 paise (₹42.00)
    assert.strictEqual(saveRes.body.data.estimatedCostPaise, 4200);

    // Fetch via GET endpoint
    const getRes = await request(app)
      .get(`/api/inventory/recipes/menu-items/${testItem.id}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.recipeItems.length, 2);
    assert.strictEqual(getRes.body.data.estimatedCostPaise, 4200);
  });

  // 5. Stock intake increases stock correctly
  test("5. Stock intake increases available stock and records audit movement", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Cooking Oil " + Date.now(),
        sku: "INTK-OIL-" + Date.now(),
        unit: "L",
        currentStock: 10,
        minThreshold: 2,
        costPerUnit: 12000,
      },
    });

    const intakeRes = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 5,
        unit: "L",
        purchaseCost: 65000, // ₹650.00 for 5L
        supplierName: "Metro Cash & Carry",
        invoiceRef: "INV-METRO-1029",
      });

    assert.strictEqual(intakeRes.status, 201);
    assert.strictEqual(intakeRes.body.data.ingredient.currentStock, 15);
    assert.strictEqual(intakeRes.body.data.movement.type, "STOCK_IN");
    assert.strictEqual(intakeRes.body.data.movement.stockBefore, 10);
    assert.strictEqual(intakeRes.body.data.movement.stockAfter, 15);
  });

  // 6. Invalid stock intake is rejected
  test("6. Rejects invalid stock intake with negative quantity or incompatible unit", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Mayonnaise " + Date.now(),
        sku: "INTK-MAYO-" + Date.now(),
        unit: "kg",
        currentStock: 2,
      },
    });

    // Negative quantity
    const negRes = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: -5,
        unit: "kg",
        purchaseCost: 1000,
      });
    assert.strictEqual(negRes.status, 400);

    // Incompatible unit (piece vs kg)
    const incompRes = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 5,
        unit: "piece",
        purchaseCost: 1000,
      });
    assert.strictEqual(incompRes.status, 400);
    assert.match(incompRes.body.error.message, /Cannot convert incompatible units/);
  });

  // 7. Wastage decreases stock correctly
  test("7. Wastage decreases stock correctly and rejects wastage exceeding current stock", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Fresh Tomatoes " + Date.now(),
        sku: "WAST-TOM-" + Date.now(),
        unit: "kg",
        currentStock: 5.0,
      },
    });

    // Record valid wastage: 1.5 kg spoiled
    const wasteRes = await request(app)
      .post("/api/inventory/wastage")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 1.5,
        unit: "kg",
        reason: "SPOILED",
        notes: "Soft and overripe",
      });

    assert.strictEqual(wasteRes.status, 201);
    assert.strictEqual(wasteRes.body.data.ingredient.currentStock, 3.5);
    assert.strictEqual(wasteRes.body.data.movement.type, "WASTAGE");
    assert.strictEqual(wasteRes.body.data.movement.stockBefore, 5.0);
    assert.strictEqual(wasteRes.body.data.movement.stockAfter, 3.5);

    // Reject wastage exceeding available stock (4 kg > 3.5 kg)
    const overWasteRes = await request(app)
      .post("/api/inventory/wastage")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 4.0,
        unit: "kg",
        reason: "SPOILED",
      });

    assert.strictEqual(overWasteRes.status, 400);
    assert.match(overWasteRes.body.error.message, /cannot exceed available current stock/);
  });

  // 8. Unauthorized stock adjustments are rejected
  test("8. Unauthorized user (CASHIER) cannot record stock intake, wastage, or adjustments", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Mozzarella Cheese " + Date.now(),
        sku: "AUTH-CHS-" + Date.now(),
        unit: "kg",
        currentStock: 4,
      },
    });

    // Cashier intake attempt
    const intakeRes = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 2,
        unit: "kg",
        purchaseCost: 2000,
      });
    assert.strictEqual(intakeRes.status, 403);

    // Cashier wastage attempt
    const wasteRes = await request(app)
      .post("/api/inventory/wastage")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 1,
        unit: "kg",
        reason: "SPOILED",
      });
    assert.strictEqual(wasteRes.status, 403);

    // Cashier adjustment attempt
    const adjRes = await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        ingredientId: ing.id,
        newQuantity: 10,
        reason: "COUNT_CORRECTION",
      });
    assert.strictEqual(adjRes.status, 403);
  });

  // 9. Low-stock and out-of-stock calculations work correctly
  test("9. Calculates IN_STOCK, LOW_STOCK, and OUT_OF_STOCK statuses accurately from database values", () => {
    // minThreshold = 5
    assert.strictEqual(calculateStockStatus(10, 5), "IN_STOCK");
    assert.strictEqual(calculateStockStatus(5, 5), "LOW_STOCK"); // At threshold
    assert.strictEqual(calculateStockStatus(2, 5), "LOW_STOCK"); // Below threshold but > 0
    assert.strictEqual(calculateStockStatus(0, 5), "OUT_OF_STOCK"); // Zero
    assert.strictEqual(calculateStockStatus(-1, 5), "OUT_OF_STOCK"); // Negative
  });

  // 10. A successful paid sale deducts configured ingredient quantities
  test("10. A successfully paid and finalized order deducts configured ingredient quantities atomically", async () => {
    // Create distinct ingredient with initial stock 10.0 kg
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Sale Test Chicken " + Date.now(),
        sku: "SALE-CHK-" + Date.now(),
        unit: "kg",
        currentStock: 10.0,
        minThreshold: 2.0,
        costPerUnit: 22000,
      },
    });

    // Map recipe: 200g (0.2 kg) per testItem
    await (testPrisma as any).recipeIngredient.deleteMany({
      where: { menuItemId: testItem.id },
    });
    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 200,
        unit: "g",
      },
    });

    // Create draft order for 2 rolls (2 * 200g = 400g = 0.4 kg)
    const order = await createDraftOrder(2);

    // Initial stock before payment
    const beforeIng = await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } });
    assert.strictEqual(beforeIng.currentStock, 10.0);

    // Pay full cash amount
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
            tenderedAmount: order.grandTotal,
          },
        ],
      });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.body.order.status, "CONFIRMED");

    // Stock after payment must be 10.0 - 0.4 = 9.6 kg
    const afterIng = await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } });
    assert.strictEqual(afterIng.currentStock, 9.6);

    // Verify stock movement was recorded
    const movement = await (testPrisma as any).stockMovement.findFirst({
      where: { orderId: order.id, ingredientId: ing.id, type: "SALE_DEDUCTION" },
    });
    assert.ok(movement);
    assert.strictEqual(movement.quantity, 0.4);
    assert.strictEqual(movement.stockBefore, 10.0);
    assert.strictEqual(movement.stockAfter, 9.6);
  });

  // 11. Unpaid orders do not deduct stock
  test("11. Unpaid draft and held orders NEVER deduct stock", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Unpaid Test Patty " + Date.now(),
        sku: "UNPD-PAT-" + Date.now(),
        unit: "piece",
        currentStock: 20,
        minThreshold: 5,
      },
    });

    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 1,
        unit: "piece",
      },
    });

    // Create draft order
    const draft = await createDraftOrder(3);

    // Put draft on hold
    await request(app)
      .patch(`/api/orders/${draft.id}/hold`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ notes: "Waiting on customer" });

    // Stock must remain unchanged at 20
    const checkIng = await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } });
    assert.strictEqual(checkIng.currentStock, 20);

    const movements = await (testPrisma as any).stockMovement.findMany({
      where: { orderId: draft.id },
    });
    assert.strictEqual(movements.length, 0);
  });

  // 12. Failed payments do not deduct stock
  test("12. Failed / rejected payments do not deduct stock", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Fail Pay Sauce " + Date.now(),
        sku: "FAIL-SAU-" + Date.now(),
        unit: "ml",
        currentStock: 1000,
      },
    });

    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 50,
        unit: "ml",
      },
    });

    const order = await createDraftOrder(1);

    // Tender cash less than required (fails validation)
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: order.grandTotal,
            tenderedAmount: 100, // Invalid tender
          },
        ],
      });

    assert.strictEqual(payRes.status, 400);

    // Stock must remain unchanged at 1000
    const checkIng = await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } });
    assert.strictEqual(checkIng.currentStock, 1000);
  });

  // 13. Partial payments do not deduct stock when full payment is required
  test("13. Partial payment attempts reject finalization and do not deduct stock", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Partial Pay Cheese " + Date.now(),
        sku: "PART-CHS-" + Date.now(),
        unit: "g",
        currentStock: 500,
      },
    });

    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 30,
        unit: "g",
      },
    });

    const order = await createDraftOrder(1);

    // Send only 5000 paise when order.grandTotal is > 16000 paise
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: 5000,
            tenderedAmount: 5000,
          },
        ],
      });

    assert.strictEqual(payRes.status, 400);

    // Stock must remain intact
    const checkIng = await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } });
    assert.strictEqual(checkIng.currentStock, 500);
  });

  // 14. Duplicate payment requests do not deduct stock twice
  test("14. Duplicate payment requests / idempotency keys do not deduct stock twice", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Dup Deduct Bun " + Date.now(),
        sku: "DUP-BUN-" + Date.now(),
        unit: "piece",
        currentStock: 25,
      },
    });

    await (testPrisma as any).recipeIngredient.deleteMany({ where: { menuItemId: testItem.id } });
    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 1,
        unit: "piece",
      },
    });

    const order = await createDraftOrder(1);
    const key = `idemp-stock-${Date.now()}`;

    // First payment
    const pay1 = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .set("x-idempotency-key", key)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: order.grandTotal }],
      });
    assert.strictEqual(pay1.status, 200);

    const stockAfter1 = (await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } })).currentStock;
    assert.strictEqual(stockAfter1, 24);

    // Immediate duplicate payment with same idempotency key
    const pay2 = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .set("x-idempotency-key", key)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: order.grandTotal }],
      });
    assert.strictEqual(pay2.status, 200);
    assert.strictEqual(pay2.body.isDuplicate, true);

    // Stock MUST remain at 24 (not 23!)
    const stockAfter2 = (await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } })).currentStock;
    assert.strictEqual(stockAfter2, 24);

    // Exactly 1 SALE_DEDUCTION movement should exist for this order
    const movements = await (testPrisma as any).stockMovement.findMany({
      where: { orderId: order.id, ingredientId: ing.id, type: "SALE_DEDUCTION" },
    });
    assert.strictEqual(movements.length, 1);
  });

  // 15. Receipt reprints do not deduct stock again
  test("15. Customer receipt and KOT reprints NEVER deduct stock again", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Reprint Test Mayo " + Date.now(),
        sku: "RPR-MAYO-" + Date.now(),
        unit: "ml",
        currentStock: 500,
      },
    });

    await (testPrisma as any).recipeIngredient.deleteMany({ where: { menuItemId: testItem.id } });
    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 25,
        unit: "ml",
      },
    });

    const order = await createDraftOrder(1);
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);

    // Stock after initial sale: 500 - 25 = 475
    const stockAfterSale = (await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } })).currentStock;
    assert.strictEqual(stockAfterSale, 475);

    // Trigger an authorized reprint via invoice endpoint
    const invoice = payRes.body.invoice;
    const reprintRes = await request(app)
      .post(`/api/invoices/${invoice.id}/reprint`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ destination: "CUSTOMER_RECEIPT", reason: "Customer lost receipt" });

    assert.strictEqual(reprintRes.status, 200);
    assert.strictEqual(reprintRes.body.printJob.isReprint, true);

    // Stock must STILL be exactly 475
    const stockAfterReprint = (await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } })).currentStock;
    assert.strictEqual(stockAfterReprint, 475);
  });

  // 16. Print retries do not deduct stock again
  test("16. Retrying a failed print job NEVER deducts stock again", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Retry Print Pickle " + Date.now(),
        sku: "RTY-PCK-" + Date.now(),
        unit: "piece",
        currentStock: 40,
      },
    });

    await (testPrisma as any).recipeIngredient.deleteMany({ where: { menuItemId: testItem.id } });
    await (testPrisma as any).recipeIngredient.create({
      data: {
        branchId: ctx.branch.id,
        menuItemId: testItem.id,
        ingredientId: ing.id,
        quantity: 2,
        unit: "piece",
      },
    });

    const order = await createDraftOrder(1);
    const payRes = await request(app)
      .post(`/api/orders/${order.id}/payments`)
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({
        payments: [{ method: "CASH", amount: order.grandTotal, tenderedAmount: order.grandTotal }],
      });
    assert.strictEqual(payRes.status, 200);

    // Stock deducted: 40 - 2 = 38
    const stockAfterSale = (await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } })).currentStock;
    assert.strictEqual(stockAfterSale, 38);

    const printJob = payRes.body.printJobs[0];
    await (testPrisma as any).printJob.update({
      where: { id: printJob.id },
      data: { status: "FAILED", lastError: "Simulated paper out error" },
    });

    const retryRes = await request(app)
      .post(`/api/print-jobs/${printJob.id}/retry`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.body.printJob.status, "PRINTED");

    // Stock remains 38
    const stockAfterRetry = (await (testPrisma as any).ingredient.findUnique({ where: { id: ing.id } })).currentStock;
    assert.strictEqual(stockAfterRetry, 38);
  });

  // 17. Stock movement records contain correct before-and-after quantities
  test("17. Stock movement records record exact stockBefore, stockAfter, and delta quantities", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Audit Test Butter " + Date.now(),
        sku: "AUD-BTR-" + Date.now(),
        unit: "g",
        currentStock: 1000,
      },
    });

    // Stock adjustment: update stock to 1200g (+200g)
    const adjRes = await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        newQuantity: 1200,
        unit: "g",
        reason: "PHYSICAL_STOCK_COUNT",
      });

    assert.strictEqual(adjRes.status, 201);
    assert.strictEqual(adjRes.body.data.movement.type, "STOCK_ADJUSTMENT");
    assert.strictEqual(adjRes.body.data.movement.stockBefore, 1000);
    assert.strictEqual(adjRes.body.data.movement.stockAfter, 1200);
    assert.strictEqual(adjRes.body.data.movement.quantity, 200);
  });

  // 18. Historical ingredient costs remain accurate
  test("18. Historical purchase intake records preserve exact historical costs", async () => {
    const ing = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Basmati Rice " + Date.now(),
        sku: "HIST-RICE-" + Date.now(),
        unit: "kg",
        currentStock: 0,
        costPerUnit: 8000, // ₹80.00 / kg
      },
    });

    // Intake 1: ₹90.00 / kg (total ₹900.00 = 90000 paise for 10 kg)
    const intake1 = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 10,
        unit: "kg",
        purchaseCost: 90000,
        invoiceRef: "BATCH-001",
      });
    assert.strictEqual(intake1.status, 201);

    // Intake 2: ₹95.00 / kg (total ₹475.00 = 47500 paise for 5 kg)
    const intake2 = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        ingredientId: ing.id,
        quantity: 5,
        unit: "kg",
        purchaseCost: 47500,
        invoiceRef: "BATCH-002",
      });
    assert.strictEqual(intake2.status, 201);

    // Verify historical intake records retain their distinct purchase costs
    const listIntakes = await request(app)
      .get(`/api/inventory/intakes?ingredientId=${ing.id}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(listIntakes.status, 200);
    const intakes = listIntakes.body.data.intakes;
    assert.strictEqual(intakes.length, 2);
    assert.ok(intakes.some((i: any) => i.invoiceRef === "BATCH-001" && i.purchaseCost === 90000));
    assert.ok(intakes.some((i: any) => i.invoiceRef === "BATCH-002" && i.purchaseCost === 47500));
  });

  // 19. Inventory data is isolated between branches
  test("19. Inventory data is strictly isolated between branches", async () => {
    // Create ingredient in branch 1
    const ingBranch1 = await (testPrisma as any).ingredient.create({
      data: {
        branchId: ctx.branch.id,
        name: "Branch 1 Secret Spice " + Date.now(),
        sku: "ISO-SPICE-" + Date.now(),
        unit: "g",
        currentStock: 100,
      },
    });

    // Branch 2 owner attempts to fetch or modify Branch 1 ingredient
    const getRes = await request(app)
      .get(`/api/inventory/ingredients/${ingBranch1.id}`)
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`);

    assert.strictEqual(getRes.status, 404);

    const intakeRes = await request(app)
      .post("/api/inventory/intake")
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`)
      .send({
        ingredientId: ingBranch1.id,
        quantity: 50,
        unit: "g",
        purchaseCost: 500,
      });

    assert.strictEqual(intakeRes.status, 400);
    assert.match(intakeRes.body.error.message, /Ingredient not found in this branch/);
  });

  // 20. Dashboard summary endpoint accurately aggregates metrics
  test("20. Dashboard summary calculates correct counts and valuation from actual database records", async () => {
    const summaryRes = await request(app)
      .get("/api/inventory/dashboard")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.strictEqual(summaryRes.status, 200);
    const summary = summaryRes.body.data;
    assert.ok(typeof summary.totalActiveIngredients === "number");
    assert.ok(typeof summary.lowStockCount === "number");
    assert.ok(typeof summary.outOfStockCount === "number");
    assert.ok(typeof summary.totalWastageCount === "number");
    assert.ok(typeof summary.totalInventoryValuation === "number");
    assert.ok(Array.isArray(summary.recentMovements));
  });
});
