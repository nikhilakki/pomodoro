#!/usr/bin/env bash
# Pomodoro installer — macOS & Linux
#
# Install the latest release (or a pinned version) from GitHub.
#
#   curl -fsSL https://atmd.cc/pomodoro | bash
#
# Options (env vars):
#   POMODORO_VERSION   Tag without leading v, e.g. 0.1.1  (default: latest)
#   POMODORO_FORMAT    Force package: dmg | deb | rpm | appimage
#   POMODORO_INSTALL_DIR  AppImage install dir (default: ~/.local/bin)
#   POMODORO_PREFIX    macOS .app destination (default: /Applications)
#   POMODORO_NO_SUDO  Set to 1 to never invoke sudo (AppImage / user install only)
#   POMODORO_DRY_RUN   Set to 1 to print actions without installing
#
# Examples:
#   POMODORO_VERSION=0.1.1 bash install.sh
#   POMODORO_FORMAT=appimage curl -fsSL ... | bash
#   POMODORO_DRY_RUN=1 bash install.sh

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REPO_OWNER="${POMODORO_REPO_OWNER:-nikhilakki}"
REPO_NAME="${POMODORO_REPO_NAME:-pomodoro}"
REPO="${REPO_OWNER}/${REPO_NAME}"
GITHUB_API="https://api.github.com/repos/${REPO}"
GITHUB_DOWNLOAD="https://github.com/${REPO}/releases/download"
PRODUCT_NAME="Pomodoro"
APP_NAME="Pomodoro.app"

# ---------------------------------------------------------------------------
# Colors (TTY only)
# ---------------------------------------------------------------------------
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
  BOLD="$(tput bold 2>/dev/null || true)"
  DIM="$(tput dim 2>/dev/null || true)"
  RED="$(tput setaf 1 2>/dev/null || true)"
  GREEN="$(tput setaf 2 2>/dev/null || true)"
  YELLOW="$(tput setaf 3 2>/dev/null || true)"
  CYAN="$(tput setaf 6 2>/dev/null || true)"
  RESET="$(tput sgr0 2>/dev/null || true)"
else
  BOLD="" DIM="" RED="" GREEN="" YELLOW="" CYAN="" RESET=""
fi

# All diagnostics go to stderr so command substitutions only capture return values.
info()  { printf '%s==>%s %s\n' "${CYAN}${BOLD}" "${RESET}" "$*" >&2; }
ok()    { printf '%s✓%s  %s\n' "${GREEN}" "${RESET}" "$*" >&2; }
warn()  { printf '%s!%s  %s\n' "${YELLOW}" "${RESET}" "$*" >&2; }
err()   { printf '%serror:%s %s\n' "${RED}${BOLD}" "${RESET}" "$*" >&2; }
die()   { err "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
TMPDIR_INSTALL=""
MOUNT_POINT=""
cleanup() {
  local code=$?
  if [[ -n "${MOUNT_POINT}" && -d "${MOUNT_POINT}" ]]; then
    hdiutil detach "${MOUNT_POINT}" -quiet 2>/dev/null || true
  fi
  if [[ -n "${TMPDIR_INSTALL}" && -d "${TMPDIR_INSTALL}" ]]; then
    rm -rf "${TMPDIR_INSTALL}" 2>/dev/null || true
  fi
  exit "${code}"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

need_cmd() {
  have "$1" || die "Required command not found: $1"
}

# Run with sudo only when not root and sudo is available.
run_priv() {
  if [[ "${POMODORO_NO_SUDO:-0}" == "1" ]]; then
    die "This step needs elevated privileges, but POMODORO_NO_SUDO=1 is set.
Install an AppImage instead:
  POMODORO_FORMAT=appimage curl -fsSL https://atmd.cc/pomodoro | bash"
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif have sudo; then
    info "Elevated privileges required for: $*"
    sudo "$@"
  else
    die "Need root privileges (install sudo or re-run as root) to run: $*"
  fi
}

is_dry_run() { [[ "${POMODORO_DRY_RUN:-0}" == "1" ]]; }

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
detect_os() {
  local uname_s
  uname_s="$(uname -s)"
  case "${uname_s}" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*)
      die "Windows is not supported by this shell installer.
Download an installer from: https://github.com/${REPO}/releases/latest" ;;
    *) die "Unsupported operating system: ${uname_s}" ;;
  esac
}

