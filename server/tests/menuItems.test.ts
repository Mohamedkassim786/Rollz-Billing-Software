import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, testPrisma } from "./setup";

test("Menu Item Management Tests", async (t) => {
  const ctx = await setupTestEnvironment();

  // Find a category for testing
  const category = await testPrisma.category.findFirst({
    where: { branchId: ctx.branch.id, isActive: true },
  });
  assert.ok(category, "Test category must exist");

  let createdItemId: string;

  await t.test("Create menu item successfully", async () => {
    const itemName = `Classic Chicken Roll ${Date.now()}`;
    const res = await request(app)
      .post("/api/menu-items")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        categoryId: category.id,
        name: itemName,
        description: "Freshly rolled paratha with spiced chicken chunks",
        basePrice: 15000, // ₹150.00
        itemCode: "ROLL-01",
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.menuItem.name, itemName);
    assert.equal(res.body.menuItem.basePrice, 15000);
    assert.equal(res.body.menuItem.isAvailable, true);
    assert.equal(res.body.menuItem.isActive, true);

    createdItemId = res.body.menuItem.id;
  });

  await t.test("Reject negative price", async () => {
    const res = await request(app)
      .post("/api/menu-items")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        categoryId: category.id,
        name: "Free Burger",
        basePrice: -100,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("Reject invalid category ID", async () => {
    const res = await request(app)
      .post("/api/menu-items")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        categoryId: "00000000-0000-0000-0000-000000000000",
        name: "Test Item",
        basePrice: 12000,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_CATEGORY");
  });

  await t.test("Update menu item price and details", async () => {
    const res = await request(app)
      .patch(`/api/menu-items/${createdItemId}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        basePrice: 17000, // ₹170.00
        description: "Updated description with extra sauce",
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.menuItem.basePrice, 17000);
  });

  await t.test("Toggle item availability", async () => {
    const res = await request(app)
      .patch(`/api/menu-items/${createdItemId}/availability`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ isAvailable: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.menuItem.isAvailable, false);

    // Turn back on
    const res2 = await request(app)
      .patch(`/api/menu-items/${createdItemId}/availability`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ isAvailable: true });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.menuItem.isAvailable, true);
  });

  await t.test("Toggle item active status", async () => {
    const res = await request(app)
      .patch(`/api/menu-items/${createdItemId}/status`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ isActive: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.menuItem.isActive, false);

    // Reactivate
    const res2 = await request(app)
      .patch(`/api/menu-items/${createdItemId}/status`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ isActive: true });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.menuItem.isActive, true);
  });

  await t.test("Reject cross-branch access", async () => {
    // Another branch owner attempts to access or modify this item
    const res = await request(app)
      .get(`/api/menu-items/${createdItemId}`)
      .set("Authorization", `Bearer ${ctx.otherBranchOwnerToken}`);

    assert.equal(res.status, 404);
  });
});
