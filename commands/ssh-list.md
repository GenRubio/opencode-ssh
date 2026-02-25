---
description: List registered SSH servers
---
Show registered servers using `ssh_list`.

Input arguments: `$ARGUMENTS`

Rules:
1) If `--check` appears, call `ssh_list` with `checkConnection=true`.
2) Otherwise, call `ssh_list` with `checkConnection=false`.
3) Call the tool exactly once.

Examples:
- `/ssh-list`
- `/ssh-list --check`
