import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import { Client, type ConnectConfig } from "ssh2"

import type { ServerProfile } from "./types"

export type ExecOptions = {
  timeoutMs?: number
  connectTimeoutMs?: number
  onStdoutChunk?: (chunk: string) => void
  onStderrChunk?: (chunk: string) => void
}

export type ExecResult = {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export type ShellRunOptions = {
  timeoutMs?: number
}

export type ShellRunResult = {
  output: string
  exitCode: number
  durationMs: number
}

export type ShellSession = {
  run(command: string, options?: ShellRunOptions): Promise<ShellRunResult>
  close(): Promise<void>
  isClosed(): boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function createMarker(): string {
  return `__OPENCODE_SHELL_DONE_${Date.now()}_${Math.random().toString(16).slice(2)}__`
}

function expandHome(inputPath: string): string {
  if (inputPath === "~") return homedir()
  if (inputPath.startsWith("~/")) {
    return path.join(homedir(), inputPath.slice(2))
  }
  return inputPath
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Variable de entorno no definida: ${name}`)
  }
  return value
}

async function buildConnectConfig(profile: ServerProfile, connectTimeoutMs: number): Promise<ConnectConfig> {
  const baseConfig: ConnectConfig = {
    host: profile.host,
    port: profile.port,
    username: profile.user,
    readyTimeout: connectTimeoutMs,
  }

  if (profile.auth.type === "key") {
    const keyPath = expandHome(profile.auth.privateKeyPath)
    const privateKey = await readFile(keyPath)
    const passphrase = profile.auth.passphraseEnvVar
      ? requireEnv(profile.auth.passphraseEnvVar)
      : undefined

    return {
      ...baseConfig,
      privateKey,
      passphrase,
    }
  }

  const password = requireEnv(profile.auth.passwordEnvVar)

  return {
    ...baseConfig,
    password,
  }
}

async function openConnection(profile: ServerProfile, connectTimeoutMs: number): Promise<Client> {
  const config = await buildConnectConfig(profile, connectTimeoutMs)

  return await new Promise<Client>((resolve, reject) => {
    const client = new Client()
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      client.end()
      reject(new Error("Timeout conectando por SSH."))
    }, connectTimeoutMs)

    const cleanup = () => {
      clearTimeout(timer)
      client.removeAllListeners("ready")
      client.removeAllListeners("error")
    }

    client.on("ready", () => {
      if (settled) return
      settled = true
      cleanup()
      resolve(client)
    })

    client.on("error", (error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    })

    client.connect(config)
  })
}

export async function testServerConnection(
  profile: ServerProfile,
  options?: { connectTimeoutMs?: number },
): Promise<void> {
  const connectTimeoutMs = options?.connectTimeoutMs ?? 10000
  const client = await openConnection(profile, connectTimeoutMs)
  client.end()
}

export async function execOnServer(
  profile: ServerProfile,
  command: string,
  options?: ExecOptions,
): Promise<ExecResult> {
  const timeoutMs = options?.timeoutMs ?? 120000
  const connectTimeoutMs = options?.connectTimeoutMs ?? 10000

  const startedAt = Date.now()
  const client = await openConnection(profile, connectTimeoutMs)

  try {
    return await new Promise<ExecResult>((resolve, reject) => {
      let stdout = ""
      let stderr = ""
      let settled = false

      const settle = (callback: () => void) => {
        if (settled) return
        settled = true
        callback()
      }

      const timeout = setTimeout(() => {
        settle(() => {
          client.end()
          reject(new Error(`Comando remoto excedio el timeout de ${timeoutMs}ms.`))
        })
      }, timeoutMs)

      client.exec(command, (error, stream) => {
        if (error) {
          clearTimeout(timeout)
          settle(() => reject(error))
          return
        }

        stream.on("data", (chunk: Buffer | string) => {
          const value = chunk.toString()
          stdout += value
          options?.onStdoutChunk?.(value)
        })

        stream.stderr.on("data", (chunk: Buffer | string) => {
          const value = chunk.toString()
          stderr += value
          options?.onStderrChunk?.(value)
        })

        stream.on("error", (streamError: Error) => {
          clearTimeout(timeout)
          settle(() => reject(streamError))
        })

        stream.on("close", (code: number | null) => {
          clearTimeout(timeout)
          settle(() => {
            const finishedAt = Date.now()
            resolve({
              stdout,
              stderr,
              exitCode: typeof code === "number" ? code : -1,
              durationMs: finishedAt - startedAt,
            })
          })
        })
      })
    })
  } finally {
    client.end()
  }
}

export async function openShellSession(
  profile: ServerProfile,
  options?: { connectTimeoutMs?: number },
): Promise<ShellSession> {
  const connectTimeoutMs = options?.connectTimeoutMs ?? 10000
  const client = await openConnection(profile, connectTimeoutMs)

  return await new Promise<ShellSession>((resolve, reject) => {
    client.shell(
      {
        term: "xterm-256color",
        cols: 140,
        rows: 40,
      },
      (error, stream) => {
        if (error) {
          client.end()
          reject(error)
          return
        }

        let closed = false
        let commandQueue: Promise<void> = Promise.resolve()

        let activeRun: {
          marker: string
          timeout: NodeJS.Timeout
          startedAt: number
          output: string
          resolve: (value: ShellRunResult) => void
          reject: (error: Error) => void
        } | null = null

        const failActiveRun = (error: Error): void => {
          if (!activeRun) return
          clearTimeout(activeRun.timeout)
          const rejectRun = activeRun.reject
          activeRun = null
          rejectRun(error)
        }

        const closeSession = async (): Promise<void> => {
          if (closed) return
          closed = true
          failActiveRun(new Error("Sesion shell cerrada."))

          await new Promise<void>((closeResolve) => {
            const timer = setTimeout(() => closeResolve(), 1000)
            client.once("close", () => {
              clearTimeout(timer)
              closeResolve()
            })
            client.end()
          })
        }

        const runCommand = async (command: string, timeoutMs: number): Promise<ShellRunResult> => {
          if (closed) {
            throw new Error("Sesion shell cerrada.")
          }
          if (activeRun) {
            throw new Error("La sesion shell esta ocupada ejecutando otro comando.")
          }

          return await new Promise<ShellRunResult>((resolveRun, rejectRun) => {
            const marker = createMarker()
            const markerRegex = new RegExp(`${escapeRegExp(marker)}:(-?\\d+)`)

            const timeout = setTimeout(async () => {
              if (!activeRun || activeRun.marker !== marker) return
              const rejectTimeout = activeRun.reject
              activeRun = null
              rejectTimeout(new Error(`Comando shell excedio el timeout de ${timeoutMs}ms.`))
              await closeSession()
            }, timeoutMs)

            activeRun = {
              marker,
              timeout,
              startedAt: Date.now(),
              output: "",
              resolve: resolveRun,
              reject: rejectRun,
            }

            stream.write(`${command}\nprintf '${marker}:%s\\n' "$?"\n`)

            const onChunk = (chunk: Buffer | string): void => {
              if (!activeRun || activeRun.marker !== marker) return

              activeRun.output += chunk.toString()
              const match = markerRegex.exec(activeRun.output)
              if (!match) return

              const exitCode = Number(match[1])
              const outputUntilMarker = activeRun.output.slice(0, match.index).replace(/\r/g, "")
              const durationMs = Date.now() - activeRun.startedAt

              clearTimeout(activeRun.timeout)
              const resolveFinal = activeRun.resolve
              activeRun = null

              resolveFinal({
                output: outputUntilMarker,
                exitCode: Number.isInteger(exitCode) ? exitCode : -1,
                durationMs,
              })
            }

            const onStdout = (chunk: Buffer | string) => onChunk(chunk)
            const onStderr = (chunk: Buffer | string) => onChunk(chunk)

            stream.on("data", onStdout)
            stream.stderr.on("data", onStderr)

            const cleanupListeners = () => {
              stream.off("data", onStdout)
              stream.stderr.off("data", onStderr)
            }

            const originalResolve = resolveRun
            const originalReject = rejectRun

            activeRun.resolve = (value) => {
              cleanupListeners()
              originalResolve(value)
            }
            activeRun.reject = (error) => {
              cleanupListeners()
              originalReject(error)
            }
          })
        }

        stream.on("close", () => {
          closed = true
          failActiveRun(new Error("La conexion shell se cerro."))
        })

        stream.on("error", (streamError: Error) => {
          closed = true
          failActiveRun(streamError)
          client.end()
        })

        client.on("error", (clientError: Error) => {
          closed = true
          failActiveRun(clientError)
        })

        stream.write("stty -echo\n")

        resolve({
          run: async (command: string, runOptions?: ShellRunOptions): Promise<ShellRunResult> => {
            const timeoutMs = runOptions?.timeoutMs ?? 120000
            const task = commandQueue.then(() => runCommand(command, timeoutMs))
            commandQueue = task.then(
              () => undefined,
              () => undefined,
            )
            return await task
          },
          close: closeSession,
          isClosed: () => closed,
        })
      },
    )
  })
}