detect_arch() {
  local uname_m
  uname_m="$(uname -m)"
  case "${uname_m}" in
    x86_64|amd64)   echo "x86_64" ;;
    aarch64|arm64)  echo "aarch64" ;;
    armv7l|armv7)   die "32-bit ARM is not supported. Use a 64-bit (aarch64) system." ;;
    i386|i686)      die "32-bit x86 is not supported. Use a 64-bit (x86_64) system." ;;
    *)              die "Unsupported CPU architecture: ${uname_m}" ;;
  esac
}

# Map internal arch to asset name tokens used by Tauri / this project.
# macOS:  aarch64 | x64
# Linux AppImage: aarch64 | amd64
# Linux deb:      arm64 | amd64
# Linux rpm:      aarch64 | x86_64
arch_token_macos() {
  case "$1" in
    aarch64) echo "aarch64" ;;
    x86_64)  echo "x64" ;;
  esac
}

arch_token_appimage() {
  case "$1" in
    aarch64) echo "aarch64" ;;
    x86_64)  echo "amd64" ;;
  esac
}

arch_token_deb() {
  case "$1" in
    aarch64) echo "arm64" ;;
    x86_64)  echo "amd64" ;;
  esac
}

arch_token_rpm() {
  case "$1" in
    aarch64) echo "aarch64" ;;
    x86_64)  echo "x86_64" ;;
  esac
}

# Detect preferred Linux package format from the distro.
detect_linux_format() {
  if [[ -n "${POMODORO_FORMAT:-}" ]]; then
    echo "${POMODORO_FORMAT}"
    return
  fi

  # ID_LIKE and ID from os-release
  local id="" id_like=""
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    id="${ID:-}"
    id_like="${ID_LIKE:-}"
  fi

  local combined
  combined="$(printf '%s %s' "${id}" "${id_like}" | tr '[:upper:]' '[:lower:]')"

  if printf '%s' "${combined}" | grep -Eq '(debian|ubuntu|linuxmint|pop|elementary|raspbian|kali|neon|zorin|mx|devuan)'; then
    if have dpkg || have apt-get || have apt; then
      echo "deb"
      return
    fi
  fi

  if printf '%s' "${combined}" | grep -Eq '(rhel|fedora|centos|rocky|alma|ol|oracle|amzn|amazon|mageia|openmandriva|nobara)'; then
    if have rpm || have dnf || have yum || have microdnf; then
      echo "rpm"
      return
    fi
  fi

  # openSUSE / SUSE
  if printf '%s' "${combined}" | grep -Eq '(suse|opensuse|sles)'; then
    if have rpm || have zypper; then
      echo "rpm"
      return
    fi
  fi

  # Arch, Alpine, Gentoo, NixOS, Void, etc. → AppImage (portable)
  echo "appimage"
}

# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------
http_get() {
  # $1 = url, $2 = optional output file (- for stdout)
  local url="$1"
  local out="${2:--}"

  if have curl; then
    if [[ "${out}" == "-" ]]; then
      curl -fsSL --retry 3 --retry-delay 1 \
        -H "Accept: application/vnd.github+json" \
        -H "User-Agent: pomodoro-install/1.0" \
        "${url}"
    else
      curl -fsSL --retry 3 --retry-delay 1 --progress-bar \
        -H "User-Agent: pomodoro-install/1.0" \
        -o "${out}" \
        "${url}"
    fi
  elif have wget; then
    if [[ "${out}" == "-" ]]; then
      wget -qO- --tries=3 \
        --header="Accept: application/vnd.github+json" \
        --header="User-Agent: pomodoro-install/1.0" \
        "${url}"
    else
      wget -q --tries=3 --show-progress \
        --header="User-Agent: pomodoro-install/1.0" \
        -O "${out}" \
        "${url}"
    fi
  else
    die "Need curl or wget to download releases."
  fi
}

