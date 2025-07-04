import { type ClearUrlRules, LinkCleaner } from "../cleaners/LinkCleaner.js";

// ==================== CONFIGURATION ====================
// These numbers can be easily adjusted for different test scenarios

// Realistic provider count
const realisticProviderCount = 200;
// Simulate different url counts for email scenarios
const emailScenarios = [
  {
    name: "Newsletter",
    urlCount: 25,
    description: "Typical newsletter with moderate links",
  },
  {
    name: "Marketing",
    urlCount: 50,
    description: "Heavy marketing email with many tracking links",
  },
  {
    name: "Digest",
    urlCount: 100,
    description: "News digest with many article links",
  },
  {
    name: "Report",
    urlCount: 150,
    description: "Business report with extensive references",
  },
];

// Provider counts to test (based on real ClearURLs data)
const PROVIDER_COUNTS = [150, 200, 250, 300, 500, 1000];

// Number of URLs to use when testing provider scaling
const URLS_FOR_PROVIDER_SCALING = 50;

// Performance budgets (in milliseconds)
const STARTUP_BUDGET_MS = 100;
const RUNTIME_BUDGET_MS = 10;

// ==================== END CONFIGURATION ====================

// More realistic and complex provider rules
interface ProviderRule {
  urlPattern: string;
  rules: string[];
  exceptions?: string[];
  redirections?: string[];
  referral?: string[];
}

