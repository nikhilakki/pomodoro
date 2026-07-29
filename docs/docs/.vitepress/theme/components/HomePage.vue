<script setup lang="ts">
import { withBase } from "vitepress";
import {
  PhTimer,
  PhCheckSquare,
  PhChartBar,
  PhTray,
  PhPalette,
  PhLockSimple,
  PhArrowRight,
  PhDownloadSimple,
  PhBookOpen,
} from "@phosphor-icons/vue";

const features = [
  {
    icon: PhTimer,
    title: "Classic cycles",
    body: "Focus, short break, and long break. Defaults 25 / 5 / 15, long break every four focus sessions. All configurable.",
    span: "wide",
    tone: "focus",
  },
  {
    icon: PhCheckSquare,
    title: "Tasks that count",
    body: "Start Focus from a todo. Pomodoros accumulate per task under the dial.",
    span: "half",
    tone: "neutral",
  },
  {
    icon: PhChartBar,
    title: "Session history",
    body: "Local SQLite stats, a seven-day chart, and recent completed, skipped, or stopped sessions.",
    span: "half",
    tone: "neutral",
  },
  {
    icon: PhTray,
    title: "Tray + shortcuts",
    body: "Menu bar controls. Space to start or pause. Command-comma for Settings on macOS.",
    span: "third",
    tone: "break",
  },
  {
    icon: PhPalette,
    title: "Your accent",
    body: "Dial and main button color, or Auto by phase. Light and dark follow the system.",
    span: "third",
    tone: "break",
  },
  {
    icon: PhLockSimple,
    title: "Local-first",
    body: "Settings, tasks, and history stay on your machine. No account. No cloud.",
    span: "third",
    tone: "break",
  },
];

const platforms = [
  { name: "macOS", detail: "arm64 + Intel · dmg" },
  { name: "Windows", detail: "x64 + arm64 · msi / exe" },
  { name: "Linux", detail: "x64 + arm64 · AppImage / deb / rpm" },
];

const steps = [
  { title: "Install", href: "/guide/install", blurb: "Pick the binary for your OS and CPU." },
  { title: "Use it", href: "/guide/usage", blurb: "Timer, tasks, sessions, and settings." },
  { title: "Build", href: "/develop/setup", blurb: "Clone, run from source, or ship a release." },
];
</script>

<template>
  <div class="home">
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-kicker">Open source · Desktop</p>
        <h1 class="hero-title">
          Focus,<br />
          <em>simply.</em>
        </h1>
        <p class="hero-lede">
          A minimal Pomodoro timer for macOS, Windows, and Linux. Local-first,
          iOS-native UI, zero accounts.
        </p>
        <div class="hero-actions">
          <a
            class="btn btn-primary"
            href="https://github.com/nikhilakki/pomodoro/releases/latest"
          >
            <PhDownloadSimple :size="18" weight="bold" aria-hidden="true" />
            Download
          </a>
          <a class="btn btn-ghost" :href="withBase('/guide/install')">
            <PhBookOpen :size="18" weight="bold" aria-hidden="true" />
            Guide
          </a>
        </div>
      </div>

      <div class="hero-visual">
        <div class="hero-glow" aria-hidden="true" />
        <img
          class="hero-shot"
          :src="withBase('/hero-app.jpg')"
          width="720"
          height="720"
          alt="Pomodoro app window with focus ring and timer on a desk"
        />
      </div>
    </section>

    <section class="platforms" aria-label="Supported platforms">
      <ul class="platform-row">
        <li v-for="p in platforms" :key="p.name" class="platform-chip">
          <span class="platform-name">{{ p.name }}</span>
          <span class="platform-detail">{{ p.detail }}</span>
        </li>
      </ul>
    </section>

    <section class="features" aria-labelledby="features-heading">
      <div class="section-head">
        <h2 id="features-heading">Built for deep work</h2>
        <p>
          Everything you need for a classic Pomodoro loop, without the noise of
          a cloud suite.
        </p>
      </div>

      <div class="bento">
        <article
          v-for="f in features"
          :key="f.title"
          class="bento-cell"
          :class="[`span-${f.span}`, `tone-${f.tone}`]"
        >
          <div class="bento-icon" aria-hidden="true">
            <component :is="f.icon" :size="22" weight="duotone" />
          </div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.body }}</p>
        </article>
      </div>
    </section>

    <section class="path" aria-labelledby="path-heading">
      <div class="section-head">
        <h2 id="path-heading">Start here</h2>
      </div>
      <ol class="path-grid">
        <li v-for="(s, i) in steps" :key="s.title">
          <a class="path-card" :href="withBase(s.href)">
            <span class="path-index" aria-hidden="true">{{ i + 1 }}</span>
            <div>
              <h3>
                {{ s.title }}
                <PhArrowRight :size="16" weight="bold" class="path-arrow" />
              </h3>
              <p>{{ s.blurb }}</p>
            </div>
          </a>
        </li>
      </ol>
    </section>

    <section class="stack-band" aria-label="Tech stack">
      <p class="stack-line">
        Rust timer · Tauri v2 · TypeScript · Vite · SQLite · local store
      </p>
    </section>

    <section class="author">
      <p>
        By
        <a href="https://github.com/nikhilakki" rel="noreferrer">nikhilakki</a>
        ·
        <a href="https://x.com/nik_akki" rel="noreferrer">@nik_akki</a>
        · MIT
      </p>
      <a
        class="btn btn-ghost btn-sm"
        href="https://github.com/nikhilakki/pomodoro"
      >
        Source on GitHub
      </a>
    </section>
  </div>
</template>
