import { loadClearUrlRules, createMinimalRules } from "../utils/fetchRules.js";

function hasProviderCaseInsensitive(
  providers: Record<string, any>,
  expected: string,
): boolean {
  const keys = Object.keys(providers).map((k) => k.toLowerCase());
  return keys.includes(expected.toLowerCase());
}

describe("loadClearUrlRules", () => {
  it("should load the statically downloaded ClearURLs rules (case-insensitive check)", () => {
    const rules = loadClearUrlRules();
    expect(rules).toBeDefined();
    expect(typeof rules).toBe("object");
    expect(rules.providers).toBeDefined();
    expect(typeof rules.providers).toBe("object");
    // Check for a few well-known providers (case-insensitive)
    const expectedProviders = [
      "google",
      "facebook",
      "twitter",
      "linkedin",
      "amazon",
      "youtube",
    ];
    expectedProviders.forEach((provider) => {
      expect(hasProviderCaseInsensitive(rules.providers, provider)).toBe(true);
    });
  });
});

describe("createMinimalRules", () => {
  it("should include common tracking domains (case-insensitive check)", () => {
    const rules = createMinimalRules();
    const expectedProviders = [
      "google.com",
      "facebook.com",
      "twitter.com",
      "linkedin.com",
      "amazon.com",
      "youtube.com",
    ];
    expectedProviders.forEach((provider) => {
      expect(hasProviderCaseInsensitive(rules.providers, provider)).toBe(true);
    });
  });

  it("should have the expected structure for each provider", () => {
    const rules = createMinimalRules();
    Object.values(rules.providers).forEach((provider: any) => {
      expect(typeof provider.urlPattern).toBe("string");
      expect(Array.isArray(provider.rules)).toBe(true);
    });
  });
});
