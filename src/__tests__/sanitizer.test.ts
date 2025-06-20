import { sanitizeEmail, sanitizeEmailSimple } from '../sanitizer.js';
import { sanitizerTestCases, assertSanitizerResult } from './email-scrubber-core-cases.ts';
import { createMinimalRules } from '../utils/fetchRules.js';
import { jest } from '@jest/globals';

// The test suite includes cases with invalid URLs, which are expected to log warnings.
// We mock the console here to prevent that output from cluttering the test results.
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('sanitizeEmail (shared cases)', () => {
  const minimalRules = createMinimalRules();
  sanitizerTestCases.forEach((tc) => {
    it(tc.name, () => {
      const rules = tc.rules ?? minimalRules;
      const result = sanitizeEmail(tc.html, rules, tc.options);
      assertSanitizerResult(result, tc);
    });
  });
});

describe('sanitizeEmailSimple', () => {
  // Retain or refactor these as needed, or migrate to shared cases if desired
  it('should return only the cleaned HTML', () => {
    const html = '<a href="https://google.com/page?gclid=123">Link</a>';
    const rules = createMinimalRules();
    const result = sanitizeEmailSimple(html, rules);
    expect(typeof result).toBe('string');
    expect(result).toContain('https://google.com/page');
    expect(result).not.toContain('gclid');
  });

  it('should accept options', () => {
    const html = '<a href="https://google.com/page?gclid=123">Link</a>';
    const rules = createMinimalRules();
    const result = sanitizeEmailSimple(html, rules, {
      cleanUrls: false,
    });
    expect(result).toContain('gclid=123');
  });

  it('should return original HTML if no modifications needed', () => {
    const html = '<div><p>Clean content</p></div>';
    const rules = createMinimalRules();
    const result = sanitizeEmailSimple(html, rules);
    expect(result).toBe(html);
  });
});
