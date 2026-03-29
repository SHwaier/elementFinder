(function() {
    const CONFIG = {
        highlightColor: '{{HIGHLIGHT_COLOR}}',
        modifierKey: '{{MODIFIER_KEY}}',
        showToasts: '{{SHOW_TOASTS}}' === 'true',
        editorName: '{{EDITOR_NAME}}'
    };

    console.log(`AI Element Selector: Injected with custom settings for ${CONFIG.editorName}.`, CONFIG);

    let socket = null;
    let highLightedElement = null;

    function connect() {
        socket = new WebSocket('ws://localhost:3210');
        socket.onopen = () => console.log(`AI Element Selector: Connected to ${CONFIG.editorName}.`);
        socket.onclose = () => {
            setTimeout(connect, 1000);
        };
    }
    connect();

    // Create highlight overlay with custom color
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        pointerEvents: 'none',
        border: `2px solid ${CONFIG.highlightColor}`,
        backgroundColor: CONFIG.highlightColor.replace(')', ', 0.1)').replace('rgb', 'rgba'),
        zIndex: '999999',
        display: 'none',
        borderRadius: '2px',
        transition: 'all 0.05s ease-out',
        boxShadow: `0 0 10px ${CONFIG.highlightColor.replace(')', ', 0.3)').replace('rgb', 'rgba')}`
    });
    document.body.appendChild(overlay);

    // Create a toast for feedback
    const toast = document.createElement('div');
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '10px 20px',
        backgroundColor: '#333',
        color: '#fff',
        borderRadius: '5px',
        zIndex: '1000000',
        display: 'none',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    });
    document.body.appendChild(toast);

    function showToast(message, duration = 2000) {
        if (!CONFIG.showToasts) return;
        toast.innerText = message;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', duration);
    }

    function sanitizeProps(props) {
        if (!props || typeof props !== 'object') return null;
        const sanitized = {};
        for (const [key, value] of Object.entries(props)) {
            if (key === 'children' || key.startsWith('__') || key.startsWith('data-source-') || key === 'data-component') continue;
            const type = typeof value;
            if (type === 'string' || type === 'number' || type === 'boolean') {
                sanitized[key] = value;
            } else if (value === null) {
                sanitized[key] = null;
            } else if (Array.isArray(value)) {
                if (value.length < 10 && value.every(v => typeof v !== 'object' && typeof v !== 'function')) {
                    sanitized[key] = value;
                }
            } else if (type === 'object' && Object.keys(value).length < 5) {
                sanitized[key] = '{...}';
            }
        }
        return Object.keys(sanitized).length > 0 ? sanitized : null;
    }

    function getComponentProps(el) {
        const fiberKey = Object.keys(el).find(key => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'));
        if (!fiberKey) return null;
        let curr = el[fiberKey];
        while (curr) {
            if (curr.memoizedProps) {
                const props = sanitizeProps(curr.memoizedProps);
                if (props) return props;
            }
            curr = curr.return;
        }
        return null;
    }

    function isSelectionEnabled(e) {
        const key = CONFIG.modifierKey;
        if (key === 'Alt') return !e.altKey;
        if (key === 'Shift') return !e.shiftKey;
        if (key === 'Control') return !e.ctrlKey;
        if (key === 'Meta') return !e.metaKey;
        return true;
    }

    document.addEventListener('mouseover', (e) => {
        if (!isSelectionEnabled(e)) {
            overlay.style.display = 'none';
            return;
        }
        const el = e.target;
        if (el === overlay || el === toast) return;
        const rect = el.getBoundingClientRect();
        Object.assign(overlay.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            display: 'block'
        });
        highLightedElement = el;
    });

    document.addEventListener('click', (e) => {
        if (!isSelectionEnabled(e)) {
            overlay.style.display = 'none';
            return;
        }
        if (!highLightedElement) return;

        overlay.style.backgroundColor = CONFIG.highlightColor.replace(')', ', 0.5)').replace('rgb', 'rgba');
        setTimeout(() => {
            overlay.style.backgroundColor = CONFIG.highlightColor.replace(')', ', 0.1)').replace('rgb', 'rgba');
        }, 100);

        const file = highLightedElement.getAttribute('data-source-file');
        const lineStr = highLightedElement.getAttribute('data-source-line');
        const line = lineStr ? parseInt(lineStr, 10) : null;
        const props = getComponentProps(highLightedElement);

        const payload = {
            file: file,
            line: line,
            component: highLightedElement.getAttribute('data-component') || 'Unknown Component',
            props: props,
            element: highLightedElement.tagName.toLowerCase(),
            text: highLightedElement.innerText.slice(0, 100).trim(),
            route: window.location.pathname
        };

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
            if (!file) {
                showToast('🚀 Sent to AI!');
            } else {
                showToast(`🚀 Captured to ${CONFIG.editorName}!`);
            }
            e.preventDefault();
            e.stopPropagation();
        } else {
            showToast(`❌ Not connected to ${CONFIG.editorName}.`);
        }
    }, true);

    window.addEventListener('keydown', (e) => {
        if (!isSelectionEnabled(e)) {
            overlay.style.display = 'none';
        }
    });
})();
