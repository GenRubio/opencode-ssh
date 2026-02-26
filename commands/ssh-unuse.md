---
description: Deselect the active SSH server (no server will be active)
---
Deselect the active SSH server using `ssh_unuse`.

Input arguments: `$ARGUMENTS`

Rules:
1) Call `ssh_unuse` exactly once with no arguments.
2) After the call, inform the user that no SSH server is active and that they must run `/ssh-use <alias>` to select one before any remote command can be executed.

Examples:
- `/ssh-unuse`
