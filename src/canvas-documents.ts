export function emptyCanvasDocument(title: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: #f7f7f8;
        color: #171717;
        display: grid;
        place-items: center;
      }

      main {
        width: min(720px, calc(100vw - 48px));
        border: 1px solid #dedee3;
        border-radius: 8px;
        background: #fff;
        padding: 24px;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
      }

      h1 {
        font-size: 18px;
        line-height: 1.3;
        margin: 0 0 8px;
      }

      p {
        color: #62626b;
        font-size: 14px;
        line-height: 1.5;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>This canvas is ready. Generated UI will appear here once a canvas run writes its first document.</p>
    </main>
  </body>
</html>`;
}

export function canvasShellDocument({
  canvasId,
  documentUrl,
  title,
}: {
  canvasId: string;
  documentUrl: string;
  title: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      html,
      body,
      iframe {
        width: 100%;
        height: 100%;
        margin: 0;
      }

      body {
        background: #f7f7f8;
      }

      iframe {
        border: 0;
        display: block;
      }
    </style>
  </head>
  <body data-canvas-id="${escapeHtml(canvasId)}">
    <iframe
      sandbox="allow-scripts allow-forms"
      referrerpolicy="no-referrer"
      src="${escapeHtml(documentUrl)}"
      title="${escapeHtml(title)}"
    ></iframe>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
