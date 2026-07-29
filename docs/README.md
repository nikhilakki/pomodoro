# Pomodoro Docs

Documentation site for [nikhilakki/pomodoro](https://github.com/nikhilakki/pomodoro), built with [VitePress](https://vitepress.dev).

**Source of truth:** this folder (`docs/`) in the app repo.  
**Hosted site:** [nikhilakki.github.io/pomodoro-docs](https://nikhilakki.github.io/pomodoro-docs/) via the [nikhilakki/pomodoro-docs](https://github.com/nikhilakki/pomodoro-docs) repository (build output only).

## Local development

From the repo root:

```bash
cd docs
pnpm install
pnpm dev
```

Open the URL printed in the terminal (usually `http://localhost:5173/pomodoro-docs/`).

## Build

```bash
cd docs
pnpm build
```

Static output lands in `docs/.vitepress/dist` (relative to this package, i.e. `docs/docs/.vitepress/dist` from the monorepo root).

## Preview production build

```bash
pnpm build && pnpm preview
```

## Publishing to GitHub Pages

On every push to `main` that touches `docs/**` (or via **workflow_dispatch**), [`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml):

1. Builds VitePress from this package.
2. Force-publishes the static files to `nikhilakki/pomodoro-docs` on `main`.

### One-time setup

1. Create a **fine-grained personal access token** (or classic PAT) with **Contents: Read and write** on `nikhilakki/pomodoro-docs`.
2. In the **pomodoro** repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `POMODORO_DOCS_DEPLOY_TOKEN`
   - Value: the token
3. In **pomodoro-docs**: **Settings → Pages**
   - **Source:** Deploy from a branch
   - **Branch:** `main` / `/` (root)
4. After the first successful deploy, the site is at  
   `https://nikhilakki.github.io/pomodoro-docs/`

> The `pomodoro-docs` repo should only contain the generated site. Edit content here in `pomodoro`, not in that hosting repo.

### Base path

`docs/.vitepress/config.ts` sets `base: '/pomodoro-docs/'` for project GitHub Pages.

If you use a **custom domain** or host at the site root, change:

```ts
base: '/',
```

…and update any absolute links if needed.

## Content map

| Path | Topic |
| ---- | ----- |
| `docs/index.md` | Landing |
| `docs/guide/` | Install, usage, privacy, keyboard |
| `docs/develop/` | Setup, architecture, releasing |
| `docs/faq.md` | FAQ |
| `docs/changelog.md` | Release notes |

## License

Docs content is MIT, same as the app. © 2026 nikhilakki
