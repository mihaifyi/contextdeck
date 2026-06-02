#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import open from 'open';
import pc from 'picocolors';
import { startWebServer } from './server/webserver';
import { scanDirectory, parseIgnoreFile } from './utils/files';
import { bundleRepository, estimateTokens } from './utils/bundler';

const program = new Command();

program
  .name('contextdeck')
  .description('AI-ready codebase context bundler & visual dashboard')
  .version('1.0.0')
  .option('-w, --web', 'Start local web server and open the interactive dashboard (default)', true)
  .option('--no-web', 'Disable starting the web server and run CLI bundling directly')
  .option('-p, --port <number>', 'Port for the local web server', '3000')
  .option('-f, --format <type>', 'Format for CLI bundling output (xml or markdown)', 'xml')
  .option('-o, --output <file>', 'Output path to write the compiled context file')
  .option('-c, --clean', 'Optimize empty lines and trailing spaces to save tokens')
  .parse(process.argv);

const options = program.opts();

async function run() {
  const workspaceRoot = process.cwd();
  
  // Decide whether to run in CLI-only mode:
  // If user passed --no-web OR specified --output OR redirected output, we run CLI bundling.
  const isCliOnly = !options.web || options.output !== undefined;

  if (isCliOnly) {
    console.log(pc.cyan('Decking codebase context via CLI...'));
    try {
      const gitignorePath = path.join(workspaceRoot, '.gitignore');
      const deckignorePath = path.join(workspaceRoot, '.deckignore');
      const ignoreRules = [
        ...parseIgnoreFile(gitignorePath),
        ...parseIgnoreFile(deckignorePath)
      ];

      console.log(pc.dim('Scanning directory files...'));
      const files = scanDirectory(workspaceRoot, ignoreRules);
      const relativePaths = files.filter(f => !f.isDirectory).map(f => f.relativePath);

      console.log(pc.dim(`Found ${relativePaths.length} files. Packaging...`));
      
      const format = options.format.toLowerCase() === 'markdown' ? 'markdown' : 'xml';
      const bundle = bundleRepository(workspaceRoot, relativePaths, {
        format,
        removeEmptyLines: !!options.clean
      });

      const stats = estimateTokens(bundle);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, bundle, 'utf8');
        console.log(pc.green(`✔ Codebase successfully bundled into: ${outputPath}`));
        console.log(pc.dim(`  └ Size: ${(bundle.length / 1024).toFixed(1)} KB`));
        console.log(pc.dim(`  └ GPT tokens: ${stats.gpt.toLocaleString()}`));
        console.log(pc.dim(`  └ Claude tokens: ${stats.claude.toLocaleString()}`));
        console.log(pc.dim(`  └ Gemini tokens: ${stats.gemini.toLocaleString()}`));
      } else {
        // Output directly to stdout (useful for piping)
        process.stdout.write(bundle);
      }
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  } else {
    // Start Interactive Web Server
    const defaultPort = parseInt(options.port, 10) || 3000;
    
    console.log(pc.bold(pc.magenta('\n  🎴 ContextDeck Launcher')));
    console.log(pc.dim('  ------------------------------------------'));
    console.log(`  Workspace: ${pc.cyan(workspaceRoot)}`);
    console.log(`  Initiating server...`);

    try {
      const { port } = await startWebServer({
        port: defaultPort,
        workspaceRoot
      });

      const url = `http://localhost:${port}`;
      console.log(pc.green(`  ✔ Server is running at: ${pc.bold(url)}`));
      console.log(pc.dim('  Press Ctrl+C to stop the server\n'));

      // Auto-open browser
      await open(url);
    } catch (err: any) {
      console.error(pc.red(`  ✘ Failed to start web server: ${err.message}`));
      process.exit(1);
    }
  }
}

run();
