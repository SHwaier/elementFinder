module.exports = function(babel) {
  const { types: t } = babel;

  return {
    name: 'source-mapper',
    visitor: {
      JSXOpeningElement(path, state) {
        // 1. Inject Source Mapping Metadata
        const fileName = state.file.opts.filename;
        const line = path.node.loc ? path.node.loc.start.line : null;

        if (fileName && line) {
          path.node.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('data-source-file'), t.stringLiteral(fileName)),
            t.jsxAttribute(t.jsxIdentifier('data-source-line'), t.stringLiteral(line.toString()))
          );
        }

        // 2. Inject Selector Loader Script (Dev Only)
        if (process.env.NODE_ENV === 'development' && !state.injected) {
          const loaderCode = `
            if (typeof window !== 'undefined' && !window.__SELECTOR_INJECTED__) {
              window.__SELECTOR_INJECTED__ = true;
              const script = document.createElement('script');
              script.src = 'http://localhost:3210/inject.js';
              script.async = true;
              document.body.appendChild(script);
              console.log('AI Element Selector: Loaded from http://localhost:3210/inject.js');
            }
          `;

          // Find the parent function (Component) body
          const parentFunc = path.getFunctionParent();
          if (parentFunc && parentFunc.isFunction()) {
            const body = parentFunc.node.body;
            if (t.isBlockStatement(body)) {
                body.body.unshift(t.expressionStatement(t.identifier(`(function(){ ${loaderCode} })()`)));
                state.injected = true;
            }
          }
        }
      },
    },
  };
};
