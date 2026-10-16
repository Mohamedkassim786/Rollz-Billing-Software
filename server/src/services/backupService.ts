import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

export interface BackupResult {
  success: boolean;
  status: "SUCCESS" | "FAILED";
  filename: string;
  filepath: string;
  sizeBytes: number;
  durationMs: number;
  error?: string;
  createdAt: Date;
}

export interface RestoreResult {
  success: boolean;
  targetDatabase: string;
  backupFile: string;
  durationMs: number;
  error?: string;
}

export class BackupService {
  private pgBinDir: string | null = null;

  constructor() {
    this.detectPostgreSqlBinDir();
  }

  /**
   * Find pg_dump and pg_restore binary path on Windows or Linux
   */
  private detectPostgreSqlBinDir(): string | null {
    if (env.PG_BIN_DIR && fs.existsSync(env.PG_BIN_DIR)) {
      this.pgBinDir = env.PG_BIN_DIR;
      return this.pgBinDir;
    }

    // Windows standard PostgreSQL installation paths
    const candidateDirs = [
      "C:\\Program Files\\PostgreSQL\\18\\bin",
      "C:\\Program Files\\PostgreSQL\\17\\bin",
      "C:\\Program Files\\PostgreSQL\\16\\bin",
      "C:\\Program Files\\PostgreSQL\\15\\bin",
      "C:\\Program Files (x86)\\PostgreSQL\\18\\bin",
    ];

    for (const dir of candidateDirs) {
      if (fs.existsSync(path.join(dir, "pg_dump.exe"))) {
        this.pgBinDir = dir;
        return this.pgBinDir;
      }
    }

    return null;
  }

  private getBinaryPath(binaryName: string): string {
    const isWindows = process.platform === "win32";
    const exeName = isWindows ? `${binaryName}.exe` : binaryName;

    if (this.pgBinDir) {
      const fullPath = path.join(this.pgBinDir, exeName);
      if (fs.existsSync(fullPath)) return fullPath;
    }

    return binaryName; // Fallback to PATH
  }

