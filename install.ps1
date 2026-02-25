param(
  [string]$Repo = $(if ($env:OPENCODE_SSH_REPO) { $env:OPENCODE_SSH_REPO } else { "GenRubio/opencode-ssh" }),
  [string]$Ref = $(if ($env:OPENCODE_SSH_REF) { $env:OPENCODE_SSH_REF } else { "main" }),
  [string]$ConfigDir = $(if ($env:OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR } else { Join-Path $HOME ".config/opencode" })
)

$ErrorActionPreference = "Stop"
$PluginName = "opencode-ssh"
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Ref"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Download-File {
  param(
    [string]$Url,
    [string]$Target
  )

  $dir = Split-Path -Parent $Target
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  Invoke-WebRequest -Uri $Url -OutFile $Target
  Write-Host "Installed: $Target"
}

Require-Command npm

Write-Host "Installing $PluginName from $Repo@$Ref"
Write-Host "OpenCode config: $ConfigDir"

Download-File "$BaseUrl/plugins/opencode-ssh.ts" "$ConfigDir/plugins/opencode-ssh.ts"
Download-File "$BaseUrl/plugins/opencode-ssh/client.ts" "$ConfigDir/plugins/opencode-ssh/client.ts"
Download-File "$BaseUrl/plugins/opencode-ssh/store.ts" "$ConfigDir/plugins/opencode-ssh/store.ts"
Download-File "$BaseUrl/plugins/opencode-ssh/types.ts" "$ConfigDir/plugins/opencode-ssh/types.ts"

Download-File "$BaseUrl/commands/ssh-new.md" "$ConfigDir/commands/ssh-new.md"
Download-File "$BaseUrl/commands/ssh-list.md" "$ConfigDir/commands/ssh-list.md"
Download-File "$BaseUrl/commands/ssh-use.md" "$ConfigDir/commands/ssh-use.md"
Download-File "$BaseUrl/commands/ssh-current.md" "$ConfigDir/commands/ssh-current.md"
Download-File "$BaseUrl/commands/ssh-run.md" "$ConfigDir/commands/ssh-run.md"

if (-not (Test-Path $ConfigDir)) {
  New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

$packageJsonPath = Join-Path $ConfigDir "package.json"
if (-not (Test-Path $packageJsonPath)) {
  @"
{
  "name": "opencode-local-config",
  "private": true,
  "dependencies": {}
}
"@ | Set-Content -Path $packageJsonPath -Encoding UTF8
}

npm pkg set --prefix "$ConfigDir" "dependencies.@opencode-ai/plugin=1.2.12" "dependencies.ssh2=^1.16.0" | Out-Null
npm install --prefix "$ConfigDir" --silent --no-fund --no-audit | Out-Null

$manifest = [ordered]@{
  plugin = $PluginName
  repo = $Repo
  ref = $Ref
  installedAt = [DateTime]::UtcNow.ToString("o")
  configDir = $ConfigDir
  files = @(
    "$ConfigDir/plugins/opencode-ssh.ts",
    "$ConfigDir/plugins/opencode-ssh/client.ts",
    "$ConfigDir/plugins/opencode-ssh/store.ts",
    "$ConfigDir/plugins/opencode-ssh/types.ts",
    "$ConfigDir/commands/ssh-new.md",
    "$ConfigDir/commands/ssh-list.md",
    "$ConfigDir/commands/ssh-use.md",
    "$ConfigDir/commands/ssh-current.md",
    "$ConfigDir/commands/ssh-run.md"
  )
}

$manifestPath = Join-Path $ConfigDir "$PluginName.manifest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "Done. Restart OpenCode to load the plugin."
Write-Host "If you use GUI, fully close and reopen the app."
