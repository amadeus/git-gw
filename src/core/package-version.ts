import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJson {
  version?: unknown;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

export async function readPackageVersion(
  startUrl = import.meta.url
): Promise<string> {
  let currentDir = dirname(fileURLToPath(startUrl));

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json');

    try {
      const packageJson = JSON.parse(
        await readFile(packageJsonPath, 'utf8')
      ) as PackageJson;

      if (typeof packageJson.version !== 'string') {
        throw new Error(
          `package.json version must be a string: ${packageJsonPath}`
        );
      }

      return packageJson.version;
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('could not find package.json');
    }

    currentDir = parentDir;
  }
}
