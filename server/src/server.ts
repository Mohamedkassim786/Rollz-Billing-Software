import os from "os";
import { app } from "./app";
import { env } from "./config/env";
import { prisma, checkDatabaseConnection } from "./config/prisma";
import { ensureDefaultBranchAndCategories } from "./utils/seedInitialData";
import { printerService } from "./services/printer/printerService";

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

async function startServer() {
  console.log("==================================================");
  console.log("🍔 ROLLZ RESTAURANT POS SERVER (Phase 9 Ready)");
  console.log("==================================================");

  // Verify PostgreSQL connection before accepting traffic
  const dbHealth = await checkDatabaseConnection();
  if (dbHealth.connected) {
    console.log(`✅ PostgreSQL connected successfully (latency: ${dbHealth.latencyMs}ms)`);
    // Ensure default branch and baseline categories exist
    await ensureDefaultBranchAndCategories(prisma);

    // Print Queue Recovery: Safely recover any jobs left in PRINTING state from prior crash
    try {
      const recovered = await printerService.recoverStalePrintJobs();
      if (recovered.recoveredCount > 0) {
        console.log(`🖨️  Recovered ${recovered.recoveredCount} stale print jobs back to PENDING queue.`);
      }
    } catch (printRecoveryErr) {
      console.warn("⚠️ Print queue startup check warning:", printRecoveryErr);
    }
  } else {
    console.warn(`⚠️ PostgreSQL connection warning: ${dbHealth.error}`);
  }

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`🚀 Server listening on host: ${env.HOST}, port: ${env.PORT}`);
    console.log(`💻 Local access:       http://localhost:${env.PORT}`);
    
    const lanIps = getLocalIpAddresses();
    if (lanIps.length > 0) {
      lanIps.forEach((ip) => {
        console.log(`🌐 Local Network (LAN): http://${ip}:${env.PORT}`);
      });
    } else {
      console.log("🌐 Local Network (LAN): (No active network adapter detected)");
    }
    console.log(`🩺 Health check:       http://localhost:${env.PORT}/api/health`);
    console.log("==================================================");
  });

  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log("🔌 Database disconnected. Process exiting.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
}

startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
