import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  size: number;
  isDirectory: boolean;
}

// Default directories and files to always exclude
const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.next',
  '.nuxt',
  'coverage',
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.test.local',
  '.env.production.local'
];

// Binary file extensions to exclude by default
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.tiff', '.bmp',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z',
  // Audio/Video
  '.mp4', '.mp3', '.wav', '.mov', '.avi', '.flac', '.webm',
  // Documents/Other
  '.pdf', '.epub', '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.eot', '.ttf'
]);

/**
 * Parses an ignore file (.gitignore or .deckignore) and returns clean glob rules.
 */
export function parseIgnoreFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (e) {
    return [];
  }
}

/**
 * Checks if a relative file path matches any glob rules or default excludes.
 */
export function isIgnored(
  relativePath: string,
  ignoreRules: string[],
  cwd: string = ''
): boolean {
  const parts = relativePath.split(path.sep);

  // 1. Check default excludes on any path segment
  for (const part of parts) {
    if (DEFAULT_EXCLUDES.includes(part)) {
      return true;
    }
  }

  // 2. Check binary file extensions
  const ext = path.extname(relativePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  // Normalize path to use forward slashes for cross-platform minimatch glob matching
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // 3. Match against gitignore / deckignore rules
  for (const rule of ignoreRules) {
    let cleanRule = rule.replace(/\\/g, '/');

    // Skip empty rules or negative rules for simplicity (or treat as standard rules)
    if (!cleanRule || cleanRule.startsWith('!')) {
      continue;
    }

    // Anchor to root if it starts with /
    const isAnchoredToRoot = cleanRule.startsWith('/');
    if (isAnchoredToRoot) {
      cleanRule = cleanRule.slice(1);
    }

    const isDirOnly = cleanRule.endsWith('/');
    if (isDirOnly) {
      cleanRule = cleanRule.slice(0, -1);
    }

    // A pattern has an internal slash if it contains a slash anywhere (excluding leading/trailing)
    const hasInternalSlash = cleanRule.includes('/');

    const matchOptions = { dot: true };

    if (isAnchoredToRoot || hasInternalSlash) {
      // Must match from the root of the workspace
      if (
        minimatch(normalizedPath, cleanRule, matchOptions) ||
        minimatch(normalizedPath, `${cleanRule}/**`, matchOptions)
      ) {
        return true;
      }
    } else {
      // Matches at any level
      if (
        minimatch(normalizedPath, cleanRule, matchOptions) ||
        minimatch(normalizedPath, `**/${cleanRule}`, matchOptions) ||
        minimatch(normalizedPath, `${cleanRule}/**`, matchOptions) ||
        parts.some(part => minimatch(part, cleanRule, matchOptions))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively scans directory and returns list of eligible files.
 */
export function scanDirectory(
  dirPath: string,
  ignoreRules: string[] = [],
  rootPath: string = dirPath
): FileEntry[] {
  let results: FileEntry[] = [];
  
  if (!fs.existsSync(dirPath)) return results;

  const list = fs.readdirSync(dirPath);

  for (const file of list) {
    const absolutePath = path.resolve(dirPath, file);
    const relativePath = path.relative(rootPath, absolutePath);

    // Skip if ignored
    if (isIgnored(relativePath, ignoreRules, rootPath)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);

    if (stat.isDirectory()) {
      results.push({
        relativePath,
        absolutePath,
        size: 0,
        isDirectory: true
      });
      // Recurse
      results = results.concat(scanDirectory(absolutePath, ignoreRules, rootPath));
    } else {
      results.push({
        relativePath,
        absolutePath,
        size: stat.size,
        isDirectory: false
      });
    }
  }

  return results;
}
