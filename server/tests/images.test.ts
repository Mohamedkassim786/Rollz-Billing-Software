import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../src/app";
import { setupTestEnvironment, testPrisma } from "./setup";

test("Food Image Upload & Safety Tests", async (t) => {
  const ctx = await setupTestEnvironment();

  // Find a category and create a test item
  const category = await testPrisma.category.findFirst({
    where: { branchId: ctx.branch.id, isActive: true },
  });
  assert.ok(category);

  const itemRes = await request(app)
    .post("/api/menu-items")
    .set("Authorization", `Bearer ${ctx.ownerToken}`)
    .send({
      categoryId: category.id,
      name: `Image Test Burger ${Date.now()}`,
      basePrice: 18000,
    });
  const itemId = itemRes.body.menuItem.id;

  await t.test("Reject unsupported MIME type (text file)", async () => {
    const textBuffer = Buffer.from("this is a text file not an image");
    const res = await request(app)
      .post(`/api/menu-items/${itemId}/image`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .attach("image", textBuffer, "bad-script.sh");

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "IMAGE_UPLOAD_ERROR");
  });

  await t.test("Reject oversized file upload (> 15MB)", async () => {
    const largeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    const res = await request(app)
      .post(`/api/menu-items/${itemId}/image`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .attach("image", largeBuffer, "large-photo.jpg");

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "IMAGE_UPLOAD_ERROR");
  });

  await t.test("Accept valid PNG image file", async () => {
    // 1x1 valid PNG buffer
    const validPngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const res = await request(app)
      .post(`/api/menu-items/${itemId}/image`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`)
      .attach("image", validPngBuffer, "food-sample.png");

    assert.equal(res.status, 200);
    assert.ok(res.body.imagePath);
    assert.match(res.body.imagePath, /^\/uploads\/menu-items\/[a-zA-Z0-9-]+\.png$/);
  });

  await t.test("Delete image from menu item", async () => {
    const res = await request(app)
      .delete(`/api/menu-items/${itemId}/image`)
      .set("Authorization", `Bearer ${ctx.ownerToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.menuItem.imagePath, null);
  });
});
