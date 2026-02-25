---
description: Seleccionar servidor SSH activo
---
Selecciona un servidor activo usando `ssh_use`.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) El primer argumento debe ser el alias.
2) Si tambien aparece `--no-test`, usa `testConnection=false`; en otro caso `true`.
3) Llama `ssh_use` exactamente una vez.
4) Si falta alias, explica el formato correcto y da un ejemplo.

Ejemplos:
- `/ssh-use prod-api`
- `/ssh-use staging-web --no-test`
