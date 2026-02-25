---
description: Configurar autenticacion SSH por clave (sin password) para un servidor
---
Configura autenticacion por clave publica SSH en el servidor activo (o el alias indicado)
usando la herramienta `ssh_copy_id`. Genera la clave si no existe, la sube al servidor
y reconfigura el perfil para no volver a pedir password.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si hay argumentos, toma el primer token como `alias` del servidor destino.
2) Si no hay argumentos, usa el servidor activo.
3) Antes de llamar `ssh_copy_id`, explica brevemente al usuario lo que va a pasar:
   - Se generara una clave ed25519 en `~/.ssh/opencode_ssh_id` (si no existe).
   - La clave publica se subira al servidor via SSH usando la autenticacion actual.
   - El perfil del servidor se actualizara a `auth=key` para futuros accesos sin password.
4) Llama `ssh_copy_id` exactamente una vez con el `alias` si fue indicado.
5) Si `ssh_copy_id` tiene exito, muestra un resumen claro:
   - Ubicacion de la clave generada.
   - Confirmacion de que `authorized_keys` fue actualizado.
   - Que `ssh_console_open` ya no pedira password.
6) Si falla, muestra el error y sugiere al usuario verificar que la variable de entorno
   con la password este definida correctamente y que el servidor permita acceso por password.

Ejemplos:
- `/ssh-setup-key`
- `/ssh-setup-key bm-old`
- `/ssh-setup-key mi-servidor`
