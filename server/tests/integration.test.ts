import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, testPrisma } from "./setup";

test("End-to-End Menu Management Integration Flow", async () => {
  const ctx = await setupTestEnvironment();

  // 1. Create a Category
  const catName = `Integration Grill ${Date.now()}`;
  const catRes = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({
      name: catName,
      description: "Charcoal grill favorites",
      displayOrder: 1,
    });
  assert.equal(catRes.status, 201);
  const categoryId = catRes.body.category.id;

  // 2. Create Modifier Group (e.g. Spice Level)
  const groupRes = await request(app)
    .post("/api/modifier-groups")
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({
      name: `Grill Spice ${Date.now()}`,
      selectionType: "SINGLE",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
    });
  assert.equal(groupRes.status, 201);
  const groupId = groupRes.body.modifierGroup.id;

  // 3. Create Modifier Options
  const optRes1 = await request(app)
    .post(`/api/modifier-groups/${groupId}/options`)
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({ name: "Medium Hot", extraPrice: 0 });
  assert.equal(optRes1.status, 201);

  const optRes2 = await request(app)
    .post(`/api/modifier-groups/${groupId}/options`)
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({ name: "Ghost Pepper Extreme", extraPrice: 2000 }); // ₹20.00 extra
  assert.equal(optRes2.status, 201);

  // 4. Create Menu Item in the Category
  const itemName = `Charcoal Grilled Kebab Skewer ${Date.now()}`;
  const itemRes = await request(app)
    .post("/api/menu-items")
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({
      categoryId,
      name: itemName,
      description: "Charcoal grilled skewered chicken marinated in special spices",
      basePrice: 24000, // ₹240.00
      itemCode: "GRILL-09",
      modifierGroupIds: [groupId],
    });
  assert.equal(itemRes.status, 201);
  const itemId = itemRes.body.menuItem.id;

  // 5. Retrieve Complete Menu Item with all relations
  const fetchRes = await request(app)
    .get(`/api/menu-items/${itemId}`)
    .set("Authorization", `Bearer ${ctx.ownerToken}`);
  assert.equal(fetchRes.status, 200);
  assert.equal(fetchRes.body.menuItem.name, itemName);
  assert.equal(fetchRes.body.menuItem.basePrice, 24000);
  assert.equal(fetchRes.body.menuItem.category.id, categoryId);
  assert.equal(fetchRes.body.menuItem.modifierGroups.length, 1);
  assert.equal(fetchRes.body.menuItem.modifierGroups[0].modifierGroup.options.length, 2);

  // 6. Update Price
  const updateRes = await request(app)
    .patch(`/api/menu-items/${itemId}`)
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({ basePrice: 26000 }); // ₹260.00
  assert.equal(updateRes.status, 200);

  // 7. Verify directly in PostgreSQL via testPrisma
  const dbItem = await testPrisma.menuItem.findUnique({
    where: { id: itemId },
    include: {
      category: true,
      modifierGroups: {
        include: {
          modifierGroup: {
            include: { options: true },
          },
        },
      },
    },
  });

  assert.ok(dbItem);
  assert.equal(dbItem.basePrice, 26000);
  assert.equal(dbItem.name, itemName);
  assert.equal(dbItem.category.name, catName);
  assert.equal(dbItem.modifierGroups.length, 1);
  assert.equal(dbItem.modifierGroups[0].modifierGroup.options.length, 2);
});
