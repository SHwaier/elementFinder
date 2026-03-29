# 🧠 AI Project Brain: AI Element Selector

This file serves as the source of truth for the AI assistant and any future AI systems interacting with this project. It defines rules, security guidelines, and logs project progress.

## 1. Source of Truth

- **Primary Product Requirements**: [prd.md](file:///Users/unknown159/Desktop/elementFinder/docs/prd.md) (Read-only, baseline requirements).
- **Extension Type**: Editor Extension (VS Code, Cursor, Antigravity, etc.) with a browser-side injection companion.
- **Workflow**: Zero-Config element selection, source mapping, and AI prompt generation.

## 2. Core Rules for AI

1. **Adhere to the PRD**: Always refer to `docs/prd.md` for functional requirements and scope.
2. **Framework Focus**: Initially support **Next.js** only. Do not add support for other frameworks unless instructed.
3. **Environment**: The tool must operate **exclusively on localhost**.
4. **Source Mapping**: Prioritize injected metadata (`data-source-file`, `data-source-line`) for 100% accuracy.
5. **Zero-Config First**: Prioritize automated injection (`app/layout.tsx`) over manual configuration.

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
1. Open your Next.js project.
2. Run command: `AI: Setup Source Mapping for Project`.
   - *This adds the dependency-free Babel plugin to your configuration.*
   - *This injects the <Script /> tag into your app/layout.tsx.*

### Step 3: Launch Selector
1. Run command: `AI: Launch Selector (Zero-Config)`.
2. Open your dev site at `http://localhost:3000`.
3. Select an element on the page.

## 5. Project Log

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