resolve_version() {
  # Prints version without leading "v"
  if [[ -n "${POMODORO_VERSION:-}" ]]; then
    local v="${POMODORO_VERSION#v}"
    echo "${v}"
    return
  fi

  info "Resolving latest release…"
  local json tag
  if ! json="$(http_get "${GITHUB_API}/releases/latest" - 2>/dev/null)"; then
    die "Could not fetch latest release from GitHub.
Check network access or set POMODORO_VERSION explicitly.
  Releases: https://github.com/${REPO}/releases"
  fi

  # Prefer jq if present; otherwise lightweight parse.
  if have jq; then
    tag="$(printf '%s' "${json}" | jq -r '.tag_name // empty')"
  else
    tag="$(printf '%s' "${json}" \
      | tr ',' '\n' \
      | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n1)"
  fi

  [[ -n "${tag}" && "${tag}" != "null" ]] || die "Could not parse latest release tag."
  echo "${tag#v}"
}

asset_url() {
  # $1 = version (no v), $2 = filename
  printf '%s/v%s/%s' "${GITHUB_DOWNLOAD}" "$1" "$2"
}

download_asset() {
  # $1 = version, $2 = filename, $3 = dest path
  local version="$1" filename="$2" dest="$3"
  local url
  url="$(asset_url "${version}" "${filename}")"

  info "Downloading ${filename}…"
  if is_dry_run; then
    printf '    %s\n' "${url}" >&2
    return 0
  fi

  if ! http_get "${url}" "${dest}"; then
    die "Download failed:
  ${url}

Verify the release exists and includes this asset:
  https://github.com/${REPO}/releases/tag/v${version}"
  fi

  [[ -s "${dest}" ]] || die "Downloaded file is empty: ${dest}"
  ok "Downloaded $(du -h "${dest}" 2>/dev/null | awk '{print $1}') → ${filename}"
}

# ---------------------------------------------------------------------------
# Installers
# ---------------------------------------------------------------------------
install_macos() {
  local version="$1" arch="$2"
  local token filename dest mount_name app_src

  token="$(arch_token_macos "${arch}")"
  filename="${PRODUCT_NAME}_${version}_${token}.dmg"

  TMPDIR_INSTALL="$(mktemp -d "${TMPDIR:-/tmp}/pomodoro-install.XXXXXX")"
  dest="${TMPDIR_INSTALL}/${filename}"

  download_asset "${version}" "${filename}" "${dest}"

  if is_dry_run; then
    info "[dry-run] Would mount DMG and install ${APP_NAME} to ${POMODORO_PREFIX:-/Applications}"
    return 0
  fi

  info "Mounting DMG…"
  # hdiutil prints mount path; attach without opening Finder
  local attach_out
  if ! attach_out="$(hdiutil attach "${dest}" -nobrowse -readonly 2>&1)"; then
    die "Failed to mount DMG:
${attach_out}"
  fi

  MOUNT_POINT="$(printf '%s\n' "${attach_out}" | sed -n 's/.*\(\/Volumes\/.*\)$/\1/p' | tail -n1)"
  [[ -n "${MOUNT_POINT}" && -d "${MOUNT_POINT}" ]] || die "Could not determine DMG mount point."

  app_src="$(find "${MOUNT_POINT}" -maxdepth 2 -name "${APP_NAME}" -type d 2>/dev/null | head -n1)"
  [[ -n "${app_src}" ]] || die "Could not find ${APP_NAME} inside the DMG."

  local prefix="${POMODORO_PREFIX:-/Applications}"
  local target="${prefix}/${APP_NAME}"

  info "Installing to ${target}…"
  if [[ -d "${target}" ]]; then
    warn "Replacing existing ${target}"
    if [[ -w "${prefix}" ]]; then
      rm -rf "${target}"
    else
      run_priv rm -rf "${target}"
    fi
  fi

  if [[ -w "${prefix}" ]]; then
    mkdir -p "${prefix}"
    cp -R "${app_src}" "${target}"
  else
    run_priv mkdir -p "${prefix}"
    run_priv cp -R "${app_src}" "${target}"
  fi

  # Detach before Gatekeeper clear so file is fully written
  hdiutil detach "${MOUNT_POINT}" -quiet 2>/dev/null || hdiutil detach "${MOUNT_POINT}" -force -quiet 2>/dev/null || true
  MOUNT_POINT=""

  info "Clearing quarantine (Gatekeeper)…"
  if have xattr; then
    if [[ -w "${target}" ]]; then
      xattr -cr "${target}" 2>/dev/null || true
    else
      run_priv xattr -cr "${target}" 2>/dev/null || true
    fi
  fi

  ok "Installed ${APP_NAME} → ${target}"
  printf '\n' >&2
  printf '  Open from Launchpad / Applications, or:\n' >&2
  printf '    open %s\n' "${target}" >&2
  printf '\n' >&2
  printf '  If macOS still says the app is “damaged”, run:\n' >&2
  printf '    xattr -cr %s\n' "${target}" >&2
  printf '\n' >&2
}

