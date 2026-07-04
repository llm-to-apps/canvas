CREATE TABLE "canvas_sessions" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'created',
  "contextTokenHash" VARCHAR(128) NOT NULL,
  "currentDocumentId" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "canvas_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canvas_artifacts" (
  "id" TEXT NOT NULL,
  "canvasId" TEXT NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "version" INTEGER NOT NULL,
  "bucket" VARCHAR(255) NOT NULL,
  "objectKey" VARCHAR(1024) NOT NULL,
  "contentType" VARCHAR(128) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canvas_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canvas_runs" (
  "id" TEXT NOT NULL,
  "canvasId" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'queued',
  "prompt" TEXT NOT NULL,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "canvas_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "canvas_sessions_status_createdAt_idx" ON "canvas_sessions"("status", "createdAt");
CREATE UNIQUE INDEX "canvas_artifacts_canvasId_kind_version_key" ON "canvas_artifacts"("canvasId", "kind", "version");
CREATE INDEX "canvas_artifacts_canvasId_createdAt_idx" ON "canvas_artifacts"("canvasId", "createdAt");
CREATE INDEX "canvas_runs_canvasId_createdAt_idx" ON "canvas_runs"("canvasId", "createdAt");
CREATE INDEX "canvas_runs_status_createdAt_idx" ON "canvas_runs"("status", "createdAt");

ALTER TABLE "canvas_artifacts"
  ADD CONSTRAINT "canvas_artifacts_canvasId_fkey"
  FOREIGN KEY ("canvasId") REFERENCES "canvas_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "canvas_runs"
  ADD CONSTRAINT "canvas_runs_canvasId_fkey"
  FOREIGN KEY ("canvasId") REFERENCES "canvas_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
