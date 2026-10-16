import { prisma } from "../config/prisma";
import { ensureDefaultBranchAndCategories } from "../utils/seedInitialData";

async function main() {
  console.log("Cleaning up automated test entries from database...");

  // 1. Delete test order items and test orders if they were created with test names
  const testItems = await prisma.menuItem.findMany({
    where: {
      OR: [
        { name: { contains: "1791" } },
        { name: { contains: "Test " } },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${testItems.length} test menu items to clean up.`);

  for (const item of testItems) {
    try {
      await prisma.menuItem.delete({
        where: { id: item.id },
      });
    } catch (err: any) {
      console.warn(`Could not delete item ${item.name}: ${err.message}`);
    }
  }

  // 2. Delete test modifier groups
  const testModGroups = await prisma.modifierGroup.findMany({
    where: {
      OR: [
        { name: { contains: "1791" } },
        { name: { contains: "Test " } },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${testModGroups.length} test modifier groups to clean up.`);
  for (const group of testModGroups) {
    try {
      await prisma.modifierGroup.delete({
        where: { id: group.id },
      });
    } catch (err: any) {
      console.warn(`Could not delete modifier group ${group.name}: ${err.message}`);
    }
  }

  // 3. Delete test categories
  const testCats = await prisma.category.findMany({
    where: {
      OR: [
        { name: { contains: "1791" } },
        { name: { contains: "Test " } },
        { name: { contains: "Updated Cat" } },
        { slug: { contains: "test-" } },
        { slug: { contains: "integration-" } },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${testCats.length} test categories to clean up.`);
  for (const cat of testCats) {
    try {
      await prisma.category.delete({
        where: { id: cat.id },
      });
    } catch (err: any) {
      console.warn(`Could not delete category ${cat.name}: ${err.message}`);
    }
  }

  // 4. Ensure the clean default 10 ROLLZ categories exist
  await ensureDefaultBranchAndCategories(prisma);

  const remainingCats = await prisma.category.count();
  const remainingItems = await prisma.menuItem.count();

  console.log(`Cleanup complete! Remaining clean categories: ${remainingCats}, items: ${remainingItems}`);
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
