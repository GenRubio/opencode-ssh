#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
PLUGIN_NAME="opencode-ssh"
MANIFEST_PATH="${CONFIG_DIR}/${PLUGIN_NAME}.manifest.json"

remove_path() {
  local target="$1"
  if [ -e "$target" ]; then
    rm -rf "$target"
    echo "Removed: $target"
  fi
}

if [ -f "$MANIFEST_PATH" ]; then
  if command -v node >/dev/null 2>&1; then
    while IFS= read -r line; do
      [ -n "$line" ] && remove_path "$line"
    done < <(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));for(const f of (m.files||[])) console.log(f)" "$MANIFEST_PATH")
  fi
fi

remove_path "${CONFIG_DIR}/plugins/opencode-ssh.ts"
remove_path "${CONFIG_DIR}/plugins/opencode-ssh"
remove_path "${CONFIG_DIR}/commands/ssh-new.md"
remove_path "${CONFIG_DIR}/commands/ssh-list.md"
remove_path "${CONFIG_DIR}/commands/ssh-use.md"
remove_path "${CONFIG_DIR}/commands/ssh-current.md"
remove_path "${CONFIG_DIR}/commands/ssh-run.md"
remove_path "$MANIFEST_PATH"

echo "Done. Restart OpenCode to apply changes."
