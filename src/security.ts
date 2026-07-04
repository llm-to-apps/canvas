import { createHash, timingSafeEqual } from "node:crypto";

import { canvasInternalToken } from "./env.js";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function matchesSha256(value: string, expectedHash: string) {
  return safeEqual(sha256(value), expectedHash);
}

export function hasInternalAuth(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${canvasInternalToken()}`;

  return safeEqual(header, expected);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
