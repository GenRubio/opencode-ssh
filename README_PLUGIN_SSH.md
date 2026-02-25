# OpenCode SSH Plugin (WIP)

Plugin local para OpenCode que permite gestionar servidores SSH y ejecutar comandos remotos desde chat.

## Estado actual

Implementado en esta version:

- Registro de servidores (`ssh_new`)
- Listado de servidores (`ssh_list`)
- Seleccion de servidor activo (`ssh_use`)
- Ver servidor activo (`ssh_current`)
- Ejecucion remota (`ssh_exec`)
- Test de conectividad (`ssh_test`)
- Eliminacion de servidor (`ssh_remove`)
- Slash commands de conveniencia:
  - `/ssh-new`
  - `/ssh-list`
  - `/ssh-use`
  - `/ssh-current`
  - `/ssh-run`

## Estructura creada

- `package.json`
- `tsconfig.json`
- `plugins/opencode-ssh.ts`
- `plugins/opencode-ssh/types.ts`
- `plugins/opencode-ssh/store.ts`
- `plugins/opencode-ssh/client.ts`
- `commands/ssh-new.md`
- `commands/ssh-list.md`
- `commands/ssh-use.md`
- `commands/ssh-current.md`
- `commands/ssh-run.md`
- `opencode.json` (registro de slash commands)
- `.opencode/plugins/opencode-ssh.ts` (shim de carga para OpenCode)

## Instalacion

Desde la raiz del proyecto:

```bash
npm install
```

OpenCode cargara automaticamente el plugin al iniciar.

## Uso rapido

### 1) Registrar servidor con clave

```text
/ssh-new alias=prod-api host=10.0.0.20 user=ubuntu auth=key privateKeyPath=~/.ssh/id_rsa
```

### 2) Listar

```text
/ssh-list
```

### 3) Activar uno

```text
/ssh-use prod-api
```

### 4) Ejecutar remoto

```text
/ssh-run uname -a
```

## Donde se guarda el estado

Por defecto:

- `~/.config/opencode/plugins/opencode-ssh/servers.json`

Puedes sobreescribir el directorio con:

- `OPENCODE_SSH_STORE_DIR`

## Seguridad

- El plugin no guarda passwords en texto plano si usas `auth=password` con `passwordEnvVar`.
- Para password, debes exportar la variable de entorno antes de usar el servidor.
- Para clave SSH, usa rutas de llave privada seguras y permisos correctos.

## Limitaciones actuales

- Aun no valida fingerprint de host de manera estricta.
- No incluye transferencia de archivos (`scp`/`sftp`) todavia.
- No hay sesiones TTY interactivas completas en esta version.
