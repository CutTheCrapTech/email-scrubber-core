import { parseHTML } from "linkedom";
import { type ClearUrlRules, LinkCleaner } from "./cleaners/LinkCleaner.js";
import {
	TrackerPixelRemover,
	type TrackerPixelRemoverOptions,
} from "./cleaners/TrackerPixelRemover.js";

/**
 * Options for the email sanitizer.
 */
export interface SanitizeEmailOptions {
	/**
	 * Options for the tracker pixel remover.
	 */
	trackerPixelOptions?: TrackerPixelRemoverOptions;

	/**
	 * Whether to clean URLs in the email.
	 * Default: true
	 */
	cleanUrls?: boolean;

	/**
	 * Whether to remove tracking pixels from the email.
	 * Default: true
	 */
	removeTrackingPixels?: boolean;

	/**
	 * Whether to preserve the original document structure.
	 * If false, only the body content will be returned.
	 * Default: true
	 */
	preserveDocumentStructure?: boolean;
}

/**
 * Result of the email sanitization process.
 */
export interface SanitizeEmailResult {
	/**
	 * The sanitized HTML content.
	 */
	html: string;

	/**
	 * Number of URLs that were cleaned.
	 */
	urlsCleaned: number;

	/**
	 * Number of tracking pixels that were removed.
	 */
	trackingPixelsRemoved: number;

	/**
	 * Whether any modifications were made to the original content.
	 */
	wasModified: boolean;
}

/**
 * Sanitizes email HTML content by cleaning URLs and removing tracking pixels.
 *
 * @param html The HTML content to sanitize.
 * @param clearUrlRules The ClearURLs rules for cleaning URLs.
 * @param options Configuration options for the sanitization process.
 * @returns The sanitization result with cleaned HTML and statistics.
 */
export function sanitizeEmail(
	html: string,
	clearUrlRules: ClearUrlRules,
	options: SanitizeEmailOptions = {},
): SanitizeEmailResult {
	const {
		trackerPixelOptions = {},
		cleanUrls = true,
		removeTrackingPixels = true,
		preserveDocumentStructure = true,
	} = options;

	// Early return for empty content
	if (!html || html.trim() === "") {
		return {
			html,
			urlsCleaned: 0,
			trackingPixelsRemoved: 0,
			wasModified: false,
		};
	}

	const result: SanitizeEmailResult = {
		html,
		urlsCleaned: 0,
		trackingPixelsRemoved: 0,
		wasModified: false,
	};

	try {
		const { document } = parseHTML(html);
		let urlsCleaned = 0;
		let trackingPixelsRemoved = 0;

		// Clean URLs if enabled
		if (cleanUrls) {
			const linkCleaner = new LinkCleaner(clearUrlRules);
			const links = document.querySelectorAll("a[href]");

			for (const link of Array.from(links)) {
				const originalHref = link.getAttribute("href");
				if (originalHref) {
					try {
						const cleanedUrl = linkCleaner.clean(originalHref);
						const cleanedHref = cleanedUrl.toString();

						if (cleanedHref !== originalHref) {
							link.setAttribute("href", cleanedHref);
							urlsCleaned++;
						}
					} catch (error) {
						// If URL cleaning fails, leave the original URL intact
						console.warn(`Failed to clean URL: ${originalHref}`, error);
					}
				}
			}
		}

		// Remove tracking pixels if enabled
		if (removeTrackingPixels) {
			const trackerRemover = new TrackerPixelRemover(trackerPixelOptions);
			trackingPixelsRemoved = trackerRemover.clean(document);
		}

		// Update result statistics
		result.urlsCleaned = urlsCleaned;
		result.trackingPixelsRemoved = trackingPixelsRemoved;
		result.wasModified = urlsCleaned > 0 || trackingPixelsRemoved > 0;

		// If modifications were made, serialize the document back to HTML
		if (result.wasModified) {
			if (!preserveDocumentStructure) {
				// If document structure is not preserved, return only the body content
				const body = document.querySelector("body");
				result.html = body ? body.innerHTML : document.toString();
			} else {
				// Otherwise, return the full document
				result.html = document.toString();
			}
		}
	} catch (error) {
		// If parsing fails, return the original HTML
		console.error("Error sanitizing email HTML:", error);
		return {
			html,
			urlsCleaned: 0,
			trackingPixelsRemoved: 0,
			wasModified: false,
		};
	}

	return result;
}

/**
 * A simplified version of sanitizeEmail that only returns the cleaned HTML.
 *
 * @param html The HTML content to sanitize.
 * @param clearUrlRules The ClearURLs rules for cleaning URLs.
 * @param options Configuration options for the sanitization process.
 * @returns The sanitized HTML content.
 */
export function sanitizeEmailSimple(
	html: string,
	clearUrlRules: ClearUrlRules,
	options: SanitizeEmailOptions = {},
): string {
	return sanitizeEmail(html, clearUrlRules, options).html;
}
