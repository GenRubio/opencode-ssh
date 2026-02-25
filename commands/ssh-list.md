---
description: Listar servidores SSH registrados
---
Muestra servidores registrados usando `ssh_list`.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si aparece `--check`, llama `ssh_list` con `checkConnection=true`.
2) En otro caso, llama `ssh_list` con `checkConnection=false`.
3) Llama la herramienta una sola vez.

Ejemplos:
- `/ssh-list`
- `/ssh-list --check`
