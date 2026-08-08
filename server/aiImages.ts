/**
 * AI image generation for the builder.
 *
 * The AI marks image slots in its mutations with "ai://<description>"
 * markers. resolveAiImageMarkers() finds those markers, generates the
 * images through the AI-integrations OpenAI proxy (gpt-image-1), optimizes
 * them with sharp (webp), persists them to Replit object storage plus the
 * website's media library, and swaps the markers for real URLs — the same
 * "/objects/uploads/…" paths manual uploads use, so publish parity comes
 * for free.
 *
 * Failures never fail the build: the marker collapses to an empty string
 * and a Danish note is added to the build report instead.
 */

import sharp from "sharp";
import { randomUUID } from "crypto";
import {
  ObjectStorageService,
  objectStorageClient,
} from "./replit_integrations/object_storage/objectStorage";
import { storage } from "./storage";
import type { BuilderMutation, AIPrimitiveNode } from "@shared/aiBuilderSchema";
import type { BrandGuide } from "@shared/schema";

import { meteredImage } from "./aiCall";
import type { SpendMeter } from "./aiSpend";

export const AI_IMAGE_MARKER = "ai://";
export const MAX_AI_IMAGES_PER_REQUEST = 5;

export type ImageAspect = "square" | "landscape" | "portrait";

