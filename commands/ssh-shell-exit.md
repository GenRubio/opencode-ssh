---
description: Close the interactive SSH shell session
---
Close the interactive shell session using `ssh_shell_exit`.

Input arguments: `$ARGUMENTS`

Rules:
1) If there are arguments, take the first token as `alias`.
2) If there are no arguments, call without `alias`.
3) Call `ssh_shell_exit` exactly once.

Examples:
- `/ssh-shell-exit`
- `/ssh-shell-exit bm-old`
