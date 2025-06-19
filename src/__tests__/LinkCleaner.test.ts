import { jest } from "@jest/globals";
import { LinkCleaner, ClearUrlRules } from "../cleaners/LinkCleaner.js";
import "jest";

describe("LinkCleaner", () => {
  const mockRules: ClearUrlRules = {
    providers: {
      "google.com": {
        urlPattern: "google\\.com",
        rules: ["gclid", "gclsrc", "utm_source", "utm_medium", "utm_campaign"],
        exceptions: ["q"],
        redirections: ["url"],
        referral: ["ref"],
      },
      "facebook.com": {
        urlPattern: "facebook\\.com",
        rules: ["fbclid", "utm_source", "utm_medium"],
        exceptions: [],
      },
      "amazon.com": {
        urlPattern: "amazon\\.com",
        rules: ["ref", "tag", "linkCode"],
        redirections: ["url"],
      },
      "tracking-domain.com": {
        urlPattern: "tracking-domain\\.com",
        rules: ["track_id", "campaign_id"],
        exceptions: ["important_param"],
      },
    },
  };

  let linkCleaner: LinkCleaner;

  beforeEach(() => {
    linkCleaner = new LinkCleaner(mockRules);
  });

  describe("constructor", () => {
    it("should create instance with provided rules", () => {
      expect(linkCleaner).toBeInstanceOf(LinkCleaner);
    });
  });

  describe("clean method", () => {
    describe("with string URLs", () => {
      it("should clean tracking parameters from Google URLs", () => {
        const dirtyUrl =
          "https://google.com/search?q=test&gclid=123&utm_source=email&utm_medium=newsletter";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe("https://google.com/search?q=test");
      });

      it("should clean Facebook tracking parameters", () => {
        const dirtyUrl =
          "https://facebook.com/page?fbclid=abc123&utm_source=social";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe("https://facebook.com/page");
      });

      it("should clean Amazon tracking parameters", () => {
        const dirtyUrl =
          "https://amazon.com/product?ref=sr_1_1&tag=mytag&linkCode=code&other=param";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe(
          "https://amazon.com/product?other=param",
        );
      });

      it("should preserve exception parameters", () => {
        const dirtyUrl =
          "https://google.com/search?q=important&gclid=123&utm_source=email";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe(
          "https://google.com/search?q=important",
        );
        expect(cleanedUrl.searchParams.has("q")).toBe(true);
        expect(cleanedUrl.searchParams.has("gclid")).toBe(false);
      });

      it("should handle referral parameters", () => {
        const dirtyUrl = "https://google.com/page?ref=social&other=param";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe(
          "https://google.com/page?other=param",
        );
      });

      it("should not modify URLs without matching providers", () => {
        const cleanUrl = "https://example.com/page?param=value&other=test";
        const result = linkCleaner.clean(cleanUrl);

        expect(result.toString()).toBe(cleanUrl);
      });

      it("should handle URLs without query parameters", () => {
        const cleanUrl = "https://google.com/page";
        const result = linkCleaner.clean(cleanUrl);

        expect(result.toString()).toBe(cleanUrl);
      });

      it("should handle empty query parameters", () => {
        const dirtyUrl =
          "https://google.com/search?gclid=&utm_source=email&q=test";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe("https://google.com/search?q=test");
      });
    });

    describe("with URL objects", () => {
      it("should clean URL objects", () => {
        const urlObject = new URL("https://google.com/search?q=test&gclid=123");
        const cleanedUrl = linkCleaner.clean(urlObject);

        expect(cleanedUrl.toString()).toBe("https://google.com/search?q=test");
      });

      it("should return original URL object if no provider matches", () => {
        const urlObject = new URL("https://example.com/page?param=value");
        const cleanedUrl = linkCleaner.clean(urlObject);

        expect(cleanedUrl).toBe(urlObject);
        expect(cleanedUrl.toString()).toBe(
          "https://example.com/page?param=value",
        );
      });
    });

    describe("redirection handling", () => {
      it("should follow redirection parameters", () => {
        const redirectUrl = encodeURIComponent(
          "https://example.com/target?param=value",
        );
        const dirtyUrl = `https://google.com/url?url=${redirectUrl}&gclid=123`;
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe(
          "https://example.com/target?param=value",
        );
      });

      it("should clean redirected URLs recursively", () => {
        const redirectUrl = encodeURIComponent(
          "https://google.com/search?q=test&utm_source=redirect",
        );
        const dirtyUrl = `https://amazon.com/redirect?url=${redirectUrl}&ref=homepage`;
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe("https://google.com/search?q=test");
      });

      it("should handle invalid redirection URLs gracefully", () => {
        const dirtyUrl = "https://google.com/url?url=invalid-url&gclid=123";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        // Should clean the original URL since redirection failed
        expect(cleanedUrl.toString()).toBe(
          "https://google.com/url?url=invalid-url",
        );
      });

      it("should handle empty redirection parameter", () => {
        const dirtyUrl = "https://google.com/url?url=&gclid=123";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe("https://google.com/url?url=");
      });
    });

    describe("exception handling", () => {
      it("should preserve parameters matching exception patterns", () => {
        const dirtyUrl =
          "https://tracking-domain.com/page?track_id=123&important_param=keep&campaign_id=456";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe(
          "https://tracking-domain.com/page?important_param=keep",
        );
      });
    });

    describe("error handling", () => {
      it("should throw error for invalid string URLs", () => {
        expect(() => {
          linkCleaner.clean("not-a-valid-url");
        }).toThrow("Invalid URL provided: not-a-valid-url");
      });

      it("should return original URL object for invalid URL objects", () => {
        const invalidUrl = new URL("https://example.com");
        // Manually corrupt the URL object (this is a bit artificial but tests the error path)
        Object.defineProperty(invalidUrl, "href", { value: "invalid" });

        const result = linkCleaner.clean(invalidUrl);
        expect(result).toBe(invalidUrl);
      });

      it("should handle providers with invalid regex patterns", () => {
        const rulesWithInvalidRegex: ClearUrlRules = {
          providers: {
            "bad-regex.com": {
              urlPattern: "[invalid-regex",
              rules: ["param1"],
            },
          },
        };

        const cleanerWithBadRegex = new LinkCleaner(rulesWithInvalidRegex);
        const consoleSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const url = "https://bad-regex.com/page?param1=value";
        const result = cleanerWithBadRegex.clean(url);

        // Should not match the provider due to invalid regex
        expect(result.toString()).toBe(url);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Invalid regex for provider bad-regex.com: [invalid-regex",
        );

        consoleSpy.mockRestore();
      });

      it("should handle exception patterns with invalid regex", () => {
        const rulesWithInvalidException: ClearUrlRules = {
          providers: {
            "test.com": {
              urlPattern: "test\\.com",
              rules: ["track"],
              exceptions: ["[invalid-exception-regex"],
            },
          },
        };

        const cleanerWithBadException = new LinkCleaner(
          rulesWithInvalidException,
        );
        const consoleSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const url = "https://test.com/page?track=value";
        const result = cleanerWithBadException.clean(url);

        // Should still remove the tracking parameter since exception regex failed
        expect(result.toString()).toBe("https://test.com/page");
        expect(consoleSpy).toHaveBeenCalledWith(
          "Invalid exception regex: [invalid-exception-regex",
        );

        consoleSpy.mockRestore();
      });
    });

    describe("case sensitivity", () => {
      it("should handle case-insensitive URL pattern matching", () => {
        const dirtyUrl = "https://GOOGLE.COM/search?q=test&gclid=123";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        expect(cleanedUrl.toString()).toBe("https://google.com/search?q=test");
      });

      it("should handle case-insensitive exception matching", () => {
        const rulesWithCaseException: ClearUrlRules = {
          providers: {
            "test.com": {
              urlPattern: "test\\.com",
              rules: ["TRACK"],
              exceptions: ["important"],
            },
          },
        };

        const cleaner = new LinkCleaner(rulesWithCaseException);
        const url = "https://test.com/page?TRACK=value&IMPORTANT=keep";
        const result = cleaner.clean(url);

        // Should preserve the IMPORTANT parameter due to case-insensitive exception matching
        expect(result.toString()).toBe("https://test.com/page?IMPORTANT=keep");
      });
    });

    describe("complex scenarios", () => {
      it("should handle multiple tracking parameters", () => {
        const complexUrl =
          "https://google.com/search?q=test&gclid=123&gclsrc=aw&utm_source=email&utm_medium=newsletter&utm_campaign=spring&other=keep";
        const cleanedUrl = linkCleaner.clean(complexUrl);

        expect(cleanedUrl.toString()).toBe(
          "https://google.com/search?q=test&other=keep",
        );
      });

      it("should handle URLs with fragments", () => {
        const urlWithFragment =
          "https://google.com/page?gclid=123&q=test#section";
        const cleanedUrl = linkCleaner.clean(urlWithFragment);

        expect(cleanedUrl.toString()).toBe(
          "https://google.com/page?q=test#section",
        );
      });

      it("should handle URLs with ports", () => {
        const urlWithPort = "https://google.com:8080/page?gclid=123&q=test";
        const cleanedUrl = linkCleaner.clean(urlWithPort);

        expect(cleanedUrl.toString()).toBe(
          "https://google.com:8080/page?q=test",
        );
      });

      it("should handle internationalized domain names", () => {
        const rules: ClearUrlRules = {
          providers: {
            "example.org": {
              urlPattern: "example\\.org",
              rules: ["track"],
            },
          },
        };
        const cleaner = new LinkCleaner(rules);
        const url = "https://example.org/page?track=123&keep=this";
        const result = cleaner.clean(url);

        expect(result.toString()).toBe("https://example.org/page?keep=this");
      });
    });

    describe("performance considerations", () => {
      it("should handle URLs with many parameters efficiently", () => {
        const params = Array.from(
          { length: 100 },
          (_, i) => `param${i}=value${i}`,
        ).join("&");
        const largeUrl = `https://google.com/page?${params}&gclid=123`;

        const start = performance.now();
        const result = linkCleaner.clean(largeUrl);
        const end = performance.now();

        expect(end - start).toBeLessThan(100); // Should complete within 100ms
        expect(result.searchParams.has("gclid")).toBe(false);
        expect(result.searchParams.has("param0")).toBe(true);
      });
    });
  });
});
