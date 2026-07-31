import type { Express, RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";

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
   * 
   * Response:
   * {
   *   "objectPath": "/objects/uploads/uuid.webp",
   *   "originalSize": 5242880,
   *   "optimizedSize": 102400,
   *   "savings": "98%"
   * }
   */
  app.post("/api/uploads/optimized-image", ...(requireAuth ? [requireAuth] : []), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const originalSize = req.file.size;
      
      // Process image with Sharp
      let sharpInstance = sharp(req.file.buffer);
      
      // Get image metadata
      const metadata = await sharpInstance.metadata();
      
      // Resize if too large (max 2000px width)
      if (metadata.width && metadata.width > 2000) {
        sharpInstance = sharpInstance.resize(2000, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }
      
      // Convert to WebP with 80% quality
      const optimizedBuffer = await sharpInstance
        .webp({ quality: 80 })
        .toBuffer();
      
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
      
      res.json({
        objectPath,
        originalSize,
        optimizedSize,
        savings: `${savings}%`,
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
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

