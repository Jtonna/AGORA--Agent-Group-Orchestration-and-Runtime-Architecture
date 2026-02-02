# Release Process for agora-framework

This documents how to publish the `agora-framework` npm package.

The package source lives in the `agora/` subdirectory of this repository.
Because it is not at the repo root, `npm version` does not automatically
create git commits or tags -- those steps must be done manually.

---

## One-Time Setup

1. **npm account** -- Create an account at https://www.npmjs.com if you do
   not already have one. You must have publish access to the `agora-framework`
   package.

2. **Create a granular access token** -- On npmjs.com, go to
   Access Tokens > Generate New Token > Granular Access Token.
   Scope it to the `agora-framework` package with read and write permissions.

3. **Add the repository secret** -- In the GitHub repository, go to
   Settings > Secrets and variables > Actions and create a repository secret
   named `NPM_TOKEN` with the token value from the previous step.

---

## Version Strategy

| Bump    | When to use                                  |
|---------|----------------------------------------------|
| `patch` | Bug fixes, documentation corrections         |
| `minor` | New features, non-breaking additions         |
| `major` | Breaking changes to the public API           |

---

## Standard Release

```bash
# 1. Bump the version in package.json
cd agora
npm version patch   # or minor / major

# 2. Stage and commit the version bump
cd ..
git add agora/package.json agora/package-lock.json
git commit -m "v0.x.x"

# 3. Tag and push
git tag v0.x.x
git push && git push --tags
```

Pushing the version tag triggers the GitHub Actions workflow at
`.github/workflows/publish.yml`, which runs:

checkout > setup Node 20 > `npm ci` > build > test > publish to npm

After the workflow completes, verify the release:

```bash
npm view agora-framework
```

---

## Pre-release / Beta

```bash
# 1. Set an explicit prerelease version
cd agora
npm version 0.2.0-beta.1

# 2. Stage, commit, and tag
cd ..
git add agora/package.json agora/package-lock.json
git commit -m "v0.2.0-beta.1"
git tag v0.2.0-beta.1
git push && git push --tags
```

This publishes to the `latest` dist-tag by default. To publish under a
different dist-tag (e.g. `next`), the publish step in the workflow needs
`--tag next` appended to the `npm publish` command. Adjust
`.github/workflows/publish.yml` accordingly before pushing the tag.

---

## CI Workflow Summary

The workflow at `.github/workflows/publish.yml` is triggered by version tag
pushes (`v*`). It performs the following steps:

1. Checkout the repository
2. Setup Node.js 20
3. `npm ci` -- install dependencies from lockfile
4. Build the package
5. Run tests
6. Publish to the npm registry

The workflow authenticates to npm using the `NPM_TOKEN` repository secret.

---

## Notes

- Always run `npm view agora-framework` after a publish to confirm the new
  version is live on the registry.
- The `agora/` subdirectory layout means you must handle git commits and tags
  yourself -- `npm version` only modifies `package.json` and
  `package-lock.json` in that directory.
- If the GitHub Actions workflow fails, check the Actions tab for logs. Common
  issues are an expired or misconfigured `NPM_TOKEN` and failing tests.
