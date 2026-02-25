# OpenCode SSH Plugin

SSH plugin for [OpenCode](https://opencode.ai) that lets you manage SSH servers and run remote commands directly from chat.

## Features

- Register SSH servers (`ssh_new`)
- List saved servers (`ssh_list`)
- Select active server (`ssh_use`)
- Show active server (`ssh_current`)
- Open a separate local terminal connected to server (`ssh_console_open`)
- Execute remote commands (`ssh_exec`)
- Execute commands in interactive shell mode (`ssh_shell`)
- Close interactive shell session (`ssh_shell_exit`)
- Test connectivity (`ssh_test`)
- Remove server profiles (`ssh_remove`)
- Chat commands:
  - `/ssh-new`
  - `/ssh-list`
  - `/ssh-use`
  - `/ssh-current`
  - `/ssh-console`
  - `/ssh-run`
  - `/ssh-shell`
  - `/ssh-shell-exit`

## Install (no clone required)

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/install.ps1 | iex
```

The installer copies plugin + commands into `~/.config/opencode`, installs required dependencies, and writes a local manifest.

After installing, restart OpenCode:
- Terminal: close and reopen.
- GUI: fully quit and reopen the app.

## Quick Start

```text
/ssh-new
/ssh-list
/ssh-use my-server
/ssh-console
/ssh-run whoami
/ssh-shell pwd
/ssh-shell-exit
```

## Password Auth and GUI Note

If you use `auth=password`, never send the password directly in chat.
Use an environment variable name in `passwordEnvVar`.

Examples:

```powershell
$env:SSH_MY_SERVER_PASS="your_password"
```

```cmd
set SSH_MY_SERVER_PASS=your_password
```

```bash
export SSH_MY_SERVER_PASS='your_password'
```

If you use OpenCode GUI, restart the app after creating/updating environment variables.

## Uninstall

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/uninstall.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/GenRubio/opencode-ssh/main/uninstall.ps1 | iex
```

Then restart OpenCode.
