export type AuthType = "key" | "password"

export type KeyAuth = {
  type: "key"
  privateKeyPath: string
  passphraseEnvVar?: string
}

export type PasswordAuth = {
  type: "password"
  passwordEnvVar: string
}

export type ServerAuth = KeyAuth | PasswordAuth

export type ServerProfile = {
  alias: string
  host: string
  port: number
  user: string
  auth: ServerAuth
  knownHostFingerprint?: string
  /** Nombre de sesion tmux activa abierta con ssh_console_open, si existe */
  activeTmuxSession?: string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export type StoreFile = {
  version: 1
  activeAlias: string | null
  servers: ServerProfile[]
}

export type AddServerInput = {
  alias: string
  host: string
  port?: number
  user: string
  auth: ServerAuth
  knownHostFingerprint?: string
}
