---
description: Ejecutar comando en servidor SSH activo
---
Ejecuta un comando remoto usando `ssh_exec`.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si no hay argumentos, explica que debe enviarse un comando remoto.
2) Si hay argumentos, usa todo `$ARGUMENTS` como valor de `command`.
3) Llama `ssh_exec` exactamente una vez.
4) Luego de ejecutar, muestra la salida cruda en formato terminal dentro de un bloque de codigo, sin resumen ni bullets.
5) Si hay `stderr`, incluyelo debajo de `stdout` tal cual venga de la herramienta.

Ejemplos:
- `/ssh-run uname -a`
- `/ssh-run systemctl status nginx`
