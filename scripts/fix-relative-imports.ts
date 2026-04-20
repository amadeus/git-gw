import { constants } from 'node:fs';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const srcRoot = resolve(repoRoot, 'src');
const sourceRoots = [resolve(repoRoot, 'src'), resolve(repoRoot, 'test')];
const sourceExtensions = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
];
const jsLikeExtensions = new Map([
  ['.js', ['.ts', '.tsx', '.js', '.jsx']],
  ['.mjs', ['.mts', '.mjs']],
  ['.cjs', ['.cts', '.cjs']],
]);

interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function isInsidePath(path: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, path);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !relativePath.startsWith(`..${sep}`))
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function getAliasSpecifier(targetPath: string): string | null {
  if (!isInsidePath(targetPath, srcRoot)) {
    return null;
  }

  let sourceRelativePath = relative(srcRoot, targetPath).split(sep).join('/');
  sourceRelativePath = sourceRelativePath.replace(/\.[^./]+$/u, '');

  if (sourceRelativePath === 'index') {
    return '@/index';
  }

  if (sourceRelativePath.endsWith('/index')) {
    sourceRelativePath = sourceRelativePath.slice(0, -'/index'.length);
  }

  return `@/${sourceRelativePath}`;
}

async function resolveImportTarget(
  filePath: string,
  specifier: string
): Promise<string | null> {
  const basePath = resolve(dirname(filePath), specifier);
  const extension = extname(basePath);
  const candidates = [basePath];

  if (!extension) {
    for (const sourceExtension of sourceExtensions) {
      candidates.push(`${basePath}${sourceExtension}`);
      candidates.push(resolve(basePath, `index${sourceExtension}`));
    }
  } else if (jsLikeExtensions.has(extension)) {
    const stem = basePath.slice(0, -extension.length);
    for (const candidateExtension of jsLikeExtensions.get(extension) || []) {
      candidates.push(`${stem}${candidateExtension}`);
    }
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function applyTextEdits(text: string, edits: TextEdit[]): string {
  return edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (updatedText, edit) =>
        `${updatedText.slice(0, edit.start)}${edit.replacement}${updatedText.slice(edit.end)}`,
      text
    );
}

async function collectSourceFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = resolve(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath);
    }
  }

  return files;
}

async function getImportEdits(filePath: string): Promise<TextEdit[]> {
  const sourceText = await readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );
  const edits: TextEdit[] = [];

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    ) {
      continue;
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteralLike(moduleSpecifier)) {
      continue;
    }

    const specifier = moduleSpecifier.text;
    if (!isRelativeImport(specifier)) {
      continue;
    }

    const targetPath = await resolveImportTarget(filePath, specifier);
    if (!targetPath) {
      continue;
    }

    const aliasSpecifier = getAliasSpecifier(targetPath);
    if (!aliasSpecifier || aliasSpecifier === specifier) {
      continue;
    }

    edits.push({
      start: moduleSpecifier.getStart(sourceFile) + 1,
      end: moduleSpecifier.getEnd() - 1,
      replacement: aliasSpecifier,
    });
  }

  return edits;
}

async function main(): Promise<void> {
  const sourceFiles = (
    await Promise.all(
      sourceRoots.map(async (rootPath) =>
        (await pathExists(rootPath)) ? collectSourceFiles(rootPath) : []
      )
    )
  ).flat();

  let updatedFiles = 0;

  for (const filePath of sourceFiles) {
    const sourceText = await readFile(filePath, 'utf8');
    const edits = await getImportEdits(filePath);
    if (edits.length === 0) {
      continue;
    }

    const updatedText = applyTextEdits(sourceText, edits);
    if (updatedText === sourceText) {
      continue;
    }

    await writeFile(filePath, updatedText, 'utf8');
    updatedFiles += 1;
  }

  console.log(
    `Normalized imports in ${updatedFiles} file${updatedFiles === 1 ? '' : 's'}.`
  );
}

await main();
