import { prisma } from "../config/prisma";
import { ensureDefaultBranchAndCategories } from "../utils/seedInitialData";

async function main() {
  console.log("Seeding authentic ROLLZ menu items...");

  const branch = await ensureDefaultBranchAndCategories(prisma);

  const categories = await prisma.category.findMany({
    where: { branchId: branch.id },
  });

  const getCatId = (name: string) => {
    const found = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return found ? found.id : categories[0].id;
  };

  const sampleItems = [
    // Rolls
    {
      name: "Chicken Tikka Roll",
      categoryName: "Rolls",
      basePrice: 14000, // ₹140.00
      description: "Char-grilled spiced chicken wrapped in flaky parotta with mint mayo & onions",
      itemCode: "ROL-01",
      displayOrder: 1,
    },
    {
      name: "Crispy Paneer Makhani Roll",
      categoryName: "Rolls",
      basePrice: 12000, // ₹120.00
      description: "Golden paneer cubes tossed in rich makhani gravy wrapped with crunchy peppers",
      itemCode: "ROL-02",
      displayOrder: 2,
    },
    {
      name: "Special Shawarma Roll",
      categoryName: "Rolls",
      basePrice: 16000, // ₹160.00
      description: "Tender shredded shawarma chicken with garlic toum, tahini & pickled veg",
      itemCode: "ROL-03",
      displayOrder: 3,
    },

    // Burgers
    {
      name: "Classic Cheese Burger",
      categoryName: "Burgers",
      basePrice: 15000, // ₹150.00
      description: "Juicy chicken patty, melted cheddar cheese, signature Rollz burger sauce",
      itemCode: "BGR-01",
      displayOrder: 1,
    },
    {
      name: "Crispy Zinger Crunch Burger",
      categoryName: "Burgers",
      basePrice: 17000, // ₹170.00
      description: "Extra crispy batter-fried fillet with spicy mayo, iceberg lettuce & dill pickles",
      itemCode: "BGR-02",
      displayOrder: 2,
    },
    {
      name: "Smoky BBQ Double Patty Burger",
      categoryName: "Burgers",
      basePrice: 22000, // ₹220.00
      description: "Double grilled patties, smoky barbecue glaze, caramelized onions & cheese",
      itemCode: "BGR-03",
      displayOrder: 3,
    },

    // Loaded Fries
    {
      name: "Cheesy Peri-Peri Loaded Fries",
      categoryName: "Loaded Fries",
      basePrice: 14000, // ₹140.00
      description: "Crispy seasoned fries smothered in liquid cheese and zesty peri-peri dust",
      itemCode: "FRS-01",
      displayOrder: 1,
    },
    {
      name: "Chicken Fajita Loaded Fries",
      categoryName: "Loaded Fries",
      basePrice: 18000, // ₹180.00
      description: "Crispy fries topped with seasoned diced chicken, salsa, sour cream & jalapenos",
      itemCode: "FRS-02",
      displayOrder: 2,
    },

    // Grill & Kebabs
    {
      name: "Charcoal Chicken Kebab Platter",
      categoryName: "Grill",
      basePrice: 26000, // ₹260.00
      description: "Succulent charcoal-grilled kebabs served with kuboos, garlic dip & salad",
      itemCode: "GRL-01",
      displayOrder: 1,
    },
    {
      name: "Spicy Seekh Kebab (4 Pcs)",
      categoryName: "Kebabs",
      basePrice: 21000, // ₹210.00
      description: "Aromatic minced chicken skewers roasted on tandoor charcoal with lemon butter",
      itemCode: "KBB-01",
      displayOrder: 2,
    },

    // Beverages
    {
      name: "Fresh Mint Lemonade",
      categoryName: "Beverages",
      basePrice: 6000, // ₹60.00
      description: "Refreshing crushed ice lemonade infused with fresh mint & black salt",
      itemCode: "BEV-01",
      displayOrder: 1,
    },
    {
      name: "Cold Brew Iced Coffee",
      categoryName: "Beverages",
      basePrice: 9000, // ₹90.00
      description: "Slow-brewed dark roast arabica coffee with chilled milk and caramel swirl",
      itemCode: "BEV-02",
      displayOrder: 2,
    },
  ];

  let added = 0;
  for (const item of sampleItems) {
    const categoryId = getCatId(item.categoryName);
    const existing = await prisma.menuItem.findFirst({
      where: {
        branchId: branch.id,
        name: item.name,
      },
    });

    if (!existing) {
      await prisma.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId,
          name: item.name,
          basePrice: item.basePrice,
          description: item.description,
          itemCode: item.itemCode,
          displayOrder: item.displayOrder,
          isActive: true,
          isAvailable: true,
        },
      });
      added++;
    }
  }

  console.log(`Successfully added ${added} clean standard menu items for ROLLZ POS.`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
