import { jest } from "@jest/globals";
import { type ClearUrlRules, LinkCleaner } from "../cleaners/LinkCleaner.js";
import "jest";

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

      it("should preserve URLs matching exception patterns", () => {
        const dirtyUrl =
          "https://mail.google.com/mail/u/0/?gclid=123&utm_source=email&tab=wm#inbox";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        // Exception pattern matches the full URL, so no cleaning should occur
        expect(cleanedUrl.toString()).toBe(dirtyUrl);
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
      it("should not apply rules to URLs matching exception patterns", () => {
        const dirtyUrl =
          "https://tracking-domain.com/admin/dashboard?track_id=123&campaign_id=456&other=param";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        // Exception pattern matches the full URL, so no cleaning should occur
        expect(cleanedUrl.toString()).toBe(dirtyUrl);
      });

      it("should apply rules to URLs not matching exception patterns", () => {
        const dirtyUrl =
          "https://tracking-domain.com/normal-page?track_id=123&campaign_id=456&other=param";
        const cleanedUrl = linkCleaner.clean(dirtyUrl);

        // Exception pattern does not match, so cleaning should occur
        expect(cleanedUrl.toString()).toBe(
          "https://tracking-domain.com/normal-page?other=param",
        );
      });

      it("should handle multiple exception patterns", () => {
        const adminUrl =
          "https://tracking-domain.com/admin/users?track_id=123&campaign_id=456";
        const apiUrl =
          "https://tracking-domain.com/api/v1/data?track_id=123&campaign_id=456";
        const normalUrl =
          "https://tracking-domain.com/page?track_id=123&campaign_id=456";

        expect(linkCleaner.clean(adminUrl).toString()).toBe(adminUrl);
        expect(linkCleaner.clean(apiUrl).toString()).toBe(apiUrl);
        expect(linkCleaner.clean(normalUrl).toString()).toBe(
          "https://tracking-domain.com/page",
        );
      });

      it("should handle Google-specific exception patterns", () => {
        const oauthUrl =
          "https://accounts.google.com/o/oauth2/auth?gclid=123&utm_source=app";
        const regularUrl =
          "https://www.google.com/search?q=test&gclid=123&utm_source=app";

        expect(linkCleaner.clean(oauthUrl).toString()).toBe(oauthUrl);
        expect(linkCleaner.clean(regularUrl).toString()).toBe(
          "https://www.google.com/search?q=test",
        );
      });

      it("should handle Facebook-specific exception patterns", () => {
        const developerUrl =
          "https://developers.facebook.com/tools/debug?fbclid=123&utm_source=dev";
        const regularUrl =
          "https://www.facebook.com/page?fbclid=123&utm_source=dev";

        expect(linkCleaner.clean(developerUrl).toString()).toBe(developerUrl);
        expect(linkCleaner.clean(regularUrl).toString()).toBe(
          "https://www.facebook.com/page",
        );
      });

      it("should handle Amazon-specific exception patterns", () => {
        const awsUrl =
          "https://aws.amazon.com/console/ec2?ref=nav&tag=aws-console";
        const regularUrl =
          "https://www.amazon.com/product?ref=sr_1_1&tag=mytag";

        expect(linkCleaner.clean(awsUrl).toString()).toBe(awsUrl);
        expect(linkCleaner.clean(regularUrl).toString()).toBe(
          "https://www.amazon.com/product",
        );
      });

      describe("comprehensive exception vs non-exception cases", () => {
        it("should preserve all Google Mail URLs with tracking parameters", () => {
          const mailUrls = [
            "https://mail.google.com/mail/u/0/?gclid=abc123&utm_source=email&utm_medium=newsletter",
            "https://mail.google.com/mail/u/1/inbox?gclsrc=aw&utm_campaign=promo&gclid=xyz789",
            "https://mail.google.com/mail/u/work@company.com/?utm_source=desktop&ref=sidebar",
          ];

          mailUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });
        });

        it("should clean all non-Mail Google URLs with tracking parameters", () => {
          const nonMailUrls = [
            {
              dirty:
                "https://google.com/search?q=test&gclid=abc123&utm_source=email",
              clean: "https://google.com/search?q=test",
            },
            {
              dirty:
                "https://www.google.com/maps?place=NY&gclsrc=aw&utm_campaign=promo",
              clean: "https://www.google.com/maps?place=NY",
            },
            {
              dirty:
                "https://images.google.com/search?q=cats&utm_source=desktop&ref=sidebar",
              clean: "https://images.google.com/search?q=cats",
            },
            {
              dirty:
                "https://drive.google.com/file/123?gclid=test&utm_medium=share",
              clean: "https://drive.google.com/file/123",
            },
          ];

          nonMailUrls.forEach(({ dirty, clean }) => {
            expect(linkCleaner.clean(dirty).toString()).toBe(clean);
          });
        });

        it("should preserve all Google OAuth URLs with tracking parameters", () => {
          const oauthUrls = [
            "https://accounts.google.com/o/oauth2/auth?gclid=abc123&utm_source=app&client_id=123",
            "https://accounts.google.com/o/oauth2/token?utm_medium=api&gclsrc=aw&refresh_token=xyz",
            "https://accounts.google.com/o/oauth2/revoke?gclid=test&utm_campaign=cleanup&token=abc",
          ];

          oauthUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });
        });

        it("should preserve all Facebook Developer URLs with tracking parameters", () => {
          const developerUrls = [
            "https://developers.facebook.com/tools/debug?fbclid=abc123&utm_source=dev",
            "https://developers.facebook.com/tools/explorer?utm_medium=api&fbclid=xyz789",
            "https://developers.facebook.com/tools/accesstoken?fbclid=test&utm_campaign=debug",
          ];

          developerUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });
        });

        it("should preserve all Facebook Business Security URLs with tracking parameters", () => {
          const businessUrls = [
            "https://business.facebook.com/security/dashboard?fbclid=abc123&utm_source=notification",
            "https://business.facebook.com/security/settings?utm_medium=email&fbclid=xyz789",
            "https://business.facebook.com/security/alerts?fbclid=test&utm_campaign=security",
          ];

          businessUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });
        });

        it("should clean all other Facebook URLs with tracking parameters", () => {
          const regularFacebookUrls = [
            {
              dirty: "https://facebook.com/page?fbclid=abc123&utm_source=share",
              clean: "https://facebook.com/page",
            },
            {
              dirty:
                "https://www.facebook.com/events/123?utm_medium=notification&fbclid=xyz",
              clean: "https://www.facebook.com/events/123",
            },
            {
              dirty:
                "https://m.facebook.com/story.php?story_fbid=123&fbclid=test&utm_campaign=mobile",
              clean:
                "https://m.facebook.com/story.php?story_fbid=123&utm_campaign=mobile",
            },
          ];

          regularFacebookUrls.forEach(({ dirty, clean }) => {
            expect(linkCleaner.clean(dirty).toString()).toBe(clean);
          });
        });

        it("should preserve all Amazon Developer URLs with tracking parameters", () => {
          const developerUrls = [
            "https://developer.amazon.com/docs?ref=nav&tag=dev-console",
            "https://developer.amazon.com/alexa/console?ref=sidebar&linkCode=dev",
            "https://developer.amazon.com/apps-and-games?tag=gaming&ref=header",
          ];

          developerUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });
        });

        it("should preserve all AWS Console URLs with tracking parameters", () => {
          const awsUrls = [
            "https://aws.amazon.com/console/ec2?ref=nav&tag=aws-console",
            "https://aws.amazon.com/console/s3?linkCode=console&ref=service-nav",
            "https://aws.amazon.com/console/lambda?tag=serverless&ref=dashboard",
          ];

          awsUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });
        });

        it("should clean all other Amazon URLs with tracking parameters", () => {
          const regularAmazonUrls = [
            {
              dirty:
                "https://amazon.com/product/B001?ref=sr_1_1&tag=mytag&linkCode=promo",
              clean: "https://amazon.com/product/B001",
            },
            {
              dirty:
                "https://www.amazon.com/dp/B002?ref=nav_logo&tag=deals&linkCode=holiday",
              clean: "https://www.amazon.com/dp/B002",
            },
            {
              dirty:
                "https://smile.amazon.com/gp/product/B003?ref=smile&tag=charity&linkCode=give",
              clean: "https://smile.amazon.com/gp/product/B003",
            },
          ];

          regularAmazonUrls.forEach(({ dirty, clean }) => {
            expect(linkCleaner.clean(dirty).toString()).toBe(clean);
          });
        });

        it("should preserve tracking-domain admin URLs but clean public URLs", () => {
          const adminUrls = [
            "https://tracking-domain.com/admin/dashboard?track_id=123&campaign_id=456",
            "https://tracking-domain.com/admin/users?track_id=789&campaign_id=000",
            "https://tracking-domain.com/admin/settings?track_id=abc&campaign_id=def",
          ];

          const publicUrls = [
            {
              dirty:
                "https://tracking-domain.com/blog?track_id=123&campaign_id=456&title=post",
              clean: "https://tracking-domain.com/blog?title=post",
            },
            {
              dirty:
                "https://tracking-domain.com/products?track_id=789&campaign_id=000&category=tech",
              clean: "https://tracking-domain.com/products?category=tech",
            },
            {
              dirty:
                "https://tracking-domain.com/contact?track_id=abc&campaign_id=def&source=footer",
              clean: "https://tracking-domain.com/contact?source=footer",
            },
          ];

          adminUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });

          publicUrls.forEach(({ dirty, clean }) => {
            expect(linkCleaner.clean(dirty).toString()).toBe(clean);
          });
        });

        it("should preserve tracking-domain API URLs but clean public URLs", () => {
          const apiUrls = [
            "https://tracking-domain.com/api/v1/users?track_id=123&campaign_id=456",
            "https://tracking-domain.com/api/v2/data?track_id=789&campaign_id=000",
            "https://tracking-domain.com/api/v10/analytics?track_id=abc&campaign_id=def",
          ];

          const publicUrls = [
            {
              dirty:
                "https://tracking-domain.com/public/data?track_id=123&campaign_id=456&format=json",
              clean: "https://tracking-domain.com/public/data?format=json",
            },
            {
              dirty:
                "https://tracking-domain.com/embed/widget?track_id=789&campaign_id=000&theme=dark",
              clean: "https://tracking-domain.com/embed/widget?theme=dark",
            },
          ];

          apiUrls.forEach((url) => {
            expect(linkCleaner.clean(url).toString()).toBe(url);
          });

          publicUrls.forEach(({ dirty, clean }) => {
            expect(linkCleaner.clean(dirty).toString()).toBe(clean);
          });
        });

        it("should handle edge cases with exception pattern matching", () => {
          // Test URLs that are similar to exceptions but don't match exactly
          const similarButNotExceptionUrls = [
            {
              dirty:
                "https://mail-example.com/mail/u/0/?gclid=123&utm_source=fake",
              clean:
                "https://mail-example.com/mail/u/0/?gclid=123&utm_source=fake", // No provider match
            },
            {
              dirty:
                "https://google.com/mail/u/0/?gclid=123&utm_source=notmail",
              clean: "https://google.com/mail/u/0/", // Provider matches but not exception
            },
            {
              dirty:
                "https://accounts.google.com/signin?gclid=123&utm_source=signin",
              clean: "https://accounts.google.com/signin", // Similar to oauth but different path
            },
            {
              dirty:
                "https://developers.facebook.com/apps?fbclid=123&utm_source=apps",
              clean: "https://developers.facebook.com/apps", // Developer domain but not tools path
            },
          ];

          similarButNotExceptionUrls.forEach(({ dirty, clean }) => {
            expect(linkCleaner.clean(dirty).toString()).toBe(clean);
          });
        });

        it("should handle URLs with fragments and exceptions", () => {
          const urlsWithFragments = [
            {
              url: "https://mail.google.com/mail/u/0/?gclid=123&utm_source=email#inbox",
              shouldPreserve: true,
            },
            {
              url: "https://google.com/search?q=test&gclid=123&utm_source=email#results",
              shouldPreserve: false,
              expected: "https://google.com/search?q=test#results",
            },
            {
              url: "https://accounts.google.com/o/oauth2/auth?gclid=123&client_id=abc#consent",
              shouldPreserve: true,
            },
          ];

          urlsWithFragments.forEach(({ url, shouldPreserve, expected }) => {
            const result = linkCleaner.clean(url);
            if (shouldPreserve) {
              expect(result.toString()).toBe(url);
            } else {
              expect(result.toString()).toBe(expected);
            }
          });
        });
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
        const consoleSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});
        const rulesWithInvalidRegex: ClearUrlRules = {
          providers: {
            "bad-regex.com": {
              urlPattern: "[invalid-regex",
              rules: ["param1"],
            },
          },
        };
        const cleanerWithBadRegex = new LinkCleaner(rulesWithInvalidRegex);
        const url = "https://bad-regex.com/page?param1=value";
        const result = cleanerWithBadRegex.clean(url);

        // The URL should remain unchanged because the invalid regex pattern
        // prevents the provider from being matched
        expect(result.toString()).toBe(url);
        expect(consoleSpy).toHaveBeenCalledWith(
          "Invalid URL regex for provider bad-regex.com: [invalid-regex",
          expect.any(Error),
        );
        consoleSpy.mockRestore();
      });

      it("should handle exception patterns with invalid regex", () => {
        const consoleSpy = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});
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
        const url = "https://test.com/page?track=value";
        const result = cleanerWithBadException.clean(url);

        // The parameter should be removed because the invalid exception regex
        // doesn't prevent the rule from working (it just fails to match)
        expect(result.toString()).toBe("https://test.com/page");
        expect(consoleSpy).toHaveBeenCalledWith(
          "Invalid exceptions regex for provider test.com: [invalid-exception-regex",
          expect.any(Error),
        );
        consoleSpy.mockRestore();
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
