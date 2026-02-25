---
description: Run a command in interactive shell mode
---
Execute a remote command using `ssh_shell` (console/PTY mode).

Input arguments: `$ARGUMENTS`

Rules:
1) If there are no arguments, explain that a remote command must be provided.
2) If there are arguments, use the entire `$ARGUMENTS` as the value of `command`.
3) Call `ssh_shell` exactly once.
4) Return the raw output as terminal output, without a summary.

Examples:
- `/ssh-shell pwd`
- `/ssh-shell ls -la`
