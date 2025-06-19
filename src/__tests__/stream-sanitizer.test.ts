import {
  sanitizerTestCases,
  assertSanitizerResult,
} from "./email-sanitizer-cases.js";
import { getStreamingHandlers } from "../stream-sanitizer.js";
import { createMinimalRules } from "../utils/fetchRules.js";
import { JSDOM } from "jsdom";
import { TrackerPixelRemover } from "../cleaners/TrackerPixelRemover.js";
import { jest } from "@jest/globals";

// The test suite includes cases with invalid URLs, which are expected to log warnings.
// We mock the console here to prevent that output from cluttering the test results.
beforeAll(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

// Helper: Simulate streaming sanitizer for test cases
function sanitizeEmailStreaming(html: string, rules: any, options?: any) {
  const opts = options || {};
  const cleanUrls = opts.cleanUrls !== undefined ? opts.cleanUrls : true;
  const removeTrackingPixels =
    opts.removeTrackingPixels !== undefined ? opts.removeTrackingPixels : true;
  const preserveDocumentStructure =
    opts.preserveDocumentStructure !== undefined
      ? opts.preserveDocumentStructure
      : true;
  const trackerPixelOptions = opts.trackerPixelOptions || {};

  const { linkHandler, pixelHandler } = getStreamingHandlers(rules);
  const dom = new JSDOM(html);
  let urlsCleaned = 0;
  let trackingPixelsRemoved = 0;
  let wasModified = false;
  const originalHtml = html;

  if (cleanUrls) {
    dom.window.document.querySelectorAll("a[href]").forEach((el: Element) => {
      const before = el.getAttribute("href");
      linkHandler.element(el);
      const after = el.getAttribute("href");
      if (before !== after) {
        urlsCleaned++;
        wasModified = true;
      }
    });
  }

  if (removeTrackingPixels) {
    const imgs = Array.from(dom.window.document.querySelectorAll("img"));
    for (const el of imgs) {
      const parent = el.parentNode;
      if (Object.keys(trackerPixelOptions).length > 0) {
        const remover = new TrackerPixelRemover(trackerPixelOptions);
        if (remover.isTrackingPixel(el)) {
          el.remove();
        }
      } else {
        pixelHandler.element(el);
      }
      if (parent && !el.parentNode) {
        trackingPixelsRemoved++;
        wasModified = true;
      }
    }
  }

  let resultHtml: string;
  if (preserveDocumentStructure) {
    if (wasModified) {
      resultHtml = dom.serialize();
    } else {
      resultHtml = originalHtml;
    }
  } else {
    if (wasModified) {
      resultHtml = dom.window.document.body.innerHTML.trim();
    } else {
      resultHtml = originalHtml;
    }
  }

  return {
    html: resultHtml,
    urlsCleaned,
    trackingPixelsRemoved,
    wasModified,
  };
}

describe("stream sanitizer (shared cases)", () => {
  const minimalRules = createMinimalRules();
  sanitizerTestCases.forEach((tc) => {
    it(tc.name, () => {
      const rules = tc.rules ?? minimalRules;
      const result = sanitizeEmailStreaming(tc.html, rules, tc.options);
      assertSanitizerResult(result, tc);
    });
  });
});