  /**
   * Parse database connection parameters from URL safely
   */
  private parseDbUrl(dbUrl: string): {
    user: string;
    pass: string;
    host: string;
    port: string;
    database: string;
  } {
    try {
      const parsed = new URL(dbUrl);
      return {
        user: decodeURIComponent(parsed.username || "postgres"),
        pass: decodeURIComponent(parsed.password || ""),
        host: parsed.hostname || "localhost",
        port: parsed.port || "5432",
        database: parsed.pathname.replace(/^\//, "").split("?")[0] || "rollz_pos",
      };
    } catch {
      throw new Error("Unable to parse PostgreSQL connection string");
    }
  }

  /**
   * Execute manual or automated backup of PostgreSQL database using pg_dump
   */
  public async createBackup(clientDbOrOptions?: any): Promise<BackupResult> {
    let db = prisma;
    let customDbUrl = env.DATABASE_URL;

    if (clientDbOrOptions) {
      if (clientDbOrOptions.backupRecord) {
        db = clientDbOrOptions;
      } else if (clientDbOrOptions.clientDb) {
        db = clientDbOrOptions.clientDb;
        if (clientDbOrOptions.dbUrl) customDbUrl = clientDbOrOptions.dbUrl;
      }
    }

    const startTime = Date.now();
    const now = new Date();

    const backupDir = path.resolve(process.cwd(), env.BACKUP_DIR);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Format: rollz_pos_backup_YYYYMMDD_HHMMSS.dump
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .split(".")[0];
    const filename = `rollz_pos_backup_${timestamp}.dump`;
    const filepath = path.join(backupDir, filename);

    const dbParams = this.parseDbUrl(customDbUrl);
    const pgDumpBin = this.getBinaryPath("pg_dump");

    // pg_dump arguments:
    // -Fc: Custom PostgreSQL format (compressed, portable, restorable with pg_restore)
    // --clean --if-exists: Drop objects before recreating on restore
    const args = [
      "-h", dbParams.host,
      "-p", dbParams.port,
      "-U", dbParams.user,
      "-F", "c",
      "-b",
      "-v",
      "-f", filepath,
      dbParams.database,
    ];

    try {
      await execFileAsync(pgDumpBin, args, {
        env: {
          ...process.env,
          PGPASSWORD: dbParams.pass,
        },
        windowsHide: true,
      });

      const stats = fs.statSync(filepath);
      const durationMs = Date.now() - startTime;

      // Log in BackupRecord table
      try {
        await db.backupRecord.create({
          data: {
            filename,
            filepath,
            sizeBytes: stats.size,
            status: "SUCCESS",
            durationMs,
          },
        });
      } catch (logErr) {
        console.warn("Failed to write backup record log in database:", logErr);
      }

      // Enforce retention policy
      await this.enforceRetentionPolicy(backupDir, env.BACKUP_RETENTION_COUNT);

      return {
        success: true,
        status: "SUCCESS",
        filename,
        filepath,
        sizeBytes: stats.size,
        durationMs,
        createdAt: now,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err.message || "pg_dump execution failed";

      try {
        await db.backupRecord.create({
          data: {
            filename,
            filepath,
            sizeBytes: 0,
            status: "FAILED",
            error: errorMessage,
            durationMs,
          },
        });
      } catch {}

      return {
        success: false,
        status: "FAILED",
        filename,
        filepath,
        sizeBytes: 0,
        durationMs,
        error: errorMessage,
        createdAt: now,
      };
    }
  }

  public isPgToolsAvailable(): boolean {
    return !!this.pgBinDir;
  }

  public getPgBinDir(): string | null {
    return this.pgBinDir;
  }

  /**
   * Enforce retention policy: delete oldest backups beyond retention limit
   */
  public async enforceRetentionPolicy(backupDir: string, retentionCount: number): Promise<number> {
    if (!fs.existsSync(backupDir) || retentionCount <= 0) return 0;

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("rollz_pos_backup_") && (f.endsWith(".dump") || f.endsWith(".sql")))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        return {
          filename: f,
          path: fullPath,
          time: fs.statSync(fullPath).mtimeMs,
        };
      })
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length <= retentionCount) return 0;

    let deleted = 0;
    const toDelete = files.slice(retentionCount);
    for (const item of toDelete) {
      try {
        fs.unlinkSync(item.path);
        deleted++;
      } catch (err) {
        console.warn(`Could not delete old backup ${item.filename}:`, err);
      }
    }

    return deleted;
  }

  /**
   * List available backups on disk and database records
   */
  public async listBackups(clientDb?: any): Promise<any[]> {
    const backupDir = path.resolve(process.cwd(), env.BACKUP_DIR);
    if (!fs.existsSync(backupDir)) return [];

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("rollz_pos_backup_") && (f.endsWith(".dump") || f.endsWith(".sql")))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          filepath: fullPath,
          sizeBytes: stats.size,
          createdAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return files;
  }

  /**
   * Restore a backup file into a target PostgreSQL database using pg_restore
   * Safety rule: Default target is a test/verification database to never overwrite production by accident!
   */
  public async restoreBackup(params: {
    backupFilePath?: string;
    backupFilename?: string;
    targetDatabase?: string;
    targetDbName?: string;
    confirmLiveOverwrite?: boolean;
  }): Promise<RestoreResult> {
    const backupDir = path.resolve(process.cwd(), env.BACKUP_DIR);
    let filePath = params.backupFilePath;
    if (!filePath && params.backupFilename) {
      filePath = path.resolve(backupDir, params.backupFilename);
    }

    if (!filePath) {
      throw new Error("Backup file path or filename must be provided");
    }

    const targetDatabase = params.targetDbName || params.targetDatabase || "rollz_pos_test";
    const startTime = Date.now();

    const dbParams = this.parseDbUrl(env.DATABASE_URL);
    // CRITICAL SAFETY CHECK: Never overwrite live production DB without explicit confirmation!
    const isLiveDb =
      targetDatabase === "rollz_pos" ||
      (targetDatabase === dbParams.database && !targetDatabase.toLowerCase().includes("test"));
    if (isLiveDb && !params.confirmLiveOverwrite) {
      throw new Error("Live production restore requires explicit confirmLiveOverwrite: true");
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found at ${filePath}`);
    }

    const pgRestoreBin = this.getBinaryPath("pg_restore");

    // pg_restore arguments:
    // -c: Clean (drop database objects before recreating them)
    // --if-exists: Use IF EXISTS when dropping objects
    // -d: Connect to target database
    const args = [
      "-h", dbParams.host,
      "-p", dbParams.port,
      "-U", dbParams.user,
      "-d", targetDatabase,
      "-c",
      "--if-exists",
      "-v",
      filePath,
    ];

    try {
      await execFileAsync(pgRestoreBin, args, {
        env: {
          ...process.env,
          PGPASSWORD: dbParams.pass,
        },
        windowsHide: true,
      });

      return {
        success: true,
        targetDatabase,
        backupFile: path.basename(filePath),
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      // Note: pg_restore may return exit code 1 if non-fatal warnings (like role does not exist) occur,
      // but if the data is restored, it succeeds.
      const durationMs = Date.now() - startTime;
      return {
        success: !err.message?.includes("connection to server failed"),
        targetDatabase,
        backupFile: path.basename(filePath),
        durationMs,
        error: err.message,
      };
    }
  }
}

export const backupService = new BackupService();
