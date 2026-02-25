---
description: Select the active SSH server
---
Select an active server using `ssh_use`.

Input arguments: `$ARGUMENTS`

Rules:
1) The first argument must be the alias.
2) If `--no-test` also appears, use `testConnection=false`; otherwise `true`.
3) Call `ssh_use` exactly once.
4) If the alias is missing, explain the correct format and give an example.

Examples:
- `/ssh-use prod-api`
- `/ssh-use staging-web --no-test`
