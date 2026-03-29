import * as vscode from 'vscode';
import { SelectionServer } from './server';
import * as fs from 'fs';
import * as path from 'path';

let server: SelectionServer | undefined;

// --- Marker used to identify our patches in config files ---
const CONFIG_MARKER_START = '// >>> AI Element Selector (auto-generated — safe to .gitignore)';
const CONFIG_MARKER_END = '// <<< AI Element Selector';
const PLUGIN_FILENAME = 'ai-selector-plugin.mjs';

/**
 * Finds the project root by searching for package.json upwards.
 */
function findProjectRoot(startPath: string): string | undefined {
	let current = startPath;
	while (current !== path.parse(current).root) {
		if (fs.existsSync(path.join(current, 'package.json'))) {
			return current;
		}
		current = path.dirname(current);
	}
	return undefined;
}

type Framework = 'Next.js' | 'Vite' | 'SvelteKit' | 'Vue' | 'Generic';

/**
 * Detects the framework used in the project.
 */
async function detectFramework(rootPath: string): Promise<Framework> {
    const pkgPath = path.join(rootPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            
            if (deps['next']) return 'Next.js';
            if (deps['@sveltejs/kit']) return 'SvelteKit';
            if (deps['vue']) return 'Vue';
            if (deps['vite']) return 'Vite';
        } catch (e) {}
    }

    // Fallback detection via config files
    if (fs.existsSync(path.join(rootPath, 'next.config.js')) || fs.existsSync(path.join(rootPath, 'next.config.mjs'))) return 'Next.js';
    if (fs.existsSync(path.join(rootPath, 'svelte.config.js'))) return 'SvelteKit';
    if (fs.existsSync(path.join(rootPath, 'vite.config.ts')) || fs.existsSync(path.join(rootPath, 'vite.config.js'))) return 'Vite';

    return 'Generic';
}

// ============================================================================
// Vite Plugin Injection (Zero-File-Edit for Vite, Vue, SvelteKit)
// ============================================================================

/**
 * Finds the Vite config file in the project root.
 * Returns the path and extension, or undefined if not found.
 */
function findViteConfig(rootPath: string): { path: string; ext: string } | undefined {
    const candidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
    for (const candidate of candidates) {
        const p = path.join(rootPath, candidate);
        if (fs.existsSync(p)) {
            return { path: p, ext: path.extname(candidate) };
        }
    }
    return undefined;
}

/**
 * Copies the Vite plugin file into the user's project root
 * and patches their vite.config to import + use it.
 */