install_linux_deb() {
  local version="$1" arch="$2"
  local token filename dest
  token="$(arch_token_deb "${arch}")"
  filename="${PRODUCT_NAME}_${version}_${token}.deb"

  TMPDIR_INSTALL="$(mktemp -d "${TMPDIR:-/tmp}/pomodoro-install.XXXXXX")"
  dest="${TMPDIR_INSTALL}/${filename}"
  download_asset "${version}" "${filename}" "${dest}"

  if is_dry_run; then
    info "[dry-run] Would install ${filename} with apt/dpkg"
    return 0
  fi

  info "Installing .deb package…"
  if have apt-get; then
    # apt handles dependencies better than bare dpkg
    run_priv apt-get install -y "${dest}" || {
      run_priv dpkg -i "${dest}" || true
      run_priv apt-get install -f -y
    }
  elif have apt; then
    run_priv apt install -y "${dest}" || {
      run_priv dpkg -i "${dest}" || true
      run_priv apt install -f -y
    }
  elif have dpkg; then
    run_priv dpkg -i "${dest}" || {
      warn "dpkg reported missing dependencies; try: sudo apt-get install -f"
      die "Package install incomplete."
    }
  else
    die "No dpkg/apt found. Force AppImage:
  POMODORO_FORMAT=appimage curl -fsSL https://atmd.cc/pomodoro | bash"
  fi

  ok "Installed ${PRODUCT_NAME} (.deb)"
  printf '\n  Launch from your app menu, or run:  pomodoro\n\n' >&2
}

install_linux_rpm() {
  local version="$1" arch="$2"
  local token filename dest
  token="$(arch_token_rpm "${arch}")"
  # Tauri rpm naming: Pomodoro-0.1.1-1.x86_64.rpm
  filename="${PRODUCT_NAME}-${version}-1.${token}.rpm"

  TMPDIR_INSTALL="$(mktemp -d "${TMPDIR:-/tmp}/pomodoro-install.XXXXXX")"
  dest="${TMPDIR_INSTALL}/${filename}"
  download_asset "${version}" "${filename}" "${dest}"

  if is_dry_run; then
    info "[dry-run] Would install ${filename} with dnf/yum/zypper/rpm"
    return 0
  fi

  info "Installing .rpm package…"
  if have dnf; then
    run_priv dnf install -y "${dest}"
  elif have microdnf; then
    run_priv microdnf install -y "${dest}"
  elif have yum; then
    run_priv yum install -y "${dest}"
  elif have zypper; then
    run_priv zypper --non-interactive install "${dest}"
  elif have rpm; then
    run_priv rpm -Uvh "${dest}"
  else
    die "No rpm/dnf/yum/zypper found. Force AppImage:
  POMODORO_FORMAT=appimage curl -fsSL https://atmd.cc/pomodoro | bash"
  fi

  ok "Installed ${PRODUCT_NAME} (.rpm)"
  printf '\n  Launch from your app menu, or run:  pomodoro\n\n' >&2
}

