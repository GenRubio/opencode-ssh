import { type Plugin, tool } from "@opencode-ai/plugin"
import { spawn } from "node:child_process"
import { writeFile, unlink } from "node:fs/promises"
import { tmpdir, homedir } from "node:os"
import { join } from "node:path"

import { execOnServer, openShellSession, testServerConnection } from "./opencode-ssh/client"
import { ServerStore } from "./opencode-ssh/store"
import type { ShellSession } from "./opencode-ssh/client"
import type { ServerAuth, ServerProfile } from "./opencode-ssh/types"

const store = new ServerStore()
const MAX_METADATA_LENGTH = 30000
const LIVE_STREAM_BUFFER_LENGTH = 6000
const LIVE_UPDATE_INTERVAL_MS = 400
const SHELL_OUTPUT_LIMIT = 16000
const TMUX_SESSION_PATTERN = /^[A-Za-z0-9_-]+$/

type ShellSessionHandle = {
  alias: string
  sessionID: string
  shell: ShellSession
  createdAt: string
  lastUsedAt: string
}

const shellSessions = new Map<string, ShellSessionHandle>()

function asBoolean(value: boolean | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const suffix = `\n... output truncado (${text.length - maxLength} caracteres omitidos)`
  return `${text.slice(0, maxLength)}${suffix}`
}

function keepTail(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const prefix = `... salida parcial truncada (${text.length - maxLength} caracteres omitidos)\n`
  return `${prefix}${text.slice(-maxLength)}`
}

