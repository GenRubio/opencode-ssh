---
description: Register a new SSH server (wizard)
---
Configure a server using the `ssh_new` tool in guided step-by-step mode.

Input arguments: `$ARGUMENTS`

Rules:
1) If there are no arguments, start the wizard and ask only for the first missing field (`alias`). Do not call any tools yet.
2) If there are arguments, parse them as `key=value` pairs separated by spaces.
3) Complete the wizard in this order, asking for one piece of data per message:
   - `alias`
   - `host`
   - `port` (default `22`)
   - `user`
   - `auth` (`key` or `password`)
   - if `auth=key`: `privateKeyPath` (required) and `passphraseEnvVar` (optional)
   - if `auth=password`: `passwordEnvVar` (required)
   - `knownHostFingerprint` (optional)
   - `test` (`true`/`false`, default `true`)
   - `use` (`true`/`false`, default `true`)
4) Map the keys:
   - `alias`, `host`, `port`, `user`
   - `auth` (`key` or `password`)
   - `privateKeyPath`, `passphraseEnvVar`, `passwordEnvVar`
   - `knownHostFingerprint`
   - `test` (`true`/`false`) -> `testConnection`
   - `use` (`true`/`false`) -> `useImmediately`
5) Do not call `ssh_new` until you have all required fields and an explicit final confirmation from the user.
6) Once you have all the data, show a short summary and ask for confirmation with `confirm`.
7) After `confirm`, call `ssh_new` exactly once with the parsed data.
8) If any required field is missing, ask only for that field and show a short example.
9) When asking for `passwordEnvVar`, ALWAYS include this security notice (adapting the variable name to the alias when applicable):

   - "This plugin expects the name of an environment variable (`passwordEnvVar`), not the actual value."
   - "Do not share the password in plain text in the chat."
   - Examples for setting it:
     - PowerShell (current session): `$env:SSH_BOOMMANIA_PASS="your_password"`
     - CMD (current session): `set SSH_BOOMMANIA_PASS=your_password`
     - Bash/Zsh: `export SSH_BOOMMANIA_PASS='your_password'`
   - "If you use OpenCode in GUI mode, you must fully restart the app for the new environment variable to take effect."
   - "Then respond with just the variable name, for example: `SSH_BOOMMANIA_PASS`."

Usage examples:
- `/ssh-new alias=prod-api host=10.0.0.20 user=ubuntu auth=key privateKeyPath=~/.ssh/id_rsa`
- `/ssh-new alias=staging-web host=10.0.1.15 user=deploy auth=password passwordEnvVar=SSH_STAGING_PASS test=true use=true`
