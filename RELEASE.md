# Release Process

## Version Strategy

| Bump    | When to use                          |
|---------|--------------------------------------|
| `patch` | Bug fixes, documentation corrections |
| `minor` | New features, non-breaking additions |
| `major` | Breaking changes to the public API   |

## Release Commands

```bash
# 1. Bump version
cd agora
npm version patch   # or minor / major

# 2. Commit the bump
cd ..
git add agora/package.json agora/package-lock.json
git commit -m "v0.x.x"

# 3. Tag and push — this triggers the CI publish
git tag v0.x.x
git push && git push --tags
```
