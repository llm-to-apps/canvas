import "dotenv/config";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function optionalEnv(name: string, fallback: string) {
  return process.env[name] || fallback;
}

export function port() {
  return Number(optionalEnv("PORT", "4121"));
}

export function canvasPublicBaseUrl() {
  return optionalEnv("CANVAS_PUBLIC_BASE_URL", `http://localhost:${port()}`);
}

export function canvasScriptSrc() {
  return optionalSourceList(
    "CANVAS_SCRIPT_SRC",
    "'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com",
  );
}

export function canvasStyleSrc() {
  return optionalSourceList(
    "CANVAS_STYLE_SRC",
    "'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
  );
}

export function canvasConnectSrc() {
  return optionalSourceList("CANVAS_CONNECT_SRC", "'none'");
}

export function canvasS3Config() {
  return {
    accessKeyId: requiredEnv("CANVAS_S3_ACCESS_KEY_ID"),
    bucket: optionalEnv("CANVAS_S3_BUCKET", "canvas"),
    endpoint: optionalEnv("CANVAS_S3_INTERNAL_ENDPOINT", optionalEnv("CANVAS_S3_ENDPOINT", "")),
    forcePathStyle: optionalEnv("CANVAS_S3_FORCE_PATH_STYLE", "true") === "true",
    region: optionalEnv("CANVAS_S3_REGION", "us-east-1"),
    secretAccessKey: requiredEnv("CANVAS_S3_SECRET_ACCESS_KEY"),
  };
}

export function agentRuntimeUrl() {
  return optionalEnv("AGENT_RUNTIME_URL", "http://localhost:4111");
}

export function canvasInternalToken() {
  return requiredEnv("CANVAS_INTERNAL_TOKEN");
}

function optionalSourceList(name: string, fallback: string) {
  return optionalEnv(name, fallback).trim() || fallback;
}
