import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment } from "./setup";

test("Modifier Groups & Options Tests", async (t) => {
  const ctx = await setupTestEnvironment();

  await t.test("Create single-choice modifier group", async () => {
    const res = await request(app)
      .post("/api/modifier-groups")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: `Spice Level ${Date.now()}`,
        selectionType: "SINGLE",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.modifierGroup.selectionType, "SINGLE");
    assert.equal(res.body.modifierGroup.isRequired, true);
  });

  await t.test("Reject single-choice group with maxSelections > 1", async () => {
    const res = await request(app)
      .post("/api/modifier-groups")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Invalid Single Group",
        selectionType: "SINGLE",
        maxSelections: 3,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("Reject group with minSelections > maxSelections", async () => {
    const res = await request(app)
      .post("/api/modifier-groups")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Invalid Range Group",
        selectionType: "MULTIPLE",
        minSelections: 5,
        maxSelections: 2,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  await t.test("Create multiple-choice modifier group and options", async () => {
    const groupRes = await request(app)
      .post("/api/modifier-groups")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: `Add-ons Group ${Date.now()}`,
        selectionType: "MULTIPLE",
        isRequired: false,
        minSelections: 0,
        maxSelections: 5,
      });

    assert.equal(groupRes.status, 201);
    const groupId = groupRes.body.modifierGroup.id;

    // Create option 1: Extra Cheese (₹30.00 = 3000 paise)
    const optRes1 = await request(app)
      .post(`/api/modifier-groups/${groupId}/options`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Extra Cheese",
        extraPrice: 3000,
      });

    assert.equal(optRes1.status, 201);
    assert.equal(optRes1.body.option.extraPrice, 3000);
  });

  await t.test("Reject negative option price", async () => {
    const groupRes = await request(app)
      .post("/api/modifier-groups")
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: `Pricing Test Group ${Date.now()}`,
        selectionType: "MULTIPLE",
      });

    const groupId = groupRes.body.modifierGroup.id;

    const optRes = await request(app)
      .post(`/api/modifier-groups/${groupId}/options`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .send({
        name: "Negative Option",
        extraPrice: -500,
      });

    assert.equal(optRes.status, 400);
    assert.equal(optRes.body.error.code, "VALIDATION_ERROR");
  });
});
