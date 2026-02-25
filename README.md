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

## Instalacion sin clonar (estilo opencode-seo)

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/install.sh | bash
```

Si publicas en otro repo/rama:

```bash
OPENCODE_SSH_REPO="tu-user/tu-repo" OPENCODE_SSH_REF="main" curl -fsSL "https://raw.githubusercontent.com/tu-user/tu-repo/main/install.sh" | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/install.ps1 | iex
```

Si publicas en otro repo/rama:

```powershell
$env:OPENCODE_SSH_REPO="tu-user/tu-repo"
$env:OPENCODE_SSH_REF="main"
irm https://raw.githubusercontent.com/tu-user/tu-repo/main/install.ps1 | iex
```

Ambos instaladores copian plugin + comandos a `~/.config/opencode`, instalan dependencias y crean un manifiesto local.

Despues reinicia OpenCode:

- En terminal: cierra y vuelve a abrir.
- En GUI: cierra completamente la app y vuelve a abrir.

## Instalacion desde clon (desarrollo)

```bash
git clone <TU_REPO_GITHUB>
cd opencode-ssh
npm install
npm run install:opencode
npm run verify:opencode
```

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

Sin clonar:

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/uninstall.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/uninstall.ps1 | iex
```

Desde clon:

```bash
npm run uninstall:opencode
```

Despues reinicia OpenCode.

## Estructura

- `plugins/opencode-ssh.ts`
- `plugins/opencode-ssh/*`
- `commands/*.md`
- `install.sh`
- `install.ps1`
- `uninstall.sh`
- `uninstall.ps1`
- `scripts/install.mjs`
- `scripts/uninstall.mjs`
- `scripts/verify-install.mjs`

## Publicacion en npm (opcional)

Este repo queda preparado para publicarlo luego en npm.

Cuando publiques, los usuarios podran instalarlo con npm y registrarlo desde su `opencode.json` con la clave `plugin`.
