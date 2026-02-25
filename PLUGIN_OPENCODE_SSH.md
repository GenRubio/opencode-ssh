# Propuesta: Plugin SSH para OpenCode

## Contexto

Quiero crear un plugin para OpenCode que permita operar servidores remotos por SSH desde la ventana de chat.

Antes de implementar, hay que revisar la documentacion oficial de OpenCode para entender:

- Como se crean e instalan plugins.
- Como se registran slash commands (comandos tipo `/comando`).
- Como se gestionan permisos y ejecucion de comandos.
- Como se almacenan configuraciones locales de forma segura.

## Objetivo del plugin

Permitir que el usuario interactue con servidores remotos usando comandos de chat, pero que la ejecucion real ocurra en el servidor por SSH.

Ejemplo: en vez de ejecutar tareas en la maquina local, poder pedir en chat acciones como deploy, logs, diagnosticos, mantenimiento, etc., y que todo se realice en el host remoto seleccionado.

## Comandos iniciales (MVP)

### `/ssh-new`

Registrar un nuevo servidor.

Datos minimos sugeridos:

- Alias (nombre corto, por ejemplo: `prod-api`)
- Host/IP
- Puerto (default 22)
- Usuario
- Metodo de autenticacion (clave SSH o password)
- Ruta de clave privada (si aplica)

Resultado esperado: guardar la configuracion de conexion en un perfil reutilizable.

### `/ssh-list`

Listar servidores guardados y permitir seleccionar uno.

Resultado esperado:

- Ver alias + host + estado basico.
- Marcar servidor activo para sesiones posteriores.

### `/ssh-use <alias>`

Conectarse directamente al servidor indicado por alias y dejarlo como servidor activo.

Resultado esperado:

- Confirmar conexion.
- Definir contexto remoto para los siguientes comandos/chat prompts.

## Comportamiento esperado en chat

Una vez seleccionado el servidor activo:

- Las acciones solicitadas desde chat se ejecutan por SSH en ese servidor.
- Las respuestas devuelven salida estandar, errores y codigo de salida.
- Debe quedar claro en UI cuando una accion se ejecuta en remoto.

## Requisitos tecnicos recomendados

- Manejo de sesiones SSH estable (reconexion y timeout).
- Ejecucion segura de comandos (validaciones y limites).
- Soporte para comandos no interactivos inicialmente (MVP).
- Registro local de actividad (logs basicos).

## Seguridad (muy importante)

- No guardar secretos en texto plano.
- Usar almacenamiento seguro del sistema cuando sea posible.
- Sanitizar comandos o advertir cuando se ejecutan operaciones peligrosas.
- Confirmacion adicional para acciones destructivas (`rm`, reinicios, cambios criticos).
- Permitir politica de hosts conocidos (verificacion de fingerprint).

## Mejoras sugeridas (post-MVP)

1. Perfiles por entorno: `dev`, `staging`, `prod`.
2. Soporte de multiplexacion SSH para mejorar rendimiento.
3. Comando `/ssh-current` para ver servidor activo y contexto.
4. Comando `/ssh-remove <alias>` para eliminar perfiles.
5. Comando `/ssh-test <alias>` para validar conectividad.
6. Historial de comandos remotos con filtros por servidor.
7. Plantillas de tareas frecuentes (`deploy`, `logs`, `backup`).
8. Aprobaciones por nivel de riesgo antes de ejecutar comandos sensibles.
9. Integracion con llaves de hardware/agent (SSH Agent, YubiKey).
10. Soporte de tuneles y port-forward (`/ssh-tunnel`).
11. Transferencia de archivos (`scp`/`sftp`) desde comandos del plugin.
12. Soporte multi-servidor (ejecucion en paralelo para fleets).

## Roadmap propuesto

### Fase 1 - Investigacion

- Revisar documentacion de plugins de OpenCode.
- Confirmar APIs disponibles para slash commands y estado de sesion.

### Fase 2 - MVP funcional

- Implementar `/ssh-new`, `/ssh-list`, `/ssh-use`.
- Conexion basica SSH + ejecucion de comandos remotos.
- Gestion minima de errores y logs.

### Fase 3 - Endurecimiento

- Seguridad de credenciales.
- Confirmaciones para comandos peligrosos.
- Mejoras de UX en seleccion de servidor y feedback de estado.

### Fase 4 - Features avanzadas

- Tareas predefinidas, tuneles, transferencia de archivos y multi-host.

## Criterios de exito

- El usuario puede registrar y seleccionar servidores desde chat.
- El contexto remoto activo queda claro en cada accion.
- Las operaciones remotas son confiables y seguras.
- La experiencia reduce friccion respecto a usar SSH manual en terminal.

## Especificacion tecnica (v0.1)

### Alcance del MVP

- Alta de perfiles SSH (`/ssh-new`).
- Listado y seleccion de perfil (`/ssh-list`, `/ssh-use`).
- Ejecucion remota no interactiva usando el perfil activo.
- Persistencia local de perfiles y estado activo.

### No incluido en MVP

- Sesiones TTY interactivas completas.
- Transferencia de archivos.
- Ejecucion distribuida multi-host.

## Contrato de comandos

### `/ssh-new`

Modo recomendado para MVP: flujo guiado paso a paso para evitar errores.

Opcionalmente, modo rapido:

