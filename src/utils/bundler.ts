import * as fs from 'fs';
import * as path from 'path';

export interface BundleOptions {
  format: 'xml' | 'markdown';
  removeEmptyLines?: boolean;
}

export interface TokenEstimation {
  gpt: number;
  claude: number;
  gemini: number;
  characters: number;
}

/**
 * Estimates LLM tokens from character counts using standard code heuristics.
 */
export function estimateTokens(content: string): TokenEstimation {
  const characters = content.length;
  // Code tends to have higher token density than english text.
  // Standard heuristics:
  // GPT models (cl100k_base / o1 / GPT-5): ~3.8 chars per token
  // Claude models (claude-3 / Claude-4): ~3.5 chars per token
  // Gemini models (Gemini-3 / 1.5): ~4.0 chars per token
  return {
    characters,
    gpt: Math.ceil(characters / 3.7),
    claude: Math.ceil(characters / 3.4),
    gemini: Math.ceil(characters / 4.0)
  };
}

/**
 * Builds a visual directory tree structure from a list of relative paths.
 */
export function generateDirectoryTree(relativePaths: string[]): string {
  interface TreeNode {
    name: string;
    children: Map<string, TreeNode>;
  }

  const root: TreeNode = { name: '.', children: new Map() };

  // Sort paths to keep the tree deterministic
  const sortedPaths = [...relativePaths].sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split(path.sep);
    let current = root;
    for (const part of parts) {
      if (!part) continue;
      if (!current.children.has(part)) {
        current.children.set(part, { name: part, children: new Map() });
      }
      current = current.children.get(part)!;
    }
  }

  function renderNode(node: TreeNode, prefix: string = '', isLast: boolean = true, isRoot: boolean = true): string {
    let result = '';
    if (!isRoot) {
      result += `${prefix}${isLast ? '└── ' : '├── '}${node.name}\n`;
    }

    const childrenList = Array.from(node.children.values());
    const nextPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
    
    for (let i = 0; i < childrenList.length; i++) {
      const child = childrenList[i];
      const last = i === childrenList.length - 1;
      result += renderNode(child, nextPrefix, last, false);
    }
    
    return result;
  }

  return renderNode(root);
}

/**
 * Cleans file content by removing unnecessary spacing to optimize context windows.
 */
export function cleanCode(content: string, options: BundleOptions): string {
  if (options.removeEmptyLines) {
    return content
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.trim().length > 0)
      .join('\n');
  }
  return content;
}

/**
 * Bundles selected files into a single context string.
 */
export function bundleRepository(
  workspaceRoot: string,
  relativePaths: string[],
  options: BundleOptions
): string {
  const tree = generateDirectoryTree(relativePaths);
  let output = '';

  if (options.format === 'xml') {
    output += `<codebase>\n`;
    output += `<structure>\n${tree}</structure>\n\n`;

    for (const file of relativePaths) {
      const absolutePath = path.join(workspaceRoot, file);
      try {
        if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;
        
        let content = fs.readFileSync(absolutePath, 'utf8');
        content = cleanCode(content, options);

        output += `<file path="${file}">\n`;
        output += content;
        if (!content.endsWith('\n')) output += '\n';
        output += `</file>\n\n`;
      } catch (e: any) {
        output += `<file path="${file}" error="true">\nFailed to read file: ${e.message}\n</file>\n\n`;
      }
    }

    output += `</codebase>`;
  } else {
    // Markdown format
    output += `# Repository Directory Tree\n\n\`\`\`\n${tree}\`\`\`\n\n`;
    output += `# File Contents\n\n`;

    for (const file of relativePaths) {
      const absolutePath = path.join(workspaceRoot, file);
      try {
        if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) continue;

        let content = fs.readFileSync(absolutePath, 'utf8');
        content = cleanCode(content, options);

        const ext = path.extname(file).slice(1);
        output += `## File: ${file}\n\n`;
        output += `\`\`\`${ext}\n`;
        output += content;
        if (!content.endsWith('\n')) output += '\n';
        output += `\`\`\`\n\n`;
      } catch (e: any) {
        output += `## File: ${file} (Error)\n\nFailed to read file: ${e.message}\n\n`;
      }
    }
  }

  return output;
}