install_linux_appimage() {
  local version="$1" arch="$2"
  local token filename dest install_dir target

  token="$(arch_token_appimage "${arch}")"
  filename="${PRODUCT_NAME}_${version}_${token}.AppImage"

  install_dir="${POMODORO_INSTALL_DIR:-${HOME}/.local/bin}"
  # Normalize trailing slash
  install_dir="${install_dir%/}"
  target="${install_dir}/pomodoro"

  TMPDIR_INSTALL="$(mktemp -d "${TMPDIR:-/tmp}/pomodoro-install.XXXXXX")"
  dest="${TMPDIR_INSTALL}/${filename}"
  download_asset "${version}" "${filename}" "${dest}"

  if is_dry_run; then
    info "[dry-run] Would install AppImage → ${target}"
    return 0
  fi

  info "Installing AppImage → ${target}"
  mkdir -p "${install_dir}"
  # Atomic-ish replace
  cp "${dest}" "${target}.new"
  chmod +x "${target}.new"
  mv -f "${target}.new" "${target}"

  # Optional desktop entry for GUI environments
  local apps_dir="${HOME}/.local/share/applications"
  local desktop="${apps_dir}/pomodoro.desktop"
  if mkdir -p "${apps_dir}" 2>/dev/null; then
    cat > "${desktop}" <<EOF
[Desktop Entry]
Type=Application
Name=Pomodoro
Comment=Minimal Pomodoro timer
Exec=${target}
Terminal=false
Categories=Utility;Office;
StartupNotify=true
EOF
    if have update-desktop-database; then
      update-desktop-database "${apps_dir}" 2>/dev/null || true
    fi
    ok "Desktop entry → ${desktop}"
  fi

  ok "Installed AppImage → ${target}"

  case ":${PATH}:" in
    *":${install_dir}:"*) ;;
    *)
      warn "${install_dir} is not on your PATH."
      printf '  Add this to your shell profile (~/.bashrc, ~/.zshrc, …):\n' >&2
      printf '    export PATH="%s:$PATH"\n' "${install_dir}" >&2
      printf '\n' >&2
      ;;
  esac

  printf '\n  Run:  pomodoro\n' >&2
  printf '  Or:   %s\n\n' "${target}" >&2
}

install_linux() {
  local version="$1" arch="$2"
  local format
  format="$(detect_linux_format)"

  # Normalize user override
  case "${format}" in
    deb|rpm|appimage|AppImage)
      format="$(printf '%s' "${format}" | tr '[:upper:]' '[:lower:]')"
      ;;
    dmg)
      die "POMODORO_FORMAT=dmg is only valid on macOS."
      ;;
    *)
      die "Unknown POMODORO_FORMAT='${format}'. Use: deb | rpm | appimage"
      ;;
  esac

  info "Package format: ${format}"

  case "${format}" in
    deb)      install_linux_deb "${version}" "${arch}" ;;
    rpm)      install_linux_rpm "${version}" "${arch}" ;;
    appimage) install_linux_appimage "${version}" "${arch}" ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  printf '\n' >&2
  printf '%s  🍅  Pomodoro installer%s\n' "${BOLD}" "${RESET}" >&2
  printf '%s  https://github.com/%s%s\n\n' "${DIM}" "${REPO}" "${RESET}" >&2

  need_cmd uname
  need_cmd mktemp
  need_cmd id

  local os arch version
  os="$(detect_os)"
  arch="$(detect_arch)"
  version="$(resolve_version)"

  info "OS: ${os}  ·  Arch: ${arch}  ·  Version: v${version}"
  if is_dry_run; then
    warn "Dry-run mode (POMODORO_DRY_RUN=1) — no files will be installed."
  fi

  case "${os}" in
    macos)
      if [[ -n "${POMODORO_FORMAT:-}" && "${POMODORO_FORMAT}" != "dmg" ]]; then
        warn "Ignoring POMODORO_FORMAT=${POMODORO_FORMAT} on macOS (using .dmg)."
      fi
      need_cmd hdiutil
      need_cmd cp
      install_macos "${version}" "${arch}"
      ;;
    linux)
      install_linux "${version}" "${arch}"
      ;;
  esac

  ok "Done."
  printf '  Docs: https://nikhilakki.github.io/pomodoro-docs/\n' >&2
  printf '  Issues: https://github.com/%s/issues\n\n' "${REPO}" >&2
}

main "$@"
