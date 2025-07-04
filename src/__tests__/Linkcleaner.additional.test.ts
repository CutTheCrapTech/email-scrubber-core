import { type ClearUrlRules, LinkCleaner } from "../cleaners/LinkCleaner.js";
import "jest";

// Additional test cases to add to your test suite

describe("LinkCleaner", () => {
  const mockRules: ClearUrlRules = {
    providers: {
      "google.com": {
        urlPattern: "google\\.com",
        rules: ["gclid", "gclsrc", "utm_source", "utm_medium", "utm_campaign"],
        exceptions: [
          "^https?:\\/\\/mail\\.google\\.com\\/mail\\/u\\/",
          "^https?:\\/\\/accounts\\.google\\.com\\/o\\/oauth2\\/",
        ],
        redirections: ["url"],
        referral: ["ref"],
      },
      "facebook.com": {
        urlPattern: "facebook\\.com",
        rules: ["fbclid", "utm_source", "utm_medium"],
        exceptions: [
          "^https?:\\/\\/developers\\.facebook\\.com\\/tools\\/",
          "^https?:\\/\\/business\\.facebook\\.com\\/security\\/",
        ],
      },
      "amazon.com": {
        urlPattern: "amazon\\.com",
        rules: ["ref", "tag", "linkCode"],
        redirections: ["url"],
        exceptions: [
          "^https?:\\/\\/developer\\.amazon\\.com\\/",
          "^https?:\\/\\/aws\\.amazon\\.com\\/console\\/",
        ],
      },
      "tracking-domain.com": {
        urlPattern: "tracking-domain\\.com",
        rules: ["track_id", "campaign_id"],
        exceptions: [
          "^https?:\\/\\/tracking-domain\\.com\\/admin\\/",
          "^https?:\\/\\/tracking-domain\\.com\\/api\\/v[0-9]+\\/",
        ],
      },
    },
  };

  let linkCleaner: LinkCleaner;

  beforeEach(() => {
    linkCleaner = new LinkCleaner(mockRules);
  });

  describe("Additional Test Cases", () => {
    describe("Global rules interaction", () => {
      it("should apply global rules when no specific provider matches", () => {
        const rulesWithGlobal: ClearUrlRules = {
          providers: {
            globalRules: {
              urlPattern: ".*",
              rules: ["utm_source", "utm_medium"],
            },
            "specific.com": {
              urlPattern: "specific\\.com",
              rules: ["track_id"],
            },
          },
        };

        const cleaner = new LinkCleaner(rulesWithGlobal);
        const url = "https://example.com/page?utm_source=test&other=keep";
        const result = cleaner.clean(url);

        expect(result.toString()).toBe("https://example.com/page?other=keep");
      });

      it("should apply both global and specific rules", () => {
        const rulesWithGlobal: ClearUrlRules = {
          providers: {
            globalRules: {
              urlPattern: ".*",
              rules: ["utm_source"],
            },
            "specific.com": {
              urlPattern: "specific\\.com",
              rules: ["track_id"],
            },
          },
        };

        const cleaner = new LinkCleaner(rulesWithGlobal);
        const url =
          "https://specific.com/page?utm_source=test&track_id=123&other=keep";
        const result = cleaner.clean(url);

        expect(result.toString()).toBe("https://specific.com/page?other=keep");
      });
    });

    describe("Redirection edge cases", () => {
      it("should handle circular redirections gracefully", () => {
        const url1 = encodeURIComponent(
          "https://google.com/url?url=https://amazon.com/redirect?url=ORIGINAL",
        );
        const url2 = encodeURIComponent(
          "https://amazon.com/redirect?url=https://google.com/url?url=ORIGINAL",
        );

        const circularUrl = `https://google.com/url?url=${url1.replace("ORIGINAL", url2.replace("ORIGINAL", "https://example.com/target"))}&gclid=123`;

        // Should not hang or crash
        const result = linkCleaner.clean(circularUrl);
        expect(result).toBeDefined();
      });

      it("should handle multiple redirection parameters", () => {
        const redirect1 = encodeURIComponent("https://example.com/target1");
        const redirect2 = encodeURIComponent("https://example.com/target2");

        const multiRedirectUrl = `https://google.com/url?url=${redirect1}&redirect=${redirect2}&gclid=123`;

        // Should follow the first matching redirection parameter
        const result = linkCleaner.clean(multiRedirectUrl);
        expect(result.toString()).toBe("https://example.com/target1");
      });
    });

    describe("Malformed URLs and parameters", () => {
      it("should handle malformed query parameters", () => {
        const malformedUrl =
          "https://google.com/search?gclid=&utm_source=test&=value&other=keep";
        const result = linkCleaner.clean(malformedUrl);

        // Should only remove parameters that match the configured rules
        // =value should remain because it doesn't match any tracking parameter rules
        expect(result.toString()).toBe(
          "https://google.com/search?=value&other=keep",
        );
      });

      it("should handle URLs with duplicate parameters", () => {
        const duplicateUrl =
          "https://google.com/search?gclid=123&gclid=456&other=keep";
        const result = linkCleaner.clean(duplicateUrl);

        expect(result.toString()).toBe("https://google.com/search?other=keep");
      });
    });

    describe("Provider matching edge cases", () => {
      it("should handle multiple providers matching the same URL", () => {
        const multiProviderRules: ClearUrlRules = {
          providers: {
            "generic.com": {
              urlPattern: "\\.com",
              rules: ["generic_param"],
            },
            "google.com": {
              urlPattern: "google\\.com",
              rules: ["gclid"],
            },
          },
        };

        const cleaner = new LinkCleaner(multiProviderRules);
        const url =
          "https://google.com/search?gclid=123&generic_param=456&other=keep";
        const result = cleaner.clean(url);

        // Should apply the first matching provider found in iteration order
        // Both providers match, but only one set of rules will be applied
        const hasGclid = result.searchParams.has("gclid");
        const hasGenericParam = result.searchParams.has("generic_param");

        // Either gclid OR generic_param should be removed, but not both
        // (depending on which provider matches first)
        expect(hasGclid && hasGenericParam).toBe(false);
        expect(result.searchParams.has("other")).toBe(true);
      });

      it("should handle providers with empty rules arrays", () => {
        const emptyRulesProvider: ClearUrlRules = {
          providers: {
            "empty.com": {
              urlPattern: "empty\\.com",
              rules: [],
            },
          },
        };

        const cleaner = new LinkCleaner(emptyRulesProvider);
        const url = "https://empty.com/page?param=value";
        const result = cleaner.clean(url);

        expect(result.toString()).toBe(url);
      });
    });

    describe("Exception pattern edge cases", () => {
      it("should handle exception patterns that match subdomains", () => {
        const subdomainRules: ClearUrlRules = {
          providers: {
            "example.com": {
              urlPattern: "example\\.com",
              rules: ["track"],
              exceptions: ["^https?:\\/\\/admin\\.example\\.com\\/"],
            },
          },
        };

        const cleaner = new LinkCleaner(subdomainRules);

        const adminUrl =
          "https://admin.example.com/dashboard?track=123&other=keep";
        const regularUrl = "https://www.example.com/page?track=123&other=keep";

        expect(cleaner.clean(adminUrl).toString()).toBe(adminUrl);
        expect(cleaner.clean(regularUrl).toString()).toBe(
          "https://www.example.com/page?other=keep",
        );
      });

      it("should handle overlapping exception patterns", () => {
        const overlappingRules: ClearUrlRules = {
          providers: {
            "test.com": {
              urlPattern: "test\\.com",
              rules: ["track"],
              exceptions: [
                "^https?:\\/\\/test\\.com\\/admin\\/",
                "^https?:\\/\\/test\\.com\\/admin\\/users\\/",
              ],
            },
          },
        };

        const cleaner = new LinkCleaner(overlappingRules);
        const url = "https://test.com/admin/users/123?track=456&other=keep";
        const result = cleaner.clean(url);

        expect(result.toString()).toBe(url);
      });
    });

    describe("Performance and stress tests", () => {
      it("should handle deeply nested redirections", () => {
        let nestedUrl = "https://example.com/final";

        // Create 10 levels of redirection
        for (let i = 0; i < 10; i++) {
          nestedUrl = `https://google.com/url?url=${encodeURIComponent(nestedUrl)}&gclid=${i}`;
        }

        const start = performance.now();
        const result = linkCleaner.clean(nestedUrl);
        const end = performance.now();

        expect(result.toString()).toBe("https://example.com/final");
        expect(end - start).toBeLessThan(1000); // Should complete within 1 second
      });

      it("should handle providers with many exception patterns", () => {
        const manyExceptions = Array.from(
          { length: 100 },
          (_, i) => `^https?:\\/\\/test\\.com\\/exception${i}\\/`,
        );

        const rulesWithManyExceptions: ClearUrlRules = {
          providers: {
            "test.com": {
              urlPattern: "test\\.com",
              rules: ["track"],
              exceptions: manyExceptions,
            },
          },
        };

        const cleaner = new LinkCleaner(rulesWithManyExceptions);
        const url = "https://test.com/normal?track=123&other=keep";

        const start = performance.now();
        const result = cleaner.clean(url);
        const end = performance.now();

        expect(result.toString()).toBe("https://test.com/normal?other=keep");
        expect(end - start).toBeLessThan(100); // Should complete within 100ms
      });
    });

    describe("Unicode and special characters", () => {
      it("should handle URLs with Unicode characters", () => {
        const unicodeUrl = "https://google.com/search?q=café&gclid=123";
        const result = linkCleaner.clean(unicodeUrl);

        expect(result.toString()).toBe("https://google.com/search?q=caf%C3%A9");
      });

      it("should handle URLs with special characters in parameters", () => {
        const specialUrl =
          "https://google.com/search?q=hello%20world&gclid=123&other=a%26b";
        const result = linkCleaner.clean(specialUrl);

        // Note: URL constructor normalizes %20 to + in query parameters
        expect(result.toString()).toBe(
          "https://google.com/search?q=hello+world&other=a%26b",
        );
      });
    });
  });
});