function parseExitCodeFromOutput(text: string): number | null {
  const match = text.match(/\nexitCode:\s*(-?\d+)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isInteger(value) ? value : null
}

function parseExitCodeFromShellOutput(text: string): number | null {
  const match = text.match(/\[exit\s+(-?\d+)\s+\|/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isInteger(value) ? value : null
}

function serverRef(server: ServerProfile): string {
  return `${server.user}@${server.host}:${server.port}`
}

function serverAuthLabel(server: ServerProfile): string {
  if (server.auth.type === "key") {
    return `key (${server.auth.privateKeyPath})`
  }
  return `password (env:${server.auth.passwordEnvVar})`
}

function formatServerList(servers: ServerProfile[], activeAlias: string | null): string {
  if (servers.length === 0) {
    return "No hay servidores registrados. Usa ssh_new para agregar uno."
  }

  const rows = servers.map((server) => {
    const isActive = activeAlias && server.alias.toLowerCase() === activeAlias.toLowerCase()
    const activeTag = isActive ? " [activo]" : ""
    return `- ${server.alias}${activeTag}\n  target: ${serverRef(server)}\n  auth: ${serverAuthLabel(server)}`
  })

  return `Servidores registrados (${servers.length}):\n${rows.join("\n")}`
}

function buildAuthFromArgs(input: {
  authType: "key" | "password"
  privateKeyPath?: string
  passphraseEnvVar?: string
  passwordEnvVar?: string
}): ServerAuth {
  if (input.authType === "key") {
    if (!input.privateKeyPath) {
      throw new Error("Para authType=key debes indicar privateKeyPath.")
    }

    return {
      type: "key",
      privateKeyPath: input.privateKeyPath,
      passphraseEnvVar: input.passphraseEnvVar,
    }
  }

  if (!input.passwordEnvVar) {
    throw new Error("Para authType=password debes indicar passwordEnvVar.")
  }

  return {
    type: "password",
    passwordEnvVar: input.passwordEnvVar,
  }
}

function shellSessionKey(sessionID: string, alias: string): string {
  return `${sessionID}::${alias.toLowerCase()}`
}

/**
 * Envia un comando a una sesion tmux para que sea visible en la consola abierta.
 * Fire-and-forget: no espera resultado, no lanza error si falla.
 * Se ejecuta en paralelo al ssh_exec/ssh_shell normal.
 */
function sendToTmux(server: ServerProfile, sessionName: string, command: string): void {
  // Escapamos el comando para tmux send-keys: las comillas simples se duplican
  const escaped = command.replace(/'/g, `'\\''`)
  const tmuxCmd = `tmux send-keys -t ${sessionName} '${escaped}' Enter`
  execOnServer(server, tmuxCmd, { timeoutMs: 5000 }).catch(() => undefined)
}

async function closeShellSession(handle: ShellSessionHandle): Promise<void> {
  try {
    await handle.shell.close()
  } catch {
    // no-op
  }
}

async function getOrCreateShellSession(input: {
  sessionID: string
  server: ServerProfile
}): Promise<ShellSessionHandle> {
  const key = shellSessionKey(input.sessionID, input.server.alias)
  const existing = shellSessions.get(key)

  if (existing && !existing.shell.isClosed()) {
    existing.lastUsedAt = new Date().toISOString()
    return existing
  }

  if (existing) {
    shellSessions.delete(key)
  }

  const shell = await openShellSession(input.server)
  const now = new Date().toISOString()
  const created: ShellSessionHandle = {
    alias: input.server.alias,
    sessionID: input.sessionID,
    shell,
    createdAt: now,
    lastUsedAt: now,
  }

  shellSessions.set(key, created)
  return created
}

function normalizeTmuxSessionName(input?: string): string {
  const value = (input ?? "opencode-live").trim()
  if (!value) return "opencode-live"
  if (!TMUX_SESSION_PATTERN.test(value)) {
    throw new Error("sessionName invalido. Usa letras, numeros, guion y guion bajo.")
  }
  return value
}

type TerminalLaunchOptions = {
  /** Comando SSH a ejecutar en la terminal */
  command: string
  /** Variables de entorno extra a inyectar en la terminal nueva */
  env?: Record<string, string>
}

function resolveServerPassword(server: ServerProfile): string | undefined {
  if (server.auth.type !== "password") return undefined
  return process.env[server.auth.passwordEnvVar]
}

function resolveKeyPath(server: ServerProfile): string | undefined {
  if (server.auth.type !== "key") return undefined
  const raw = server.auth.privateKeyPath
  if (raw === "~" || raw.startsWith("~/")) {
    return raw.replace(/^~/, homedir())
  }
  return raw
}

function buildAttachCommand(server: ServerProfile, sessionName: string): string {
  const sshBase = `ssh -t -p ${server.port}`
  const target = `${server.user}@${server.host}`
  const tmuxCmd = `'tmux new-session -A -s ${sessionName}'`

  if (server.auth.type === "key") {
    const keyPath = resolveKeyPath(server)
    const keyFlag = keyPath ? ` -i "${keyPath}"` : ""
    return `${sshBase}${keyFlag} ${target} ${tmuxCmd}`
  }

  // auth=password: en Linux/macOS usamos sshpass -e (lee $SSHPASS)
  // En Windows no hay sshpass nativo; usamos expect o directamente ssh (pedirá password si no hay otra opción)
  if (process.platform !== "win32") {
    return `sshpass -e ${sshBase} ${target} ${tmuxCmd}`
  }
  return `${sshBase} ${target} ${tmuxCmd}`
}

function spawnDetached(exe: string, args: string[], extraEnv?: Record<string, string>): void {
  const child = spawn(exe, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
  })
  child.unref()
}

function isAvailable(exe: string): Promise<boolean> {
  return new Promise((resolve) => {
    const which = process.platform === "win32" ? "where" : "which"
    const child = spawn(which, [exe], { stdio: "ignore" })
    child.on("close", (code) => resolve(code === 0))
    child.on("error", () => resolve(false))
  })
}

async function openDetachedTerminalWindows(opts: TerminalLaunchOptions): Promise<void> {
  // Usamos wscript.exe + VBScript. wscript.Shell.Run usa ShellExecute
  // internamente y puede crear ventanas visibles desde Electron/GUI.
  // Las variables de entorno se inyectan en el entorno del proceso wscript
  // que luego las hereda PowerShell.
  const vbsPath = join(tmpdir(), `opencode-ssh-${Date.now()}.vbs`)
  const escaped = opts.command.replace(/"/g, '""')

  const hasWt = await isAvailable("wt.exe")
  const cmdLine = hasWt
    ? `wt.exe new-tab powershell.exe -NoExit -Command "${escaped}"`
    : `powershell.exe -NoExit -Command "${escaped}"`

  // Inyectar env vars via WScript.Shell.Environment antes de ejecutar
  const envLines = Object.entries(opts.env ?? {}).map(
    ([k, v]) => `sh.Environment("Process")("${k}") = "${v.replace(/"/g, '""')}"`,
  )

  const vbsContent = [
    `Set sh = CreateObject("WScript.Shell")`,
    ...envLines,
    `sh.Run "${cmdLine.replace(/"/g, '""')}", 1, False`,
  ].join("\r\n")

  await writeFile(vbsPath, vbsContent, "utf-8")

  await new Promise<void>((resolve) => {
    const child = spawn("wscript.exe", [vbsPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })
    child.unref()
    setTimeout(resolve, 1000)
  })

  unlink(vbsPath).catch(() => undefined)
}

async function openDetachedTerminalMac(opts: TerminalLaunchOptions): Promise<void> {
  // En macOS exportamos las env vars como prefijo del comando shell
  const envPrefix = Object.entries(opts.env ?? {})
    .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
    .join("; ")
  const fullCommand = envPrefix ? `${envPrefix}; ${opts.command}` : opts.command

  // Intentamos iTerm2 primero (muy común entre devs), luego Terminal.app
  const hasIterm = await new Promise<boolean>((resolve) => {
    const child = spawn(
      "osascript",
      ["-e", 'tell application "System Events" to return exists application process "iTerm2"'],
      { stdio: "pipe" },
    )
    let out = ""
    child.stdout?.on("data", (d: Buffer) => { out += d.toString() })
    child.on("close", () => resolve(out.trim() === "true"))
    child.on("error", () => resolve(false))
  })

  if (hasIterm) {
    spawnDetached("osascript", [
      "-e", `tell application "iTerm2"`,
      "-e", `  create window with default profile command ${JSON.stringify(fullCommand)}`,
      "-e", `end tell`,
    ])
    return
  }

  // Terminal.app (siempre disponible en macOS)
  spawnDetached("osascript", [
    "-e",
    `tell application "Terminal" to do script ${JSON.stringify(fullCommand)}`,
  ])
}

async function openDetachedTerminalLinux(opts: TerminalLaunchOptions): Promise<void> {
  // Exportamos env vars como prefijo del comando
  const envPrefix = Object.entries(opts.env ?? {})
    .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
    .join("; ")
  const fullCommand = envPrefix ? `${envPrefix}; ${opts.command}` : opts.command

  // Lista de emuladores de terminal comunes, en orden de preferencia
  const candidates: Array<{ exe: string; args: string[] }> = [
    { exe: "gnome-terminal", args: ["--", "bash", "-lc", fullCommand] },
    { exe: "konsole",        args: ["--noclose", "-e", "bash", "-lc", fullCommand] },
    { exe: "xfce4-terminal", args: ["--hold", "-e", `bash -lc ${JSON.stringify(fullCommand)}`] },
    { exe: "tilix",          args: ["-e", "bash", "-lc", fullCommand] },
    { exe: "alacritty",      args: ["-e", "bash", "-lc", fullCommand] },
    { exe: "kitty",          args: ["bash", "-lc", fullCommand] },
    { exe: "xterm",          args: ["-e", "bash", "-lc", fullCommand] },
    { exe: "x-terminal-emulator", args: ["-e", "bash", "-lc", fullCommand] },
  ]

  for (const { exe, args } of candidates) {
    if (await isAvailable(exe)) {
      spawnDetached(exe, args)
      return
    }
  }

  throw new Error("No se encontro ningun emulador de terminal instalado (gnome-terminal, konsole, xterm, etc.).")
}

async function openDetachedTerminal(opts: TerminalLaunchOptions): Promise<void> {
  if (process.platform === "win32") return openDetachedTerminalWindows(opts)
  if (process.platform === "darwin") return openDetachedTerminalMac(opts)
  return openDetachedTerminalLinux(opts)
}

export const OpenCodeSSHPlugin: Plugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: "opencode-ssh",
      level: "info",
      message: "Plugin SSH cargado",
    },
  })

  return {
    tool: {
      ssh_new: tool({
        description: "Registra un nuevo servidor SSH en el perfil local",
        args: {
          alias: tool.schema.string().min(1).describe("Alias unico del servidor"),
          host: tool.schema.string().min(1).describe("Host o IP"),
          port: tool.schema.number().int().min(1).max(65535).default(22),
          user: tool.schema.string().min(1).describe("Usuario SSH"),
          authType: tool.schema.enum(["key", "password"]).default("key"),
          privateKeyPath: tool.schema.string().optional(),
          passphraseEnvVar: tool.schema.string().optional(),
          passwordEnvVar: tool.schema.string().optional(),
          knownHostFingerprint: tool.schema.string().optional(),
          testConnection: tool.schema.boolean().optional(),
          useImmediately: tool.schema.boolean().optional(),
        },
        async execute(args) {
          const auth = buildAuthFromArgs(args)

          const server = await store.addServer({
            alias: args.alias,
            host: args.host,
            port: args.port,
            user: args.user,
            auth,
            knownHostFingerprint: args.knownHostFingerprint,
          })

          const testConnection = asBoolean(args.testConnection, true)
          const useImmediately = asBoolean(args.useImmediately, true)

          let testResult = "No ejecutada"
          let testOk = true

          if (testConnection) {
            try {
              await testServerConnection(server)
              testResult = "Conexion OK"
            } catch (error) {
              testOk = false
              testResult = `Fallo de conexion: ${(error as Error).message}`
            }
          }

          let activeResult = "No actualizado"
          if (useImmediately) {
            if (!testConnection || testOk) {
              await store.setActiveAlias(server.alias)
              activeResult = `Activo: ${server.alias}`
            } else {
              activeResult = "No activado por fallo de conexion"
            }
          }

          return [
            `Servidor guardado: ${server.alias}`,
            `Target: ${serverRef(server)}`,
            `Auth: ${serverAuthLabel(server)}`,
            `Test: ${testResult}`,
            `Estado activo: ${activeResult}`,
          ].join("\n")
        },
      }),

      ssh_list: tool({
        description: "Lista servidores SSH registrados",
        args: {
          checkConnection: tool.schema.boolean().optional(),
        },
        async execute(args) {
          const servers = await store.listServers()
          const activeAlias = await store.getActiveAlias()

          const lines: string[] = [formatServerList(servers, activeAlias)]

          if (servers.length > 0 && asBoolean(args.checkConnection, false)) {
            lines.push("", "Estado de conectividad:")

            for (const server of servers) {
              try {
                await testServerConnection(server, { connectTimeoutMs: 8000 })
                lines.push(`- ${server.alias}: OK`)
              } catch (error) {
                lines.push(`- ${server.alias}: ERROR (${(error as Error).message})`)
              }
            }
          }

          return lines.join("\n")
        },
      }),

      ssh_use: tool({
        description: "Selecciona un servidor SSH como activo",
        args: {
          alias: tool.schema.string().min(1),
          testConnection: tool.schema.boolean().optional(),
        },
        async execute(args) {
          const server = await store.getServerByAlias(args.alias)
          if (!server) {
            throw new Error(`Alias no encontrado: ${args.alias}`)
          }

          const testConnection = asBoolean(args.testConnection, true)
          if (testConnection) {
            await testServerConnection(server)
          }

          const activeServer = await store.setActiveAlias(server.alias)

          return [
            `Servidor activo actualizado: ${activeServer.alias}`,
            `Target: ${serverRef(activeServer)}`,
            `Test conexion: ${testConnection ? "OK" : "omitido"}`,
          ].join("\n")
        },
      }),

      ssh_current: tool({
        description: "Muestra el servidor SSH actualmente activo",
        args: {},
        async execute() {
          const active = await store.getActiveServer()
          if (!active) {
            return "No hay servidor activo. Usa ssh_use <alias>."
          }

          return [
            `Servidor activo: ${active.alias}`,
            `Target: ${serverRef(active)}`,
            `Auth: ${serverAuthLabel(active)}`,
            `Ultimo uso: ${active.lastUsedAt ?? "nunca"}`,
          ].join("\n")
        },
      }),

      ssh_console_open: tool({
        description: "Abre una terminal local separada conectada por SSH al servidor activo",
        args: {
          alias: tool.schema.string().optional(),
          sessionName: tool.schema.string().optional(),
        },
        async execute(args) {
          const target = args.alias ? await store.getServerByAlias(args.alias) : await store.getActiveServer()
          if (!target) {
            throw new Error(args.alias ? `Alias no encontrado: ${args.alias}` : "No hay servidor activo.")
          }

          const sessionName = normalizeTmuxSessionName(args.sessionName)
          const command = buildAttachCommand(target, sessionName)
          // Comando manual sin sshpass (para mostrar al usuario)
          const manualCommand = `ssh -t -p ${target.port} ${target.user}@${target.host} 'tmux new-session -A -s ${sessionName}'`

          // Resolver password para inyectarla en la terminal nueva
          // (la terminal nueva no hereda las env vars del proceso de OpenCode)
          const password = resolveServerPassword(target)
          const env: Record<string, string> = {}
          if (password) env["SSHPASS"] = password

          try {
            await openDetachedTerminal({ command, env })
            await store.touchServer(target.alias)
            // Guardar la sesion tmux activa para que ssh_exec/ssh_shell
            // puedan enviar comandos a ella y sean visibles en la consola
            await store.setActiveTmuxSession(target.alias, sessionName)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return [
              "No se pudo abrir la terminal local automaticamente.",
              `Error: ${message}`,
              "Comando manual (copiar y pegar):",
              manualCommand,
            ].join("\n")
          }

          return [
            `Terminal abierta para ${target.alias} (${serverRef(target)}).`,
            `Sesion tmux: ${sessionName}`,
            "Los comandos que ejecute OpenCode aparecerán también en esta consola.",
            "Si la ventana no aparece automaticamente, pega este comando en tu terminal local:",
            manualCommand,
          ].join("\n")
        },
      }),

      ssh_exec: tool({
        description: "Ejecuta un comando en el servidor SSH activo",
        args: {
          command: tool.schema.string().min(1).describe("Comando remoto a ejecutar"),
          timeoutMs: tool.schema.number().int().min(1000).max(600000).optional(),
        },
        async execute(args, context) {
          const active = await store.getActiveServer()
          if (!active) {
            throw new Error("No hay servidor activo. Usa ssh_use <alias>.")
          }

          // Si hay consola tmux abierta, enviar el comando para que sea visible
          if (active.activeTmuxSession) {
            sendToTmux(active, active.activeTmuxSession, args.command)
          }

          const title = `SSH ${active.alias} - ${args.command}`
          let liveStdout = ""
          let liveStderr = ""
          let lastUpdateAt = 0

          const renderLiveOutput = (): string => {
            return [
              `target: ${active.alias} (${serverRef(active)})`,
              `command: ${args.command}`,
              "estado: ejecutando...",
              "",
              "stdout parcial:",
              liveStdout || "(vacio)",
              "",
              "stderr parcial:",
              liveStderr || "(vacio)",
            ].join("\n")
          }

          const publishMetadata = (input: {
            output: string
            exit?: number
            status: "running" | "completed" | "error"
            error?: string
          }): void => {
            context.metadata({
              title,
              metadata: {
                alias: active.alias,
                host: active.host,
                port: active.port,
                user: active.user,
                description: args.command,
                status: input.status,
                exit: input.exit,
                error: input.error,
                output:
                  input.output.length > MAX_METADATA_LENGTH
                    ? `${input.output.slice(0, MAX_METADATA_LENGTH)}\n\n...`
                    : input.output,
              },
            })
          }

          const maybePublishLiveMetadata = (force: boolean): void => {
            const now = Date.now()
            if (!force && now - lastUpdateAt < LIVE_UPDATE_INTERVAL_MS) {
              return
            }
            lastUpdateAt = now
            publishMetadata({
              status: "running",
              output: renderLiveOutput(),
            })
          }

          maybePublishLiveMetadata(true)

          try {
            const result = await execOnServer(active, args.command, {
              timeoutMs: args.timeoutMs ?? 120000,
              onStdoutChunk: (chunk) => {
                liveStdout = keepTail(`${liveStdout}${chunk}`, LIVE_STREAM_BUFFER_LENGTH)
                maybePublishLiveMetadata(false)
              },
              onStderrChunk: (chunk) => {
                liveStderr = keepTail(`${liveStderr}${chunk}`, LIVE_STREAM_BUFFER_LENGTH)
                maybePublishLiveMetadata(false)
              },
            })

            await store.touchServer(active.alias)

            const stdout = truncateText(result.stdout, 12000)
            const stderr = truncateText(result.stderr, 12000)

            const rawOutput = [
              `target: ${active.alias} (${serverRef(active)})`,
              `command: ${args.command}`,
              `exitCode: ${result.exitCode}`,
              `durationMs: ${result.durationMs}`,
              "",
              "stdout:",
              stdout || "(vacio)",
              "",
              "stderr:",
              stderr || "(vacio)",
            ].join("\n")

            publishMetadata({
              status: "completed",
              exit: result.exitCode,
              output: rawOutput,
            })

            return rawOutput
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)

            const errorOutput = [
              `target: ${active.alias} (${serverRef(active)})`,
              `command: ${args.command}`,
              `error: ${message}`,
              "",
              "stdout parcial:",
              liveStdout || "(vacio)",
              "",
              "stderr parcial:",
              liveStderr || "(vacio)",
            ].join("\n")

            publishMetadata({
              status: "error",
              error: message,
              output: errorOutput,
            })

            throw error
          }
        },
      }),

      ssh_shell: tool({
        description: "Ejecuta comando en modo shell interactivo (PTY)",
        args: {
          command: tool.schema.string().min(1).describe("Comando a ejecutar en la sesion shell"),
          timeoutMs: tool.schema.number().int().min(1000).max(600000).optional(),
        },
        async execute(args, context) {
          const active = await store.getActiveServer()
          if (!active) {
            throw new Error("No hay servidor activo. Usa ssh_use <alias>.")
          }

          // Si hay consola tmux abierta, enviar el comando para que sea visible
          if (active.activeTmuxSession) {
            sendToTmux(active, active.activeTmuxSession, args.command)
          }

          const sessionKey = shellSessionKey(context.sessionID, active.alias)
          const handle = await getOrCreateShellSession({
            sessionID: context.sessionID,
            server: active,
          })

          const title = `SSH Shell ${active.alias} - ${args.command}`
          const prompt = `${active.user}@${active.host}:~$ ${args.command}`

          context.metadata({
            title,
            metadata: {
              alias: active.alias,
              host: active.host,
              port: active.port,
              user: active.user,
              description: args.command,
              mode: "shell",
              status: "running",
              output: prompt,
            },
          })

          try {
            const result = await handle.shell.run(args.command, {
              timeoutMs: args.timeoutMs ?? 120000,
            })

            handle.lastUsedAt = new Date().toISOString()
            await store.touchServer(active.alias)

            const body = truncateText(result.output.trimEnd(), SHELL_OUTPUT_LIMIT)
            const rawOutput = [prompt, body || "(sin salida)", "", `[exit ${result.exitCode} | ${result.durationMs}ms]`].join(
              "\n",
            )

            context.metadata({
              title,
              metadata: {
                alias: active.alias,
                host: active.host,
                port: active.port,
                user: active.user,
                description: args.command,
                mode: "shell",
                status: "completed",
                exit: result.exitCode,
                output:
                  rawOutput.length > MAX_METADATA_LENGTH
                    ? `${rawOutput.slice(0, MAX_METADATA_LENGTH)}\n\n...`
                    : rawOutput,
              },
            })

            return rawOutput
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (handle.shell.isClosed()) {
              shellSessions.delete(sessionKey)
            }

            const errorOutput = [prompt, "", `error: ${message}`].join("\n")

            context.metadata({
              title,
              metadata: {
                alias: active.alias,
                host: active.host,
                port: active.port,
                user: active.user,
                description: args.command,
                mode: "shell",
                status: "error",
                error: message,
                output: errorOutput,
              },
            })

            throw error
          }
        },
      }),

      ssh_shell_exit: tool({
        description: "Cierra la sesion shell interactiva del servidor activo",
        args: {
          alias: tool.schema.string().optional(),
        },
        async execute(args, context) {
          const activeAlias = args.alias ?? (await store.getActiveAlias())
          if (!activeAlias) {
            return "No hay servidor activo y no se indico alias."
          }

          const key = shellSessionKey(context.sessionID, activeAlias)
          const handle = shellSessions.get(key)

          if (!handle) {
            return `No hay sesion shell abierta para ${activeAlias} en esta conversacion.`
          }

          await closeShellSession(handle)
          shellSessions.delete(key)

          return `Sesion shell cerrada para ${activeAlias}.`
        },
      }),

      ssh_console_close: tool({
        description: "Indica que la consola tmux fue cerrada y deja de reenviar comandos a ella",
        args: {
          alias: tool.schema.string().optional(),
        },
        async execute(args) {
          const activeAlias = args.alias ?? (await store.getActiveAlias())
          if (!activeAlias) {
            return "No hay servidor activo."
          }
          await store.setActiveTmuxSession(activeAlias, null)
          return `Consola tmux desvinculada para ${activeAlias}. Los comandos ya no se reenviarán a la terminal.`
        },
      }),

      ssh_test: tool({
        description: "Prueba conectividad SSH para un alias o para el servidor activo",
        args: {
          alias: tool.schema.string().optional(),
          connectTimeoutMs: tool.schema.number().int().min(1000).max(120000).optional(),
        },
        async execute(args) {
          let target = args.alias ? await store.getServerByAlias(args.alias) : await store.getActiveServer()
          if (!target) {
            throw new Error(args.alias ? `Alias no encontrado: ${args.alias}` : "No hay servidor activo.")
          }

          await testServerConnection(target, { connectTimeoutMs: args.connectTimeoutMs ?? 10000 })
          return `Conexion SSH OK para ${target.alias} (${serverRef(target)})`
        },
      }),

      ssh_remove: tool({
        description: "Elimina un servidor SSH por alias",
        args: {
          alias: tool.schema.string().min(1),
        },
        async execute(args) {
          await store.removeServer(args.alias)
          return `Servidor eliminado: ${args.alias}`
        },
      }),

      ssh_copy_id: tool({
        description: "Copia tu clave publica SSH al servidor para autenticacion sin password. Genera la clave si no existe.",
        args: {
          alias: tool.schema.string().optional().describe("Alias del servidor destino (por defecto: activo)"),
          keyPath: tool.schema.string().optional().describe("Ruta a la clave privada. Por defecto: ~/.ssh/opencode_ssh_id"),
        },
        async execute(args) {
          const target = args.alias ? await store.getServerByAlias(args.alias) : await store.getActiveServer()
          if (!target) {
            throw new Error(args.alias ? `Alias no encontrado: ${args.alias}` : "No hay servidor activo.")
          }

          const keyName = "opencode_ssh_id"
          const privateKeyPath = args.keyPath
            ? args.keyPath.replace(/^~/, homedir())
            : join(homedir(), ".ssh", keyName)
          const publicKeyPath = `${privateKeyPath}.pub`

          const lines: string[] = []

          // 1. Generar clave si no existe
          const { access } = await import("node:fs/promises")
          let keyExists = false
          try {
            await access(privateKeyPath)
            keyExists = true
          } catch {
            keyExists = false
          }

          if (!keyExists) {
            await new Promise<void>((resolve, reject) => {
              const child = spawn("ssh-keygen", [
                "-t", "ed25519",
                "-f", privateKeyPath,
                "-N", "",
                "-C", "opencode-ssh",
              ], { stdio: "ignore" })
              child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ssh-keygen fallo con codigo ${code}`)))
              child.on("error", reject)
            })
            lines.push(`Clave generada: ${privateKeyPath}`)
          } else {
            lines.push(`Clave existente: ${privateKeyPath}`)
          }

          // 2. Leer clave publica
          const { readFile: readFileFs } = await import("node:fs/promises")
          const pubKey = (await readFileFs(publicKeyPath, "utf-8")).trim()
          lines.push(`Clave publica: ${pubKey.split(" ").slice(0, 2).join(" ").slice(0, 60)}...`)

          // 3. Subir al servidor via ssh2 (usa la auth actual del perfil)
          const uploadCmd = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qF ${JSON.stringify(pubKey)} ~/.ssh/authorized_keys 2>/dev/null || echo ${JSON.stringify(pubKey)} >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo OK`
          const result = await execOnServer(target, uploadCmd)
          if (result.exitCode !== 0 || !result.stdout.includes("OK")) {
            throw new Error(`No se pudo subir la clave: ${result.stderr || result.stdout}`)
          }
          lines.push("Clave publica agregada a authorized_keys en el servidor.")

          // 4. Actualizar perfil a key auth
          const keyRelPath = `~/.ssh/${keyName}`
          await store.updateServerAuth(target.alias, {
            type: "key",
            privateKeyPath: args.keyPath ?? keyRelPath,
          })
          lines.push(`Perfil '${target.alias}' actualizado a auth=key (${args.keyPath ?? keyRelPath}).`)
          lines.push("Desde ahora ssh_console_open no pedira password.")

          return lines.join("\n")
        },
      }),
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "ssh_exec" && input.tool !== "ssh_shell" && input.tool !== "ssh_console_open") return

      if (input.tool === "ssh_console_open") {
        output.title = "SSH Console"
        output.metadata = {
          ...(output.metadata || {}),
          mode: "console-open",
          output:
            output.output.length > MAX_METADATA_LENGTH
              ? `${output.output.slice(0, MAX_METADATA_LENGTH)}\n\n...`
              : output.output,
        }
        return
      }

      const args = input.args as { command?: string }
      const command = args.command ?? "ssh command"
      const exit =
        input.tool === "ssh_exec"
          ? parseExitCodeFromOutput(output.output)
          : parseExitCodeFromShellOutput(output.output)

      output.title = input.tool === "ssh_exec" ? `SSH Exec - ${command}` : `SSH Shell - ${command}`
      output.metadata = {
        ...(output.metadata || {}),
        description: command,
        mode: input.tool === "ssh_exec" ? "exec" : "shell",
        exit: exit ?? undefined,
        output:
          output.output.length > MAX_METADATA_LENGTH
            ? `${output.output.slice(0, MAX_METADATA_LENGTH)}\n\n...`
            : output.output,
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const active = await store.getActiveServer()
      if (!active) return

      const lines = [
        "Hay un servidor SSH activo en este proyecto.",
        `Servidor: ${active.alias} (${serverRef(active)}).`,
        "Para ejecutar comandos remotos, prioriza ssh_exec o ssh_shell en vez de bash local.",
        "Si el usuario pide abrir una terminal separada o ver comandos en consola real, usa ssh_console_open.",
      ]

      if (active.activeTmuxSession) {
        lines.push(
          `Hay una consola tmux abierta (sesion: ${active.activeTmuxSession}). Los comandos ejecutados via ssh_exec y ssh_shell se envian automaticamente a esa consola para que sean visibles.`,
          "Si el usuario cierra la consola, llama ssh_console_close para desvincularla.",
        )
      }

      output.system.push(lines.join(" "))
    },
  }
}

export default OpenCodeSSHPlugin
