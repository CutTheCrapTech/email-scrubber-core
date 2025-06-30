# Testing Documentation

This document describes the comprehensive testing strategy for the email-scrubber-core library, which is designed to work consistently across Node.js, Cloudflare Workers, and browser extensions.

## Test Structure

### 1. Core Functionality Tests (`src/__tests__/sanitizer.test.ts`)

- Tests the main `Sanitizer` class and its methods.
- Validates input handling, error cases, and edge cases.
- Ensures deterministic behavior and proper validation logic.

### 2. Stream Sanitizer Tests (`src/__tests__/stream-sanitizer.test.ts`)

- Tests the `StreamSanitizer` class and its methods.

### 3. Link Cleaner Tests (`src/__tests__/LinkCleaner.test.ts`)

- Tests the `LinkCleaner` class and its methods.

### 4. Tracker Pixel Remover Tests (`src/__tests__/TrackerPixelRemover.test.ts`)

- Tests the `TrackerPixelRemover` class and its methods.

### 5. Fetch Rules Tests (`src/__tests__/fetchRules.test.ts`)

- Tests the `fetchRules` function.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/__tests__/sanitizer.test.ts

# Run tests with verbose output
npm test -- --verbose

# Run tests in watch mode
npm test -- --watch
```

## Continuous Integration

The test suite is designed to run in CI/CD environments:

- Uses `NODE_OPTIONS='--experimental-vm-modules'` for ES modules
- All tests are deterministic and environment-independent
- No external dependencies or network calls required

## Debugging Failed Tests

If tests fail in your environment:

1. **Check Node.js Version**: Ensure Node.js 22+ for Web Crypto API support
2. **Verify Dependencies**: Ensure all dependencies are installed correctly with `npm install`

### Common Issues

- **Missing Modules**: Ensure all dependencies are installed.
- **Import Errors**: Ensure proper ES module configuration.

## Test Coverage

The test suite covers:

- ✅ All public API functions
- ✅ Error handling and edge cases
- ✅ Performance characteristics

## Future Testing Considerations

- **Deno Support**: Test vectors ready for Deno environment verification
- **Additional Browsers**: Test vectors can verify Safari, Edge compatibility
- **Mobile Environments**: React Native, Capacitor compatibility testing
