import * as vscode from 'vscode';
import { SelectionServer } from './server';
import * as fs from 'fs';
import * as path from 'path';

let server: SelectionServer | undefined;

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

/**
 * Safely injects the script into a layout file. (Next.js specific)
 */
async function injectIntoLayout(layoutPath: string): Promise<boolean> {
    let content = await fs.promises.readFile(layoutPath, 'utf8');
    
    // 1. Add import Script from 'next/script' if missing
    if (!content.includes("'next/script'") && !content.includes('"next/script"')) {
        content = "import Script from 'next/script';\n" + content;
    }

    // 2. Prepare the injection block
    const injection = `
      {process.env.NODE_ENV === 'development' && (
        <Script src="http://localhost:3210/inject.js" strategy="afterInteractive" />
      )}`;

    // 3. Find the <body> tag and inject before </body>
    if (content.includes('</body>')) {
        if (!content.includes('http://localhost:3210/inject.js')) {
            content = content.replace('</body>', `${injection}\n      </body>`);
        } else {
            return false; // Already injected
        }
    } else {
        // Fallback for layouts without explicit body tag
        if (!content.includes('http://localhost:3210/inject.js')) {
            content += injection;
        } else {
            return false;
        }
    }

    fs.writeFileSync(layoutPath, content);
    return true;
}

/**
 * Safely injects the script into an HTML file. (Vite/Vue/SvelteKit/Generic)
 */
async function injectIntoHTML(htmlPath: string): Promise<boolean> {
    let content = await fs.promises.readFile(htmlPath, 'utf8');
    
    if (content.includes('http://localhost:3210/inject.js')) {
        return false; // Already injected
    }

    // Standard HTML injection that works in Dev only via local server availability
    const injection = `
    <!-- AI Element Selector -->
    <script>
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        const script = document.createElement('script');
        script.src = 'http://localhost:3210/inject.js';
        script.async = true;
        document.head.appendChild(script);
      }
    </script>`;

    if (content.includes('</body>')) {
        content = content.replace('</body>', `${injection}\n  </body>`);
    } else if (content.includes('</html>')) {
        content = content.replace('</html>', `${injection}\n</html>`);
    } else {
        content += injection;
    }

    fs.writeFileSync(htmlPath, content);
    return true;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('AI Element Selector is now active!');

	server = new SelectionServer();

	// Command 1: Start Selector Server
	let launchDisposable = vscode.commands.registerCommand('ai-element-selector.launchSelector', async () => {
		if (server) {
			server.stop();
			server.start();
			
			const targetUrl = `http://localhost:3000`;
			vscode.env.openExternal(vscode.Uri.parse(targetUrl));
			vscode.window.showInformationMessage(`AI Selector active! Open your dev site at ${targetUrl}.`);
		}
	});

	// Command 2: Auto-Setup (Babel + Layout Injection + Cache Clean)
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
		if (!rootPath) {
			vscode.window.showErrorMessage('Could not find project root (package.json).');
			return;
		}

        const framework = await detectFramework(rootPath);
        vscode.window.showInformationMessage(`Detected Framework: ${framework}`);

		// --- 1. Babel Setup (For mapping info - mainly JSX) ---
		const babelRcPath = path.join(rootPath, '.babelrc');
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

		// --- 2. Environment-Specific Injection ---
		let injectionResult = false;
        let injectionTarget = '';

        if (framework === 'Next.js') {
            const appDirPath = path.join(rootPath, 'app');
            const layouts = ['layout.tsx', 'layout.js'];
            for (const l of layouts) {
                const p = path.join(appDirPath, l);
                if (fs.existsSync(p)) {
                    injectionResult = await injectIntoLayout(p);
                    injectionTarget = 'app/' + l;
                    break;
                }
            }
        } else if (framework === 'SvelteKit') {
            const appHtmlPath = path.join(rootPath, 'src', 'app.html');
            if (fs.existsSync(appHtmlPath)) {
                injectionResult = await injectIntoHTML(appHtmlPath);
                injectionTarget = 'src/app.html';
            }
        } else {
            // Vite, Vue, or Generic
            const indexHtmlPath = path.join(rootPath, 'index.html');
            if (fs.existsSync(indexHtmlPath)) {
                injectionResult = await injectIntoHTML(indexHtmlPath);
                injectionTarget = 'index.html';
            }
        }

		// --- 3. Build Cache Clean (Next.js specific) ---
		const dotNextPath = path.join(rootPath, '.next');
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

		let msg = `${framework} Selector setup complete!`;
		if (injectionResult) msg += ` Injected Script into ${injectionTarget}.`;
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

	context.subscriptions.push(launchDisposable, setupDisposable, stopDisposable);
}

export function deactivate() {
	if (server) {
		server.stop();
	}
}
