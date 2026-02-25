---
description: Ejecutar comando en modo shell interactivo
---
Ejecuta un comando remoto usando `ssh_shell` (modo consola/PTY).

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si no hay argumentos, explica que debe enviarse un comando remoto.
2) Si hay argumentos, usa todo `$ARGUMENTS` como valor de `command`.
3) Llama `ssh_shell` exactamente una vez.
4) Devuelve la salida cruda como terminal, sin resumen.

Ejemplos:
- `/ssh-shell pwd`
- `/ssh-shell ls -la`
