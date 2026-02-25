import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const pluginName = "opencode-ssh"
const configDir = process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), ".config", "opencode")

const sourceFiles = [
  {
    from: path.join(repoRoot, "plugins", "opencode-ssh.ts"),
    to: path.join(configDir, "plugins", "opencode-ssh.ts"),
  },
  {
    from: path.join(repoRoot, "plugins", "opencode-ssh"),
    to: path.join(configDir, "plugins", "opencode-ssh"),
  },
  {
    from: path.join(repoRoot, "commands", "ssh-new.md"),
    to: path.join(configDir, "commands", "ssh-new.md"),
  },
  {
    from: path.join(repoRoot, "commands", "ssh-list.md"),
    to: path.join(configDir, "commands", "ssh-list.md"),
  },
  {
    from: path.join(repoRoot, "commands", "ssh-use.md"),
    to: path.join(configDir, "commands", "ssh-use.md"),
  },
  {
    from: path.join(repoRoot, "commands", "ssh-current.md"),
    to: path.join(configDir, "commands", "ssh-current.md"),
  },
  {
    from: path.join(repoRoot, "commands", "ssh-run.md"),
    to: path.join(configDir, "commands", "ssh-run.md"),
  },
]

const requiredDependencies = {
  "@opencode-ai/plugin": "1.2.12",
  ssh2: "^1.16.0",
}

const manifestPath = path.join(configDir, `${pluginName}.manifest.json`)
const configPackageJsonPath = path.join(configDir, "package.json")

async function copyPath(from, to) {
  await mkdir(path.dirname(to), { recursive: true })
  await cp(from, to, { recursive: true, force: true })
}

async function ensureConfigPackageJson() {
  let pkg = {
    name: "opencode-local-config",
    private: true,
    dependencies: {},
  }

  try {
    const current = await readFile(configPackageJsonPath, "utf8")
    const parsed = JSON.parse(current)
    pkg = {
      ...pkg,
      ...parsed,
      dependencies: {
        ...(parsed.dependencies || {}),
      },
    }
  } catch {
    // Ignore: file does not exist or invalid JSON.
  }

  for (const [dep, version] of Object.entries(requiredDependencies)) {
    if (!pkg.dependencies[dep]) {
      pkg.dependencies[dep] = version
    }
  }

  await mkdir(path.dirname(configPackageJsonPath), { recursive: true })
  await writeFile(configPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8")
}

async function writeManifest() {
  const payload = {
    plugin: pluginName,
    installedAt: new Date().toISOString(),
    configDir,
    files: sourceFiles.map((item) => item.to),
    requiredDependencies,
  }

  await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

async function main() {
  for (const file of sourceFiles) {
    await copyPath(file.from, file.to)
  }

  await ensureConfigPackageJson()
  await writeManifest()

  process.stdout.write(`Installed ${pluginName} into ${configDir}\n`)
  process.stdout.write("Restart OpenCode to load the new plugin and commands.\n")
  process.stdout.write("If you use GUI, fully close and reopen the app.\n")
}

await main()
