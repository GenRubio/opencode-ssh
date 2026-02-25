# OpenCode SSH Plugin Notes

This file is kept for internal notes. Public documentation is in `README.md`.

## Current status

Implemented:

- `ssh_new`, `ssh_list`, `ssh_use`, `ssh_current`, `ssh_exec`, `ssh_test`, `ssh_remove`
- Chat commands: `/ssh-new`, `/ssh-list`, `/ssh-use`, `/ssh-current`, `/ssh-run`

## Storage

- Default profile path: `~/.config/opencode/plugins/opencode-ssh/servers.json`
- Override with: `OPENCODE_SSH_STORE_DIR`

## Security notes

- Passwords are referenced through `passwordEnvVar` (no plaintext password storage in profile JSON)
- GUI users must restart OpenCode after changing environment variables

## Known limitations

- Strict host fingerprint validation is not enforced yet
- No `scp` / `sftp` support yet
- No full interactive TTY session mode yet
