# OpenCode SSH Plugin

Plugin para OpenCode que permite gestionar servidores SSH y ejecutar comandos remotos desde chat.

## Features

- Registro de servidores (`ssh_new`)
- Listado de servidores (`ssh_list`)
- Seleccion de servidor activo (`ssh_use`)
- Estado del servidor activo (`ssh_current`)
- Ejecucion remota (`ssh_exec`)
- Test de conectividad (`ssh_test`)
- Eliminacion de servidor (`ssh_remove`)
- Slash commands:
  - `/ssh-new`
  - `/ssh-list`
  - `/ssh-use`
  - `/ssh-current`
  - `/ssh-run`

## Instalacion desde GitHub

1) Clona el repositorio

```bash
git clone <TU_REPO_GITHUB>
cd opencode-ssh
```

2) Instala dependencias del proyecto

```bash
npm install
```

3) Instala el plugin en OpenCode (global)

```bash
npm run install:opencode
```

4) Verifica instalacion

```bash
npm run verify:opencode
```

5) Reinicia OpenCode

- En terminal: cierra y vuelve a abrir.
- En GUI: cierra completamente la app y vuelve a abrir.

## Uso rapido

```text
/ssh-new
/ssh-list
/ssh-use boommania
/ssh-run whoami
```

## Passwords y GUI

Si usas `auth=password`, NO pases la password en texto plano.

Debes usar una variable de entorno y pasar su nombre en `passwordEnvVar`.

Ejemplos:

- PowerShell (sesion actual):

```powershell
$env:SSH_BOOMMANIA_PASS="tu_password"
```

- CMD (sesion actual):

```cmd
set SSH_BOOMMANIA_PASS=tu_password
```

- Bash/Zsh:

```bash
export SSH_BOOMMANIA_PASS='tu_password'
```

Importante: si usas OpenCode en GUI, reinicia la app despues de crear/actualizar variables de entorno.

## Desinstalar

```bash
npm run uninstall:opencode
```

Despues reinicia OpenCode.

## Estructura

- `plugins/opencode-ssh.ts`
- `plugins/ssh/*`
- `commands/*.md`
- `scripts/install.mjs`
- `scripts/uninstall.mjs`
- `scripts/verify-install.mjs`

## Publicacion en npm (opcional)

Este repo queda preparado para publicarlo luego en npm.

Cuando publiques, los usuarios podran instalarlo con npm y registrarlo desde su `opencode.json` con la clave `plugin`.
