/**
 * Email Sanitizer Library
 *
 * A privacy-focused email sanitizer that removes trackers and cleans URLs.
 * It can operate in two modes: buffered (for simple use cases) and streaming
 * (for high-performance environments like Cloudflare Workers).
 *
 * @example
 * // Buffered (non-streaming) usage for Node.js or similar environments:
 * ```typescript
 * import { sanitizeEmailBuffered, createMinimalRules } from 'email-sanitizer';
 *
 * const rules = createMinimalRules();
 * const originalHtml = '<a href="https://example.com/page?utm_source=news"><img src="https://track.com/pixel.gif"></a>';
 * const result = sanitizeEmailBuffered(originalHtml, rules);
 * console.log(`Cleaned ${result.urlsCleaned} URLs. Result: ${result.html}`);
 * ```
 *
 * @example
 * // Streaming usage for edge environments (e.g., Cloudflare Workers):
 * ```typescript
 * // In your Cloudflare Worker:
 * import { getStreamingHandlers, createMinimalRules } from 'email-sanitizer';
 *
 * async function handleRequest(request) {
 *   const response = await fetch(request); // Get response from origin
 *   const rules = createMinimalRules();
 *   const handlers = getStreamingHandlers(rules);
 *
 *   const rewriter = new HTMLRewriter()
 *     .on("a[href]", handlers.linkHandler)
 *     .on("img", handlers.pixelHandler);
 *
 *   return rewriter.transform(response);
 * }
 * ```
 */

// Buffered (non-streaming) functions for standard Node.js environments
export {
  sanitizeEmail as sanitizeEmailBuffered,
  sanitizeEmailSimple as sanitizeEmailSimpleBuffered,
  type SanitizeEmailOptions,
  type SanitizeEmailResult,
} from './sanitizer.js';

// Handlers for streaming environments (e.g., Cloudflare Workers)
export { getStreamingHandlers } from './stream-sanitizer.js';

// Link cleaning functionality
export { LinkCleaner, type ClearUrlRules } from './cleaners/LinkCleaner.js';

// Tracking pixel removal functionality
export {
  TrackerPixelRemover,
  type SanitizableElement,
  type TrackerPixelRemoverOptions,
} from './cleaners/TrackerPixelRemover.js';

// Utility function to fetch ClearURLs rules
export { createMinimalRules } from './utils/fetchRules.js';

// Version information
export const VERSION = '1.0.0';
