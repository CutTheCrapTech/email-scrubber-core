import { sanitizeEmail, sanitizeEmailSimple } from '../sanitizer.js';
import { createMinimalRules } from '../utils/fetchRules.js';

describe('Simple functionality test', () => {
  const rules = createMinimalRules();

  test('sanitizeEmail should work with basic HTML', () => {
    const htmlContent = `
      <html>
        <body>
          <p>Hello World</p>
          <a href="https://google.com/search?q=test&utm_source=email">Click here</a>
        </body>
      </html>
    `;

    const result = sanitizeEmail(htmlContent, rules);

    expect(result).toBeDefined();
    expect(result.html).toContain('Hello World');
    expect(result.html).toContain('href="https://google.com/search?q=test"');
    expect(result.html).not.toContain('utm_source=email');
    expect(result.urlsCleaned).toBe(1);
    expect(result.wasModified).toBe(true);
  });

  test('sanitizeEmailSimple should return cleaned HTML string', () => {
    const htmlContent = `<a href="https://google.com/search?q=test&utm_source=email">Click</a>`;

    const result = sanitizeEmailSimple(htmlContent, rules);

    expect(typeof result).toBe('string');
    expect(result).toContain('href="https://google.com/search?q=test"');
    expect(result).not.toContain('utm_source=email');
  });

  test('should handle empty HTML', () => {
    const result = sanitizeEmail('', rules);

    expect(result.html).toBe('');
    expect(result.urlsCleaned).toBe(0);
    expect(result.trackingPixelsRemoved).toBe(0);
    expect(result.wasModified).toBe(false);
  });

  test('should handle HTML without tracking elements', () => {
    const cleanHtml = `<p>This is clean content</p>`;

    const result = sanitizeEmail(cleanHtml, rules);

    expect(result.html).toBe(cleanHtml);
    expect(result.urlsCleaned).toBe(0);
    expect(result.trackingPixelsRemoved).toBe(0);
    expect(result.wasModified).toBe(false);
  });

  test('createMinimalRules should return valid rules', () => {
    expect(rules).toBeDefined();
    expect(rules.providers).toBeDefined();
    expect(typeof rules.providers).toBe('object');
    expect(Object.keys(rules.providers).length).toBeGreaterThan(0);
  });
});
