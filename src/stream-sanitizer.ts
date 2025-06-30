import { type ClearUrlRules, LinkCleaner } from "./cleaners/LinkCleaner.js";
import {
  type SanitizableElement,
  TrackerPixelRemover,
} from "./cleaners/TrackerPixelRemover.js";

/**
 * An adapter that makes an HTMLRewriter element look like a SanitizableElement.
 * This allows us to reuse the same logic from TrackerPixelRemover.
 */
class HTMLRewriterElementAdapter implements SanitizableElement {
  constructor(private element: Element) {}

  getAttribute(name: string): string | null {
    return this.element.getAttribute(name);
  }

  hasAttribute(name: string): boolean {
    return this.element.hasAttribute(name);
  }

  removeAttribute(name: string): void {
    this.element.removeAttribute(name);
  }

  setAttribute(name: string, value: string): void {
    this.element.setAttribute(name, value);
  }

  remove(): void {
    this.element.remove();
  }
}

/**
 * Returns a set of handler objects that can be attached to an HTMLRewriter instance.
 * This function decouples the sanitization logic from the Cloudflare-specific environment.
 * The caller is responsible for creating the HTMLRewriter instance.
 *
 * @param rules The ClearURL rules for cleaning links.
 * @returns An object containing `linkHandler` and `pixelHandler` for use with `HTMLRewriter`.
 */
export function getStreamingHandlers(rules: ClearUrlRules) {
  const linkCleaner = new LinkCleaner(rules);
  const pixelRemover = new TrackerPixelRemover();

  return {
    /**
     * An HTMLRewriter element handler for sanitizing anchor (`<a>`) tags.
     * Attach to a selector like "a[href]".
     */
    linkHandler: {
      element(element: Element) {
        const href = element.getAttribute("href");
        if (href) {
          try {
            const cleanedUrl = linkCleaner.clean(href);
            element.setAttribute("href", cleanedUrl.toString());
          } catch (error) {
            console.warn(
              `Failed to clean URL during streaming: ${href}`,
              error,
            );
          }
        }
      },
    },

    /**
     * An HTMLRewriter element handler for removing tracking pixels.
     * Attach to a selector like "img".
     */
    pixelHandler: {
      element(element: Element) {
        const adapter = new HTMLRewriterElementAdapter(element);
        if (pixelRemover.isTrackingPixel(adapter)) {
          adapter.remove();
        }
      },
    },
  };
}
