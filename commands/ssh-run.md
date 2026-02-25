---
description: Run a command on the active SSH server
---
Execute a remote command using `ssh_exec`.

Input arguments: `$ARGUMENTS`

Rules:
1) If there are no arguments, explain that a remote command must be provided.
2) If there are arguments, use the entire `$ARGUMENTS` as the value of `command`.
3) Call `ssh_exec` exactly once.
4) After execution, display the raw output in terminal format inside a code block, without a summary or bullets.
5) If there is `stderr`, include it below `stdout` exactly as returned by the tool.

Examples:
- `/ssh-run uname -a`
- `/ssh-run systemctl status nginx`
