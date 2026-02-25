---
description: Cerrar sesion shell interactiva SSH
---
Cierra la sesion shell interactiva usando `ssh_shell_exit`.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si hay argumentos, toma el primer token como `alias`.
2) Si no hay argumentos, llama sin `alias`.
3) Llama `ssh_shell_exit` exactamente una vez.

Ejemplos:
- `/ssh-shell-exit`
- `/ssh-shell-exit bm-old`
