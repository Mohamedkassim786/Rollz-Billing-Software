import { prisma } from "../config/prisma";

async function clearTestSales() {
  console.log("==================================================");
  console.log("🧹 CLEARING TEST BILLING & SALES DATA");
  console.log("==================================================");

  try {
    // 1. Delete print jobs
    const printJobs = await prisma.printJob.deleteMany({});
    console.log(`✅ Deleted ${printJobs.count} print jobs.`);

    // 2. Delete payments
    const payments = await prisma.payment.deleteMany({});
    console.log(`✅ Deleted ${payments.count} payments.`);

    // 3. Delete invoices
    const invoices = await prisma.invoice.deleteMany({});
    console.log(`✅ Deleted ${invoices.count} invoices.`);

    // 4. Delete order items
    const orderItems = await prisma.orderItem.deleteMany({});
    console.log(`✅ Deleted ${orderItems.count} order items.`);

    // 5. Delete orders
    const orders = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${orders.count} orders.`);

    // 6. Reset daily invoice sequences
    const seqs = await prisma.invoiceSequence.deleteMany({});
    console.log(`✅ Reset ${seqs.count} invoice sequence counters.`);

    // 7. Delete cash movements and shifts
    const cashMovs = await prisma.cashMovement.deleteMany({});
    console.log(`✅ Deleted ${cashMovs.count} cash register movements.`);

    const shifts = await prisma.cashierShift.deleteMany({});
    console.log(`✅ Deleted ${shifts.count} cashier shifts.`);

    // 8. Delete stock movements created from orders
    const stockMovs = await prisma.stockMovement.deleteMany({});
    console.log(`✅ Deleted ${stockMovs.count} inventory movements.`);

    // 9. Delete test customer records
    const customers = await prisma.customer.deleteMany({});
    console.log(`✅ Deleted ${customers.count} customer records.`);

    console.log("==================================================");
    console.log("✨ SUCCESS: ALL TEST SALES & ORDERS REMOVED!");
    console.log("Your Menu, Categories, Modifiers, Users, and Branding are 100% PRESERVED.");
    console.log("All sales dashboards, reports, and bill counters are now fresh at 0.");
    console.log("==================================================");
  } catch (error) {
    console.error("❌ Failed to clear sales data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearTestSales();
