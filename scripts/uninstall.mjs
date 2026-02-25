import { readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const pluginName = "opencode-ssh"
const configDir = process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), ".config", "opencode")
const manifestPath = path.join(configDir, `${pluginName}.manifest.json`)

const fallbackPaths = [
  path.join(configDir, "plugins", "opencode-ssh.ts"),
  path.join(configDir, "plugins", "ssh"),
  path.join(configDir, "commands", "ssh-new.md"),
  path.join(configDir, "commands", "ssh-list.md"),
  path.join(configDir, "commands", "ssh-use.md"),
  path.join(configDir, "commands", "ssh-current.md"),
  path.join(configDir, "commands", "ssh-run.md"),
]

async function removePath(target) {
  try {
    await rm(target, { recursive: true, force: true })
    process.stdout.write(`Removed: ${target}\n`)
  } catch {
    // Ignore: already removed.
  }
}

async function main() {
  let targets = fallbackPaths

  try {
    const raw = await readFile(manifestPath, "utf8")
    const manifest = JSON.parse(raw)
    if (Array.isArray(manifest.files)) {
      targets = manifest.files
    }
  } catch {
    process.stdout.write("Manifest not found, using fallback file list.\n")
  }

  for (const target of targets) {
    await removePath(target)
  }

  await removePath(manifestPath)

  process.stdout.write("Uninstall completed.\n")
  process.stdout.write("Restart OpenCode to apply changes.\n")
}

await main()
