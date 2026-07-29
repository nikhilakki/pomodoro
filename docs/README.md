# Pomodoro Docs

Documentation site for [nikhilakki/pomodoro](https://github.com/nikhilakki/pomodoro), built with [VitePress](https://vitepress.dev) and published to GitHub Pages.

## Local development

```bash
pnpm install
pnpm dev
```

Open the URL printed in the terminal (usually `http://localhost:5173/pomodoro-docs/`).

## Build

```bash
pnpm build
```

Static output lands in `docs/.vitepress/dist`.

## Preview production build

```bash
pnpm build && pnpm preview
```

## GitHub Pages setup

1. Push this repo to GitHub (e.g. `nikhilakki/pomodoro-docs`).
2. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
3. The workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys on every push to `main`.
4. Site URL (project pages): `https://<user>.github.io/pomodoro-docs/`

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
