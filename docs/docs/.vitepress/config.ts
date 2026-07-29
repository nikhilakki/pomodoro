import { defineConfig } from "vitepress";

// Custom domain: https://pomodoro.nikhilakki.com/
// Project Pages path (nikhilakki.github.io/pomodoro-docs/) needs base: '/pomodoro-docs/'.
const base = "/";

export default defineConfig({
  title: "Pomodoro",
  description:
    "Minimal, iOS-native Pomodoro timer for macOS, Windows, and Linux. Local-first, open source.",
  base,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  appearance: true,

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}favicon.svg` }],
    ["meta", { name: "theme-color", content: "#e03a30" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Pomodoro" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Minimal Pomodoro timer for macOS, Windows, and Linux. Local-first, open source.",
      },
    ],
    ["meta", { property: "og:image", content: `${base}hero-app.jpg` }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],

  themeConfig: {
    logo: { src: "/logo.svg", alt: "Pomodoro" },
    siteTitle: "Pomodoro",

    nav: [
      { text: "Guide", link: "/guide/install", activeMatch: "/guide/" },
      { text: "Develop", link: "/develop/setup", activeMatch: "/develop/" },
      { text: "FAQ", link: "/faq" },
      { text: "Changelog", link: "/changelog" },
      {
        text: "Download",
        link: "https://github.com/nikhilakki/pomodoro/releases/latest",
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Install", link: "/guide/install" },
            { text: "Using the app", link: "/guide/usage" },
            { text: "Keyboard shortcuts", link: "/guide/keyboard" },
            { text: "Privacy", link: "/guide/privacy" },
          ],
        },
      ],
      "/develop/": [
        {
          text: "Develop",
          items: [
            { text: "Setup from source", link: "/develop/setup" },
            { text: "Architecture", link: "/develop/architecture" },
            { text: "Releasing", link: "/develop/releasing" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/nikhilakki/pomodoro" },
      { icon: "x", link: "https://x.com/nik_akki" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 nikhilakki",
    },

    editLink: {
      pattern:
        "https://github.com/nikhilakki/pomodoro/edit/main/docs/docs/:path",
      text: "Edit this page on GitHub",
    },

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
    },

    externalLinkIcon: true,
  },
});
