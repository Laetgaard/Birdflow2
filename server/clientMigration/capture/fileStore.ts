/**
 * Where a migration's own files live: screenshots, section crops, the saved
 * HTML, the pictures of each rebuild.
 *
 * A real job keeps them in object storage. The offline bench has no object
 * storage, no database and no network, and still has to run the whole
 * pipeline — capture, import, plan, build, score — so the store is a seam
 * rather than an import. Swapping it is a development affordance and refuses
 * to happen in production.
 */

import { objectStorageClient, ObjectStorageService } from "../../replit_integrations/object_storage/objectStorage";

export type MigrationFileStore = {
  store(args: { jobId: string; pageId: string; suffix: string; bytes: Buffer; contentType: string }): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
};

function pathsFor(jobId: string, pageId: string, suffix: string): { fullPath: string; storagePath: string } {
  const privateDir = new ObjectStorageService().getPrivateObjectDir();
  const fullPath = `${privateDir}/migrations/${jobId}/${pageId}-${suffix}`;
  return { fullPath, storagePath: `/objects/migrations/${jobId}/${pageId}-${suffix}` };
}

/** The real one: the customer's private bucket. */
export const objectStorageFileStore: MigrationFileStore = {
  async store({ jobId, pageId, suffix, bytes, contentType }) {
    const { fullPath, storagePath } = pathsFor(jobId, pageId, suffix);
    const parts = fullPath.replace(/^\//, "").split("/");
    await objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/")).save(bytes, { contentType, resumable: false });
    return storagePath;
  },
  async read(storagePath) {
    const privateDir = new ObjectStorageService().getPrivateObjectDir();
    const relative = storagePath.replace(/^\/objects\//, "");
    const parts = `${privateDir}/${relative}`.replace(/^\//, "").split("/");
    const [contents] = await objectStorageClient.bucket(parts[0]).file(parts.slice(1).join("/")).download();
    return contents;
  },
};

export type MemoryFileStore = MigrationFileStore & { files: Map<string, Buffer> };

/** Everything in a Map: what the bench and the tests run against. */
export function memoryFileStore(): MemoryFileStore {
  const files = new Map<string, Buffer>();
  return {
    files,
    async store({ jobId, pageId, suffix, bytes }) {
      const storagePath = `/objects/migrations/${jobId}/${pageId}-${suffix}`;
      files.set(storagePath, bytes);
      return storagePath;
    },
    async read(storagePath) {
      const bytes = files.get(storagePath);
      if (!bytes) throw new Error(`No migration file at ${storagePath}`);
      return bytes;
    },
  };
}

let active: MigrationFileStore = objectStorageFileStore;

/**
 * Point the migration's file reads and writes somewhere else.
 *
 * Development only. A production process that called this would write a
 * customer's screenshots into a Map and lose them, so it refuses instead.
 */
export function useMigrationFileStore(store: MigrationFileStore | null): void {
  if (process.env.NODE_ENV === "production") throw new Error("The migration file store cannot be replaced in production.");
  active = store ?? objectStorageFileStore;
}

export const migrationFileStore = (): MigrationFileStore => active;
