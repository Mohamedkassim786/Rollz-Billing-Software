import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Base upload directories
export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "menu-items");
export const BRANDING_UPLOAD_ROOT = path.resolve(process.cwd(), "uploads", "branding");

// Ensure directories exist
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}
if (!fs.existsSync(BRANDING_UPLOAD_ROOT)) {
  fs.mkdirSync(BRANDING_UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".svg",
]);

// Storage for menu items
const menuItemStorage = multer.diskStorage({
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

// Storage for branding (logos and wallpapers)
const brandingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, BRANDING_UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".png";
    const uniqueName = `brand-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, uniqueName);
  },
});

// Menu item upload (supports up to 15MB)
export const imageUpload = multer({
  storage: menuItemStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE: Only JPEG, PNG, and WebP images are supported."));
    }
    cb(null, true);
  },
});

// Branding upload (supports up to 15MB for logos and high-res wallpapers)
export const brandingUpload = multer({
  storage: brandingStorage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE: Only JPEG, PNG, WebP, and SVG images are supported."));
    }
    cb(null, true);
  },
});

export function deleteLocalImage(relativePath: string | null | undefined): void {
  if (!relativePath) return;

  const filename = path.basename(relativePath);
  const targetPath = path.join(UPLOAD_ROOT, filename);

  if (targetPath.startsWith(UPLOAD_ROOT) && fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (err) {
      console.error(`Failed to delete local image: ${targetPath}`, err);
    }
  }
}

export function deleteBrandingImage(relativePath: string | null | undefined): void {
  if (!relativePath) return;

  const filename = path.basename(relativePath);
  const targetPath = path.join(BRANDING_UPLOAD_ROOT, filename);

  if (targetPath.startsWith(BRANDING_UPLOAD_ROOT) && fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (err) {
      console.error(`Failed to delete branding image: ${targetPath}`, err);
    }
  }
}
