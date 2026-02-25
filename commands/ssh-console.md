---
description: Open a separate local terminal connected to the SSH server
---
Open a separate local terminal connected to the active server using `ssh_console_open`.

Input arguments: `$ARGUMENTS`

Rules:
1) If there are arguments, take the first token as `alias`.
2) If there are no arguments, use the active server.
3) Call `ssh_console_open` exactly once.
4) Always display the manual command returned by the tool in a code block so the user can paste it if the window does not open automatically.

Examples:
- `/ssh-console`
- `/ssh-console bm-old`
