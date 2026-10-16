import { prisma } from "../config/prisma";

async function seedInventory() {
  console.log("🌱 Seeding realistic baseline inventory data for ROLLZ POS...");

  const branch = await prisma.branch.findFirst({
    where: { isActive: true },
  });

  if (!branch) {
    console.log("❌ No active branch found");
    return;
  }

  const existingIngredientsCount = await prisma.ingredient.count({
    where: { branchId: branch.id },
  });

  if (existingIngredientsCount > 0) {
    console.log(`ℹ️ Branch already has ${existingIngredientsCount} ingredients configured. Preserving existing inventory.`);
    return;
  }

  // Realistic restaurant raw materials and packaging
  const initialIngredients = [
    {
      name: "Boneless Chicken Breast (Marinated)",
      sku: "ING-CHK-001",
      category: "Meat & Poultry",
      description: "Hand-trimmed chicken cubes marinated in signature Rollz spices",
      unit: "kg",
      currentStock: 15.0,
      minThreshold: 3.0,
      costPerUnit: 24000, // ₹240.00 / kg
    },
    {
      name: "Paratha Flatbread Wraps",
      sku: "ING-WRP-001",
      category: "Bakery & Breads",
      description: "Layered, flaky paratha flatbreads for signature rolls",
      unit: "piece",
      currentStock: 120,
      minThreshold: 25,
      costPerUnit: 1400, // ₹14.00 / piece
    },
    {
      name: "Toasted Brioche Burger Buns",
      sku: "ING-BUN-001",
      category: "Bakery & Breads",
      description: "4.5-inch sesame brioche burger buns",
      unit: "piece",
      currentStock: 60,
      minThreshold: 15,
      costPerUnit: 1800, // ₹18.00 / piece
    },
    {
      name: "Crispy French Fries (Pre-cut)",
      sku: "ING-POT-001",
      category: "Produce & Vegetables",
      description: "9mm skin-on coated potato strips",
      unit: "kg",
      currentStock: 25.0,
      minThreshold: 5.0,
      costPerUnit: 11000, // ₹110.00 / kg
    },
    {
      name: "Mozzarella Cheese Blend",
      sku: "ING-CHS-001",
      category: "Dairy & Cheese",
      description: "Shredded high-melt mozzarella cheese",
      unit: "kg",
      currentStock: 8.0,
      minThreshold: 2.0,
      costPerUnit: 42000, // ₹420.00 / kg
    },
    {
      name: "Cheddar Cheese Slices",
      sku: "ING-CHS-002",
      category: "Dairy & Cheese",
      description: "Processed cheddar cheese slices for burgers",
      unit: "piece",
      currentStock: 80,
      minThreshold: 20,
      costPerUnit: 900, // ₹9.00 / slice
    },
    {
      name: "Rollz Signature Garlic Mayo Sauce",
      sku: "ING-SAU-001",
      category: "Sauces & Condiments",
      description: "Creamy garlic house dressing",
      unit: "L",
      currentStock: 6.0,
      minThreshold: 1.5,
      costPerUnit: 16000, // ₹160.00 / L
    },
    {
      name: "Chili Garlic Hot Sauce",
      sku: "ING-SAU-002",
      category: "Sauces & Condiments",
      description: "Spicy red chili dipping sauce",
      unit: "L",
      currentStock: 5.0,
      minThreshold: 1.0,
      costPerUnit: 14000, // ₹140.00 / L
    },
    {
      name: "Sliced Red Onions & Herbs",
      sku: "ING-VEG-001",
      category: "Produce & Vegetables",
      description: "Freshly sliced crunchy onions and chopped coriander",
      unit: "kg",
      currentStock: 12.0,
      minThreshold: 3.0,
      costPerUnit: 3500, // ₹35.00 / kg
    },
    {
      name: "Rolls Foil Wrapping Paper",
      sku: "ING-PKG-001",
      category: "Packaging & Disposables",
      description: "Food-grade insulated foil wrap for hot takeaway rolls",
      unit: "piece",
      currentStock: 250,
      minThreshold: 50,
      costPerUnit: 250, // ₹2.50 / wrap
    },
  ];

  for (const item of initialIngredients) {
    const created = await prisma.ingredient.create({
      data: {
        branchId: branch.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        description: item.description,
        unit: item.unit,
        currentStock: item.currentStock,
        minThreshold: item.minThreshold,
        costPerUnit: item.costPerUnit,
        isActive: true,
      },
    });

    // Record initial stock intake movement
    await prisma.stockMovement.create({
      data: {
        branchId: branch.id,
        ingredientId: created.id,
        type: "STOCK_IN",
        quantity: item.currentStock,
        unit: item.unit,
        stockBefore: 0,
        stockAfter: item.currentStock,
        reason: "Initial baseline inventory setup",
      },
    });
  }

  console.log(`✅ Seeded ${initialIngredients.length} baseline ingredients successfully.`);

  // Sample recipe mapping for existing menu items
  const menuItems = await prisma.menuItem.findMany({
    where: { branchId: branch.id },
  });

  const chickenIng = await prisma.ingredient.findFirst({ where: { branchId: branch.id, sku: "ING-CHK-001" } });
  const wrapIng = await prisma.ingredient.findFirst({ where: { branchId: branch.id, sku: "ING-WRP-001" } });
  const sauceIng = await prisma.ingredient.findFirst({ where: { branchId: branch.id, sku: "ING-SAU-001" } });
  const onionIng = await prisma.ingredient.findFirst({ where: { branchId: branch.id, sku: "ING-VEG-001" } });
  const foilIng = await prisma.ingredient.findFirst({ where: { branchId: branch.id, sku: "ING-PKG-001" } });

  for (const mi of menuItems) {
    if (mi.name.toLowerCase().includes("roll") && chickenIng && wrapIng && sauceIng && foilIng) {
      const existingRecipes = await prisma.recipeIngredient.count({ where: { menuItemId: mi.id } });
      if (existingRecipes === 0) {
        await prisma.recipeIngredient.createMany({
          data: [
            {
              branchId: branch.id,
              menuItemId: mi.id,
              ingredientId: chickenIng.id,
              quantity: 120, // 120g chicken
              unit: "g",
            },
            {
              branchId: branch.id,
              menuItemId: mi.id,
              ingredientId: wrapIng.id,
              quantity: 1, // 1 paratha wrap
              unit: "piece",
            },
            {
              branchId: branch.id,
              menuItemId: mi.id,
              ingredientId: sauceIng.id,
              quantity: 25, // 25ml sauce
              unit: "ml",
            },
            {
              branchId: branch.id,
              menuItemId: mi.id,
              ingredientId: onionIng?.id || foilIng.id,
              quantity: 20, // 20g onion
              unit: "g",
            },
            {
              branchId: branch.id,
              menuItemId: mi.id,
              ingredientId: foilIng.id,
              quantity: 1, // 1 foil
              unit: "piece",
            },
          ],
        });
        console.log(`✅ Configured sample recipe for "${mi.name}"`);
      }
    }
  }

  console.log("🎉 Phase 6 baseline inventory seeding complete!");
}

seedInventory()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
