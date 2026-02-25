# OpenCode SSH Plugin Specification

## Goal

Build an OpenCode plugin that executes remote actions over SSH from chat, using slash commands and a selectable active server context.

## Core Commands (MVP)

- `/ssh-new` -> create a saved SSH profile
- `/ssh-list` -> list saved profiles
- `/ssh-use <alias>` -> set active profile
- `/ssh-current` -> show current active profile
- `/ssh-run <command>` -> execute command on active server

## Tool Layer

- `ssh_new`
- `ssh_list`
- `ssh_use`
- `ssh_current`
- `ssh_console_open`
- `ssh_exec`
- `ssh_shell`
- `ssh_shell_exit`
- `ssh_test`
- `ssh_remove`

## Behavior

- Commands run on the active remote server, not locally
- Output includes `stdout`, `stderr`, `exitCode`, and timing
- UI metadata is set for `ssh_exec` so output appears like a shell result block

## Security Requirements

- Never store plaintext passwords in profile JSON
- Use `passwordEnvVar` for password auth
- Warn users not to share passwords in chat
- For GUI users, require app restart after env var changes

## Persistence

- Profile data stored at: `~/.config/opencode/plugins/opencode-ssh/servers.json`
- Override path with: `OPENCODE_SSH_STORE_DIR`

## Distribution

- One-line install (no clone):
  - Linux/macOS: `install.sh`
  - Windows: `install.ps1`
- One-line uninstall:
  - Linux/macOS: `uninstall.sh`
  - Windows: `uninstall.ps1`

## Planned Improvements

- Strict host fingerprint enforcement
- `scp` / `sftp` support
- Risk-level confirmations for destructive commands