const ASPECT_SIZE: Record<ImageAspect, "1024x1024" | "1536x1024" | "1024x1536"> = {
  square: "1024x1024",
  landscape: "1536x1024",
  portrait: "1024x1536",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Ground the image prompt in the brand guide and optional business context
 * so visuals stay on-brand and relevant to this specific business.
 *
 * `businessName` and `siteDescription` improve prompt relevance when the
 * caller has them — neither is required, and both are ignored when blank.
 */
function buildImagePrompt(
  description: string,
  brandGuide?: BrandGuide,
  businessName?: string,
  siteDescription?: string
): string {
  const parts = [description.trim()];

  // Ground the image in the specific business so generic "people" become
  // "clients of a psychology practice" instead of stock photo strangers.
  if (businessName) parts.push(`Business: ${businessName}`);
  if (siteDescription) parts.push(`Context: ${siteDescription.slice(0, 120)}`);

  if (brandGuide) {
    switch (brandGuide.imageryStyle) {
      case "illustration":
        parts.push("Style: modern flat illustration with clean shapes");
        break;
      case "3d":
        parts.push("Style: soft 3D render with subtle depth");
        break;
      case "minimal":
        parts.push("Style: minimalist, generous negative space, restrained");
        break;
      case "bold":
        parts.push("Style: bold, high contrast, dramatic lighting");
        break;
      default:
        parts.push("Style: professional photography, natural light, high quality");
    }
    const c = brandGuide.colors;
    if (c) {
      parts.push(`Color mood: primary ${c.primary}, accent ${c.accent}, background ${c.background}`);
    }
    if (brandGuide.imageryNotes) parts.push(`Art direction: ${brandGuide.imageryNotes}`);
    if (brandGuide.keywords?.length) parts.push(`Brand keywords: ${brandGuide.keywords.join(", ")}`);
  } else {
    parts.push("Style: professional photography, natural light, high quality");
  }
  parts.push("No text, no words, no logos, no watermarks in the image");
  return parts.join(". ");
}

/**
 * Generate one image, optimize to webp, store it in object storage and
 * register it in the website's media library. Returns the "/objects/…"
 * URL that both the builder and the published site can serve.
 */
export async function generateAndStoreImage(
  websiteId: string,
  description: string,
  brandGuide?: BrandGuide,
  aspect: ImageAspect = "landscape",
  /** The run's meter, when this image belongs to a larger run. */
  meter?: SpendMeter,
  /** Optional business name and description to ground the image in the real business. */
  businessContext?: { name?: string; description?: string }
): Promise<{ url: string; mediaId: string }> {
  const result = await meteredImage(
    {
      prompt: buildImagePrompt(description, brandGuide, businessContext?.name, businessContext?.description),
      size: ASPECT_SIZE[aspect],
      quality: "medium",
    },
    meter
  );

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Ingen billeddata modtaget fra billedgeneratoren");

  const optimized = await sharp(Buffer.from(b64, "base64")).webp({ quality: 82 }).toBuffer();
  const meta = await sharp(optimized).metadata();

  const objectStorageService = new ObjectStorageService();
  const privateObjectDir = objectStorageService.getPrivateObjectDir();
  const objectId = `${randomUUID()}.webp`;
  const fullPath = `${privateObjectDir}/uploads/${objectId}`;
  const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucket = objectStorageClient.bucket(pathParts[0]);
  const file = bucket.file(pathParts.slice(1).join("/"));
  await file.save(optimized, { contentType: "image/webp", resumable: false });

  const objectPath = `/objects/uploads/${objectId}`;
  const safeName = description.replace(/[^a-zA-Z0-9æøåÆØÅéÉüÜöÖäÄ _-]/g, "").trim().slice(0, 60) || "ai-billede";
  const asset = await storage.createMediaAsset({
    websiteId,
    filename: objectId,
    originalFilename: `ai-${safeName}.webp`,
    storagePath: objectPath,
    mimeType: "image/webp",
    size: optimized.length,
    width: meta.width,
    height: meta.height,
    altText: truncate(description, 250),
  });

  return { url: objectPath, mediaId: asset.id };
}

/**
 * Generate a logo for a business and store it like any other media
 * asset. Deliberately its OWN prompt path: buildImagePrompt appends
 * "no text, no logos" to every prompt because content images must not
 * fake wordmarks — a logo is the one image where text is the point.
 */
export async function generateLogo(
  websiteId: string,
  businessName: string,
  options?: { feeling?: string; primaryColor?: string; accentColor?: string; notes?: string },
  /** The run's meter, when this logo belongs to a larger run. */
  meter?: SpendMeter
): Promise<{ url: string; mediaId: string }> {
  const parts = [
    `Minimalist vector-style logo for the business "${businessName.trim()}".`,
    "A simple, memorable mark plus the business name as a clean wordmark.",
    "Flat design, crisp edges, centered composition, plain solid background.",
  ];
  if (options?.feeling) parts.push(`Brand feeling: ${options.feeling}`);
  if (options?.primaryColor) {
    parts.push(
      `Primary brand color ${options.primaryColor}${options?.accentColor ? `, accent ${options.accentColor}` : ""}. Use at most these colors plus neutrals.`
    );
  }
  if (options?.notes) parts.push(`Direction: ${truncate(options.notes, 300)}`);
  parts.push("No photograph, no 3D, no gradients heavier than subtle, no watermark.");

  const result = await meteredImage(
    {
      prompt: parts.join(" "),
      size: "1024x1024",
      quality: "medium",
    },
    meter
  );

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Ingen billeddata modtaget fra billedgeneratoren");

  const optimized = await sharp(Buffer.from(b64, "base64")).webp({ quality: 90 }).toBuffer();
  const meta = await sharp(optimized).metadata();

  const objectStorageService = new ObjectStorageService();
  const privateObjectDir = objectStorageService.getPrivateObjectDir();
  const objectId = `${randomUUID()}.webp`;
  const fullPath = `${privateObjectDir}/uploads/${objectId}`;
  const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucket = objectStorageClient.bucket(pathParts[0]);
  const file = bucket.file(pathParts.slice(1).join("/"));
  await file.save(optimized, { contentType: "image/webp", resumable: false });

  const objectPath = `/objects/uploads/${objectId}`;
  const asset = await storage.createMediaAsset({
    websiteId,
    filename: objectId,
    originalFilename: `logo-${businessName.replace(/[^a-zA-Z0-9æøåÆØÅ _-]/g, "").trim().slice(0, 40) || "logo"}.webp`,
    storagePath: objectPath,
    mimeType: "image/webp",
    size: optimized.length,
    width: meta.width,
    height: meta.height,
    altText: `${businessName} logo`,
  });

  return { url: objectPath, mediaId: asset.id };
}

/**
 * Read an image from object storage as a resized JPEG data URL — used to
 * feed uploaded inspiration screenshots to the vision model.
 */
export async function readObjectImageAsDataUrl(
  objectPath: string,
  maxDim = 768
): Promise<string | null> {
  try {
    if (typeof objectPath !== "string" || !objectPath.startsWith("/objects/")) return null;
    const objectStorageService = new ObjectStorageService();
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const [buffer] = await file.download();
    const resized = await sharp(buffer)
      .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch (error) {
    console.error("Failed to read object image for vision:", error);
    return null;
  }
}

// ============ Marker resolution ============

type MarkerSlot = {
  description: string;
  aspect: ImageAspect;
  apply: (url: string) => void;
};

function parseMarker(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(AI_IMAGE_MARKER)) return null;
  const description = value.slice(AI_IMAGE_MARKER.length).trim();
  return description.length > 0 ? description : null;
}

function aspectFromNodeStyles(node: AIPrimitiveNode): ImageAspect {
  const ratio = String(node.styles?.aspectRatio ?? "").replace(/\s+/g, "");
  if (ratio === "1" || ratio === "1/1") return "square";
  if (["2/3", "3/4", "4/5", "9/16"].includes(ratio)) return "portrait";
  return "landscape";
}

function collectFromProps(
  props: Record<string, any> | undefined,
  slots: MarkerSlot[]
): void {
  if (!props || typeof props !== "object") return;
  const heroDesc = parseMarker(props.imageUrl);
  if (heroDesc) {
    slots.push({ description: heroDesc, aspect: "landscape", apply: (url) => { props.imageUrl = url; } });
  }
  if (Array.isArray(props.images)) {
    props.images.forEach((value: unknown, index: number) => {
      const desc = parseMarker(value);
      if (desc) {
        slots.push({ description: desc, aspect: "landscape", apply: (url) => { props.images[index] = url; } });
      }
    });
  }
  if (Array.isArray(props.items)) {
    for (const item of props.items) {
      const desc = parseMarker(item?.imageUrl);
      if (desc) {
        slots.push({ description: desc, aspect: "square", apply: (url) => { item.imageUrl = url; } });
      }
    }
  }
}

/**
 * Iterative (explicit stack) with a visit budget: marker collection can run
 * before tree validation, so it must not recurse over model/client-controlled
 * nesting. Validated trees are ≤400 nodes; the budget is defensive headroom.
 */
const MAX_TREE_MARKER_VISITS = 5000;

function collectFromTree(root: AIPrimitiveNode | undefined, slots: MarkerSlot[]): void {
  if (!root || typeof root !== "object") return;
  const stack: AIPrimitiveNode[] = [root];
  let visited = 0;
  while (stack.length > 0 && visited < MAX_TREE_MARKER_VISITS) {
    const node = stack.pop()!;
    if (!node || typeof node !== "object") continue;
    visited++;
    if (node.type === "image") {
      const desc = parseMarker(node.src);
      if (desc) {
        slots.push({ description: desc, aspect: aspectFromNodeStyles(node), apply: (url) => { node.src = url; } });
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) stack.push(child);
    }
  }
}

export type ResolvedImages = {
  mutations: BuilderMutation[];
  /** Danish lines for the report's "Oprettet" group. */
  created: string[];
  /** Danish lines for the report's "Tjek" group (failures, skips). */
  notes: string[];
};

export type ImageJob = { description: string; aspect: ImageAspect; url?: string; failed?: boolean };

export function imageJobKey(slot: { description: string; aspect: ImageAspect }): string {
  return `${slot.aspect}::${slot.description}`;
}

/**
 * Decide which unique images to generate for the collected marker slots.
 *
 * Cap semantics (intentional): at most MAX_AI_IMAGES_PER_REQUEST UNIQUE
 * (aspect, description) assets are generated per request. Repeating an
 * already-admitted marker reuses the same generated image in every field and
 * costs no extra budget. Only slots that would require a NEW asset beyond the
 * cap are skipped; each such image FIELD counts once in skippedSlots.
 */
export function planImageJobs(
  slots: Array<{ description: string; aspect: ImageAspect }>
): { jobs: Map<string, ImageJob>; skippedSlots: number } {
  const jobs = new Map<string, ImageJob>();
  let skippedSlots = 0;
  for (const slot of slots) {
    const key = imageJobKey(slot);
    if (!jobs.has(key)) {
      if (jobs.size >= MAX_AI_IMAGES_PER_REQUEST) {
        skippedSlots++;
        continue;
      }
      jobs.set(key, { description: slot.description, aspect: slot.aspect });
    }
  }
  return { jobs, skippedSlots };
}

/**
 * Replace every "ai://…" marker in the mutations with a generated, hosted
 * image URL. At most MAX_AI_IMAGES_PER_REQUEST unique (aspect, description)
 * images are generated per request; identical markers share one generated
 * image (see planImageJobs for the exact cap semantics).
 */
export async function resolveAiImageMarkers(
  websiteId: string,
  mutations: BuilderMutation[],
  brandGuide?: BrandGuide,
  /** The meter of the run that asked, when this is part of a larger run. */
  meter?: SpendMeter,
  /** Optional business context to ground images in the real business. */
  businessContext?: { name?: string; description?: string }
): Promise<ResolvedImages> {
  const cloned = structuredClone(mutations);
  const slots: MarkerSlot[] = [];

  for (const mutation of cloned) {
    switch (mutation.action) {
      case "add_component":
        collectFromProps(mutation.component?.props as Record<string, any>, slots);
        break;
      case "update_component":
        collectFromProps(mutation.props as Record<string, any>, slots);
        break;
      case "add_section":
        collectFromProps(mutation.customContent as Record<string, any>, slots);
        break;
      case "add_custom_component":
        collectFromTree(mutation.tree, slots);
        break;
      case "update_custom_component":
        collectFromTree(mutation.tree, slots);
        break;
    }
  }

  if (slots.length === 0) return { mutations: cloned, created: [], notes: [] };

  const { jobs, skippedSlots: skipped } = planImageJobs(slots);

  await Promise.all(
    Array.from(jobs.values()).map(async (job) => {
      try {
        const { url } = await generateAndStoreImage(
          websiteId,
          job.description,
          brandGuide,
          job.aspect,
          meter,
          businessContext
        );
        job.url = url;
      } catch (error) {
        console.error("AI image generation failed:", error);
        job.failed = true;
      }
    })
  );

  const created: string[] = [];
  const notes: string[] = [];
  for (const job of Array.from(jobs.values())) {
    if (job.url) {
      created.push(`AI-billede genereret: "${truncate(job.description, 70)}".`);
    } else {
      notes.push(`Billedet "${truncate(job.description, 70)}" kunne ikke genereres — upload evt. et billede manuelt.`);
    }
  }
  if (skipped > 0) {
    notes.push(
      `Højst ${MAX_AI_IMAGES_PER_REQUEST} unikke AI-billeder pr. forespørgsel — ${skipped} billedfelt(er) blev sprunget over. Genbrug en eksisterende beskrivelse for at dele et billede, eller bed om resten i næste besked.`
    );
  }

  for (const slot of slots) {
    const job = jobs.get(imageJobKey(slot));
    slot.apply(job?.url ?? "");
  }

  return { mutations: cloned, created, notes };
}
