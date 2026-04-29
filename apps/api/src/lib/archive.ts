/**
 * Streaming archive helpers used by /api/packages/[framework].
 *
 * - `buildZip` — generic .zip with `<rootDir>/...` layout (universal).
 * - `buildNpmTarball` — npm-compatible .tgz where every entry is rooted at
 *   `package/...` (npm convention) so `npm install <url>` Just Works.
 */
import { gzipSync } from 'node:zlib';
import JSZip from 'jszip';
// `tar-stream` is CJS; importing the default gives us { pack, extract }.
import tarStream from 'tar-stream';
import type { PackageFile, PackageOutput } from './packages';

export async function buildZip(pkg: PackageOutput): Promise<Buffer> {
  const zip = new JSZip();
  for (const file of pkg.files) {
    zip.file(`${pkg.rootDir}/${file.path}`, file.content);
  }
  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Build an npm-compatible .tgz. npm requires the archive root to be
 * `package/` regardless of the package's actual name.
 */
export async function buildNpmTarball(pkg: PackageOutput): Promise<Buffer> {
  const pack = tarStream.pack();

  for (const file of pkg.files) {
    addEntry(pack, `package/${file.path}`, file.content);
  }
  pack.finalize();

  const tarBuf = await streamToBuffer(pack);
  return gzipSync(tarBuf, { level: 6 });
}

function addEntry(
  pack: ReturnType<typeof tarStream.pack>,
  name: string,
  content: string,
): void {
  const buf = Buffer.from(content, 'utf8');
  pack.entry({ name, size: buf.length, mode: 0o644, mtime: new Date(0) }, buf);
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export type { PackageFile, PackageOutput };
