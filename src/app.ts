import type { PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import { z } from "zod";

import { emptyCanvasDocument, canvasShellDocument } from "./canvas-documents.js";
import { canvasConnectSrc, canvasPublicBaseUrl, canvasScriptSrc, canvasStyleSrc } from "./env.js";
import { jsonError, jsonOk } from "./http.js";
import { logError, logInfo, logWarn } from "./logger.js";
import { hasInternalAuth, matchesSha256, sha256 } from "./security.js";
import type { StoredObject } from "./storage.js";

type CanvasStorage = {
  getCanvasObject(input: { bucket: string; key: string }): Promise<Buffer>;
  putCanvasObject(input: {
    body: Buffer;
    contentType: string;
    key: string;
  }): Promise<StoredObject>;
};

type CanvasAppDeps = {
  prisma: PrismaClient;
  storage: CanvasStorage;
};

const createCanvasSchema = z.object({
  contextToken: z.string().min(16),
  prompt: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(160),
});

const saveDocumentSchema = z.object({
  html: z.string().min(1),
});

const startRunSchema = z.object({
  prompt: z.string().trim().min(1),
});

export function createCanvasApp({ prisma, storage }: CanvasAppDeps) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();

    c.header("X-Request-Id", requestId);

    try {
      await next();
      logInfo("http.request", {
        durationMs: Date.now() - startedAt,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        requestId,
        status: c.res.status,
      });
    } catch (error) {
      logError("http.request.failed", {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        requestId,
      });
      throw error;
    }
  });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "canvas",
    }),
  );

  app.post("/api/canvases", async (c) => {
    if (!hasInternalAuth(c.req.raw)) {
      logWarn("canvas.create.unauthorized");
      return jsonError("Unauthorized", 401);
    }

    const input = createCanvasSchema.safeParse(await c.req.json().catch(() => null));

    if (!input.success) {
      logWarn("canvas.create.invalid_payload", {
        issues: input.error.issues.map((issue) => issue.path.join(".")),
      });
      return jsonError("Invalid canvas payload", 400);
    }

    const canvas = await prisma.canvasSession.create({
      data: {
        contextTokenHash: sha256(input.data.contextToken),
        title: input.data.title,
        ...(input.data.prompt
          ? {
              runs: {
                create: {
                  prompt: input.data.prompt,
                },
              },
            }
          : {}),
      },
    });

    logInfo("canvas.created", {
      canvasId: canvas.id,
      hasInitialPrompt: Boolean(input.data.prompt),
    });

    return jsonOk(
      {
        canvasId: canvas.id,
        title: canvas.title,
        url: canvasUrl(canvas.id, input.data.contextToken),
      },
      201,
    );
  });

  app.get("/c/:canvasId", async (c) => {
    const canvas = await prisma.canvasSession.findUnique({
      where: {
        id: c.req.param("canvasId"),
      },
      select: {
        contextTokenHash: true,
        id: true,
        title: true,
      },
    });

    if (!canvas) {
      logWarn("canvas.shell.not_found", {
        canvasId: c.req.param("canvasId"),
      });
      return new Response("Canvas not found", { status: 404 });
    }

    const contextToken = c.req.query("contextToken") ?? "";

    if (!matchesSha256(contextToken, canvas.contextTokenHash)) {
      logWarn("canvas.shell.forbidden", {
        canvasId: canvas.id,
      });
      return new Response("Forbidden", { status: 403 });
    }

    const documentUrl = `/api/canvases/${encodeURIComponent(
      canvas.id,
    )}/document?contextToken=${encodeURIComponent(contextToken)}`;

    return new Response(
      canvasShellDocument({
        canvasId: canvas.id,
        documentUrl,
        title: canvas.title,
      }),
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  });

  app.get("/api/canvases/:canvasId/document", async (c) => {
    const canvas = await prisma.canvasSession.findUnique({
      where: {
        id: c.req.param("canvasId"),
      },
      include: {
        artifacts: {
          orderBy: {
            version: "desc",
          },
          take: 1,
          where: {
            kind: "document",
          },
        },
      },
    });

    if (!canvas) {
      logWarn("canvas.document.not_found", {
        canvasId: c.req.param("canvasId"),
      });
      return new Response("Canvas not found", { status: 404 });
    }

    const contextToken = c.req.query("contextToken") ?? "";

    if (!matchesSha256(contextToken, canvas.contextTokenHash)) {
      logWarn("canvas.document.forbidden", {
        canvasId: canvas.id,
      });
      return new Response("Forbidden", { status: 403 });
    }

    const artifact = canvas.artifacts[0];
    const html = artifact
      ? await storage.getCanvasObject({
          bucket: artifact.bucket,
          key: artifact.objectKey,
        })
      : Buffer.from(emptyCanvasDocument(canvas.title));

    logInfo("canvas.document.served", {
      canvasId: canvas.id,
      hasArtifact: Boolean(artifact),
      sizeBytes: html.byteLength,
    });

    return new Response(html, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Security-Policy": canvasDocumentCsp(),
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  });

  app.post("/api/canvases/:canvasId/document", async (c) => {
    if (!hasInternalAuth(c.req.raw)) {
      logWarn("canvas.document.save.unauthorized", {
        canvasId: c.req.param("canvasId"),
      });
      return jsonError("Unauthorized", 401);
    }

    const canvas = await prisma.canvasSession.findUnique({
      where: {
        id: c.req.param("canvasId"),
      },
      include: {
        artifacts: {
          orderBy: {
            version: "desc",
          },
          take: 1,
          where: {
            kind: "document",
          },
        },
      },
    });

    if (!canvas) {
      logWarn("canvas.document.save.not_found", {
        canvasId: c.req.param("canvasId"),
      });
      return jsonError("Canvas not found", 404);
    }

    const input = saveDocumentSchema.safeParse(await c.req.json().catch(() => null));

    if (!input.success) {
      logWarn("canvas.document.save.invalid_payload", {
        canvasId: canvas.id,
      });
      return jsonError("Invalid document payload", 400);
    }

    const version = (canvas.artifacts[0]?.version ?? 0) + 1;
    const object = await storage.putCanvasObject({
      body: Buffer.from(input.data.html),
      contentType: "text/html; charset=utf-8",
      key: `canvases/${canvas.id}/documents/${version}.html`,
    });

    const artifact = await prisma.canvasArtifact.create({
      data: {
        bucket: object.bucket,
        canvasId: canvas.id,
        contentType: "text/html; charset=utf-8",
        kind: "document",
        objectKey: object.key,
        sizeBytes: object.sizeBytes,
        version,
      },
    });

    await prisma.canvasSession.update({
      where: {
        id: canvas.id,
      },
      data: {
        currentDocumentId: artifact.id,
        status: "ready",
      },
    });

    logInfo("canvas.document.saved", {
      artifactId: artifact.id,
      canvasId: canvas.id,
      sizeBytes: object.sizeBytes,
      version,
    });

    return jsonOk({
      artifactId: artifact.id,
      documentUrl: `${canvasPublicBaseUrl()}/api/canvases/${canvas.id}/document`,
      version,
    });
  });

  app.post("/api/canvases/:canvasId/runs", async (c) => {
    if (!hasInternalAuth(c.req.raw)) {
      logWarn("canvas.run.create.unauthorized", {
        canvasId: c.req.param("canvasId"),
      });
      return jsonError("Unauthorized", 401);
    }

    const canvas = await prisma.canvasSession.findUnique({
      where: {
        id: c.req.param("canvasId"),
      },
      select: {
        id: true,
      },
    });

    if (!canvas) {
      logWarn("canvas.run.create.not_found", {
        canvasId: c.req.param("canvasId"),
      });
      return jsonError("Canvas not found", 404);
    }

    const input = startRunSchema.safeParse(await c.req.json().catch(() => null));

    if (!input.success) {
      logWarn("canvas.run.create.invalid_payload", {
        canvasId: canvas.id,
      });
      return jsonError("Invalid run payload", 400);
    }

    const run = await prisma.canvasRun.create({
      data: {
        canvasId: canvas.id,
        prompt: input.data.prompt,
      },
    });

    logInfo("canvas.run.created", {
      canvasId: canvas.id,
      runId: run.id,
    });

    return jsonOk(
      {
        message:
          "Canvas run was queued. Mastra stream execution will be wired in the next integration step.",
        runId: run.id,
      },
      202,
    );
  });

  return app;
}

function canvasUrl(canvasId: string, contextToken: string) {
  const url = new URL(`/c/${canvasId}`, canvasPublicBaseUrl());
  url.searchParams.set("contextToken", contextToken);
  return url.toString();
}

function canvasDocumentCsp() {
  return [
    "default-src 'none'",
    `script-src ${canvasScriptSrc()}`,
    `style-src ${canvasStyleSrc()}`,
    "img-src data: blob: https:",
    "font-src data: https:",
    `connect-src ${canvasConnectSrc()}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
