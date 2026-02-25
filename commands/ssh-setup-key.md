---
description: Set up SSH key authentication (passwordless) for a server
---
Configure public key authentication on the active server (or the specified alias)
using the `ssh_copy_id` tool. Generates the key if it does not exist, uploads it to
the server, and reconfigures the profile so no password is required in the future.

Input arguments: `$ARGUMENTS`

Rules:
1) If there are arguments, take the first token as the `alias` of the target server.
2) If there are no arguments, use the active server.
3) Before calling `ssh_copy_id`, briefly explain to the user what is about to happen:
   - An ed25519 key will be generated at `~/.ssh/opencode_ssh_id` (if it does not exist).
   - The public key will be uploaded to the server via SSH using the current authentication.
   - The server profile will be updated to `auth=key` for future passwordless access.
4) Call `ssh_copy_id` exactly once with the `alias` if one was provided.
5) If `ssh_copy_id` succeeds, show a clear summary:
   - Location of the generated key.
   - Confirmation that `authorized_keys` was updated.
   - That `ssh_console_open` will no longer ask for a password.
6) If it fails, show the error and suggest the user verify that the environment variable
   with the password is correctly defined and that the server allows password authentication.

Examples:
- `/ssh-setup-key`
- `/ssh-setup-key bm-old`
- `/ssh-setup-key my-server`