async function setupVitePlugin(rootPath: string, extensionPath: string): Promise<{ success: boolean; message: string }> {
    // 1. Copy the plugin file to the project root
    const srcPlugin = path.join(extensionPath, 'scripts', 'plugins', 'vite-plugin.mjs');
    const destPlugin = path.join(rootPath, PLUGIN_FILENAME);
    
    try {
        await fs.promises.copyFile(srcPlugin, destPlugin);
    } catch (e) {
        return { success: false, message: `Failed to copy plugin file: ${e}` };
    }

    // 2. Find or create the vite config
    let configInfo = findViteConfig(rootPath);
    
    if (!configInfo) {
        // Create a minimal vite.config.mjs
        const minimalConfig = `import { defineConfig } from 'vite';\n\nexport default defineConfig({\n  plugins: []\n});\n`;
        const newConfigPath = path.join(rootPath, 'vite.config.mjs');
        await fs.promises.writeFile(newConfigPath, minimalConfig);
        configInfo = { path: newConfigPath, ext: '.mjs' };
    }

    // 3. Patch the config to import and use our plugin
    let content = await fs.promises.readFile(configInfo.path, 'utf8');

    // Check if already patched
    if (content.includes(CONFIG_MARKER_START)) {
        return { success: true, message: 'Vite plugin already configured.' };
    }

    // Add our import at the top of the file
    const importLine = `${CONFIG_MARKER_START}\nimport aiSelectorPlugin from './${PLUGIN_FILENAME}';\n${CONFIG_MARKER_END}`;
    content = importLine + '\n' + content;

    // Inject our plugin into the plugins array
    // Strategy: find `plugins: [` and insert right after it
    const pluginsMatch = content.match(/plugins\s*:\s*\[/);
    if (pluginsMatch && pluginsMatch.index !== undefined) {
        const insertPos = pluginsMatch.index + pluginsMatch[0].length;
        content = content.slice(0, insertPos) +
            `\n    ${CONFIG_MARKER_START}\n    aiSelectorPlugin(),\n    ${CONFIG_MARKER_END}` +
            content.slice(insertPos);
    } else {
        // No plugins array found — try to inject into defineConfig({})
        const defineMatch = content.match(/defineConfig\s*\(\s*\{/);
        if (defineMatch && defineMatch.index !== undefined) {
            const insertPos = defineMatch.index + defineMatch[0].length;
            content = content.slice(0, insertPos) +
                `\n  ${CONFIG_MARKER_START}\n  plugins: [aiSelectorPlugin()],\n  ${CONFIG_MARKER_END}` +
                content.slice(insertPos);
        } else {
            return { success: false, message: 'Could not find plugins array or defineConfig() in vite config. Please add the plugin manually.' };
        }
    }

    await fs.promises.writeFile(configInfo.path, content);
    return { success: true, message: `Patched ${path.basename(configInfo.path)} with AI Selector plugin.` };
}

/**
 * Removes the Vite plugin from the user's project.
 */
async function removeVitePlugin(rootPath: string): Promise<{ success: boolean; message: string }> {
    // 1. Remove the plugin file
    const pluginPath = path.join(rootPath, PLUGIN_FILENAME);
    try {
        await fs.promises.unlink(pluginPath);
    } catch (e) {
        // File doesn't exist, that's fine
    }

    // 2. Remove our patches from vite config
    const configInfo = findViteConfig(rootPath);
    if (configInfo) {
        let content = await fs.promises.readFile(configInfo.path, 'utf8');
        // Remove all marked blocks (import + plugin usage)
        const markerRegex = new RegExp(
            `\\s*${escapeRegExp(CONFIG_MARKER_START)}[\\s\\S]*?${escapeRegExp(CONFIG_MARKER_END)}`,
            'g'
        );
        content = content.replace(markerRegex, '');
        await fs.promises.writeFile(configInfo.path, content);
    }

    return { success: true, message: 'AI Selector plugin removed.' };
}

// ============================================================================
// .gitignore Management
// ============================================================================

/**
 * Ensures our generated files are in .gitignore.
 */
async function ensureGitignore(rootPath: string): Promise<void> {
    const gitignorePath = path.join(rootPath, '.gitignore');
    const entries = [PLUGIN_FILENAME];
    
    let content = '';
    try {
        content = await fs.promises.readFile(gitignorePath, 'utf8');
    } catch (e) {
        // No .gitignore, we'll create one
    }

    const linesToAdd: string[] = [];
    for (const entry of entries) {
        if (!content.includes(entry)) {
            linesToAdd.push(entry);
        }
    }

    if (linesToAdd.length > 0) {
        const block = `\n# AI Element Selector (auto-generated)\n${linesToAdd.join('\n')}\n`;
        await fs.promises.writeFile(gitignorePath, content + block);
    }
}

// ============================================================================
// Utility
// ============================================================================

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Extension Activation
// ============================================================================

export function activate(context: vscode.ExtensionContext) {
	console.log('AI Element Selector is now active!');

	server = new SelectionServer();

	// Command 1: Start Selector Server
	let launchDisposable = vscode.commands.registerCommand('ai-element-selector.launchSelector', async () => {
		if (server) {
			server.stop();

			// Detect if this is a plain HTML project (Generic) to enable static file serving
			let rootPath: string | undefined;
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor) {
				rootPath = findProjectRoot(path.dirname(activeEditor.document.uri.fsPath));
			}
			if (!rootPath && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				rootPath = findProjectRoot(vscode.workspace.workspaceFolders[0].uri.fsPath);
			}
			// Even without package.json, use the workspace folder as root for plain HTML
			if (!rootPath && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			}

			let framework: Framework = 'Generic';
			if (rootPath) {
				framework = await detectFramework(rootPath);
			}

			if (framework === 'Generic' && rootPath) {
				// Plain HTML: Enable static file serving mode
				server.setProjectRoot(rootPath);
				server.start();
				const targetUrl = `http://localhost:3210`;
				vscode.env.openExternal(vscode.Uri.parse(targetUrl));
				vscode.window.showInformationMessage(
					`AI Selector active in Static Server mode! Open ${targetUrl} to browse your project.`
				);
			} else {
				// Framework project: User has their own dev server
				server.setProjectRoot(undefined);
				server.start();
				const targetUrl = `http://localhost:3000`;
				vscode.env.openExternal(vscode.Uri.parse(targetUrl));
				vscode.window.showInformationMessage(`AI Selector active! Open your dev site at ${targetUrl}.`);
			}
		}
	});

	// Command 2: Auto-Setup (Babel + Dev Server Middleware — Zero-File-Edit)
	let setupDisposable = vscode.commands.registerCommand('ai-element-selector.setupSourceMapping', async () => {
		let startPath: string | undefined;

		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			startPath = path.dirname(activeEditor.document.uri.fsPath);
		} else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			startPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		}

		if (!startPath) {
			vscode.window.showErrorMessage('No file or workspace open.');
			return;
		}

		const rootPath = findProjectRoot(startPath);
		// For Generic projects, we allow no package.json — use workspace root
		const resolvedRoot = rootPath || (vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0]?.uri.fsPath : undefined);
		if (!resolvedRoot) {
			vscode.window.showErrorMessage('Could not find project root.');
			return;
		}

        const framework = await detectFramework(resolvedRoot);
        vscode.window.showInformationMessage(`Detected Framework: ${framework}`);

		// --- 1. Babel Setup (For source mapping metadata — framework projects only) ---
		if (framework !== 'Generic') {
			const babelRcPath = path.join(resolvedRoot, '.babelrc');
			let babelConfig: any = { plugins: [] };
			
			// Next.js needs its specific preset
			if (framework === 'Next.js') {
				babelConfig.presets = ["next/babel"];
			}

			if (fs.existsSync(babelRcPath)) {
				try { babelConfig = JSON.parse(await fs.promises.readFile(babelRcPath, 'utf8')); } catch (e) {}
			}
			const pluginPath = path.join(context.extensionPath, 'packages', 'babel-plugin-source-mapper');
			if (!babelConfig.plugins) babelConfig.plugins = [];
			if (framework === 'Next.js') {
				if (!babelConfig.presets) babelConfig.presets = [];
				if (!babelConfig.presets.includes("next/babel")) babelConfig.presets.unshift("next/babel");
			}

			if (!babelConfig.plugins.includes(pluginPath)) {
				babelConfig.plugins.push(pluginPath);
				await fs.promises.writeFile(babelRcPath, JSON.stringify(babelConfig, null, 2));
			}
		}

		// --- 2. Dev Server Middleware (Zero-File-Edit Injection) ---
        let injectionMessage = '';

        if (framework === 'Next.js') {
            // Next.js: The Babel plugin already handles runtime injection (zero-file-edit).
            injectionMessage = 'Babel plugin handles runtime script injection (no file edits needed).';
        } else if (framework === 'Vite' || framework === 'Vue' || framework === 'SvelteKit') {
            // Vite-based: Use the Vite plugin to inject via transformIndexHtml
            const result = await setupVitePlugin(resolvedRoot, context.extensionPath);
            if (!result.success) {
                vscode.window.showErrorMessage(result.message);
                return;
            }
            injectionMessage = result.message;

            // Add plugin file to .gitignore so it never pollutes the repo
            await ensureGitignore(resolvedRoot);
        } else {
            // Generic / Plain HTML: Use the built-in static server
            injectionMessage = 'Built-in dev server will auto-inject the selector (open http://localhost:3210).';
        }

		// --- 3. Build Cache Clean (Next.js specific) ---
		const dotNextPath = path.join(resolvedRoot, '.next');
		let cacheCleaned = false;
		if (framework === 'Next.js' && fs.existsSync(dotNextPath)) {
			const cleanResponse = await vscode.window.showInformationMessage(
				'Detected existing Next.js build cache. Clearing it can fix the "placeholder-url" error. Clear it now?',
				'Yes', 'No'
			);
			if (cleanResponse === 'Yes') {
				try {
					fs.rmSync(dotNextPath, { recursive: true, force: true });
					cacheCleaned = true;
				} catch (e) {
					vscode.window.showErrorMessage(`Failed to clear .next: ${e}`);
				}
			}
		}

		let msg = `✅ ${framework} setup complete (Zero-File-Edit)! ${injectionMessage}`;
		if (cacheCleaned) msg += ' Cleared build cache.';
		msg += ' Please RESTART your dev server.';
		
		vscode.window.showInformationMessage(msg);
	});

	// Command 3: Stop Selector Server
	let stopDisposable = vscode.commands.registerCommand('ai-element-selector.stopSelector', () => {
		if (server) {
			server.stop();
			vscode.window.showInformationMessage('Selector Server stopped.');
		}
	});

    // Command 4: Remove Setup (Clean Undo)
    let removeDisposable = vscode.commands.registerCommand('ai-element-selector.removeSetup', async () => {
        let startPath: string | undefined;
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            startPath = path.dirname(activeEditor.document.uri.fsPath);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            startPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        if (!startPath) {
            vscode.window.showErrorMessage('No file or workspace open.');
            return;
        }

        const rootPath = findProjectRoot(startPath);
        if (!rootPath) {
            vscode.window.showErrorMessage('Could not find project root (package.json).');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            'This will remove the AI Selector Babel plugin and Vite plugin from this project. Continue?',
            'Yes', 'No'
        );
        if (confirm !== 'Yes') return;

        // 1. Remove Vite plugin
        const viteResult = await removeVitePlugin(rootPath);

        // 2. Remove .babelrc plugin entry
        const babelRcPath = path.join(rootPath, '.babelrc');
        if (fs.existsSync(babelRcPath)) {
            try {
                const babelConfig = JSON.parse(await fs.promises.readFile(babelRcPath, 'utf8'));
                if (babelConfig.plugins) {
                    babelConfig.plugins = babelConfig.plugins.filter(
                        (p: string) => !p.includes('babel-plugin-source-mapper')
                    );
                }
                // If config is effectively empty, delete it
                const hasPlugins = babelConfig.plugins && babelConfig.plugins.length > 0;
                const hasPresets = babelConfig.presets && babelConfig.presets.length > 0 && 
                    !(babelConfig.presets.length === 1 && babelConfig.presets[0] === 'next/babel');
                
                if (!hasPlugins && !hasPresets) {
                    await fs.promises.unlink(babelRcPath);
                } else {
                    await fs.promises.writeFile(babelRcPath, JSON.stringify(babelConfig, null, 2));
                }
            } catch (e) {}
        }

        vscode.window.showInformationMessage('🧹 AI Selector setup removed. Please restart your dev server.');
    });

	context.subscriptions.push(launchDisposable, setupDisposable, stopDisposable, removeDisposable);
}

export function deactivate() {
	if (server) {
		server.stop();
	}
}
