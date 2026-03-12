#!/usr/bin/env bash
# =============================================================================
# setup.sh — one-time project setup
#
# Does two things:
#   1. Walks you through filling in deploy.config.yaml interactively.
#   2. Connects to the remote and bootstraps it (installs Bun, PM2,
#      creates directories, writes the .env file).
#
# Requirements (local machine):
#   yq  ≥ 4.x  — https://github.com/mikefarah/yq
#     macOS:   brew install yq
#     Windows: winget install MikeFarah.yq   (run in Git Bash / WSL)
#     Linux:   snap install yq
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/../deploy.config.yaml"

# ── Helpers ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }

# Read current value from config.
cfg_get() { yq e ".$1" "$CONFIG"; }

# Write a value to config.
cfg_set() { yq e ".$1 = \"$2\"" -i "$CONFIG"; }

# Prompt user; if they press Enter use the current config value as default.
prompt() {
    local key="$1"
    local label="$2"
    local current
    current="$(cfg_get "$key")"

    if [[ -n "$current" && "$current" != "null" && "$current" != '""' ]]; then
        read -rp "  $label [$current]: " value
        value="${value:-$current}"
    else
        read -rp "  $label: " value
    fi

    cfg_set "$key" "$value"
    echo "$value"
}

# ── Preflight ─────────────────────────────────────────────────────────────────

if ! command -v yq &>/dev/null; then
    echo "ERROR: yq is not installed."
    echo ""
    echo "Install it first:"
    echo "  macOS:   brew install yq"
    echo "  Windows: winget install MikeFarah.yq  (then restart your shell)"
    echo "  Linux:   snap install yq"
    exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
    echo "ERROR: $CONFIG not found. Run this script from the project root."
    exit 1
fi

# ── Step 1: fill in deploy.config.yaml ───────────────────────────────────────

echo ""
echo -e "${CYAN}══════════════════════════════════════════${RESET}"
echo -e "${CYAN}  KWT — deployment setup${RESET}"
echo -e "${CYAN}══════════════════════════════════════════${RESET}"
echo ""
info "Filling in deploy.config.yaml — press Enter to keep the current value."
echo ""

SSH_ALIAS=$(prompt "remote.ssh_alias"   "SSH alias (e.g. rpi or pi@192.168.1.10)")
DEPLOY_PATH=$(prompt "remote.deploy_path" "Remote deploy directory")
DATA_PATH=$(prompt  "remote.data_path"  "Remote data directory (database lives here)")
PORT=$(prompt       "app.port"           "Application port")
ORIGIN=$(prompt     "app.origin"         "Public URL (e.g. https://kwt.example.com)")

echo ""
warn "The admin password is stored in deploy.config.yaml in plain text."
warn "Make sure this file is in your .gitignore."
ADMIN_PW=$(prompt "app.admin_password" "Admin panel password (leave empty to disable)")

echo ""
success "deploy.config.yaml updated."

# ── Step 2: make sure .gitignore protects the config ─────────────────────────

GITIGNORE="$SCRIPT_DIR/../.gitignore"
if ! grep -q "deploy.config.yaml" "$GITIGNORE" 2>/dev/null; then
    echo "" >> "$GITIGNORE"
    echo "# Deployment config contains secrets" >> "$GITIGNORE"
    echo "deploy.config.yaml" >> "$GITIGNORE"
    warn "Added deploy.config.yaml to .gitignore."
fi

# ── Step 3: bootstrap the remote ─────────────────────────────────────────────

echo ""
read -rp "Bootstrap the remote server now? [Y/n]: " do_bootstrap
do_bootstrap="${do_bootstrap:-Y}"

if [[ ! "$do_bootstrap" =~ ^[Yy]$ ]]; then
    success "Skipping remote bootstrap. Run 'bash scripts/setup.sh' again when ready."
    exit 0
fi

info "Connecting to $SSH_ALIAS…"

ssh "$SSH_ALIAS" bash << REMOTE
set -euo pipefail

echo ""
echo "[remote] Creating directories…"
mkdir -p "$DEPLOY_PATH" "$DATA_PATH"

echo "[remote] Installing Bun…"
if command -v bun &>/dev/null; then
    echo "[remote] Bun already installed: \$(bun --version)"
else
    curl -fsSL https://bun.sh/install | bash
    # Make bun available in this session
    export BUN_INSTALL="\$HOME/.bun"
    export PATH="\$BUN_INSTALL/bin:\$PATH"
    echo "[remote] Bun installed: \$(bun --version)"
fi

export BUN_INSTALL="\$HOME/.bun"
export PATH="\$BUN_INSTALL/bin:\$PATH"

echo "[remote] Installing PM2…"
if command -v pm2 &>/dev/null; then
    echo "[remote] PM2 already installed: \$(pm2 --version)"
else
    bun install -g pm2
    echo "[remote] PM2 installed."
fi

echo "[remote] Writing .env…"
cat > "$DEPLOY_PATH/.env" << 'ENV'
ADMIN_PASSWORD=$ADMIN_PW
ORIGIN=$ORIGIN
PORT=$PORT
DATA_DIR=$DATA_PATH
ENV

echo "[remote] .env written to $DEPLOY_PATH/.env"
echo ""
echo "[remote] Bootstrap complete."
REMOTE

echo ""
success "Remote is ready."
echo ""
info "Next step: run 'bash scripts/deploy.sh' to build and deploy the app."
echo ""