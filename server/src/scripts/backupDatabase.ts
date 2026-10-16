import { backupService } from "../services/backupService";
import { prisma } from "../config/prisma";

async function main() {
  console.log("==========================================");
  console.log("   ROLLZ POS — DATABASE BACKUP UTILITY    ");
  console.log("==========================================");
  console.log("Starting PostgreSQL backup using pg_dump...");

  const result = await backupService.createBackup(prisma);

  if (result.success) {
    console.log("✅ Backup completed successfully!");
    console.log(`📁 File:     ${result.filename}`);
    console.log(`📍 Path:     ${result.filepath}`);
    console.log(`📦 Size:     ${(result.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`⏱️ Duration: ${result.durationMs}ms`);
    process.exit(0);
  } else {
    console.error("❌ Backup failed:", result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal backup error:", err);
  process.exit(1);
});
