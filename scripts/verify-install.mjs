import { access, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const configDir = process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), ".config", "opencode")

const requiredPaths = [
  path.join(configDir, "plugins", "opencode-ssh.ts"),
  path.join(configDir, "plugins", "opencode-ssh", "client.ts"),
  path.join(configDir, "plugins", "opencode-ssh", "store.ts"),
  path.join(configDir, "plugins", "opencode-ssh", "types.ts"),
  path.join(configDir, "commands", "ssh-new.md"),
  path.join(configDir, "commands", "ssh-list.md"),
  path.join(configDir, "commands", "ssh-use.md"),
  path.join(configDir, "commands", "ssh-current.md"),
  path.join(configDir, "commands", "ssh-run.md"),
]

async function checkPath(filePath) {
  try {
    await access(filePath)
    return { filePath, ok: true }
  } catch {
    return { filePath, ok: false }
  }
}

async function main() {
  const results = await Promise.all(requiredPaths.map((item) => checkPath(item)))
  const missing = results.filter((item) => !item.ok)

  process.stdout.write(`Config dir: ${configDir}\n`)

  for (const result of results) {
    process.stdout.write(`${result.ok ? "OK" : "MISSING"} ${result.filePath}\n`)
  }

  const packageJsonPath = path.join(configDir, "package.json")
  try {
    const raw = await readFile(packageJsonPath, "utf8")
    const pkg = JSON.parse(raw)
    const deps = pkg.dependencies || {}
    process.stdout.write(`Dependency @opencode-ai/plugin: ${deps["@opencode-ai/plugin"] || "missing"}\n`)
    process.stdout.write(`Dependency ssh2: ${deps.ssh2 || "missing"}\n`)
  } catch {
    process.stdout.write(`MISSING ${packageJsonPath}\n`)
  }

  if (missing.length > 0) {
    process.exitCode = 1
  }
}

await main()
