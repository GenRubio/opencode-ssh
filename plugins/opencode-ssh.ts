import { type Plugin, tool } from "@opencode-ai/plugin"

import { execOnServer, testServerConnection } from "./opencode-ssh/client"
import { ServerStore } from "./opencode-ssh/store"
import type { ServerAuth, ServerProfile } from "./opencode-ssh/types"

const store = new ServerStore()

function asBoolean(value: boolean | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  const suffix = `\n... output truncado (${text.length - maxLength} caracteres omitidos)`
  return `${text.slice(0, maxLength)}${suffix}`
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

          context.metadata({
            title: `SSH ${active.alias}`,
            metadata: {
              alias: active.alias,
              host: active.host,
              port: active.port,
              user: active.user,
            },
          })

          const result = await execOnServer(active, args.command, {
            timeoutMs: args.timeoutMs ?? 120000,
          })

          await store.touchServer(active.alias)

          const stdout = truncateText(result.stdout, 12000)
          const stderr = truncateText(result.stderr, 12000)

          return [
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
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const active = await store.getActiveServer()
      if (!active) return

      output.system.push(
        [
          "Hay un servidor SSH activo en este proyecto.",
          `Servidor: ${active.alias} (${serverRef(active)}).`,
          "Para ejecutar comandos de shell remotos, prioriza la herramienta ssh_exec en vez de bash local.",
        ].join(" "),
      )
    },
  }
}

export default OpenCodeSSHPlugin
