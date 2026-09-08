import fs from 'fs/promises';
import path from 'path';

/**
 * Storage abstraction — local filesystem for dev, S3 for production.
 * Switchable via STORAGE_PROVIDER env var.
 */
interface StorageService {
  uploadFile(key: string, data: Buffer): Promise<void>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  getFileUrl(key: string): Promise<string>;
}

// ─── Local Filesystem Storage ──────────────────────────
class LocalStorageService implements StorageService {
  private basePath: string;

  constructor() {
    this.basePath = path.resolve(process.cwd(), 'uploads');
  }

  async uploadFile(key: string, data: Buffer): Promise<void> {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async getFile(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore if file doesn't exist
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async getFileUrl(key: string): Promise<string> {
    // For local dev, return a file path (or serve via express static in prod)
    return `file://${path.join(this.basePath, key)}`;
  }
}

// ─── S3 Storage (placeholder — implement when deploying to prod) ────
class S3StorageService implements StorageService {
  async uploadFile(_key: string, _data: Buffer): Promise<void> {
    // TODO: Implement with @aws-sdk/client-s3
    throw new Error('S3 storage not yet implemented — set STORAGE_PROVIDER=local for dev');
  }

  async getFile(_key: string): Promise<Buffer> {
    throw new Error('S3 storage not yet implemented');
  }

  async deleteFile(_key: string): Promise<void> {
    throw new Error('S3 storage not yet implemented');
  }

  async getFileUrl(_key: string): Promise<string> {
    throw new Error('S3 storage not yet implemented');
  }
}

// ─── Factory ───────────────────────────────────────────
function createStorageService(): StorageService {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  switch (provider) {
    case 's3':
      return new S3StorageService();
    case 'local':
    default:
      return new LocalStorageService();
  }
}

export const storageService = createStorageService();
