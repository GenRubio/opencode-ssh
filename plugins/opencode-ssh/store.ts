import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"

import type { AddServerInput, ServerProfile, StoreFile } from "./types"

const ALIAS_PATTERN = /^[A-Za-z0-9_-]+$/
const STORE_VERSION = 1
const STORE_FILE_NAME = "servers.json"

function defaultStoreData(): StoreFile {
  return {
    version: STORE_VERSION,
    activeAlias: null,
    servers: [],
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function ensureValidAlias(alias: string): void {
  if (!alias || !ALIAS_PATTERN.test(alias)) {
    throw new Error("Invalid alias. Use letters, numbers, hyphens and underscores.")
  }
}

function normalizePort(port?: number): number {
  if (port === undefined) return 22
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid port. Must be between 1 and 65535.")
  }
  return port
}

function sameAlias(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function defaultStoreDir(): string {
  if (process.env.OPENCODE_SSH_STORE_DIR) {
    return process.env.OPENCODE_SSH_STORE_DIR
  }
  return path.join(homedir(), ".config", "opencode", "plugins", "opencode-ssh")
}

function sanitizeServer(raw: any): ServerProfile | null {
  if (!raw || typeof raw !== "object") return null

  const alias = typeof raw.alias === "string" ? raw.alias.trim() : ""
  const host = typeof raw.host === "string" ? raw.host.trim() : ""
  const user = typeof raw.user === "string" ? raw.user.trim() : ""
  const port = typeof raw.port === "number" ? raw.port : Number(raw.port)
  const auth = raw.auth

  if (!alias || !host || !user || !Number.isInteger(port)) return null
  if (port < 1 || port > 65535) return null

  if (!auth || typeof auth !== "object" || typeof auth.type !== "string") return null

  if (auth.type === "key") {
    if (typeof auth.privateKeyPath !== "string" || !auth.privateKeyPath.trim()) return null
  }

  if (auth.type === "password") {
    if (typeof auth.passwordEnvVar !== "string" || !auth.passwordEnvVar.trim()) return null
  }

  return {
    alias,
    host,
    port,
    user,
    auth,
    knownHostFingerprint:
      typeof raw.knownHostFingerprint === "string" ? raw.knownHostFingerprint : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
    lastUsedAt: typeof raw.lastUsedAt === "string" ? raw.lastUsedAt : undefined,
  }
}

export class ServerStore {
  private readonly storeDir: string
  private readonly storeFilePath: string
  private cache: StoreFile | null = null
  private writeChain: Promise<void> = Promise.resolve()

  constructor(input?: { storeDir?: string }) {
    this.storeDir = input?.storeDir ?? defaultStoreDir()
    this.storeFilePath = path.join(this.storeDir, STORE_FILE_NAME)
  }

  private async ensureStoreDir(): Promise<void> {
    await mkdir(this.storeDir, { recursive: true })
  }

  private async loadFromDisk(): Promise<StoreFile> {
    await this.ensureStoreDir()

    try {
      const raw = await readFile(this.storeFilePath, "utf8")
      const parsed = JSON.parse(raw) as Partial<StoreFile>

      const servers = Array.isArray(parsed.servers)
        ? parsed.servers.map((item) => sanitizeServer(item)).filter((item) => item !== null)
        : []

      const aliases = new Set<string>()
      const dedupedServers = servers.filter((server) => {
        const key = server.alias.toLowerCase()
        if (aliases.has(key)) return false
        aliases.add(key)
        return true
      })

      const activeAlias =
        typeof parsed.activeAlias === "string" &&
        dedupedServers.some((server) => sameAlias(server.alias, parsed.activeAlias!))
          ? parsed.activeAlias
          : null

      return {
        version: STORE_VERSION,
        activeAlias,
        servers: dedupedServers,
      }
    } catch {
      return defaultStoreData()
    }
  }

  private async saveToDisk(data: StoreFile): Promise<void> {
    const operation = this.writeChain.then(async () => {
      await this.ensureStoreDir()

      const tempPath = `${this.storeFilePath}.${randomUUID()}.tmp`
      const payload = `${JSON.stringify(data, null, 2)}\n`

      await writeFile(tempPath, payload, "utf8")
      await rename(tempPath, this.storeFilePath)
    })

    this.writeChain = operation.catch(() => undefined)
    await operation
  }

  private async getData(): Promise<StoreFile> {
    if (!this.cache) {
      this.cache = await this.loadFromDisk()
    }
    return this.cache
  }

  async listServers(): Promise<ServerProfile[]> {
    const data = await this.getData()
    return [...data.servers].sort((a, b) => a.alias.localeCompare(b.alias))
  }

  async getActiveAlias(): Promise<string | null> {
    const data = await this.getData()
    return data.activeAlias
  }

  async getServerByAlias(alias: string): Promise<ServerProfile | null> {
    const data = await this.getData()
    const found = data.servers.find((server) => sameAlias(server.alias, alias))
    return found ?? null
  }

  async getActiveServer(): Promise<ServerProfile | null> {
    const data = await this.getData()
    if (!data.activeAlias) return null
    const found = data.servers.find((server) => sameAlias(server.alias, data.activeAlias!))
    return found ?? null
  }

  async addServer(input: AddServerInput): Promise<ServerProfile> {
    const data = await this.getData()

    const alias = input.alias.trim()
    const host = input.host.trim()
    const user = input.user.trim()

    ensureValidAlias(alias)

    if (!host) throw new Error("Host is required.")
    if (!user) throw new Error("User is required.")

    const existing = data.servers.find((server) => sameAlias(server.alias, alias))
    if (existing) {
      throw new Error(`Alias '${alias}' already exists.`)
    }

    const port = normalizePort(input.port)
    const timestamp = nowIso()

    const newServer: ServerProfile = {
      alias,
      host,
      port,
      user,
      auth: input.auth,
      knownHostFingerprint: input.knownHostFingerprint,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    data.servers.push(newServer)
    await this.saveToDisk(data)

    return newServer
  }

  async setActiveAlias(alias: string): Promise<ServerProfile> {
    const data = await this.getData()
    const existing = data.servers.find((server) => sameAlias(server.alias, alias))
    if (!existing) {
      throw new Error(`Alias not found: ${alias}`)
    }

    const timestamp = nowIso()
    existing.lastUsedAt = timestamp
    existing.updatedAt = timestamp
    data.activeAlias = existing.alias

    await this.saveToDisk(data)
    return existing
  }

  async touchServer(alias: string): Promise<void> {
    const data = await this.getData()
    const existing = data.servers.find((server) => sameAlias(server.alias, alias))
    if (!existing) return

    const timestamp = nowIso()
    existing.lastUsedAt = timestamp
    existing.updatedAt = timestamp

    await this.saveToDisk(data)
  }

  async removeServer(alias: string): Promise<void> {
    const data = await this.getData()
    const previousLength = data.servers.length

    data.servers = data.servers.filter((server) => !sameAlias(server.alias, alias))

    if (data.servers.length === previousLength) {
      throw new Error(`Alias not found: ${alias}`)
    }

    if (data.activeAlias && sameAlias(data.activeAlias, alias)) {
      data.activeAlias = null
    }

    await this.saveToDisk(data)
  }

  async updateServerAuth(alias: string, auth: ServerProfile["auth"]): Promise<ServerProfile> {
    const data = await this.getData()
    const existing = data.servers.find((server) => sameAlias(server.alias, alias))
    if (!existing) {
      throw new Error(`Alias not found: ${alias}`)
    }

    existing.auth = auth
    existing.updatedAt = nowIso()

    await this.saveToDisk(data)
    return existing
  }

  async setActiveTmuxSession(alias: string, sessionName: string | null): Promise<void> {
    const data = await this.getData()
    const existing = data.servers.find((server) => sameAlias(server.alias, alias))
    if (!existing) return

    if (sessionName === null) {
      delete existing.activeTmuxSession
    } else {
      existing.activeTmuxSession = sessionName
    }
    existing.updatedAt = nowIso()

    await this.saveToDisk(data)
  }
}
