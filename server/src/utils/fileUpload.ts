import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Base upload directory: server/uploads/menu-items
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "menu-items");

// Ensure directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".jpg";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE: Only JPEG, PNG, and WebP images up to 2MB are supported."));
    }
    cb(null, true);
  },
});

export function deleteLocalImage(relativePath: string | null | undefined): void {
  if (!relativePath) return;

  // Prevent path traversal by extracting only the filename
  const filename = path.basename(relativePath);
  const targetPath = path.join(UPLOAD_ROOT, filename);

  // Ensure path is strictly within UPLOAD_ROOT
  if (!targetPath.startsWith(UPLOAD_ROOT)) {
    console.warn("Potential path traversal attempted:", relativePath);
    return;
  }

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch (err) {
    console.error("Failed to delete image file:", targetPath, err);
  }
}

export { UPLOAD_ROOT };
