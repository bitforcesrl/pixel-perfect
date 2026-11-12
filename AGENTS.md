# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# General rules

Do not use skills for this project and never commit — the only exception is
the release flow below, where git is explicitly allowed.
Do not write tests; go straight to implementing the code.

# Development rules

- Apply all the SOLID principles
- Prefer a smart/dumb structure for code and reusable components
- Add clear, meaningful comments to the code
- Always consider edge cases (empty, missing or malformed input, offline,
  slow network, concurrent actions, very large data, browser differences) and
  handle them explicitly.
- Handle errors deliberately: never swallow them silently, show the user a
  clear message with a way forward, and keep the app usable after a failure.
- Always keep performance in mind (bundle size, render cost, network requests,
  memory, large images). If something can be done in a more performant way
  than the request describes, say so and propose the alternative **before**
  implementing it, then wait for a decision.

# Changelog

- Every user-visible change (new feature, behaviour change, fix, removal) gets a
  line in `CHANGELOG.md` under `## [Unreleased]`, in the same task that makes
  the change — never left for later.
- Use the Keep a Changelog sections: `Added`, `Changed`, `Fixed`, `Removed`.
- It is a changelog, not documentation: one short line per change, a summary
  of the feature from the user's point of view (what they can now do, or what
  behaves differently). Never describe how it was implemented — no file,
  function, algorithm, library or technical detail.
- Internal-only changes (refactors, tooling, tests, docs typos) need no entry.
- Do not bump the version or create a dated release section unless asked to
  cut a release.

# Releases

Commits and production deploys are continuous; a release is a deliberate
milestone, cut only when the user asks for a bump. Deploy detection does not
depend on it (`lib/app-version.ts` changes with every deploy).

**Versions are Claude's responsibility.** The version number lives in three
places that must always agree: `package.json` (`version`), `lib/version.ts`
(`APP_VERSION`) and the latest dated section of `CHANGELOG.md`. Keep them in
sync on every release, and whenever you touch the changelog check that they
still match — if they do not, point it out and fix it.

When the user asks for a bump:

1. **Ask the bump type first** — major, minor or fix (patch) — unless the
   request already says which. Do not pick it yourself.
2. **Challenge what does not add up**, before touching anything. Compare the
   requested type with what `## [Unreleased]` holds and say so if it does not
   fit (e.g. a fix bump while `Added` lists new features, a major with no
   breaking change, an empty `Unreleased`, a version that would go backwards,
   uncommitted work unrelated to the release). Wait for the user's answer.
3. Compute the version from the current one (SemVer). During the beta
   (`0.X.Y-beta.N`) say which version you are about to use and confirm it if
   the mapping is not obvious.
4. In `CHANGELOG.md`, rename `## [Unreleased]` to
   `## [<version>] - <YYYY-MM-DD>`, add a fresh empty `## [Unreleased]` above
   it, and update the compare links at the bottom.
5. Set the same version in `package.json` (`version`) and `lib/version.ts`
   (`APP_VERSION`, shown in the sidebar footer).
6. Run `npm run check`; stop and report if it fails.
7. **Git is allowed for this step only:** commit the release
   (`chore(release): v<version>`), create the annotated tag `v<version>`, and
   push both the branch and the tag (`git push && git push origin v<version>`).
   Report the commit hash and the tag.
8. Do not create the GitHub Release by hand: pushing the tag triggers
   `.github/workflows/release.yml`, which checks the tag against
   `package.json` and publishes the release with the matching `CHANGELOG.md`
   section as notes (flagged pre-release for `-beta`/`-rc` versions). Point
   the user to the Actions tab if they want to confirm it ran.

# Open goals

- Make the project open source
- Improve the project documentation
- Implement new features requested by users
- Optimize the project's performance
- Improve the user experience
- Create a dedicated minisite for the project
