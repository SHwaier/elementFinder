# 🧠 AI Project Brain: AI Element Selector

This file serves as the source of truth for the AI assistant and any future AI systems interacting with this project. It defines rules, security guidelines, and logs project progress.

## 1. Source of Truth

- **Primary Product Requirements**: [prd.md](file:///Users/unknown159/Desktop/elementFinder/docs/prd.md) (Read-only, baseline requirements).
- **Extension Type**: Editor Extension (VS Code, Cursor, Antigravity, etc.) with a browser-side injection companion.
- **Workflow**: Zero-Config element selection, source mapping, and AI prompt generation.

## 2. Core Rules for AI

1. **Adhere to the PRD**: Always refer to `docs/prd.md` for functional requirements and scope.
2. **Framework Focus**: Support **Next.js**, **Vite**, **Vue**, **SvelteKit**, and **Plain HTML** (no framework required).
3. **Environment**: The tool must operate **exclusively on localhost**.
4. **Source Mapping**: Prioritize injected metadata (`data-source-file`, `data-source-line`) for 100% accuracy.
5. **Zero-File-Edit**: Never modify user source files (`layout.tsx`, `index.html`). Use dev server middleware (Vite plugin / Babel runtime injection) to inject the selector script into the HTML stream.

## 3. Security First Approach

1. **Localhouse Isolation**: The extension must only interact with `localhost`. It should never send data to external servers or domains.
2. **Data Minimization**: Capture only the minimum necessary DOM and source metadata required for prompt generation.
3. **User Confirmation**: Critical actions (like copying to clipboard or opening files) should be transparent to the user.
4. **No Sensitive Data**: Ensure the injection script does not capture or transmit sensitive user input or credentials. Sanitized React Props are only captured if they are primitives (strings, numbers, booleans).

## 4. Usage Guide

### Step 1: Installation
1. Pack the extension: `npm run package`.
2. Install the generated `.vsix` file in your editor (Cursor, Antigravity, or VS Code) via **"Extensions: Install from VSIX..."**.

### Step 2: Project Setup
1. Open your project.
2. Run command: `AI: Setup Source Mapping for Project`.
   - *This adds the dependency-free Babel plugin to your `.babelrc`.*
   - **Next.js**: The Babel plugin injects the script at runtime (zero file edits).
   - **Vite/Vue/SvelteKit**: A Vite plugin (`ai-selector-plugin.mjs`) is copied to your project root and auto-patched into `vite.config.*`. The plugin is added to `.gitignore`.

### Step 3: Launch Selector
1. Run command: `AI: Launch Selector (Zero-Config)`.
2. Open your dev site at `http://localhost:3000`.
3. Select an element on the page.

### Removing Setup
- Run command: `AI: Remove Source Mapping Setup` to cleanly undo all changes.

## 5. Project Log

### 2026-03-29 (v4.0 Zero-File-Edit Middleware)
- **Zero-File-Edit Architecture**: Replaced all source file modifications (`layout.tsx`, `index.html`, `app.html`) with dev server middleware injection.
- **Next.js**: Removed `injectIntoLayout()`. Now relies entirely on the Babel plugin's built-in runtime injection (`window.__SELECTOR_INJECTED__`).
- **Vite/Vue/SvelteKit**: Created `scripts/plugins/vite-plugin.mjs` using Vite's native `transformIndexHtml` hook. The plugin is auto-copied to the project root and patched into `vite.config.*`.
- **Plain HTML Support**: Built-in static file server mode in `server.ts`. When framework is `Generic`, the hub server serves project files from `localhost:3210` and auto-injects the selector script into every HTML response. Includes directory listing, MIME type handling, and path traversal protection.
- **Auto-Gitignore**: Plugin files are automatically added to `.gitignore` so they never pollute the user's repo.
- **Remove Command**: Added `AI: Remove Source Mapping Setup` command for clean teardown of Babel + Vite plugin config.
- **Config Markers**: Introduced `CONFIG_MARKER_START`/`END` delimiters for safe, reversible config file patching.

### 2026-03-29 (v3.1 Production-Grade Refinement)
- **Security Hardening**: Implemented WebSocket Origin Validation, 127.0.0.1 strict binding, and shell command sanitization (regex whitelisting).
- **Performance Optimization**: Refactored `server.ts` and `extension.ts` to use asynchronous file IO (`fs.promises`).
- **Reliability**: Switched to `vscode.Uri` abstraction and fixed framework detection edge cases.

### 2026-03-29 (v3.0 Multi-Framework Support)
- **Framework Expansion**: Implemented Universal Project Detection and Injection Logic.
- **Vite & Vue Support**: Added `index.html` modification for a zero-config experience in Vite and Vue projects.
- **SvelteKit Support**: Added `src/app.html` injection and custom framework detection.
- **Intelligent Prompts**: Generalized the server hub to support framework-agnostic AI prompts.
- **Documentation**: Updated README with a compatibility matrix and manual source mapping guides.

### 2026-03-28 (v2.1 Advanced Customization & VSIX)
- **VSIX Packaging**: Integrated `@vscode/vsce` and `.vscodeignore` for professional distribution. Generated `ai-element-selector-0.1.0.vsix`.
- **Advanced Prompt Customization**: Implemented a **Templating System** (`{{tag}}`, `{{props}}`, etc.), **Compact Mode**, and **Task Placeholders**.
- **Universal Editor Support**: Implemented dynamic editor detection using `vscode.env.appName`. Works natively with **Cursor** and **Antigravity**.
- **Dynamic Visuals**: Added `highlightColor` and `showToasts` settings, which are dynamically injected into the browser script on refresh.
- **Interaction Refinement**: Added a `modifierKey` setting (`Alt`, `Shift`, `Ctrl`, `Meta`) to bypass selection for interactions.
- **Auto-Focus Logic**: Added a toggle for the window-switching behavior.
- **Documentation**: Added a professional `README.md` for end users.

### 2026-03-28 (v2.0 Refined Injection)
- **Zero-Config Layout Injection**: Switched from HTTP proxy to automated `app/layout.tsx` modification.
- **Turbopack Compatible**: Verified compatibility with Next.js 15+ Turbopack and Webpack.
- **Smarter Context**: Implemented **Code Snippet Extraction** (10-line window) and **React Props Detection** (sanitized primitives).

### 2026-03-27 (v1 Initial Prototype)
- **Babel Source Mapper**: Built a plugin for injecting JSX metadata (`data-source-file`, `data-source-line`).
- **Server Hub**: Combined HTTP and WebSocket servers on port `3210`.
- **MVP Selection**: Basic blue-box selection and file opening logic.
