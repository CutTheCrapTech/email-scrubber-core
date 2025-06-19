import { ClearUrlRules } from "../cleaners/LinkCleaner.js";
import rules from "../../clearurls-data/rules.json" with { type: "json" };

/**
 * Loads the statically downloaded ClearURLs rules.
 * This file is generated and updated by a GitHub Action.
 *
 * @returns The ClearURLs rules object.
 */
export function loadClearUrlRules(): ClearUrlRules {
  return rules as ClearUrlRules;
}

/**
 * Creates a minimal set of ClearURLs rules for testing or fallback purposes.
 * This includes rules for common tracking parameters and domains.
 *
 * @returns A minimal ClearURLs rules object.
 */
export function createMinimalRules(): ClearUrlRules {
  return {
    providers: {
      "*": {
        urlPattern: ".*",
        rules: [
          // Common UTM parameters
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "utm_id",
          "utm_name",
          // Facebook Click Identifier
          "fbclid",
          // Google Click Identifier
          "gclid",
          // Microsoft Click Identifier
          "msclkid",
          // Mailchimp Click Identifiers
          "mc_cid",
          "mc_eid",
          // HubSpot Click Identifiers
          "_hsenc",
          "_hsmi",
        ],
      },
      "google.com": {
        urlPattern: "google\\.com",
        rules: [
          "gclid",
          "gclsrc",
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
        ],
      },
      "facebook.com": {
        urlPattern: "facebook\\.com",
        rules: [
          "fbclid",
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
        ],
      },
      "twitter.com": {
        urlPattern: "twitter\\.com",
        rules: [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "twclid",
        ],
      },
      "linkedin.com": {
        urlPattern: "linkedin\\.com",
        rules: [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "li_fat_id",
        ],
      },
      "amazon.com": {
        urlPattern: "amazon\\.com",
        rules: [
          "ref",
          "tag",
          "linkCode",
          "creative",
          "creativeASIN",
          "camp",
          "adid",
        ],
      },
      "youtube.com": {
        urlPattern: "youtube\\.com",
        rules: [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "feature",
        ],
      },
    },
  };
}
