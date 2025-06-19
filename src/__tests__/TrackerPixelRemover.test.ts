import "jest";

import {
  TrackerPixelRemover,
  type TrackerPixelRemoverOptions,
} from "../cleaners/TrackerPixelRemover.js";
import { parseHTML } from "linkedom";

// Helper function to run tests
const runCleanTest = (
  html: string,
  options?: TrackerPixelRemoverOptions,
): { removedCount: number; html: string } => {
  const remover = new TrackerPixelRemover(options);
  // Create a full, valid document to avoid parsing edge cases with fragments.
  const { document } = parseHTML(
    "<!DOCTYPE html><html><head></head><body></body></html>",
  );
  // Place the test HTML inside the body.
  document.body.innerHTML = html;

  // Run the cleaner on the document.
  const removedCount = remover.clean(document);

  // Return the resulting content of the body.
  return { removedCount, html: document.body.innerHTML };
};

describe("TrackerPixelRemover", () => {
  describe("constructor", () => {
    it("should create an instance with default options", () => {
      const remover = new TrackerPixelRemover();
      expect(remover).toBeInstanceOf(TrackerPixelRemover);
    });

    it("should accept and merge custom options", () => {
      const customOptions: TrackerPixelRemoverOptions = {
        maxPixelSize: 5,
        trackingDomains: ["custom.com"],
        trackingParams: ["custom_param"],
        removeNoAltImages: false,
        removeTransparentImages: false,
      };
      const customRemover = new TrackerPixelRemover(customOptions);
      // @ts-ignore - Accessing private property for testing
      expect(customRemover.options.maxPixelSize).toBe(5);
      // @ts-ignore - Accessing private property for testing
      expect(customRemover.options.trackingDomains).toContain("custom.com");
    });
  });

  describe("clean method", () => {
    describe("basic functionality", () => {
      it("should not modify HTML if no images are present", () => {
        const html = "<div><p>Hello world</p></div>";
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(0);
        expect(result).toBe(html);
      });

      it("should preserve non-tracking images", () => {
        const html =
          '<img src="https://example.com/image.jpg" alt="Normal image" width="200" height="150">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(0);
        expect(result).toContain("<img");
      });
    });

    describe("dimension-based tracking pixel detection", () => {
      it("should remove 1x1 pixel images", () => {
        const html =
          '<img src="https://example.com/pixel.gif" width="1" height="1">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should remove images with pixel dimensions in style attribute", () => {
        const html = '<img src="pixel.gif" style="width: 1px; height: 1px;">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should respect custom maxPixelSize option", () => {
        const html = '<img src="pixel.gif" width="5" height="5">';
        const { removedCount, html: result } = runCleanTest(html, {
          maxPixelSize: 5,
        });
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });
    });

    describe("tracking domain detection", () => {
      it("should remove images from known tracking domains", () => {
        const html = '<img src="https://google-analytics.com/pixel.gif">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should remove images from subdomains of tracking domains", () => {
        const html = '<img src="https://stats.google-analytics.com/pixel.gif">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });
    });

    describe("tracking parameter detection", () => {
      it("should remove images with UTM parameters", () => {
        const html =
          '<img src="https://example.com/pixel.gif?utm_source=email&utm_campaign=newsletter">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should preserve images without tracking parameters", () => {
        const html = '<img src="https://example.com/image.jpg?id=123">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(0);
        expect(result).toContain("<img");
      });
    });

    describe("alt text detection", () => {
      it("should remove tiny images with no alt attribute", () => {
        const html = '<img src="pixel.gif" width="1" height="1">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should respect removeNoAltImages option when disabled", () => {
        const html = '<img src="pixel.gif" width="1" height="1">';
        const { removedCount, html: result } = runCleanTest(html, {
          removeNoAltImages: false,
        });
        expect(removedCount).toBe(0);
        expect(result).toContain("<img");
      });
    });

    describe("transparent image detection", () => {
      it("should remove transparent GIF data URLs", () => {
        const html =
          '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should respect removeTransparentImages option when disabled", () => {
        const html =
          '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="not a tracking pixel" width="50" height="50">';
        const { removedCount, html: result } = runCleanTest(html, {
          removeTransparentImages: false,
        });
        expect(removedCount).toBe(0);
        expect(result).toContain("<img");
      });
    });

    describe("hidden image detection", () => {
      it("should remove images with display: none", () => {
        const html = '<img src="pixel.gif" style="display: none;">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });
    });

    describe("complex HTML structures", () => {
      it("should handle images within complex HTML", () => {
        const html = `
          <div>
            <p>Some text</p>
            <img src="good-image.jpg" alt="Good image" width="200" height="150">
            <img src="https://google-analytics.com/pixel.gif" width="1" height="1">
            <span>More text</span>
          </div>
        `;
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(1);
        expect(result).toContain("good-image.jpg");
        expect(result).not.toContain("google-analytics.com");
      });
    });

    describe("edge cases and error handling", () => {
      it("should handle images without src attribute", () => {
        const html = '<img alt="no src">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(0);
        expect(result).toBe(html);
      });

      it("should handle images with empty src attribute", () => {
        const html = '<img src="" alt="empty src">';
        const { removedCount, html: result } = runCleanTest(html);
        expect(removedCount).toBe(0);
        expect(result).toBe(html);
      });
    });

    describe("custom configuration", () => {
      it("should use custom tracking domains", () => {
        const html = '<img src="https://my-custom-tracker.com/pixel.png">';
        const { removedCount, html: result } = runCleanTest(html, {
          trackingDomains: ["my-custom-tracker.com"],
        });
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });

      it("should use custom tracking parameters", () => {
        const html = '<img src="https://example.com/img.png?my_param=1">';
        const { removedCount, html: result } = runCleanTest(html, {
          trackingParams: ["my_param"],
        });
        expect(removedCount).toBe(1);
        expect(result).not.toContain("<img");
      });
    });
  });
});
