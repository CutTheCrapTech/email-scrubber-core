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
   * An array of regex patterns. If a URL matches one of these,
   * the provider rules will not be applied.
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
 * Internal structure for cached provider data with compiled regex patterns.
 */
interface CachedProviderRule {
  urlPattern: RegExp | null;
  rules: RegExp | null;
  exceptions: RegExp | null;
  redirections: RegExp | null;
  referral: RegExp | null;
}

/**
 * A class for cleaning URLs by removing tracking parameters, based on the ClearURLs ruleset.
 * All regex patterns are compiled eagerly in the constructor for optimal runtime performance.
 */
export class LinkCleaner {
  private readonly rules: ClearUrlRules;
  private readonly cachedProviders: Map<string, CachedProviderRule>;

  /**
   * Creates an instance of the LinkCleaner.
   * @param rules The ClearURLs rules data.
   */
  constructor(rules: ClearUrlRules) {
    this.rules = rules;
    this.cachedProviders = new Map();

    // Eagerly compile all providers' regex patterns
    for (const [provider, providerRules] of Object.entries(rules.providers)) {
      const cachedProvider = this.compileProvider(providerRules, provider);
      this.cachedProviders.set(provider, cachedProvider);
    }
  }

  /**
   * Gets a cached provider's rules.
   * @param provider The provider identifier to get rules for.
   * @returns The cached provider rule or null if not found.
   */
  private getProvider(provider: string): CachedProviderRule | null {
    return this.cachedProviders.get(provider) || null;
  }

  /**
   * Compiles a provider's rules into cached regex patterns.
   * All patterns are compiled eagerly.
   * @param providerRules The raw provider rule.
   * @param provider The provider identifier for error reporting.
   * @returns Compiled provider rule with regex patterns.
   */
  private compileProvider(
    providerRules: ProviderRule,
    provider: string,
  ): CachedProviderRule {
    return {
      urlPattern: this.compileUrlPattern(providerRules.urlPattern, provider),
      rules: this.compileCombinedPattern(
        providerRules.rules,
        provider,
        "rules",
      ),
      exceptions: this.compileCombinedPattern(
        providerRules.exceptions || [],
        provider,
        "exceptions",
      ),
      redirections: this.compileCombinedPattern(
        providerRules.redirections || [],
        provider,
        "redirections",
      ),
      referral: this.compileCombinedPattern(
        providerRules.referral || [],
        provider,
        "referral",
      ),
    };
  }

  /**
   * Compiles a URL pattern regex, with error handling.
   * @param pattern The regex pattern string.
   * @param provider The provider identifier for error reporting.
   * @returns Compiled RegExp or null if invalid.
   */
  private compileUrlPattern(pattern: string, provider: string): RegExp | null {
    try {
      return new RegExp(pattern, "i");
    } catch (error) {
      console.error(
        `Invalid URL regex for provider ${provider}: ${pattern}`,
        error,
      );
      return null;
    }
  }

  /**
   * Compiles an array of pattern strings into a single combined RegExp object.
   * @param patterns Array of regex pattern strings.
   * @param provider The provider identifier for error reporting.
   * @param fieldName The field name for error reporting.
   * @returns A single compiled RegExp object, or null if no patterns are provided.
   */
  private compileCombinedPattern(
    patterns: string[],
    provider: string,
    fieldName: string,
  ): RegExp | null {
    if (patterns.length === 0) {
      return null;
    }

    try {
      // Combine all patterns into a single regex: (pattern1|pattern2|...)
      const combined = `(?:${patterns.join("|")})`;
      return new RegExp(combined, "i");
    } catch (error) {
      console.error(
        `Invalid ${fieldName} regex for provider ${provider}: ${patterns.join(", ")}`,
        error,
      );
      return null;
    }
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
      urlObject = typeof url === "string" ? new URL(url) : url;
    } catch (_e) {
      // If the URL is invalid, we cannot process it.
      // Return the original input if it was a URL object, or throw if it was an invalid string.
      if (url instanceof URL) {
        return url;
      }
      throw new Error(`Invalid URL provided: ${url}`);
    }

    // Early exit if there are no query parameters to clean.
    if (urlObject.search.length === 0) {
      return urlObject;
    }

    // Apply the universal default rules first, if they exist.
    const defaultProvider = this.getProvider("globalRules");
    if (defaultProvider) {
      this.cleanParams(urlObject, defaultProvider);
    }

    // Then, find and apply a more specific provider rule.
    const specificProvider = this.findProvider(urlObject);

    if (specificProvider) {
      // Handle redirections first, as they often contain the final destination URL.
      if (specificProvider.redirections) {
        for (const param of Array.from(urlObject.searchParams.keys())) {
          if (this.matchesPattern(param, specificProvider.redirections)) {
            const redirectUrl = urlObject.searchParams.get(param);
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
   * @returns The matching cached provider rule, or null if no provider matches.
   */
  public findProvider(urlObject: URL): CachedProviderRule | null {
    for (const provider of Object.keys(this.rules.providers)) {
      // Skip the default provider in this lookup, as it's handled separately.
      if (provider === "globalRules") {
        continue;
      }

      // Get pre-compiled provider
      const cachedProvider = this.getProvider(provider);
      if (cachedProvider?.urlPattern?.test(urlObject.href)) {
        // If a provider matches, check if the URL is an exception.
        if (this.matchesPattern(urlObject.href, cachedProvider.exceptions)) {
          // This URL is an exception for this provider, so skip it.
          continue;
        }
        return cachedProvider;
      }
    }
    return null;
  }

  /**
   * Removes unwanted query parameters from a URL based on a cached provider's rules.
   * @param urlObject The URL object to be modified.
   * @param cachedProvider The cached provider rule to apply.
   */
  private cleanParams(
    urlObject: URL,
    cachedProvider: CachedProviderRule,
  ): void {
    // Early exit if the provider has no rules to apply.
    if (!cachedProvider.rules && !cachedProvider.referral) {
      return;
    }

    const paramsToDelete: string[] = [];

    for (const param of urlObject.searchParams.keys()) {
      const shouldRemove =
        this.matchesPattern(param, cachedProvider.rules) ||
        this.matchesPattern(param, cachedProvider.referral);

      if (shouldRemove) {
        paramsToDelete.push(param);
      }
    }

    for (const param of paramsToDelete) {
      urlObject.searchParams.delete(param);
    }
  }

  /**
   * Tests if a string matches a compiled regex pattern.
   * @param value The string to test.
   * @param pattern The compiled RegExp object.
   * @returns True if the string matches the pattern.
   */
  private matchesPattern(value: string, pattern: RegExp | null): boolean {
    if (!pattern) {
      return false;
    }
    return pattern.test(value);
  }
}
