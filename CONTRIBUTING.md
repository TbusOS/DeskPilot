# Contributing to DeskPilot

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Python 3.8+ (for Python bridge)
- A Tauri/Electron app for testing

### Installation

```bash
# Clone the repository
git clone https://github.com/TbusOS/DeskPilot.git
cd DeskPilot

# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
```

## Project Structure

```
packages/desktop-test/
├── src/
│   ├── core/           # Core test framework
│   ├── adapters/       # Platform adapters
│   ├── vlm/            # VLM client and cost tracking
│   ├── types.ts        # Type definitions
│   └── index.ts        # Main exports
├── docs/               # Documentation
├── examples/           # Example test suites
└── tests/              # Unit tests
```

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-fix
```

### 2. Code Style

- Use TypeScript for all new code
- Follow existing code style
- Add JSDoc comments for public APIs
- Keep files focused and small

### 3. Testing

- Add unit tests for new functionality
- Ensure all tests pass before submitting
- Test with real Tauri/Electron apps when possible

### 4. Documentation

- Update README.md if adding new features
- Add API documentation for new public methods
- Update DESIGN.md for architectural changes

### 5. Commit Messages

Follow conventional commits:

```
feat: add new VLM provider support
fix: correct element finding in hybrid mode
docs: update API reference
refactor: simplify cost tracking logic
test: add tests for Python bridge
```

## Pull Request Process

1. Ensure your code builds: `npm run build`
2. Ensure tests pass: `npm test`
3. Update documentation as needed
4. Create a pull request with a clear description
5. Wait for review and address feedback

## Adding a New VLM Provider

1. Add provider enum in `src/types.ts`
2. Add default model in `src/vlm/client.ts`
3. Implement API call method in `src/vlm/client.ts`
4. Add pricing info in `src/vlm/cost-tracker.ts`
5. Update documentation

## Adding a New Adapter

1. Create adapter file in `src/adapters/`
2. Implement required interface from `types.ts`
3. Export from `src/adapters/index.ts`
4. Add configuration options in `types.ts`
5. Update `DesktopTest` to use the new adapter

## Reporting Issues

When reporting issues, please include:

- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages and stack traces

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
