import { describe, expect, it, vi } from "vitest";

import { hasInternalAuth, sha256 } from "./security.js";

vi.mock("./env.js", () => ({
  canvasInternalToken: () => "secret-token",
}));

describe("security", () => {
  it("hashes tokens with sha256", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("accepts only the configured bearer token", () => {
    expect(
      hasInternalAuth(
        new Request("http://canvas.test", {
          headers: {
            authorization: "Bearer secret-token",
          },
        }),
      ),
    ).toBe(true);

    expect(
      hasInternalAuth(
        new Request("http://canvas.test", {
          headers: {
            authorization: "Bearer wrong",
          },
        }),
      ),
    ).toBe(false);
  });
});