```text
/ssh-new --alias prod-api --host 10.0.0.20 --port 22 --user ubuntu --auth key --key ~/.ssh/id_rsa
```

Validaciones minimas:

- `alias`: unico, solo letras/numeros/`-`/`_`.
- `host`: hostname o IP valido.
- `port`: 1-65535.
- `auth`: `key` o `password`.

### `/ssh-list`

Salida sugerida:

```text
Servidores registrados:
1) prod-api    ubuntu@10.0.0.20:22   [activo]
2) staging-web deploy@10.0.1.15:22   [ok]
3) dev-db      admin@10.0.2.40:2222  [sin probar]
```

### `/ssh-use <alias>`

Comportamiento:

- Verifica que el alias exista.
- Prueba conexion corta.
- Si conecta, marca el alias como activo.

Ejemplo:

```text
/ssh-use prod-api
Conectado a prod-api (ubuntu@10.0.0.20:22). Perfil activo actualizado.
```

## Modelo de datos sugerido

Archivo local (ejemplo):

`~/.opencode/plugins/ssh-plugin/servers.json`

```json
{
  "version": 1,
  "activeAlias": "prod-api",
  "servers": [
    {
      "alias": "prod-api",
      "host": "10.0.0.20",
      "port": 22,
      "user": "ubuntu",
      "authType": "key",
      "keyPath": "~/.ssh/id_rsa",
      "knownHostFingerprint": "SHA256:...",
      "createdAt": "2026-02-25T12:00:00Z",
      "lastUsedAt": "2026-02-25T12:15:00Z"
    }
  ]
}
```

Notas:

- Passwords o secretos no deben ir en este JSON en texto plano.
- Guardar secretos en keychain/credential store del sistema.

## Arquitectura propuesta

### Componentes

1. Registry de comandos
   - Registra `/ssh-new`, `/ssh-list`, `/ssh-use`.
2. Profile store
   - Lee/escribe perfiles locales.
3. Secret manager adapter
   - Guarda/recupera credenciales seguras.
4. SSH client wrapper
   - Crea conexion, ejecuta comando, retorna stdout/stderr/exitCode.
5. Session context
   - Mantiene `activeAlias` y metadata de sesion.

### Flujo general

1. Usuario ejecuta slash command.
2. Handler valida input.
3. Handler usa store/ssh wrapper segun el comando.
4. Respuesta vuelve al chat con estado claro y accion siguiente.

## Pseudocodigo de handlers

```ts
async function onSshUse(alias: string) {
  const profile = await store.getByAlias(alias)
  if (!profile) return ui.error(`Alias no encontrado: ${alias}`)

  const conn = await ssh.connect(profile)
  const ok = await conn.ping()
  await conn.close()

  if (!ok) return ui.error(`No se pudo conectar a ${alias}`)

  await store.setActiveAlias(alias)
  return ui.ok(`Servidor activo: ${alias}`)
}
```

```ts
async function runRemoteCommand(command: string) {
  const alias = await store.getActiveAlias()
  if (!alias) return ui.error("No hay servidor activo. Usa /ssh-use <alias>")

  const profile = await store.getByAlias(alias)
  const conn = await ssh.connect(profile)
  const result = await conn.exec(command, { timeoutMs: 120000 })
  await conn.close()

  return ui.execResult({
    target: alias,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  })
}
```

## UX recomendada en chat

- Mostrar siempre `target: <alias>` antes de ejecutar.
- Mostrar resumen de comando remoto y timeout.
- Si falla, incluir causa accionable (auth, red, host key, permiso).
- Para comandos de alto riesgo, pedir confirmacion explicita.

## Matriz de errores minima

- `AUTH_FAILED`: credencial invalida o clave no permitida.
- `HOST_UNREACHABLE`: DNS/red/firewall.
- `HOST_KEY_MISMATCH`: posible riesgo MITM, bloquear por defecto.
- `COMMAND_TIMEOUT`: terminar ejecucion y reportar.
- `PERMISSION_DENIED`: comando sin privilegios suficientes.

## Checklist para revisar en documentacion de OpenCode

1. API exacta para registrar slash commands.
2. Hook para persistencia de estado/config de plugins.
3. Capacidad de pedir confirmaciones en chat antes de ejecutar.
4. Manejo de secretos recomendado por la plataforma.
5. Limites/sandbox al ejecutar herramientas externas.
6. Formato recomendado para output estructurado al chat.

## Plan de pruebas (MVP)

### Pruebas funcionales

- Crear perfil valido con `/ssh-new`.
- Listar perfiles con `/ssh-list`.
- Activar perfil con `/ssh-use`.
- Ejecutar comando remoto simple (`uname -a`, `whoami`).

### Pruebas de error

- Alias duplicado en `/ssh-new`.
- Host invalido o puerto fuera de rango.
- Clave privada inexistente.
- Timeout de red.

### Pruebas de seguridad

- Confirmar que no se persisten passwords en texto plano.
- Confirmar bloqueo en fingerprint no confiable.
- Confirmar doble validacion en comandos peligrosos.

## Backlog priorizado (despues del MVP)

1. `/ssh-current`, `/ssh-remove`, `/ssh-test`.
2. Soporte de SSH agent y passphrase.
3. Tuneles (`local`, `remote`, `dynamic`).
4. Transferencia de archivos con progreso.
5. Jobs remotos largos con streaming en tiempo real.
6. Politicas por entorno (prod mas estricto que dev).
