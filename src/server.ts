import * as ws from 'ws';
import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// MIME type map for static file serving
const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.map': 'application/json',
};

export class SelectionServer {
    private wss: ws.Server | undefined;
    private httpServer: http.Server | undefined;
    private port: number = 3210;
    private projectRoot: string | undefined;

    constructor() {}

    /**
     * Sets the project root for static file serving mode.
     * When set, the server serves files from this directory
     * and auto-injects inject.js into HTML responses.
     */
    public setProjectRoot(root: string | undefined): void {
        this.projectRoot = root;
    }

    public getProjectRoot(): string | undefined {
        return this.projectRoot;
    }

    public start(): void {
        const appName = vscode.env.appName;

        this.httpServer = http.createServer(async (req, res) => {
            if (req.url === '/inject.js') {
                const scriptPath = path.join(__dirname, '..', 'scripts', 'inject.js');
                try {
                    const scriptBuffer = await fs.promises.readFile(scriptPath);
                    let script = scriptBuffer.toString('utf8');
                    const config = vscode.workspace.getConfiguration('ai-element-selector');
                    
                    // --- Dynamic Injection of Settings & Editor Name ---
                    script = script.replace(/{{HIGHLIGHT_COLOR}}/g, config.get<string>('highlightColor', 'rgba(0, 122, 255, 0.7)'));
                    script = script.replace(/{{MODIFIER_KEY}}/g, config.get<string>('modifierKey', 'Alt'));
                    script = script.replace(/{{SHOW_TOASTS}}/g, String(config.get<boolean>('showToasts', true)));
                    script = script.replace(/{{EDITOR_NAME}}/g, appName);

                    res.writeHead(200, {
                        'Content-Type': 'application/javascript',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': '*'
                    });
                    res.end(script);
                } catch (e) {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            } else if (this.projectRoot) {
                // --- Static File Serving Mode (Plain HTML projects) ---
                await this.serveStaticFile(req, res);
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        // Hardened WebSocket Server: Validates Origin
        this.wss = new ws.Server({ 
            server: this.httpServer,
            verifyClient: (info: any) => {
                const origin = info.origin;
                // Allow requests from localhost, 127.0.0.1, or browser-side file protocols
                const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
                return isLocal;
            }
        });
        
        this.wss.on('connection', (socket) => {
            console.log(`Browser connected to ${appName} Element Selector`);
            socket.on('message', (data) => {
                try {
                    const payload = JSON.parse(data.toString());
                    this.handlePayload(payload, appName);
                } catch (err) {
                    console.error('Failed to parse payload:', err);
                }
            });
        });

        // Strictly bind to 127.0.0.1 to avoid network exposure
        this.httpServer.listen(this.port, '127.0.0.1', () => {
            console.log(`${appName} Selector Server started on http://127.0.0.1:${this.port}`);
        });
        
        vscode.window.showInformationMessage(`${appName} Selector Server started on http://127.0.0.1:${this.port}. Bound to localhost for security.`);
    }

    public stop(): void {
        if (this.wss) this.wss.close();
        if (this.httpServer) this.httpServer.close();
    }

    /**
     * Serves static files from the projectRoot directory.
     * HTML files get the inject.js script automatically appended before </body>.
     * This enables zero-file-edit usage for plain HTML projects.
     */
    private async serveStaticFile(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.projectRoot) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        // Decode and sanitize the URL path
        let urlPath = decodeURIComponent(req.url || '/');
        
        // Strip query strings and hash fragments
        urlPath = urlPath.split('?')[0].split('#')[0];

        // Resolve to filesystem path (prevent directory traversal)
        let filePath = path.join(this.projectRoot, urlPath);
        const resolvedPath = path.resolve(filePath);
        
        // Security: ensure the resolved path is within the project root
        if (!resolvedPath.startsWith(path.resolve(this.projectRoot))) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        try {
            const stat = await fs.promises.stat(resolvedPath);
            
            // If it's a directory, look for index.html
            if (stat.isDirectory()) {
                filePath = path.join(resolvedPath, 'index.html');
                try {
                    await fs.promises.stat(filePath);
                } catch {
                    // No index.html — return a simple directory listing
                    const entries = await fs.promises.readdir(resolvedPath);
                    const links = entries
                        .map(e => `<li><a href="${path.join(urlPath, e)}">${e}</a></li>`)
                        .join('\n');
                    const html = `<!DOCTYPE html><html><head><title>Index of ${urlPath}</title>
                        <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px}
                        a{color:#0066cc;text-decoration:none}a:hover{text-decoration:underline}
                        li{padding:4px 0}h1{border-bottom:1px solid #ddd;padding-bottom:10px}</style>
                        </head><body><h1>📁 ${urlPath}</h1><ul>${links}</ul>
                        <script src="http://localhost:3210/inject.js" async><\/script>
                        </body></html>`;
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(html);
                    return;
                }
            } else {
                filePath = resolvedPath;
            }

            // Read the file
            const content = await fs.promises.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

            // If it's HTML, inject the selector script
            if (ext === '.html' || ext === '.htm') {
                let html = content.toString('utf8');
                const injection = `\n    <!-- AI Element Selector (auto-injected by dev server) -->\n    <script src="http://localhost:3210/inject.js" async><\/script>`;
                
                if (html.includes('</body>')) {
                    html = html.replace('</body>', `${injection}\n  </body>`);
                } else if (html.includes('</html>')) {
                    html = html.replace('</html>', `${injection}\n</html>`);
                } else {
                    html += injection;
                }

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            } else {
                res.writeHead(200, { 'Content-Type': mimeType });
                res.end(content);
            }
        } catch (e) {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private handlePayload(payload: any, appName: string): void {
        const { file, line, component, element } = payload;
        const config = vscode.workspace.getConfiguration('ai-element-selector');

        if (file && line) {
            const uri = vscode.Uri.file(file);
            vscode.workspace.openTextDocument(uri).then(async (doc) => {
                vscode.window.showTextDocument(doc, {
                    selection: new vscode.Range(line - 1, 0, line - 1, 0),
                    preview: false,
                    viewColumn: vscode.ViewColumn.One
                });
                
                if (config.get<boolean>('includeSnippet', true)) {
                    const range = config.get<number>('snippetRange', 5);
                    payload.snippet = await this.readCodeSnippet(file, line, range);
                }

                const prompt = this.generatePrompt(payload, config, appName);
                vscode.env.clipboard.writeText(prompt);

                if (config.get<boolean>('autoFocus', true)) {
                    this.refocusWindow(appName);
                }

                vscode.window.showInformationMessage(`Element captured: ${component || element}`);
            }, (err) => {
                const prompt = this.generatePrompt(payload, config, appName);
                vscode.env.clipboard.writeText(prompt);
            });
        }
 else {
            const prompt = this.generatePrompt(payload, config, appName);
            vscode.env.clipboard.writeText(prompt);
            vscode.window.showWarningMessage('Element captured for AI (Mapping missing).');
        }
    }

    private async readCodeSnippet(filePath: string, targetLine: number, range: number): Promise<string> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split(/\r?\n/);
            const start = Math.max(0, targetLine - (range + 1));
            const end = Math.min(lines.length, targetLine + range);
            const snippetLines = lines.slice(start, end).map((line, index) => {
                const currentLineNum = start + index + 1;
                const marker = currentLineNum === targetLine ? ' > ' : '   ';
                return `${marker}${currentLineNum} | ${line}`;
            });
            return snippetLines.join('\n');
        } catch (e) {
            return '';
        }
    }

    private refocusWindow(appName: string): void {
        const platform = process.platform;
        // Whitelist app name to prevent command injection (only allow alphanumeric, spaces, and common editor names)
        const sanitizedAppName = appName.replace(/[^a-zA-Z0-9\s\.\-]/g, '');

        if (platform === 'darwin') {
            exec(`osascript -e "tell application \\"${sanitizedAppName}\\" to activate"`);
        } else if (platform === 'win32') {
            exec(`powershell -Command "(New-Object -ComObject WScript.Shell).AppActivate('${sanitizedAppName}')"`);
        } else if (platform === 'linux') {
            exec(`wmctrl -a "${sanitizedAppName}" || code .`);
        }
    }

    private generatePrompt(payload: any, config: vscode.WorkspaceConfiguration, appName: string): string {
        const { file, line, component, element, text, route, snippet, props } = payload;
        const customTemplate = config.get<string>('customTemplate', '');

        if (customTemplate) {
            return this.fillTemplate(customTemplate, payload, config);
        }

        const systemPrompt = config.get<string>('systemPrompt', `You are an expert developer assistant.`);
        const taskPlaceholder = config.get<string>('taskPlaceholder', '[User instruction here]');
        const compact = config.get<boolean>('compactPrompt', false);
        const includeProps = config.get<boolean>('includeProps', true);
        const includeConstraints = config.get<boolean>('includeConstraints', true);

        const separator = compact ? ' | ' : '\n- ';
        let context = `Context:${compact ? '' : '\n- '}Route: "${route || '/'}"${separator}Component: "${component || 'unknown'}"${separator}Tag: <${element}>${separator}Text: "${text || ''}"`;

        if (file && line) {
            context += `${separator}File: "${file}"${separator}Line: ${line}`;
        }

        let propsSection = '';
        if (includeProps && props) {
            propsSection = `\n\nDetected Props:\n\`\`\`json\n${JSON.stringify(props, null, 2)}\n\`\`\``;
        }

        let snippetSection = '';
        if (snippet) {
            snippetSection = `\n\nSurrounding Code:\n\`\`\`tsx\n${snippet}\n\`\`\``;
        }

        const constraints = includeConstraints ? `\n\nConstraints:\n- Only modify code relevant to this element\n- Do not refactor unrelated components\n- Preserve existing styling patterns` : '';

        if (compact) {
            return `${systemPrompt}\n\n${context}${propsSection}${snippetSection}\n\nTask: ${taskPlaceholder}${constraints}`;
        }

        return `${systemPrompt}\n\nTarget element:\n${context}${propsSection}${snippetSection}\n\nTask:\n${taskPlaceholder}${constraints}`;
    }

    private fillTemplate(template: string, payload: any, config: vscode.WorkspaceConfiguration): string {
        const { file, line, component, element, text, route, snippet, props } = payload;
        let p = template;
        p = p.replace(/{{component}}/g, component || 'unknown');
        p = p.replace(/{{file}}/g, file || 'unknown');
        p = p.replace(/{{line}}/g, String(line || 'unknown'));
        p = p.replace(/{{tag}}/g, element || 'unknown');
        p = p.replace(/{{text}}/g, text || '');
        p = p.replace(/{{route}}/g, route || '/');
        p = p.replace(/{{snippet}}/g, snippet || '');
        p = p.replace(/{{props}}/g, props ? JSON.stringify(props, null, 2) : '');
        return p;
    }
}
