# Releasing

How installers are built and published for [nikhilakki/pomodoro](https://github.com/nikhilakki/pomodoro).

## CI matrix

Workflow: [`.github/workflows/release.yml`](https://github.com/nikhilakki/pomodoro/blob/main/.github/workflows/release.yml)

| Runner | Target |
| ------ | ------ |
| `macos-latest` | `aarch64-apple-darwin` |
| `macos-latest` | `x86_64-apple-darwin` |
| `windows-latest` | `x86_64-pc-windows-msvc` |
| `windows-11-arm` | `aarch64-pc-windows-msvc` |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` |
| `ubuntu-22.04-arm` | `aarch64-unknown-linux-gnu` |

Uses [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action) to build and attach artifacts.

### Triggers

- Push of a version tag matching `v*`
- Manual **Actions → Release → Run workflow**

## Cut a release

1. Bump version in all three places:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml` (refresh `Cargo.lock` if needed)
2. Commit on `main` and push.
3. Tag and push:

```bash
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

4. Wait for the six matrix jobs. Review the GitHub Release draft/assets.
5. Publish the release if the workflow left it as a draft (`releaseDraft: true` may create drafts; consolidate assets if parallel jobs race).

Users download from [Releases](https://github.com/nikhilakki/pomodoro/releases).

## Code signing (optional)

Default pipeline only needs `GITHUB_TOKEN` with `contents: write`.

### macOS (seamless open)

Configure secrets for signing + notarization so users avoid the `xattr` Gatekeeper workaround:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

### Windows

Optional certificate secrets (e.g. `WINDOWS_CERTIFICATE`) reduce SmartScreen friction.

## Local release build

```bash
pnpm install
pnpm tauri build
```

See [Setup](/develop/setup) for prerequisites and output paths.

## Docs site releases

This documentation site (`pomodoro-docs`) deploys independently via GitHub Actions on push to `main`. It does not version-lock to app tags; update [Changelog](/changelog) when documenting app releases.
