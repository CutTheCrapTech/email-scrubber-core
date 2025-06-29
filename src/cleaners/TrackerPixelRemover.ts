/**
 * A generic interface representing an element that can be sanitized.
 * This allows the logic to work with different HTML parsing backends,
 * such as `linkedom` for buffered parsing and `HTMLRewriter` for streaming.
 */
export interface SanitizableElement {
	getAttribute(name: string): string | null;
	hasAttribute(name: string): boolean;
	removeAttribute(name: string): void;
	setAttribute(name: string, value: string): void;
	remove(): void;
}

/**
 * Configuration options for the TrackerPixelRemover.
 */
export interface TrackerPixelRemoverOptions {
	/**
	 * Maximum width/height in pixels to consider as a tracking pixel.
	 * Default: 2
	 */
	maxPixelSize?: number;

	/**
	 * Known tracking domains to remove images from.
	 */
	trackingDomains?: string[];

	/**
	 * Query parameters that indicate tracking.
	 */
	trackingParams?: string[];

	/**
	 * Whether to remove images with no alt text (common for tracking pixels).
	 * Default: true
	 */
	removeNoAltImages?: boolean;

	/**
	 * Whether to remove transparent images (common for tracking pixels).
	 * Default: true
	 */
	removeTransparentImages?: boolean;
}

/**
 * Default configuration for the TrackerPixelRemover.
 */
const DEFAULT_OPTIONS: Required<TrackerPixelRemoverOptions> = {
	maxPixelSize: 2,
	trackingDomains: [
		"google-analytics.com",
		"googletagmanager.com",
		"doubleclick.net",
		"facebook.com",
		"connect.facebook.net",
		"scorecardresearch.com",
		"quantserve.com",
		"outbrain.com",
		"taboola.com",
		"adsystem.com",
		"amazon-adsystem.com",
		"googlesyndication.com",
		"googleadservices.com",
		"twitter.com",
		"linkedin.com",
		"pinterest.com",
		"snapchat.com",
		"tiktok.com",
		"hubspot.com",
		"mailchimp.com",
		"constantcontact.com",
		"sendgrid.net",
		"mailgun.org",
		"createsend.com",
		"campaign-monitor.com",
		"aweber.com",
		"getresponse.com",
		"convertkit.com",
		"activecampaign.com",
		"drip.com",
		"klaviyo.com",
		"omnisend.com",
		"sendinblue.com",
		"emailoctopus.com",
		"moosend.com",
		"pardot.com",
		"marketo.com",
		"eloqua.com",
		"salesforce.com",
	],
	trackingParams: [
		"utm_source",
		"utm_medium",
		"utm_campaign",
		"utm_content",
		"utm_term",
		"fbclid",
		"gclid",
		"msclkid",
		"twclid",
		"li_fat_id",
		"mc_cid",
		"mc_eid",
		"_hsenc",
		"_hsmi",
		"mkt_tok",
		"vero_id",
		"vero_conv",
		"email_id",
		"recipient_id",
		"list_id",
		"campaign_id",
		"message_id",
		"subscriber_id",
		"tracking_id",
		"pixel_id",
		"beacon_id",
	],
	removeNoAltImages: true,
	removeTransparentImages: true,
};

/**
 * A class for removing tracking pixels from email HTML content.
 */
export class TrackerPixelRemover {
	private readonly options: Required<TrackerPixelRemoverOptions>;

