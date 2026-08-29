import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

/** Recursively collects supported specification files from dialog-selected paths. */
export async function collectSpecificationFiles(
  selectedPaths: readonly string[],
): Promise<readonly string[]> {
  const paths = await Promise.all(selectedPaths.map(collectSpecificationFilesAtPath));
  return [...new Set(paths.flat())].sort();
}

async function collectSpecificationFilesAtPath(path: string): Promise<readonly string[]> {
  const metadata = await stat(path);
  if (metadata.isFile()) return isSpecificationFile(path) ? [path] : [];
  if (!metadata.isDirectory()) return [];

  const entries = await readdir(path, { withFileTypes: true });
  const paths = await Promise.all(
    entries
      .filter((entry) => !entry.isSymbolicLink())
      .map((entry) => collectSpecificationFilesAtPath(join(path, entry.name))),
  );
  return paths.flat();
}

function isSpecificationFile(path: string): boolean {
  return ['.yaml', '.yml', '.json'].includes(extname(path).toLowerCase());
}
