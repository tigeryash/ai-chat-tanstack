import { afterEach, describe, expect, it, vi } from "vitest";
import { generateShareId, SHARE_ID_LENGTH } from "./shareId";

describe("convex/lib/shareId.ts generateShareId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns URL-safe IDs with at least 128 bits of randomness", () => {
    const id = generateShareId();

    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).toHaveLength(SHARE_ID_LENGTH);
    expect(SHARE_ID_LENGTH * 6).toBeGreaterThanOrEqual(128);
  });

  it("draws from crypto.getRandomValues, not Math.random", () => {
    const getRandomValues = vi.spyOn(crypto, "getRandomValues");
    // The old generator, under a predictable Math.random, made the same ID every time.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const ids = new Set(Array.from({ length: 1000 }, () => generateShareId()));

    expect(getRandomValues).toHaveBeenCalled();
    expect(ids.size).toBe(1000);
  });

  it("maps every random byte onto the alphabet", () => {
    const bytes = Array.from({ length: SHARE_ID_LENGTH }, (_, i) => i * 11);
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).set(bytes);
      return array;
    });

    expect(generateShareId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});
