// Shared test cases for sanitizer and stream-sanitizer

import type { ClearUrlRules } from "../cleaners/LinkCleaner.js";
import type {
  SanitizeEmailOptions,
  SanitizeEmailResult,
} from "../sanitizer.js";
import { createMinimalRules } from "../utils/fetchRules.js";

export interface SanitizerTestCase {
  name: string;
  html: string;
  rules?: ClearUrlRules;
  options?: SanitizeEmailOptions;
  expectedHtml?: string;
  contains?: string[];
  notContains?: string[];
  expectedStats: {
    urlsCleaned: number;
    trackingPixelsRemoved: number;
    wasModified: boolean;
  };
  customAssert?: (result: SanitizeEmailResult) => void;
}

const minimalRules = createMinimalRules();
const mockClearUrlRules: ClearUrlRules = {
  providers: {
    "google.com": {
      urlPattern: "google\\.com",
      rules: ["gclid", "utm_source", "utm_medium", "utm_campaign"],
      exceptions: ["^https?:\\/\\/google\\.com\\/search\\?q=important&gclid="], // Proper regex pattern
    },
    "facebook.com": {
      urlPattern: "facebook\\.com",
      rules: ["fbclid", "utm_source"],
    },
    "tracking-domain.com": {
      urlPattern: "tracking-domain\\.com",
      rules: ["track_id"],
    },
  },
};

