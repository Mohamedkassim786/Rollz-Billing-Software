import { PrismaClient } from "@prisma/client";

export const INITIAL_CATEGORIES = [
  { name: "Rolls", slug: "rolls", description: "Delicious freshly rolled wraps with signature fillings and sauces" },
  { name: "Burgers", slug: "burgers", description: "Juicy, grilled, and crispy handcrafted burgers" },
  { name: "Grill", slug: "grill", description: "Char-grilled platters and marinated specialties" },
  { name: "Loaded Fries", slug: "loaded-fries", description: "Crispy fries layered with cheese, toppings, and sauces" },
  { name: "Kebabs", slug: "kebabs", description: "Tender skewered and spiced kebabs" },
  { name: "Starters", slug: "starters", description: "Quick crunchy bites and appetizing sides" },
  { name: "Sandwiches", slug: "sandwiches", description: "Toasted and club sandwiches packed with flavor" },
  { name: "Beverages", slug: "beverages", description: "Chilled mocktails, sodas, and refreshing drinks" },
  { name: "Combos", slug: "combos", description: "Value meals pairing rolls, sides, and beverages" },
  { name: "Add-ons", slug: "add-ons", description: "Extra toppings, sauces, cheese, and upgrades" },
];

export async function ensureDefaultBranchAndCategories(prisma: PrismaClient) {
  // 1. Ensure default branch exists using upsert to avoid race conditions
  const branch = await prisma.branch.upsert({
    where: { code: "ROLLZ-001" },
    update: {},
    create: {
      name: "ROLLZ Main Branch",
      code: "ROLLZ-001",
      address: "Main Street, Ground Floor",
      phone: "+91 98765 43210",
      isActive: true,
    },
  });

  // 2. Ensure initial categories exist for this branch without duplicates
  let createdCount = 0;
  for (let i = 0; i < INITIAL_CATEGORIES.length; i++) {
    const cat = INITIAL_CATEGORIES[i];
    const existing = await prisma.category.findUnique({
      where: {
        branchId_name: {
          branchId: branch.id,
          name: cat.name,
        },
      },
    });

    if (!existing) {
      try {
        await prisma.category.create({
          data: {
            branchId: branch.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            displayOrder: i,
            isActive: true,
          },
        });
        createdCount++;
      } catch {
        // If created concurrently by another process, safely ignore
      }
    }
  }

  if (createdCount > 0) {
    console.log(`📦 Initialized ${createdCount} standard food categories for branch ${branch.code}`);
  }

  return branch;
}
