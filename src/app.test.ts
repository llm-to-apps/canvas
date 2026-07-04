import { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCanvasApp } from "./app.js";

vi.mock("./env.js", () => ({
  canvasConnectSrc: () => "'none'",
  canvasInternalToken: () => "test-token",
  canvasPublicBaseUrl: () => "http://canvas.test",
  canvasScriptSrc: () =>
    "'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com",
  canvasStyleSrc: () => "'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
}));

const prisma = new PrismaClient();

function createTestStorage() {
  const state = {
    objects: new Map<string, Buffer>(),
  };

  const storage = {
    getCanvasObject: vi.fn(async ({ bucket, key }) => {
      const object = state.objects.get(`${bucket}/${key}`);

      if (!object) {
        throw new Error(`Missing object ${bucket}/${key}`);
      }

      return object;
    }),
    putCanvasObject: vi.fn(async ({ body, contentType, key }) => {
      const bucket = "canvas";
      state.objects.set(`${bucket}/${key}`, body);

      return {
        bucket,
        contentType,
        key,
        sizeBytes: body.byteLength,
      };
    }),
  };

  return {
    state,
    storage,
  };
}

async function resetDb() {
  await prisma.canvasArtifact.deleteMany();
  await prisma.canvasRun.deleteMany();
  await prisma.canvasSession.deleteMany();
}

function createTestApp() {
  const { state, storage } = createTestStorage();

  return {
    app: createCanvasApp({
      prisma,
      storage,
    }),
    state,
    storage,
  };
}

describe("canvas app", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("requires internal auth for canvas creation", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/canvases", {
      body: JSON.stringify({
        contextToken: "long-enough-token",
        title: "Bulk editor",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("creates a canvas and an initial run", async () => {
    const { app } = createTestApp();
    const response = await app.request("/api/canvases", {
      body: JSON.stringify({
        contextToken: "long-enough-token",
        prompt: "Build an editor",
        title: "Bulk editor",
      }),
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: {
        canvasId: string;
        url: string;
      };
    };

    expect(body).toMatchObject({
      ok: true,
      data: {
        title: "Bulk editor",
      },
    });
    expect(body.data.canvasId).toMatch(/^c/);
    expect(body.data.url).toBe(
      `http://canvas.test/c/${body.data.canvasId}?contextToken=long-enough-token`,
    );
    expect(await prisma.canvasRun.findMany()).toMatchObject([
      {
        canvasId: body.data.canvasId,
        prompt: "Build an editor",
      },
    ]);
  });

  it("saves and serves the latest HTML document", async () => {
    const { app, storage } = createTestApp();

    const createResponse = await app.request("/api/canvases", {
      body: JSON.stringify({
        contextToken: "long-enough-token",
        title: "Bulk editor",
      }),
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const createBody = (await createResponse.json()) as {
      data: {
        canvasId: string;
      };
    };
    const canvasId = createBody.data.canvasId;

    const saveResponse = await app.request(`/api/canvases/${canvasId}/document`, {
      body: JSON.stringify({
        html: "<!doctype html><title>Generated</title>",
      }),
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      method: "POST",
    });

    expect(saveResponse.status).toBe(200);
    await expect(saveResponse.json()).resolves.toMatchObject({
      ok: true,
      data: {
        documentUrl: `http://canvas.test/api/canvases/${canvasId}/document`,
        version: 1,
      },
    });
    expect(storage.putCanvasObject).toHaveBeenCalledOnce();
    await expect(prisma.canvasArtifact.count()).resolves.toBe(1);

    const forbiddenDocumentResponse = await app.request(
      `/api/canvases/${canvasId}/document`,
    );

    expect(forbiddenDocumentResponse.status).toBe(403);

    const documentResponse = await app.request(
      `/api/canvases/${canvasId}/document?contextToken=long-enough-token`,
    );

    expect(documentResponse.status).toBe(200);
    expect(documentResponse.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(documentResponse.headers.get("content-security-policy")).toContain(
      "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com",
    );
    await expect(documentResponse.text()).resolves.toBe(
      "<!doctype html><title>Generated</title>",
    );
  });
});
