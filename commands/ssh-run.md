---
description: Ejecutar comando en servidor SSH activo
---
Ejecuta un comando remoto usando `ssh_exec`.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si no hay argumentos, explica que debe enviarse un comando remoto.
2) Si hay argumentos, usa todo `$ARGUMENTS` como valor de `command`.
3) Llama `ssh_exec` exactamente una vez.

Ejemplos:
- `/ssh-run uname -a`
- `/ssh-run systemctl status nginx`
