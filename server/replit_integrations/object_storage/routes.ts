import type { Express, RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { getOrCreateImageVariant, parseVariantRequest, warmVariants } from "../../imageVariants";
import { randomUUID } from "crypto";

/**
 * One recipe for turning an upload into the webp the site serves.
 *
 * SVG rasterises at a high density (the default 72dpi renders a logo as a
 * blurry thumbnail), an animated GIF keeps its frames instead of collapsing
 * to frame one, and every photo is rotated by its EXIF orientation before
 * the metadata is dropped — a portrait taken on a phone used to arrive on
 * its side. The dimensions come back with it so nothing has to measure the
 * file in a browser afterwards.
 */
export async function optimizeUploadBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; width?: number; height?: number }> {
  const isSvg = mimeType === "image/svg+xml";
  const isGif = mimeType === "image/gif";
  let pipeline = sharp(buffer, {
    ...(isSvg ? { density: 192 } : {}),
    ...(isGif ? { animated: true } : {}),
  });
  if (!isSvg && !isGif) pipeline = pipeline.rotate();

  const metadata = await pipeline.metadata();
  if (metadata.width && metadata.width > 2000) {
    pipeline = pipeline.resize(2000, null, { withoutEnlargement: true, fit: "inside" });
  }

  const optimized = await pipeline.webp({ quality: 80 }).toBuffer();
  const out = await sharp(optimized, isGif ? { animated: true } : {}).metadata();
  // An animated webp reports the height of the filmstrip; pages need one frame.
  const height = isGif && out.pages && out.pages > 1 && out.height ? Math.round(out.height / out.pages) : out.height;
  return { buffer: optimized, width: out.width, height };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for high-resolution images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express, requireAuth?: RequestHandler): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", ...(requireAuth ? [requireAuth] : []), async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Upload and optimize an image.
   * 
   * POST /api/uploads/optimized-image
   * Content-Type: multipart/form-data
   * 
   * The image is automatically:
   * - Compressed to 80% quality
   * - Converted to WebP format (25-35% smaller than JPEG/PNG)
   * - Resized if larger than 2000px width
   * - Rotated by EXIF orientation; SVG rasterised at 192dpi; GIF kept animated
   *
   * Response:
   * {
   *   "objectPath": "/objects/uploads/uuid.webp",
   *   "originalSize": 5242880,
   *   "optimizedSize": 102400,
   *   "savings": "98%",
   *   "width": 2000,
   *   "height": 1333
   * }
   */
  app.post("/api/uploads/optimized-image", ...(requireAuth ? [requireAuth] : []), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const originalSize = req.file.size;

      const { buffer: optimizedBuffer, width, height } = await optimizeUploadBuffer(
        req.file.buffer,
        req.file.mimetype
      );

      const optimizedSize = optimizedBuffer.length;
      const savings = Math.round((1 - optimizedSize / originalSize) * 100);
      
      // Upload to Object Storage
      const privateObjectDir = objectStorageService.getPrivateObjectDir();
      const objectId = `${randomUUID()}.webp`;
      const fullPath = `${privateObjectDir}/uploads/${objectId}`;
      
      // Parse the path to get bucket and object name
      const pathParts = fullPath.startsWith('/') ? fullPath.slice(1).split('/') : fullPath.split('/');
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      // Upload the optimized buffer
      await file.save(optimizedBuffer, {
        contentType: 'image/webp',
        resumable: false,
      });
      
      const objectPath = `/objects/uploads/${objectId}`;

      // The page that uses this image will ask for smaller copies; make them
      // now, while someone is already waiting, rather than on a visitor's
      // first paint.
      void warmVariants(objectPath);

      res.json({
        objectPath,
        originalSize,
        optimizedSize,
        savings: `${savings}%`,
        // Measured server-side, so the caller never has to load the file to
        // learn how much space to reserve for it.
        width,
        height,
      });
    } catch (error) {
      console.error("Error optimizing and uploading image:", error);
      res.status(500).json({ error: "Failed to optimize and upload image" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      // ?w= asks for one of the fixed variant widths of an upload. Anything
      // else — another width, another path shape — is served as the original
      // rather than resized on demand, so the parameter cannot be used to
      // fill the bucket with arbitrary renditions.
      const width = parseVariantRequest(req.path, req.query.w);
      const variantPath = width === null ? null : await getOrCreateImageVariant(req.path, width);
      const servedPath = variantPath ?? req.path;

      const objectFile = await objectStorageService.getObjectEntityFile(servedPath);
      // An upload is addressed by a uuid and never rewritten, so its bytes
      // can be cached for as long as the browser likes.
      const immutable = /^\/objects\/uploads\//.test(req.path);
      await objectStorageService.downloadObject(objectFile, res, immutable ? 31536000 : 3600, immutable);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

