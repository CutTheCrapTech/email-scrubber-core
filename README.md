# email-scrubber-core

A privacy-focused email sanitizer that removes trackers from URLs and HTML content.

[![npm version](https://badge.fury.io/js/email-scrubber-core.svg)](https://www.npmjs.com/package/email-scrubber-core)
[![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)

## Features

🛡️ **Universal Privacy Protection**

- **Cleans All URLs**: Removes common tracking parameters from _any_ URL, not just those from specific providers.
- **Removes Tracking Pixels**: Strips 1x1 pixels and other tracking images from email content.
- **Powered by ClearURLs**: Uses the excellent [ClearURLs](https://gitlab.com/ClearURLs/Rules) ruleset for provider-specific cleaning.

🚀 **High Performance & Modern**

- **Streaming Architecture**: Built for modern edge environments like Cloudflare Workers, Vercel Edge Functions, and Deno.
- **Buffered API**: Provides a simple, memory-based API for traditional Node.js environments.
- **Efficient**: Uses `linkedom` for fast, server-side DOM parsing in buffered mode.

🔧 **Customizable & Flexible**

- Configure or extend the tracking domains and parameters.
- Choose between streaming handlers or a simple buffered function.
- Preserve the full HTML structure or extract only the `<body>` content.

## How It Works

The library takes HTML content and sanitizes it in two main ways:

### 1. URL Cleaning

A two-pass system ensures comprehensive cleaning:

1.  **Default Cleaning**: A built-in list of common tracking parameters (e.g., `utm_source`, `fbclid`, `gclid`) is removed from **every URL**.
2.  **Provider-Specific Cleaning**: For domains found in the ClearURLs ruleset (like Google, Facebook, Amazon), a second, more specific set of rules is applied.

### 2. Tracking Pixel Detection

The library removes `<img>` tags that are likely to be tracking pixels by checking for:

- **1x1 or 2x2 dimensions**.
- **Known tracking domains** (e.g., `google-analytics.com`).
- **Hidden styles** (`display: none`, `visibility: hidden`).
- **Lack of descriptive `alt` text**.

## Installation

```bash
npm install email-scrubber-core
```

## Quick Start

### For Node.js (Buffered API)

This is the simplest way to use the library in a standard Node.js application.

```typescript
import { sanitizeEmailBuffered, createMinimalRules } from 'email-scrubber-core';

// Use the built-in minimal ruleset, which includes default cleaning.
const rules = createMinimalRules();

const dirtyEmail = `
  <div>
    <p>Check out our <a href="https://a-random-site.com/product?utm_source=email">latest product</a>!</p>
    <img src="https://google-analytics.com/collect?tid=UA-12345" width="1" height="1">
  </div>
`;

// sanitizeEmailBuffered processes the entire HTML string in memory.
const result = sanitizeEmailBuffered(dirtyEmail, rules);

// Resulting HTML:
// <div>
//   <p>Check out our <a href="https://a-random-site.com/product">latest product</a>!</p>
// </div>
console.log(result.html);

console.log(
  `Cleaned ${result.urlsCleaned} URLs and removed ${result.trackingPixelsRemoved} tracking pixels.`
);
```

### For Cloudflare Workers (Streaming API)

This is the recommended, high-performance approach for edge environments. It transforms the HTML _as it streams_ without buffering the entire body in memory.

```typescript
// In your Cloudflare Worker's main file:
import { getStreamingHandlers, createMinimalRules } from 'email-scrubber-core';

export default {
  async fetch(request: Request): Promise<Response> {
    // Fetch the original response from your origin.
    const response = await fetch(request);

    // Get the sanitization rules and handlers.
    const rules = createMinimalRules();
    const handlers = getStreamingHandlers(rules);

    // Create an HTMLRewriter and attach the handlers.
    const rewriter = new HTMLRewriter()
      .on('a[href]', handlers.linkHandler)
      .on('img', handlers.pixelHandler);

    // Return the transformed response.
    return rewriter.transform(response);
  },
};
```

## API Reference

### Core Functions

#### `sanitizeEmailBuffered(html, rules, options?)`

Sanitizes a complete HTML string in memory. Ideal for Node.js.

- **`html`** (string): The HTML content to sanitize.
- **`rules`** (ClearUrlRules): The ruleset to apply.
- **`options`** (SanitizeEmailOptions): Optional configuration.
- **Returns**: `SanitizeEmailResult`

#### `getStreamingHandlers(rules)`

Returns handler objects for use with `HTMLRewriter` in a streaming environment.

- **`rules`** (ClearUrlRules): The ruleset to apply.
- **Returns**: An object with `linkHandler` and `pixelHandler`.

#### `createMinimalRules()`

Returns a built-in, lightweight ruleset that includes the default `*` rule for cleaning all URLs, plus specific rules for major providers like Google and Facebook. **This is often all you need.**

---

_For detailed API documentation on options and return types, please refer to the TypeScript definitions included in the package._

## License

This project is licensed under the **LGPL-3.0 License** due to its use of the ClearURLs ruleset. See the [LICENSE](LICENSE) file for details. This means you can use it freely in your projects, but if you modify and distribute this library itself, you must share your changes under the same license.
