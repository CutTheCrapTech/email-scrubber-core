/**
 * Defines the structure for a provider's rules in the ClearURLs ruleset.
 */
interface ProviderRule {
  /**
   * A regex pattern to match against the full URL.
   */
  urlPattern: string;

  /**
   * An array of query parameter names to be removed completely.
   */
  rules: string[];

  /**
   * An array of regex patterns. If a parameter matches one of these,
   * it will NOT be removed, even if it's in the `rules` list.
   */
  exceptions?: string[];

  /**
   * An array of query parameter names that contain the real destination URL.
   * If one of these is found, the cleaner will navigate to that URL.
   */
  redirections?: string[];

  /**
   * An array of query parameter names that are considered tracking referrals.
   * These are often removed.
   */
  referral?: string[];
}

/**
 * Defines the top-level structure of the ClearURLs JSON data.
 */
export interface ClearUrlRules {
  /**
   * A dictionary mapping a provider's identifier (often its domain) to its set of rules.
   */
  providers: {
    [domain: string]: ProviderRule;
  };
}

/**
 * A class for cleaning URLs by removing tracking parameters, based on the ClearURLs ruleset.
 */
export class LinkCleaner {
  private readonly rules: ClearUrlRules;

  /**
   * Creates an instance of the LinkCleaner.
   * @param rules The ClearURLs rules data.
   */
  constructor(rules: ClearUrlRules) {
    this.rules = rules;
  }

  /**
   * Cleans a URL by removing tracking parameters and resolving redirection links.
   *
   * @param url The URL to be cleaned. It can be a string or a URL object.
   * @returns A cleaned URL object.
   */
  public clean(url: string | URL): URL {
    let urlObject: URL;
    try {
      urlObject = typeof url === 'string' ? new URL(url) : url;
    } catch (_e) {
      // If the URL is invalid, we cannot process it.
      // Return the original input if it was a URL object, or throw if it was an invalid string.
      if (url instanceof URL) {
        return url;
      }
      throw new Error(`Invalid URL provided: ${url}`);
    }

    // Apply the universal default rules first, if they exist.
    const defaultProvider = this.rules.providers['*'];
    if (defaultProvider) {
      this.cleanParams(urlObject, defaultProvider);
    }

    // Then, find and apply a more specific provider rule.
    const specificProvider = this.findProvider(urlObject);

    if (specificProvider) {
      // Handle redirections first, as they often contain the final destination URL.
      if (specificProvider.redirections) {
        for (const redirectParamName of specificProvider.redirections) {
          if (urlObject.searchParams.has(redirectParamName)) {
            const redirectUrl = urlObject.searchParams.get(redirectParamName);
            if (redirectUrl) {
              try {
                // The redirected URL should also be cleaned.
                return this.clean(decodeURIComponent(redirectUrl));
              } catch (_e) {
                // The redirect parameter was not a valid URL, so we ignore it.
              }
            }
          }
        }
      }

      // Clean the parameters of the current URL using the specific provider's rules.
      this.cleanParams(urlObject, specificProvider);
    }

    return urlObject;
  }

  /**
   * Finds the matching provider rule for a given URL.
   * @param urlObject The URL to find a provider for.
   * @returns The matching provider rule, or null if no provider matches.
   */
  private findProvider(urlObject: URL): ProviderRule | null {
    for (const domain in this.rules.providers) {
      // Skip the default provider in this lookup, as it's handled separately.
      if (domain === '*') {
        continue;
      }

      const provider = this.rules.providers[domain];
      try {
        const urlPattern = new RegExp(provider.urlPattern, 'i');
        if (urlPattern.test(urlObject.href)) {
          return provider;
        }
      } catch (_e) {
        // Ignore invalid regex patterns in the rules.
        console.error(`Invalid regex for provider ${domain}: ${provider.urlPattern}`);
      }
    }
    return null;
  }

  /**
   * Removes unwanted query parameters from a URL based on a provider's rules.
   * @param urlObject The URL object to be modified.
   * @param provider The provider rule to apply.
   */
  private cleanParams(urlObject: URL, provider: ProviderRule): void {
    const paramsToDelete: string[] = [];
    const allRules = [...provider.rules, ...(provider.referral || [])];

    for (const param of urlObject.searchParams.keys()) {
      let shouldRemove = allRules.includes(param);

      if (shouldRemove && provider.exceptions) {
        // If the parameter is an exception, it should not be removed.
        const isException = provider.exceptions.some((exception) => {
          try {
            return new RegExp(exception, 'i').test(param);
          } catch (_e) {
            console.error(`Invalid exception regex: ${exception}`);
            return false;
          }
        });

        if (isException) {
          shouldRemove = false;
        }
      }

      if (shouldRemove) {
        paramsToDelete.push(param);
      }
    }

    for (const param of paramsToDelete) {
      urlObject.searchParams.delete(param);
    }
  }
}
