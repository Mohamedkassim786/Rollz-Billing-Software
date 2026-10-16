import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, testPrisma } from "./setup";
import { ensureDefaultBranchAndCategories } from "../src/utils/seedInitialData";

test("Category Management Tests", async (t) => {
  const ctx = await setupTestEnvironment();

  await t.test("Reject unauthenticated category requests", async () => {
    const res = await request(app).get("/api/categories");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHORIZED");
  });

  await t.test("Reject cashier from creating category", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ctx.cashierToken}`)
      .send({ name: "Unauthorized Category" });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  await t.test("Owner can create a new category", async () => {
    const testName = `Special Rolls ${Date.now()}`;
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: testName,
        description: "Artisan and fusion rolls",
        displayOrder: 25,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.category.name, testName);
    assert.equal(res.body.category.isActive, true);
  });

  await t.test("Reject invalid category (empty name)", async () => {
    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ name: "" });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("Reject duplicate category name in same branch", async () => {
    const duplicateName = `Duplicate Cat ${Date.now()}`;
    await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ name: duplicateName });

    const duplicateRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ name: duplicateName });

    assert.equal(duplicateRes.status, 409);
    assert.equal(duplicateRes.body.error.code, "DUPLICATE_CATEGORY");
  });

  await t.test("Owner can update category", async () => {
    const createRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ name: `To Update ${Date.now()}` });

    const catId = createRes.body.category.id;
    const updatedName = `Updated Cat ${Date.now()}`;

    const updateRes = await request(app)
      .patch(`/api/categories/${catId}`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({ name: updatedName, description: "Updated description" });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.category.name, updatedName);
    assert.equal(updateRes.body.category.description, "Updated description");
  });

  await t.test("Owner can reorder categories", async () => {
    const listRes = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    const cats = listRes.body.categories.slice(0, 2);
    if (cats.length >= 2) {
      const reorderPayload = {
        items: [
          { id: cats[0].id, displayOrder: 99 },
          { id: cats[1].id, displayOrder: 100 },
        ],
      };

      const reorderRes = await request(app)
        .patch("/api/categories/reorder")
        .set("Authorization", `Bearer ${ctx.ownerToken}`)
        .send(reorderPayload);

      assert.equal(reorderRes.status, 200);

      const verifyRes = await request(app)
        .get(`/api/categories/${cats[0].id}`)
        .set("Authorization", `Bearer ${ctx.ownerToken}`);

      assert.equal(verifyRes.body.category.displayOrder, 99);
    }
  });

  await t.test("Prevent duplicate initial seed data on multiple runs", async () => {
    const countBefore = await testPrisma.category.count({
      where: { branchId: ctx.branch.id },
    });

    // Run seedInitialData again
    await ensureDefaultBranchAndCategories(testPrisma);

    const countAfter = await testPrisma.category.count({
      where: { branchId: ctx.branch.id },
    });

    assert.equal(countBefore, countAfter);
  });
});
