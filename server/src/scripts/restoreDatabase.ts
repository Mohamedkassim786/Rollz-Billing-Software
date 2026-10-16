import path from "path";
import fs from "fs";
import { backupService } from "../services/backupService";
import { env } from "../config/env";

async function main() {
  const args = process.argv.slice(2);
  const targetDb = args[0] || "rollz_pos_test";
  const backupFileArg = args[1];

  console.log("==========================================");
  console.log("   ROLLZ POS — SAFE RESTORE UTILITY       ");
  console.log("==========================================");

  let targetBackupFile = backupFileArg;

  if (!targetBackupFile) {
    const backupDir = path.resolve(process.cwd(), env.BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
      console.error(`❌ Backup directory not found at ${backupDir}`);
      process.exit(1);
    }

    const available = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".dump") || f.endsWith(".sql"))
      .sort()
      .reverse();

    if (available.length === 0) {
      console.error("❌ No backup files found in backups directory");
      process.exit(1);
    }

    targetBackupFile = path.join(backupDir, available[0]);
    console.log(`Using latest backup: ${available[0]}`);
  }

  console.log(`Target Database:  ${targetDb}`);
  console.log(`Backup File:      ${targetBackupFile}`);
  console.log("Executing pg_restore...");

  const result = await backupService.restoreBackup({
    backupFilePath: targetBackupFile,
    targetDatabase: targetDb,
  });

  if (result.success) {
    console.log("✅ Backup restored successfully!");
    console.log(`⏱️ Duration: ${result.durationMs}ms`);
    process.exit(0);
  } else {
    console.error("❌ Restore failed:", result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal restore error:", err);
  process.exit(1);
});
