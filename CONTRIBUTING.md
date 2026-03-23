# Contributing to MemexCore

Thanks for your interest in contributing! MemexCore is a young project and contributions of all kinds are welcome — bug reports, feature ideas, docs improvements, and code.

## Getting Started

1. Fork the repository
2. Clone your fork and create a branch from `main`:
   ```bash
   git checkout -b my-change
   ```
3. Install dependencies:
   ```bash
   cd server && bun install
   cd ../cli && bun install
   ```
4. Start the server locally:
   ```bash
   docker compose up
   # or: cd server && bun run start
   ```

## Making Changes

- Keep changes focused — one concern per PR.
- Follow the existing code style (TypeScript, no semicolons in most files — match what's there).
- If you're adding a feature, include tests. If you're fixing a bug, add a test that reproduces it.
- Run the existing tests before submitting:
  ```bash
  cd server && bun test src/tests/
  ```

## Commit Messages

Use short, descriptive commit messages with a conventional prefix:

```
feat: Add page manifest support
fix: Handle expired HMAC keys on restart
docs: Clarify session TTL configuration
chore: Update dependencies
test: Add rate limiting edge case
```

## Pull Requests

1. Make sure all tests pass.
2. Update documentation if your change affects the public API or configuration.
3. Describe **what** your PR does and **why** in the PR description.
4. Link any related issues.

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Bun version, Docker version if applicable)

## Suggesting Features

Open an issue describing the use case first. Check the [ROADMAP.md](./ROADMAP.md) to see if it's already planned. Feature discussions help align ideas before code is written.

## Security

If you find a security vulnerability, **do not open a public issue**. Instead, email the maintainers directly. See [SECURITY.md](./SECURITY.md) for details.

## Code of Conduct

Be respectful and constructive. We're all here to build something useful.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
