param(
  [string]$ConfigDir = $(if ($env:OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR } else { Join-Path $HOME ".config/opencode" })
)

$ErrorActionPreference = "Stop"
$PluginName = "opencode-ssh"
$ManifestPath = Join-Path $ConfigDir "$PluginName.manifest.json"

function Remove-Target {
  param([string]$Target)
  if (Test-Path $Target) {
    Remove-Item -LiteralPath $Target -Recurse -Force
    Write-Host "Removed: $Target"
  }
}

if (Test-Path $ManifestPath) {
  try {
    $manifest = Get-Content -Raw $ManifestPath | ConvertFrom-Json
    foreach ($file in $manifest.files) {
      Remove-Target $file
    }
  }
  catch {
    # Ignore parse errors and continue with fallback.
  }
}

Remove-Target "$ConfigDir/plugins/opencode-ssh.ts"
Remove-Target "$ConfigDir/plugins/opencode-ssh"
Remove-Target "$ConfigDir/commands/ssh-new.md"
Remove-Target "$ConfigDir/commands/ssh-list.md"
Remove-Target "$ConfigDir/commands/ssh-use.md"
Remove-Target "$ConfigDir/commands/ssh-current.md"
Remove-Target "$ConfigDir/commands/ssh-console.md"
Remove-Target "$ConfigDir/commands/ssh-run.md"
Remove-Target "$ConfigDir/commands/ssh-shell.md"
Remove-Target "$ConfigDir/commands/ssh-shell-exit.md"
Remove-Target $ManifestPath

Write-Host "Done. Restart OpenCode to apply changes."
