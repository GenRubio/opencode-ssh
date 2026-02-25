---
description: Abrir terminal local separada al servidor SSH
---
Abre una terminal local separada conectada al servidor activo usando `ssh_console_open`.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si hay argumentos, toma el primer token como `alias`.
2) Si no hay argumentos, usa el servidor activo.
3) Llama `ssh_console_open` exactamente una vez.
4) Muestra siempre el comando manual devuelto por la herramienta en un bloque de codigo para que el usuario pueda pegarlo si no aparece la ventana.

Ejemplos:
- `/ssh-console`
- `/ssh-console bm-old`
