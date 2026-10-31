import { describe, expect, it } from "vitest";
import { buildTemplateVariants } from "./content";

describe("content generation fallback", () => {
  it("creates three distinct tones for a topic", () => {
    const variants = buildTemplateVariants("creator workflows");
    expect(variants).toHaveLength(3);
    expect(variants.map(variant => variant.tone)).toEqual(["professional", "casual", "punchy"]);
    expect(variants.every(variant => variant.body.includes("creator workflows"))).toBe(true);
  });
});
