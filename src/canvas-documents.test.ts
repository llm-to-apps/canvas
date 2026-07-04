import { describe, expect, it } from "vitest";

import { canvasShellDocument, emptyCanvasDocument } from "./canvas-documents.js";

describe("canvas documents", () => {
  it("escapes titles in the empty document", () => {
    const html = emptyCanvasDocument('<script>alert("x")</script>');

    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it("renders a sandboxed shell iframe", () => {
    const html = canvasShellDocument({
      canvasId: "cnv_123",
      documentUrl: "/api/canvases/cnv_123/document",
      title: "Bulk editor",
    });

    expect(html).toContain('data-canvas-id="cnv_123"');
    expect(html).toContain('sandbox="allow-scripts allow-forms"');
    expect(html).toContain('src="/api/canvases/cnv_123/document"');
  });
});