describe("Enhanced Performance Tests - Email URL Processing", () => {
  function generateComplexRealisticProviders(count: number): {
    [domain: string]: ProviderRule;
  } {
    const providers: { [domain: string]: ProviderRule } = {};

    // Add universal default rules (always checked first)
    providers["*"] = {
      urlPattern: ".*",
      rules: [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "msclkid",
        "_ga",
        "_gl",
      ],
      exceptions: ["q", "search", "query"],
    };

    // Complex realistic patterns based on actual ClearURLs data
    const realPatterns = [
      // Google family
      {
        domain: "google.com",
        urlPattern: "^https?://(?:[a-z0-9-]+\\.)*google\\.",
        rules: [
          "ei",
          "sa",
          "ved",
          "uact",
          "cd",
          "cad",
          "rct",
          "url",
          "ct",
          "oi",
          "source",
        ],
        exceptions: ["q", "tbm"],
      },
      // Amazon family
      {
        domain: "amazon.com",
        urlPattern: "^https?://(?:[a-z0-9-]+\\.)*amazon\\.",
        rules: [
          "tag",
          "linkCode",
          "creative",
          "creativeASIN",
          "psc",
          "_encoding",
          "pd_rd_.*",
          "ref_?",
        ],
        exceptions: [],
      },
      // Social media complex patterns
      {
        domain: "facebook.com",
        urlPattern: "^https?://(?:[a-z0-9-]+\\.)*(facebook|fb)\\.com",
        rules: [
          "fbclid",
          "fb_.*",
          "fref",
          "hc_.*",
          "refsrc",
          "__tn__",
          "__xts__",
        ],
        exceptions: [],
      },
      // YouTube complex
      {
        domain: "youtube.com",
        urlPattern:
          "^https?://(?:[a-z0-9-]+\\.)*(?:youtube|youtu)\\.(?:com|be)",
        rules: ["feature", "gclid", "kw", "adurl", "sourceid", "fbclid"],
        exceptions: ["v", "list", "t"],
      },
    ];

    // Add the complex realistic patterns
    realPatterns.forEach((pattern) => {
      providers[pattern.domain] = {
        urlPattern: pattern.urlPattern,
        rules: pattern.rules,
        exceptions: pattern.exceptions,
      };
    });

    // Fill remaining with complex generated patterns
    for (let i = realPatterns.length; i < count - 1; i++) {
      // -1 for the "*" provider
      const domain = `complex-provider-${i}.com`;
      providers[domain] = {
        urlPattern: `^https?://(?:[a-z0-9-]+\\.)*complex-provider-${i}\\.com(?:/.*)?$`,
        rules: [
          `track_${i}_.*`,
          `param${i}[0-9]+`,
          `utm_.*_${i}`,
          `session[a-z]*${i}`,
          `ref[a-zA-Z0-9]*_${i}`,
        ],
        exceptions: [],
        referral: [`aff_${i}`, `partner_${i}`],
      };
    }

    return providers;
  }

  function generateTrulyUniqueUrls(count: number): string[] {
    const urls: string[] = [];
    const timestamp = Date.now();

    // 80% URLs that DON'T match any provider - forces checking ALL providers
    const noMatchCount = Math.floor(count * 0.8);
    for (let i = 0; i < noMatchCount; i++) {
      // Generate truly unique domains each time
      const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2)}-${i}`;
      const domain = `no-match-${uniqueId}.org`;
      const path = `/path-${Math.random().toString(36).substring(2)}`;
      const params = [
        `param1=${Math.random().toString(36).substring(2)}`,
        `param2=${Math.random().toString(36).substring(2)}`,
        `tracking=${uniqueId}`,
        `session=${Date.now() + i}`,
      ].join("&");

      urls.push(`https://${domain}${path}?${params}`);
    }

    // 20% URLs that match providers, but only LATE in the iteration
    const lateMatchCount = count - noMatchCount;
    for (let i = 0; i < lateMatchCount; i++) {
      // Use high-numbered providers that will be checked last
      const providerNum = 180 + (i % 19); // Providers 180-199
      const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2)}-${i}`;
      const domain = `complex-provider-${providerNum}.com`;
      const path = `/page-${uniqueId}`;
      const params = [
        `track_${providerNum}_${uniqueId}=value`,
        `utm_source=${Math.random().toString(36).substring(2)}`,
        `param${providerNum}${Math.floor(Math.random() * 1000)}=test`,
        `session=${Date.now() + i}`,
      ].join("&");

      urls.push(`https://${domain}${path}?${params}`);
    }

    // Shuffle to randomize order
    for (let i = urls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urls[i], urls[j]] = [urls[j], urls[i]];
    }

    return urls;
  }

  describe("Provider Scaling Performance", () => {
    it("should measure performance across different provider counts", () => {
      const urlCount = URLS_FOR_PROVIDER_SCALING;

      process.stdout.write("\n=== PROVIDER SCALING PERFORMANCE ===\n");
      process.stdout.write(`Using ${urlCount} URLs for each test\n`);

      const results: Array<{
        providerCount: number;
        startupTime: number;
        processingTime: number;
        perUrlTime: number;
      }> = [];

      PROVIDER_COUNTS.forEach((providerCount) => {
        process.stdout.write(`\n--- Testing ${providerCount} providers ---\n`);

        const mockRules: ClearUrlRules = {
          providers: generateComplexRealisticProviders(providerCount),
        };

        // Measure startup time
        const startupStart = performance.now();
        const linkCleaner = new LinkCleaner(mockRules);
        const startupTime = performance.now() - startupStart;

        // Measure processing time
        const testUrls = generateTrulyUniqueUrls(urlCount);
        const processingStart = performance.now();
        testUrls.forEach((url) => linkCleaner.clean(url));
        const processingTime = performance.now() - processingStart;

        const perUrlTime = processingTime / urlCount;

        results.push({
          providerCount,
          startupTime,
          processingTime,
          perUrlTime,
        });

        process.stdout.write(`Results:\n`);
        process.stdout.write(`  Startup: ${startupTime.toFixed(3)}ms\n`);
        process.stdout.write(
          `  Processing ${urlCount} URLs: ${processingTime.toFixed(3)}ms\n`,
        );
        process.stdout.write(`  Per URL: ${perUrlTime.toFixed(4)}ms\n`);

        // Budget analysis
        const startupBudgetUsage = (startupTime / STARTUP_BUDGET_MS) * 100;
        const runtimeBudgetUsage = (perUrlTime / RUNTIME_BUDGET_MS) * 100;

        process.stdout.write(`Budget usage:\n`);
        process.stdout.write(
          `  Startup (${STARTUP_BUDGET_MS}ms): ${startupBudgetUsage.toFixed(1)}%\n`,
        );
        process.stdout.write(
          `  Runtime (${RUNTIME_BUDGET_MS}ms): ${runtimeBudgetUsage.toFixed(1)}%\n`,
        );

        const startupStatus =
          startupTime < STARTUP_BUDGET_MS ? "✅ PASS" : "❌ FAIL";
        const runtimeStatus =
          perUrlTime < RUNTIME_BUDGET_MS ? "✅ PASS" : "❌ FAIL";

        process.stdout.write(`  Startup: ${startupStatus}\n`);
        process.stdout.write(`  Runtime: ${runtimeStatus}\n`);

        // Assertions
        expect(startupTime).toBeLessThan(STARTUP_BUDGET_MS);
        expect(perUrlTime).toBeLessThan(RUNTIME_BUDGET_MS);
      });

      // Scaling analysis
      process.stdout.write(`\n=== SCALING ANALYSIS ===\n`);
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];

        const providerRatio = curr.providerCount / prev.providerCount;
        const startupRatio = curr.startupTime / prev.startupTime;
        const runtimeRatio = curr.perUrlTime / prev.perUrlTime;

        process.stdout.write(
          `${prev.providerCount} → ${curr.providerCount} providers (${providerRatio.toFixed(1)}x):\n`,
        );
        process.stdout.write(
          `  Startup scaling: ${startupRatio.toFixed(2)}x\n`,
        );
        process.stdout.write(
          `  Runtime scaling: ${runtimeRatio.toFixed(2)}x\n`,
        );

        const startupLinear = Math.abs(startupRatio - providerRatio) < 0.3;
        const runtimeLinear = Math.abs(runtimeRatio - providerRatio) < 0.3;

        process.stdout.write(
          `  Startup linearity: ${startupLinear ? "✅ Linear" : "⚠️ Non-linear"}\n`,
        );
        process.stdout.write(
          `  Runtime linearity: ${runtimeLinear ? "✅ Linear" : "⚠️ Non-linear"}\n`,
        );
      }

      // Find performance limits
      const startupLimit = results.find(
        (r) => r.startupTime > STARTUP_BUDGET_MS,
      );
      const runtimeLimit = results.find(
        (r) => r.perUrlTime > RUNTIME_BUDGET_MS,
      );

      process.stdout.write(`\n=== PERFORMANCE LIMITS ===\n`);
      if (startupLimit) {
        process.stdout.write(
          `❌ Startup limit exceeded at ${startupLimit.providerCount} providers\n`,
        );
      } else {
        process.stdout.write(`✅ All provider counts within startup budget\n`);
      }

      if (runtimeLimit) {
        process.stdout.write(
          `❌ Runtime limit exceeded at ${runtimeLimit.providerCount} providers\n`,
        );
      } else {
        process.stdout.write(`✅ All provider counts within runtime budget\n`);
      }

      // Recommendations
      const safe = results.filter(
        (r) =>
          r.startupTime < STARTUP_BUDGET_MS * 0.8 &&
          r.perUrlTime < RUNTIME_BUDGET_MS * 0.8,
      );

      if (safe.length > 0) {
        const maxSafe = safe[safe.length - 1];
        process.stdout.write(`\n=== RECOMMENDATIONS ===\n`);
        process.stdout.write(
          `Maximum safe provider count: ${maxSafe.providerCount}\n`,
        );
        process.stdout.write(
          `(Leaves 20% safety margin for both startup and runtime)\n`,
        );
      }
    });
  });

  describe("Real-world Email Processing Simulation", () => {
    it("should simulate realistic email processing scenarios", () => {
      const mockRules: ClearUrlRules = {
        providers: generateComplexRealisticProviders(realisticProviderCount),
      };

      process.stdout.write("\n=== REAL-WORLD EMAIL PROCESSING ===\n");

      // Cold start
      process.stdout.write("Cold start simulation...\n");
      const coldStartTime = performance.now();
      const linkCleaner = new LinkCleaner(mockRules);
      const initTime = performance.now() - coldStartTime;

      process.stdout.write(`Initialization: ${initTime.toFixed(3)}ms\n`);

      emailScenarios.forEach((scenario) => {
        process.stdout.write(
          `\n--- ${scenario.name} Email (${scenario.urlCount} URLs) ---\n`,
        );
        process.stdout.write(`Description: ${scenario.description}\n`);

        const iterations = 20;
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const emailUrls = generateTrulyUniqueUrls(scenario.urlCount);
          const start = performance.now();

          emailUrls.forEach((url) => linkCleaner.clean(url));

          const end = performance.now();
          times.push(end - start);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const p95Time = times.sort((a, b) => a - b)[
          Math.floor(times.length * 0.95)
        ];
        const perUrlTime = avgTime / scenario.urlCount;

        process.stdout.write(`Performance (${iterations} iterations):\n`);
        process.stdout.write(`  Average: ${avgTime.toFixed(3)}ms\n`);
        process.stdout.write(`  P95: ${p95Time.toFixed(3)}ms\n`);
        process.stdout.write(`  Maximum: ${maxTime.toFixed(3)}ms\n`);
        process.stdout.write(`  Per URL: ${perUrlTime.toFixed(4)}ms\n`);

        // User experience analysis
        const budget = RUNTIME_BUDGET_MS; // Fixed budget regardless of URL count
        const budgetUsage = (p95Time / budget) * 100;
        const status = p95Time < budget ? "✅ EXCELLENT" : "❌ SLOW";

        process.stdout.write(`User experience:\n`);
        process.stdout.write(`  Budget usage: ${budgetUsage.toFixed(1)}%\n`);
        process.stdout.write(`  Status: ${status}\n`);

        if (p95Time < budget * 0.5) {
          process.stdout.write(`  Rating: ⚡ BLAZING FAST\n`);
        } else if (p95Time < budget * 0.8) {
          process.stdout.write(`  Rating: 🚀 FAST\n`);
        } else if (p95Time < budget) {
          process.stdout.write(`  Rating: ✅ ACCEPTABLE\n`);
        } else {
          process.stdout.write(`  Rating: 🐌 NEEDS OPTIMIZATION\n`);
        }

        expect(p95Time).toBeLessThan(budget);
      });

      // Overall system health
      process.stdout.write(`\n=== SYSTEM HEALTH SUMMARY ===\n`);
      process.stdout.write(
        `Initialization time: ${initTime.toFixed(3)}ms (${((initTime / STARTUP_BUDGET_MS) * 100).toFixed(1)}% of budget)\n`,
      );
      process.stdout.write(`Provider count: ${realisticProviderCount}\n`);
      process.stdout.write(
        `System status: ${initTime < STARTUP_BUDGET_MS ? "✅ HEALTHY" : "❌ NEEDS ATTENTION"}\n`,
      );
    });
  });
});
