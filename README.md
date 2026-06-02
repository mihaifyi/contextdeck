# ContextDeck 🎴

> **Bridges the gap between massive local repositories and LLM context windows with an elegant, token-aware web interface and a micro-CLI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%23007acc.svg)](#)
[![Node.js](https://img.shields.io/badge/node-%3E%3D%2018.0.0-green.svg)](#)

ContextDeck compiles local codebases into highly structured, optimized, and token-aware prompts. Developers can select exactly which folders or files to include, see real-time token counts for different LLMs, and copy/download the bundled context instantly.

No more manual copying of dozens of files, and no more exceeding LLM context windows with junk files (like `node_modules` or `.git` configurations).

---

## Features ✨

- **Interactive Local Dashboard**: Run `contextdeck --web` to launch a sleek, glassmorphic dark-mode web application on `localhost:3000`.
- **Parent-Child Checkbox Inheritance**: Toggle entire directories, check file sizes, and filter codebases.
- **Git-Aware & Custom Ignores**: Automatically parses `.gitignore` and `.deckignore` to filter binary files, dependencies, build folders, and environment files.
- **Real-Time Token Estimator**: Project token counts on-the-fly for **OpenAI (GPT-4/o1)**, **Anthropic (Claude 3.5)**, and **Google (Gemini 1.5)**.
- **Flexible Exporters**: Outputs context in clean, LLM-optimized schemas:
  - **XML Tagged** (recommended for AI parsing)
  - **Markdown**
- **Token Optimization**: Built-in line cleaning that strips blank lines and trailing spaces, saving up to 25% of token payloads.
- **Zero-Config CLI**: Use `contextdeck -o context.xml` for CLI-only bundling, ideal for scripting and CI/CD pipelines.

---

## Installation 📦

Get started instantly without installing globally:

```bash
npx contextdeck
```

Or install globally:

```bash
npm install -g contextdeck
```

---

## Quick Start 🚀

### 1. Launch the Visual Dashboard (Default)

From your project's root directory, run:

```bash
contextdeck
```

This will automatically launch the local web server and open the dashboard in your default browser at `http://localhost:3000`.

### 2. Generate a Bundle via CLI

To compile context directly to a file from the terminal (without booting the web UI):

```bash
# Output XML context (default) to a file
contextdeck -o context.xml

# Output Markdown context and optimize empty lines to save tokens
contextdeck -f markdown -c -o context.md

# Pipe output directly to clipboard (macOS example)
contextdeck --no-web | pbcopy
```

---

## Configuration ⚙️

Create a `.deckignore` file in the root of your project to specify patterns you want ContextDeck to ignore (in addition to your `.gitignore` patterns):

```ignore
# .deckignore
tests/
*.test.ts
docs/
package-lock.json
```

---

## Visual Preview 🖥️

*The ContextDeck dashboard features a beautiful grid containing:*
- **Left Column**: File explorer displaying project structure with chevrons to collapse/expand folders, checkbox selectors, search box, and file size metadata.
- **Right Column**:
  - **Real-time Stats**: Dedicated token cost counters for OpenAI, Claude, and Gemini.
  - **Bundling Settings**: Format choice (XML vs Markdown) and optimization switches.
  - **Action buttons**: Smooth, animated "Copy Context" and "Download" buttons with instant feedback triggers.

---

## Why ContextDeck? 💡

Context windows have expanded, but sending raw folders wastes money, slows down responses, and clutters the LLM's attention span with irrelevant configuration, lock files, and images.

ContextDeck solves this by:
1. **Structuring Code**: Surrounding code blocks with semantic XML markers (`<file path="src/index.ts">...</file>`) so the LLM understands exactly where each line belongs.
2. **Injecting Structure**: Embedding a visual ASCII directory tree map at the beginning of the context payload so the model can grasp your architecture instantly.
3. **Filtering Noise**: Stripping large assets, package lockers, and binary files so only core logic is analyzed.

---

## Development 🛠️

If you wish to contribute or run the codebase locally:

```bash
# Clone the repository
git clone https://github.com/your-username/contextdeck.git
cd contextdeck

# Install developer dependencies
npm install

# Compile TypeScript
npm run build

# Run unit tests
npm run test
```

---

## License 📄

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
