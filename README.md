# OS7 Canvas Runtime

Canvas Runtime hosts agent-generated UI sessions outside the main `web` frontend.

The intended flow is:

```text
web project chat
  -> Mastra generateSandboxedUi tool call
  -> web runner creates a canvas session in canvas-runtime
  -> web runner saves the generated HTML document
  -> web opens that URL in an iframe tab
  -> canvas-runtime serves sandboxed documents, Postgres metadata, and S3 artifacts
```

This service is intentionally separate from `web`:

- Postgres stores canvas session metadata and artifact pointers.
- S3-compatible object storage stores iframe-ready HTML documents.
- Later, canvas-runtime can consume Mastra canvas streams directly when we move
  generation ownership out of `web`.

## Local

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

Health check:

```bash
curl http://localhost:4121/health
```
