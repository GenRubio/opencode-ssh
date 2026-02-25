import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import { Client, type ConnectConfig } from "ssh2"

import type { ServerProfile } from "./types"

export type ExecOptions = {
  timeoutMs?: number
  connectTimeoutMs?: number
}

export type ExecResult = {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
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
          stdout += chunk.toString()
        })

        stream.stderr.on("data", (chunk: Buffer | string) => {
          stderr += chunk.toString()
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
