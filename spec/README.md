# Chat App Test Suite

This directory contains tests for the Chat App.

## Running Tests

### Rails Tests

Run the entire test suite:

```bash
bundle exec rspec
```

Run a specific test file:

```bash
bundle exec rspec spec/models/chat_spec.rb
```

Run with code coverage:

```bash
COVERAGE=true bundle exec rspec
```

### JavaScript Tests

Run the entire JavaScript test suite:

```bash
npm test
```

Run with code coverage:

```bash
npm run test:coverage
```

Run tests in watch mode (continuously re-run when files change):

```bash
npm run test:watch
```

## Viewing Coverage Reports

### Rails Coverage

After running tests with `COVERAGE=true`, open the coverage report:

```bash
open coverage/index.html
```

### JavaScript Coverage

After running tests with `npm run test:coverage`, open the JavaScript coverage report:

```bash
open coverage/jest/lcov-report/index.html
```

## Test Structure

- `spec/models/` - Tests for Rails models
- `spec/controllers/` - Tests for Rails controllers
- `spec/channels/` - Tests for ActionCable channels
- `spec/system/` - Integration tests that simulate user interaction
- `spec/javascript/` - Tests for JavaScript functionality

## Adding New Tests

When adding new features, make sure to add corresponding tests to maintain coverage. The test files should follow the same structure as the application code.

For example:

- For a new model `User`, create `spec/models/user_spec.rb`
- For JavaScript functionality, create `spec/javascript/[feature].test.js`
