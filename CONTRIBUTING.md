# Contributing to Pixel Perfect

Thanks for taking the time to contribute! Bug reports, feature ideas, docs fixes and pull requests are all welcome.

By taking part in this project you agree to follow its [Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Reporting a bug](#reporting-a-bug)
- [Suggesting a feature](#suggesting-a-feature)
- [Setting up the project](#setting-up-the-project)
- [Making a change](#making-a-change)
- [Code style](#code-style)
- [Commit messages](#commit-messages)
- [Opening a pull request](#opening-a-pull-request)
- [Security issues](#security-issues)

## Ways to contribute

- **Report a bug** you hit while comparing a site with its design.
- **Suggest a feature** or an improvement to an existing one.
- **Improve the docs**: the README, code comments, or this guide.
- **Fix an issue**: look for the [`good first issue`](https://github.com/bitforcesrl/pixel-perfect/labels/good%20first%20issue) and [`help wanted`](https://github.com/bitforcesrl/pixel-perfect/labels/help%20wanted) labels.

For anything larger than a small fix, please **open an issue first** so we can agree on the approach before you spend time on it.

## Reporting a bug

Search the [existing issues](https://github.com/bitforcesrl/pixel-perfect/issues) first. If nothing matches, open a new one with the **Bug report** template and include:

- what you did, what you expected and what happened instead;
- whether you used the hosted version, `npm run dev`, or Docker;
- browser, OS and Node.js version;
- screenshots, or an exported project ZIP that reproduces the problem (remove anything confidential first).

## Suggesting a feature

Open an issue with the **Feature request** template. Describe the problem you are trying to solve, not only the solution: it helps find the design that fits the rest of the app.

## Setting up the project

Requirements: **Node.js 20.9+** (the version in [`.nvmrc`](.nvmrc) is recommended) and npm.

```bash
git clone https://github.com/bitforcesrl/pixel-perfect.git
cd pixel-perfect
nvm use              # optional: picks the Node version from .nvmrc
npm install          # also enables the git hooks
npm run playwright:install  # optional: Firefox, only needed for automatic site capture
cp .env.example .env # optional: no variable is required locally
npm run dev          # http://localhost:7654
```

`npm install` points git at [`scripts/git-hooks`](scripts/git-hooks), whose pre-commit hook scans staged changes for secrets with [gitleaks](https://github.com/gitleaks/gitleaks). Install it with `brew install gitleaks` (or see its README); without it the check is skipped with a warning.

## Making a change

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/overlay-offset
   ```
2. Make your change, keeping it focused on one thing.
3. Run every check locally; CI runs the same ones on your pull request:
   ```bash
   npm run check        # lint + typecheck + format check + tests
   npm run build        # make sure the production build still works
   ```
4. Update the README if you changed behaviour, a shortcut or a configuration variable, and add a line to [`CHANGELOG.md`](CHANGELOG.md) under **Unreleased**.

### Project layout

| Folder            | What lives there                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/api/`        | Server routes: screenshot, Figma, auth, login session                                                                       |
| `app/components/` | React components. `Workspace` is the smart container; the rest are presentational and reusable                              |
| `lib/`            | Pure logic with no React: capture, Figma, IndexedDB storage, ZIP, diff, viewports. Tests sit next to the code (`*.test.ts`) |
| `scripts/`        | Git hooks (gitleaks pre-commit)                                                                                             |

The project uses **Next.js 16**, which differs from older versions. Check the guides in `node_modules/next/dist/docs/` before relying on an API you know from earlier releases.

## Code style

- **Formatting** is owned by [Prettier](https://prettier.io); run `npm run format` before committing. Don't argue with it in review.
- **Linting** is ESLint with the Next.js rules (`npm run lint`, or `npm run lint:fix`).
- **TypeScript** runs in `strict` mode; avoid `any`.
- **Architecture**: follow the SOLID principles and the smart/dumb split. Components that hold state and talk to `lib/` are containers; everything else receives props and renders.
- **Comments** explain _why_, not _what_. Add a short doc comment to every exported function and component.
- **Tests**: logic in `lib/` is covered by [Vitest](https://vitest.dev). If you change it, add or update the test next to it.

Your editor will pick up [`.editorconfig`](.editorconfig) automatically; for VS Code, install the Prettier and ESLint extensions.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org):

```text
feat: add a 4K viewport preset
fix(overlay): keep the offset when switching viewport
docs: explain the Browserless setup
```

Common types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`.

## Opening a pull request

- Fill in the pull request template and link the issue it closes (`Closes #123`).
- Keep it small: several focused PRs are reviewed faster than one large one.
- Add a screenshot or a short recording for any visible UI change.
- Make sure CI is green. Maintainers review pull requests in their spare time, with no guaranteed timeline; please be patient and open to feedback.

## Security issues

**Do not open a public issue for a vulnerability.** Follow the process in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