	/**
	 * Creates an instance of the TrackerPixelRemover.
	 * @param options Configuration options for the tracker pixel remover.
	 */
	constructor(options: TrackerPixelRemoverOptions = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	/**
	 * Removes tracking pixels from a DOM document.
	 * @param document The DOM document to clean.
	 * @returns The number of tracking pixels removed.
	 */
	public clean(document: Document): number {
		// Find all img elements
		const images = document.querySelectorAll("img");
		const imagesToRemove: (Element & SanitizableElement)[] = [];

		for (const img of Array.from(images)) {
			if (this.isTrackingPixel(img)) {
				imagesToRemove.push(img);
			}
		}

		// Remove identified tracking pixels
		for (const img of imagesToRemove) {
			img.remove();
		}

		return imagesToRemove.length;
	}

	/**
	 * Determines if an image element is likely a tracking pixel.
	 * @param img The image element to analyze.
	 * @returns True if the image is likely a tracking pixel.
	 */
	isTrackingPixel(img: SanitizableElement): boolean {
		// Definitive tracking indicators - remove if any of these are true

		// Check if image source contains tracking domains
		if (this.hasTrackingDomain(img)) {
			return true;
		}

		// Check if image URL contains tracking parameters
		if (this.hasTrackingParameters(img)) {
			return true;
		}

		// Check if image is hidden via CSS
		if (this.isHidden(img)) {
			return true;
		}

		// Less definitive indicators - need multiple signals
		const hasSmallDimensions = this.hasTrackingPixelDimensions(img);
		const hasNoAlt = this.options.removeNoAltImages && this.hasNoAltText(img);
		const isTransparent =
			this.options.removeTransparentImages && this.isTransparent(img);

		// Remove if it has small dimensions and no alt text
		if (hasSmallDimensions && hasNoAlt) {
			return true;
		}

		// Remove if it's transparent and has no alt text
		if (isTransparent && hasNoAlt) {
			return true;
		}

		// Remove if it has small dimensions and is transparent
		if (hasSmallDimensions && isTransparent) {
			return true;
		}

		return false;
	}

	/**
	 * Checks if an image has tracking pixel dimensions.
	 * @param img The image element to check.
	 * @returns True if the image has tracking pixel dimensions.
	 */
	private hasTrackingPixelDimensions(img: SanitizableElement): boolean {
		const width = this.getDimension(img.getAttribute("width"));
		const height = this.getDimension(img.getAttribute("height"));

		// Check explicit width/height attributes
		if (width !== null && height !== null) {
			return (
				width <= this.options.maxPixelSize &&
				height <= this.options.maxPixelSize
			);
		}

		// Check style attribute
		const style = img.getAttribute("style");
		if (style) {
			const widthMatch = style.match(/width\s*:\s*(\d+)px/i);
			const heightMatch = style.match(/height\s*:\s*(\d+)px/i);

			if (widthMatch && heightMatch) {
				const styleWidth = parseInt(widthMatch[1], 10);
				const styleHeight = parseInt(heightMatch[1], 10);
				return (
					styleWidth <= this.options.maxPixelSize &&
					styleHeight <= this.options.maxPixelSize
				);
			}
		}

		return false;
	}

	/**
	 * Checks if an image source contains a known tracking domain.
	 * @param img The image element to check.
	 * @returns True if the image source contains a tracking domain.
	 */
	private hasTrackingDomain(img: SanitizableElement): boolean {
		const src = img.getAttribute("src");
		if (!src) {
			return false;
		}

		try {
			const url = new URL(src);
			const hostname = url.hostname.toLowerCase();

			return this.options.trackingDomains.some(
				(domain) => hostname === domain || hostname.endsWith(`.${domain}`),
			);
		} catch {
			// If URL parsing fails, check if any tracking domain is in the src string
			const srcLower = src.toLowerCase();
			return this.options.trackingDomains.some((domain) =>
				srcLower.includes(domain),
			);
		}
	}

	/**
	 * Checks if an image URL contains tracking parameters.
	 * @param img The image element to check.
	 * @returns True if the image URL contains tracking parameters.
	 */
	private hasTrackingParameters(img: SanitizableElement): boolean {
		const src = img.getAttribute("src");
		if (!src) {
			return false;
		}

		try {
			const url = new URL(src);
			const params = url.searchParams;

			for (const trackingParam of this.options.trackingParams) {
				if (params.has(trackingParam)) {
					return true;
				}
			}
		} catch {
			// If URL parsing fails, check if any tracking parameter is in the src string
			const srcLower = src.toLowerCase();
			return this.options.trackingParams.some((param) =>
				srcLower.includes(`${param}=`),
			);
		}

		return false;
	}

	/**
	 * Checks if an image has no alt text.
	 * @param img The image element to check.
	 * @returns True if the image has no alt text.
	 */
	private hasNoAltText(img: SanitizableElement): boolean {
		const alt = img.getAttribute("alt");
		// Consider it "no alt text" if the alt attribute is missing, empty, or only whitespace
		return alt === null || alt.trim() === "";
	}

	/**
	 * Checks if an image appears to be transparent.
	 * @param img The image element to check.
	 * @returns True if the image appears to be transparent.
	 */
	private isTransparent(img: SanitizableElement): boolean {
		const src = img.getAttribute("src");
		if (!src) {
			return false;
		}

		// Check for transparent pixel data URLs
		const transparentGif =
			"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
		const transparentPng =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

		if (src === transparentGif || src === transparentPng) {
			return true;
		}

		// Check for other transparent data URLs
		if (src.startsWith("data:image/") && src.includes("transparent")) {
			return true;
		}

		// Check style for opacity
		const style = img.getAttribute("style");
		if (style) {
			const opacityMatch = style.match(/opacity\s*:\s*([\d.]+)/i);
			if (opacityMatch) {
				const opacity = parseFloat(opacityMatch[1]);
				return opacity === 0;
			}
		}

		return false;
	}

	/**
	 * Checks if an image is hidden via CSS.
	 * @param img The image element to check.
	 * @returns True if the image is hidden.
	 */
	private isHidden(img: SanitizableElement): boolean {
		const style = img.getAttribute("style");
		if (!style) {
			return false;
		}

		const styleLower = style.toLowerCase();

		// Check for display: none
		if (
			styleLower.includes("display:none") ||
			styleLower.includes("display: none")
		) {
			return true;
		}

		// Check for visibility: hidden
		if (
			styleLower.includes("visibility:hidden") ||
			styleLower.includes("visibility: hidden")
		) {
			return true;
		}

		// Check for position: absolute with negative coordinates (common hiding technique)
		if (
			styleLower.includes("position:absolute") ||
			styleLower.includes("position: absolute")
		) {
			const leftMatch = style.match(/left\s*:\s*(-?\d+)px/i);
			const topMatch = style.match(/top\s*:\s*(-?\d+)px/i);

			if (leftMatch && parseInt(leftMatch[1], 10) < -1000) {
				return true;
			}

			if (topMatch && parseInt(topMatch[1], 10) < -1000) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Parses a dimension string and returns a number or null.
	 * @param dimension The dimension string to parse.
	 * @returns The parsed dimension or null if invalid.
	 */
	private getDimension(dimension: string | null): number | null {
		if (!dimension) {
			return null;
		}

		const match = dimension.match(/^(\d+)(?:px)?$/i);
		return match ? parseInt(match[1], 10) : null;
	}
}
