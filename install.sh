#!/usr/bin/env bash
set -euo pipefail

REPO="${OPENCODE_SSH_REPO:-GenRubio/opencode-ssh}"
REF="${OPENCODE_SSH_REF:-main}"
BASE_URL="https://raw.githubusercontent.com/${REPO}/${REF}"
CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
PLUGIN_NAME="opencode-ssh"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

download() {
  local from="$1"
  local to="$2"
  mkdir -p "$(dirname "$to")"
  curl -fsSL "$from" -o "$to"
  echo "Installed: $to"
}

require_cmd curl
require_cmd npm

echo "Installing ${PLUGIN_NAME} from ${REPO}@${REF}"
echo "OpenCode config: ${CONFIG_DIR}"

download "${BASE_URL}/plugins/opencode-ssh.ts" "${CONFIG_DIR}/plugins/opencode-ssh.ts"
download "${BASE_URL}/plugins/opencode-ssh/client.ts" "${CONFIG_DIR}/plugins/opencode-ssh/client.ts"
download "${BASE_URL}/plugins/opencode-ssh/store.ts" "${CONFIG_DIR}/plugins/opencode-ssh/store.ts"
download "${BASE_URL}/plugins/opencode-ssh/types.ts" "${CONFIG_DIR}/plugins/opencode-ssh/types.ts"

download "${BASE_URL}/commands/ssh-new.md" "${CONFIG_DIR}/commands/ssh-new.md"
download "${BASE_URL}/commands/ssh-list.md" "${CONFIG_DIR}/commands/ssh-list.md"
download "${BASE_URL}/commands/ssh-use.md" "${CONFIG_DIR}/commands/ssh-use.md"
download "${BASE_URL}/commands/ssh-current.md" "${CONFIG_DIR}/commands/ssh-current.md"
download "${BASE_URL}/commands/ssh-console.md" "${CONFIG_DIR}/commands/ssh-console.md"
download "${BASE_URL}/commands/ssh-run.md" "${CONFIG_DIR}/commands/ssh-run.md"
download "${BASE_URL}/commands/ssh-shell.md" "${CONFIG_DIR}/commands/ssh-shell.md"
download "${BASE_URL}/commands/ssh-shell-exit.md" "${CONFIG_DIR}/commands/ssh-shell-exit.md"

mkdir -p "${CONFIG_DIR}"

if [ ! -f "${CONFIG_DIR}/package.json" ]; then
  cat >"${CONFIG_DIR}/package.json" <<'JSON'
{
  "name": "opencode-local-config",
  "private": true,
  "dependencies": {}
}
JSON
fi

npm pkg set --prefix "${CONFIG_DIR}" \
  "dependencies.@opencode-ai/plugin=1.2.12" \
  "dependencies.ssh2=^1.16.0" >/dev/null

npm install --prefix "${CONFIG_DIR}" --silent --no-fund --no-audit

cat >"${CONFIG_DIR}/${PLUGIN_NAME}.manifest.json" <<JSON
{
  "plugin": "${PLUGIN_NAME}",
  "repo": "${REPO}",
  "ref": "${REF}",
  "installedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "configDir": "${CONFIG_DIR}",
  "files": [
    "${CONFIG_DIR}/plugins/opencode-ssh.ts",
    "${CONFIG_DIR}/plugins/opencode-ssh/client.ts",
    "${CONFIG_DIR}/plugins/opencode-ssh/store.ts",
    "${CONFIG_DIR}/plugins/opencode-ssh/types.ts",
    "${CONFIG_DIR}/commands/ssh-new.md",
    "${CONFIG_DIR}/commands/ssh-list.md",
    "${CONFIG_DIR}/commands/ssh-use.md",
    "${CONFIG_DIR}/commands/ssh-current.md",
    "${CONFIG_DIR}/commands/ssh-console.md",
    "${CONFIG_DIR}/commands/ssh-run.md",
    "${CONFIG_DIR}/commands/ssh-shell.md",
    "${CONFIG_DIR}/commands/ssh-shell-exit.md"
  ]
}
JSON

echo
echo "Done. Restart OpenCode to load the plugin."
echo "If you use GUI, fully close and reopen the app."
