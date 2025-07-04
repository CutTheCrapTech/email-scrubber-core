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
 * Internal structure for cached provider data with compiled regex patterns.
 */
interface CachedProviderRule {
  urlPattern: RegExp | null;
  rules: RegExp[];
  exceptions: RegExp[];
  redirections?: RegExp[];
  referral?: RegExp[];
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
      rules: this.compilePatternArray(providerRules.rules, provider, "rules"),
      exceptions: this.compilePatternArray(
        providerRules.exceptions || [],
        provider,
        "exceptions",
      ),
      redirections: providerRules.redirections
        ? this.compilePatternArray(
            providerRules.redirections,
            provider,
            "redirections",
          )
        : undefined,
      referral: providerRules.referral
        ? this.compilePatternArray(providerRules.referral, provider, "referral")
        : undefined,
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
   * Compiles an array of pattern strings into RegExp objects.
   * @param patterns Array of regex pattern strings.
   * @param provider The provider identifier for error reporting.
   * @param fieldName The field name for error reporting.
   * @returns Array of compiled RegExp objects.
   */
  private compilePatternArray(
    patterns: string[],
    provider: string,
    fieldName: string,
  ): RegExp[] {
    const compiledPatterns: RegExp[] = [];

    for (const pattern of patterns) {
      try {
        compiledPatterns.push(new RegExp(pattern, "i"));
      } catch (error) {
        console.error(
          `Invalid ${fieldName} regex for provider ${provider}: ${pattern}`,
          error,
        );
      }
    }

    return compiledPatterns;
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

    // Apply the universal default rules first, if they exist.
    const defaultProvider = this.getProvider("*");
    if (defaultProvider) {
      this.cleanParams(urlObject, defaultProvider);
    }

    // Then, find and apply a more specific provider rule.
    const specificProvider = this.findProvider(urlObject);

    if (specificProvider) {
      // Handle redirections first, as they often contain the final destination URL.
      if (specificProvider.redirections) {
        for (const param of urlObject.searchParams.keys()) {
          if (this.matchesPatternArray(param, specificProvider.redirections)) {
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
      if (provider === "*") {
        continue;
      }

      // Get pre-compiled provider
      const cachedProvider = this.getProvider(provider);
      if (cachedProvider?.urlPattern?.test(urlObject.href)) {
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
    const paramsToDelete: string[] = [];

    for (const param of urlObject.searchParams.keys()) {
      // Test against pre-compiled rules and referral regex patterns
      let shouldRemove =
        this.matchesPatternArray(param, cachedProvider.rules) ||
        (cachedProvider.referral
          ? this.matchesPatternArray(param, cachedProvider.referral)
          : false);

      if (shouldRemove) {
        // Check exceptions if we need to
        if (cachedProvider.exceptions.length > 0) {
          const isException = this.matchesPatternArray(
            param,
            cachedProvider.exceptions,
          );
          if (isException) {
            shouldRemove = false;
          }
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

  /**
   * Tests if a parameter matches any pattern in an array of compiled regex patterns.
   * @param param The parameter name to test.
   * @param patterns Array of compiled RegExp objects.
   * @returns True if the parameter matches any pattern.
   */
  private matchesPatternArray(param: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(param));
  }
}
