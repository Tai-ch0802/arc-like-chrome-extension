#!/bin/bash
set -euo pipefail

# ============================================================
# GitHub Actions Self-Hosted Runner - One-Shot VM Setup Script
# ============================================================
# Target OS: Ubuntu 24.04 LTS (bare VM, no Docker)
#
# Usage:
#   1. Copy this script to your VM
#   2. Create a .env file next to this script (see .env.example)
#   3. Run: sudo bash setup-runner.sh
#
# What this script does:
#   Phase 1: Install system dependencies (apt packages, Node.js)
#   Phase 2: Create runner user
#   Phase 3: Download & configure GitHub Actions Runner
#   Phase 4: Register runner with GitHub
#   Phase 5: Install & start as systemd service
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Load .env file ---
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "📄 Loading .env file..."
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
else
    echo "❌ .env file not found at ${SCRIPT_DIR}/.env"
    echo "   Please create one from .env.example:"
    echo "   cp .env.example .env && nano .env"
    exit 1
fi

# --- Validate required env vars ---
: "${GITHUB_OWNER:?Error: GITHUB_OWNER is required in .env}"
: "${GITHUB_REPO:?Error: GITHUB_REPO is required in .env}"
: "${GITHUB_TOKEN:?Error: GITHUB_TOKEN is required in .env}"
RUNNER_VERSION="${RUNNER_VERSION:-2.331.0}"
RUNNER_ARCH="${RUNNER_ARCH:-x64}"
RUNNER_NAME="${RUNNER_NAME:-vm-runner-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,linux,x64}"
RUNNER_WORKDIR="${RUNNER_WORKDIR:-_work}"
RUNNER_USER="${RUNNER_USER:-runner}"
RUNNER_HOME="/home/${RUNNER_USER}"

echo ""
echo "============================================"
echo "  GitHub Actions Self-Hosted Runner Setup"
echo "============================================"
echo "  Repository : ${GITHUB_OWNER}/${GITHUB_REPO}"
echo "  Runner     : ${RUNNER_NAME}"
echo "  Labels     : ${RUNNER_LABELS}"
echo "  Version    : ${RUNNER_VERSION}"
echo "  User       : ${RUNNER_USER}"
echo "============================================"
echo ""

# ============================================================
# Phase 1: Install system dependencies
# ============================================================
echo "📦 [Phase 1/5] Installing system dependencies..."

# Install base dependencies + Chrome/Chromium shared libraries for Puppeteer
# Ref: https://pptr.dev/troubleshooting#chrome-doesnt-launch-on-linux
export DEBIAN_FRONTEND=noninteractive

apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    git \
    sudo \
    unzip \
    zip \
    build-essential \
    libssl-dev \
    libffi-dev \
    libicu-dev \
    python3 \
    python3-pip \
    ca-certificates \
    gnupg \
    lsb-release \
    wget \
    xdg-utils \
    dbus \
    fonts-liberation \
    libasound2t64 \
    libatk-bridge2.0-0t64 \
    libatk1.0-0t64 \
    libc6 \
    libcairo2 \
    libcups2t64 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0t64 \
    libgtk-3-0t64 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf

echo "✅ System dependencies installed."

# --- Install Node.js 20.x ---
echo "📦 Installing Node.js 20.x..."

if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "✅ Node.js $(node -v) installed."
else
    echo "✅ Node.js $(node -v) already installed, skipping."
fi

# ============================================================
# Phase 2: Create runner user
# ============================================================
echo ""
echo "👤 [Phase 2/5] Setting up runner user '${RUNNER_USER}'..."

if id "${RUNNER_USER}" &>/dev/null; then
    echo "✅ User '${RUNNER_USER}' already exists, skipping."
else
    useradd -m -s /bin/bash "${RUNNER_USER}"
    usermod -aG audio,video "${RUNNER_USER}"
    echo "${RUNNER_USER} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
    echo "✅ User '${RUNNER_USER}' created."
fi

# ============================================================
# Phase 3: Download & extract GitHub Actions Runner
# ============================================================
echo ""
echo "⬇️  [Phase 3/5] Downloading GitHub Actions Runner v${RUNNER_VERSION}..."

RUNNER_DIR="${RUNNER_HOME}/actions-runner"
RUNNER_TAR="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"

if [ -d "${RUNNER_DIR}" ] && [ -f "${RUNNER_DIR}/run.sh" ]; then
    echo "✅ Runner already downloaded at ${RUNNER_DIR}, skipping."
else
    mkdir -p "${RUNNER_DIR}"
    cd "${RUNNER_DIR}"

    curl -o "${RUNNER_TAR}" -L \
        "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TAR}"

    tar xzf "${RUNNER_TAR}"
    rm -f "${RUNNER_TAR}"

    # Install runner dependencies
    ./bin/installdependencies.sh

    chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"
    echo "✅ Runner downloaded and extracted to ${RUNNER_DIR}."
fi

# ============================================================
# Phase 4: Register runner with GitHub
# ============================================================
echo ""
echo "🔑 [Phase 4/5] Registering runner with GitHub..."

# Request registration token
REG_TOKEN=$(curl -s -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runners/registration-token" \
    | jq -r '.token')

if [ "${REG_TOKEN}" = "null" ] || [ -z "${REG_TOKEN}" ]; then
    echo "❌ Failed to obtain registration token."
    echo "   Check your GITHUB_TOKEN permissions (needs 'repo' or 'Administration: Read & Write')."
    exit 1
fi

echo "✅ Registration token obtained."

# Configure the runner (as runner user)
cd "${RUNNER_DIR}"
sudo -u "${RUNNER_USER}" ./config.sh \
    --url "https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" \
    --token "${REG_TOKEN}" \
    --name "${RUNNER_NAME}" \
    --labels "${RUNNER_LABELS}" \
    --work "${RUNNER_WORKDIR}" \
    --unattended \
    --replace

echo "✅ Runner configured."

# ============================================================
# Phase 5: Install & start as systemd service
# ============================================================
echo ""
echo "🚀 [Phase 5/5] Installing runner as systemd service..."

cd "${RUNNER_DIR}"

# Use the official svc.sh to install as a service
./svc.sh install "${RUNNER_USER}"
./svc.sh start

echo ""
echo "============================================"
echo "  ✅ Setup Complete!"
echo "============================================"
echo ""
echo "  Runner '${RUNNER_NAME}' is now running as a systemd service."
echo ""
echo "  Useful commands:"
echo "    Status:  sudo ${RUNNER_DIR}/svc.sh status"
echo "    Stop:    sudo ${RUNNER_DIR}/svc.sh stop"
echo "    Start:   sudo ${RUNNER_DIR}/svc.sh start"
echo "    Uninstall: sudo ${RUNNER_DIR}/svc.sh uninstall"
echo ""
echo "  Check runner at:"
echo "    https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/settings/actions/runners"
echo ""