export const sanitizerTestCases: SanitizerTestCase[] = [
  // Basic functionality
  {
    name: "should return original HTML if no modifications needed",
    html: "<div><p>Hello world</p></div>",
    rules: mockClearUrlRules,
    expectedHtml: "<div><p>Hello world</p></div>",
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should handle empty HTML input",
    html: "",
    rules: mockClearUrlRules,
    expectedHtml: "",
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should handle whitespace-only HTML input",
    html: "   ",
    rules: mockClearUrlRules,
    expectedHtml: "   ",
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  // URL cleaning functionality
  {
    name: "should clean tracking parameters from URLs",
    html: '<a href="https://google.com/search?q=test&gclid=123&utm_source=email">Search</a>',
    rules: mockClearUrlRules,
    contains: ['href="https://google.com/search?q=test"'],
    notContains: ["gclid", "utm_source"],
    expectedStats: {
      urlsCleaned: 1,
      trackingPixelsRemoved: 0,
      wasModified: true,
    },
  },
  {
    name: "should not clean URLs matching an exception pattern",
    html: '<a href="https://google.com/search?q=important&gclid=123">Important Search</a>',
    rules: mockClearUrlRules,
    contains: ['href="https://google.com/search?q=important&gclid=123"'],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should not clean URLs matching an exception pattern - 2",
    html: '<a href="https://google.com/search?q=important&gclid=123">Important Search</a>',
    rules: {
      providers: {
        "google.com": {
          urlPattern: "google\\.com",
          rules: ["gclid", "utm_source", "utm_medium", "utm_campaign"],
          exceptions: [
            "^https:\\/\\/google\\.com\\/search\\?q=important&gclid=123$",
          ], // Exact match regex
        },
      },
    },
    contains: ['href="https://google.com/search?q=important&gclid=123"'],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should clean multiple URLs in the same document",
    html: `
        <div>
          <a href="https://google.com/page1?gclid=123">Link 1</a>
          <a href="https://facebook.com/page2?fbclid=456">Link 2</a>
          <a href="https://example.com/clean">Clean Link</a>
        </div>
      `,
    rules: mockClearUrlRules,
    contains: [
      'href="https://google.com/page1"' /* gclid removed */,
      'href="https://facebook.com/page2"' /* fbclid removed */,
      'href="https://example.com/clean"' /* unchanged */,
    ],
    notContains: ["gclid=", "fbclid="],
    expectedStats: {
      urlsCleaned: 2,
      trackingPixelsRemoved: 0,
      wasModified: true,
    },
  },
  {
    name: "should preserve URLs without tracking parameters",
    html: '<a href="https://example.com/page?param=value">Clean Link</a>',
    rules: mockClearUrlRules,
    contains: ['href="https://example.com/page?param=value"'],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should handle malformed URLs gracefully",
    html: '<a href="not-a-valid-url">Invalid Link</a>',
    rules: mockClearUrlRules,
    contains: ['href="not-a-valid-url"'],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
    customAssert: () => {
      // If you need to check for console.warn, remove the suppression
      // from sanitizer.test.ts and stream-sanitizer.test.ts
    },
  },
  {
    name: "should apply default cleaning rules to a domain not in the providers list",
    html: `<a href="https://a-random-site.net/some/path?utm_source=some-ad&id=real">Click Here</a>`,
    rules: minimalRules,
    contains: ['href="https://a-random-site.net/some/path?id=real"'],
    notContains: ["utm_source"],
    expectedStats: {
      urlsCleaned: 1,
      trackingPixelsRemoved: 0,
      wasModified: true,
    },
  },
  // Tracking pixel removal functionality
  {
    name: "should remove tracking pixels",
    html: `
        <div>
          <p>Content</p>
          <img src="https://google-analytics.com/pixel.gif" width="1" height="1">
          <img src="https://example.com/image.jpg" alt="Real image" width="200" height="150">
        </div>
      `,
    rules: mockClearUrlRules,
    contains: ["example.com/image.jpg"],
    notContains: ["google-analytics.com"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  {
    name: "should remove multiple tracking pixels",
    html: `
        <div>
          <img src="https://google-analytics.com/pixel1.gif" width="1" height="1">
          <img src="https://facebook.com/pixel2.gif">
          <img src="https://doubleclick.net/pixel3.gif" style="width: 1px; height: 1px;">
        </div>
      `,
    rules: mockClearUrlRules,
    notContains: ["google-analytics.com", "facebook.com", "doubleclick.net"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 3,
      wasModified: true,
    },
  },
  {
    name: "should preserve legitimate images",
    html: `
        <div>
          <img src="https://example.com/logo.jpg" alt="Company Logo" width="100" height="50">
          <img src="https://cdn.example.com/banner.png" alt="Banner" width="728" height="90">
        </div>
      `,
    rules: mockClearUrlRules,
    contains: ["logo.jpg", "banner.png"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  // Combined functionality
  {
    name: "should clean URLs and remove tracking pixels simultaneously",
    html: `
        <div>
          <a href="https://google.com/page?gclid=123&utm_source=email">Tracked Link</a>
          <img src="https://google-analytics.com/pixel.gif" width="1" height="1">
          <p>Content</p>
          <a href="https://example.com/clean">Clean Link</a>
          <img src="https://example.com/image.jpg" alt="Real image">
        </div>
      `,
    rules: mockClearUrlRules,
    contains: [
      'href="https://google.com/page"' /* gclid removed */,
      'href="https://example.com/clean"' /* unchanged */,
      'alt="Real image"' /* legitimate image preserved */,
    ],
    notContains: ["gclid=", "google-analytics.com"],
    expectedStats: {
      urlsCleaned: 1,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  // --- Migrated from sanitizer_old.test.ts ---
  {
    name: "should handle complex email with multiple tracking elements",
    html: `
      <!DOCTYPE html>
      <html>
        <head><title>Email</title></head>
        <body>
          <div style="font-family: Arial, sans-serif;">
            <h1>Newsletter</h1>
            <p>Check out our <a href="https://google.com/products?utm_source=newsletter&utm_campaign=spring&gclid=abc123">latest products</a>!</p>
            <table>
              <tr>
                <td><img src="https://example.com/product1.jpg" alt="Product 1" width="200" height="200"></td>
                <td><img src="https://example.com/product2.jpg" alt="Product 2" width="200" height="200"></td>
              </tr>
            </table>
            <p>Visit our <a href="https://facebook.com/page?fbclid=xyz789&utm_medium=social">Facebook page</a> for more updates.</p>
            <!-- Tracking pixels -->
            <img src="https://google-analytics.com/collect?tid=UA-12345&cid=abcdef" width="1" height="1">
            <img src="https://facebook.com/tr?id=123456&ev=PageView" style="display: none;">
            <img src="https://mailchimp.com/pixel.gif?utm_source=mailchimp">
          </div>
        </body>
      </html>
    `,
    rules: mockClearUrlRules,
    contains: [
      'href="https://google.com/products"' /* utm_source, gclid removed */,
      'href="https://facebook.com/page?utm_medium=social"' /* fbclid removed */,
      "product1.jpg",
      "product2.jpg",
      "Newsletter",
      "latest products",
    ],
    notContains: [
      "utm_source=newsletter",
      "gclid=",
      "fbclid=",
      "google-analytics.com",
      "facebook.com/tr",
      "mailchimp.com",
    ],
    expectedStats: {
      urlsCleaned: 2,
      trackingPixelsRemoved: 3,
      wasModified: true,
    },
  },
  {
    name: "should skip URL cleaning when cleanUrls is false",
    html: '<a href="https://google.com/page?gclid=123">Link</a>',
    rules: mockClearUrlRules,
    options: { cleanUrls: false },
    contains: ["gclid=123"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should clean URLs when cleanUrls is true (default)",
    html: '<a href="https://google.com/page?gclid=123">Link</a>',
    rules: mockClearUrlRules,
    options: { cleanUrls: true },
    notContains: ["gclid=123"],
    expectedStats: {
      urlsCleaned: 1,
      trackingPixelsRemoved: 0,
      wasModified: true,
    },
  },
  {
    name: "should skip pixel removal when removeTrackingPixels is false",
    html: '<img src="https://google-analytics.com/pixel.gif" width="1" height="1">',
    rules: mockClearUrlRules,
    options: { removeTrackingPixels: false },
    contains: ["google-analytics.com"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should remove pixels when removeTrackingPixels is true (default)",
    html: '<img src="https://google-analytics.com/pixel.gif" width="1" height="1">',
    rules: mockClearUrlRules,
    options: { removeTrackingPixels: true },
    notContains: ["google-analytics.com"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  {
    name: "should preserve full document structure when true (default)",
    html: "<!DOCTYPE html><html><head><title>Test</title></head><body><p>Content</p></body></html>",
    rules: mockClearUrlRules,
    options: { preserveDocumentStructure: true },
    contains: ["<!DOCTYPE html>", "<html>", "<head>", "<title>"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should extract body content when preserveDocumentStructure is false and modifications were made",
    html: `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <p>Content</p>
          <img src="https://google-analytics.com/pixel.gif" width="1" height="1">
        </body>
      </html>
    `,
    rules: mockClearUrlRules,
    options: { preserveDocumentStructure: false },
    notContains: ["<!DOCTYPE html>", "<html>", "<head>"],
    contains: ["<p>Content</p>"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  {
    name: "should return full document when preserveDocumentStructure is false but no modifications were made",
    html: "<!DOCTYPE html><html><head><title>Test</title></head><body><p>Content</p></body></html>",
    rules: mockClearUrlRules,
    options: { preserveDocumentStructure: false },
    expectedHtml:
      "<!DOCTYPE html><html><head><title>Test</title></head><body><p>Content</p></body></html>",
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should pass options to TrackerPixelRemover",
    html: '<img src="https://example.com/pixel.gif" width="5" height="5">',
    rules: mockClearUrlRules,
    options: { trackerPixelOptions: { maxPixelSize: 10 } },
    notContains: ["<img"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  {
    name: "should handle malformed HTML gracefully",
    html: '<div><p>Unclosed tags<img src="test"',
    rules: mockClearUrlRules,
    contains: ["Unclosed tags"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should handle body extraction failure gracefully",
    html: '<img src="https://google-analytics.com/pixel.gif" width="1" height="1">',
    rules: mockClearUrlRules,
    options: { preserveDocumentStructure: false },
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  {
    name: "should handle HTML with no links or images",
    html: "<div><h1>Title</h1><p>Just text content with <strong>formatting</strong>.</p></div>",
    rules: mockClearUrlRules,
    expectedHtml:
      "<div><h1>Title</h1><p>Just text content with <strong>formatting</strong>.</p></div>",
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should handle HTML with only clean links and legitimate images",
    html: `
      <div>
        <a href="https://example.com/page">Clean Link</a>
        <img src="https://example.com/image.jpg" alt="Image" width="200" height="150">
      </div>
    `,
    rules: mockClearUrlRules,
    contains: ["example.com/page", "example.com/image.jpg"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  {
    name: "should handle very large HTML documents",
    html: `<div>${"content ".repeat(10000)}<img src="https://google-analytics.com/pixel.gif" width="1" height="1"></div>`,
    rules: mockClearUrlRules,
    notContains: ["google-analytics.com"],
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 1,
      wasModified: true,
    },
  },
  {
    name: "should handle HTML with special characters and encoding",
    html: `
      <div>
        <p>Special chars: àáâãäåæçèéêë</p>
        <a href="https://google.com/somepath?q=test%20query&gclid=123">Search Query</a>
        <img src="https://example.com/image.jpg?param=value%20with%20spaces" alt="Image with spaces">
      </div>
    `,
    rules: mockClearUrlRules,
    contains: [
      "àáâãäåæçèéêë",
      'href="https://google.com/somepath?q=test+query"',
      'src="https://example.com/image.jpg?param=value%20with%20spaces"',
    ],
    notContains: ["gclid"],
    expectedStats: {
      urlsCleaned: 1,
      trackingPixelsRemoved: 0,
      wasModified: true,
    },
  },
  {
    name: "should accurately count cleaned URLs",
    html: `
      <div>
        <a href="https://google.com/page1?gclid=123">Link 1</a>
        <a href="https://facebook.com/page2?fbclid=456">Link 2</a>
        <a href="https://tracking-domain.com/page3?track_id=789">Link 3</a>
        <a href="https://example.com/clean">Clean Link</a>
      </div>
    `,
    rules: mockClearUrlRules,
    expectedStats: {
      urlsCleaned: 3,
      trackingPixelsRemoved: 0,
      wasModified: true,
    },
  },
  {
    name: "should accurately count removed tracking pixels",
    html: `
      <div>
        <img src="https://google-analytics.com/pixel1.gif" width="1" height="1">
        <img src="https://facebook.com/pixel2.gif">
        <img src="https://example.com/legitimate.jpg" alt="Legitimate" width="200" height="150">
        <img src="https://doubleclick.net/pixel3.gif" style="display: none;">
      </div>
    `,
    rules: mockClearUrlRules,
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 3,
      wasModified: true,
    },
  },
  {
    name: "should set wasModified correctly",
    html: "<div><p>Clean content</p></div>",
    rules: mockClearUrlRules,
    expectedStats: {
      urlsCleaned: 0,
      trackingPixelsRemoved: 0,
      wasModified: false,
    },
  },
  // ... (add any remaining cases as needed)
];

export function assertSanitizerResult(
  result: SanitizeEmailResult,
  testCase: SanitizerTestCase,
) {
  if (testCase.expectedHtml !== undefined) {
    expect(result.html.replace(/\s+/g, "")).toBe(
      testCase.expectedHtml.replace(/\s+/g, ""),
    );
  }
  if (testCase.contains) {
    for (const str of testCase.contains) {
      expect(result.html).toContain(str);
    }
  }
  if (testCase.notContains) {
    for (const str of testCase.notContains) {
      expect(result.html).not.toContain(str);
    }
  }
  expect(result.urlsCleaned).toBe(testCase.expectedStats.urlsCleaned);
  expect(result.trackingPixelsRemoved).toBe(
    testCase.expectedStats.trackingPixelsRemoved,
  );
  expect(result.wasModified).toBe(testCase.expectedStats.wasModified);
  if (testCase.customAssert) testCase.customAssert(result);
}
