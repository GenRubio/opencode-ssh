---
description: Registrar nuevo servidor SSH (wizard)
---
Configura un servidor usando la herramienta `ssh_new` en modo asistido paso a paso.

Argumentos de entrada: `$ARGUMENTS`

Reglas:
1) Si no hay argumentos, inicia wizard y pregunta solo por el primer campo faltante (`alias`). No llames herramientas todavia.
2) Si hay argumentos, parsealos como pares `key=value` separados por espacios.
3) Mantiene y completa el wizard en este orden, preguntando de a un dato por mensaje:
   - `alias`
   - `host`
   - `port` (default `22`)
   - `user`
   - `auth` (`key` o `password`)
   - si `auth=key`: `privateKeyPath` (obligatorio) y `passphraseEnvVar` (opcional)
   - si `auth=password`: `passwordEnvVar` (obligatorio)
   - `knownHostFingerprint` (opcional)
   - `test` (`true`/`false`, default `true`)
   - `use` (`true`/`false`, default `true`)
4) Mapea las claves:
   - `alias`, `host`, `port`, `user`
   - `auth` (`key` o `password`)
   - `privateKeyPath`, `passphraseEnvVar`, `passwordEnvVar`
   - `knownHostFingerprint`
   - `test` (`true`/`false`) -> `testConnection`
   - `use` (`true`/`false`) -> `useImmediately`
5) No llames `ssh_new` hasta tener todos los datos obligatorios y una confirmacion final explicita del usuario.
6) Al tener todos los datos, muestra un resumen corto y pide confirmacion con `confirmo`.
7) Tras `confirmo`, llama `ssh_new` exactamente una vez con los datos parseados.
8) Si falta algun campo obligatorio, pide solo ese campo y muestra un ejemplo corto.
9) Cuando pidas `passwordEnvVar`, incluye SIEMPRE este aviso de seguridad (adaptando el nombre de variable al alias cuando aplique):

   - "Este plugin espera el nombre de una variable de entorno (`passwordEnvVar`), no el valor directo."
   - "No compartas la password en texto plano en el chat."
   - Ejemplos para definirla:
     - PowerShell (sesion actual): `$env:SSH_BOOMMANIA_PASS=\"tu_password\"`
     - CMD (sesion actual): `set SSH_BOOMMANIA_PASS=tu_password`
     - Bash/Zsh: `export SSH_BOOMMANIA_PASS='tu_password'`
   - "Si usas OpenCode en GUI, debes reiniciar completamente la app para que tome la nueva variable de entorno."
   - "Luego responde solo con el nombre de la variable, por ejemplo: `SSH_BOOMMANIA_PASS`."

Ejemplos de uso:
- `/ssh-new alias=prod-api host=10.0.0.20 user=ubuntu auth=key privateKeyPath=~/.ssh/id_rsa`
- `/ssh-new alias=staging-web host=10.0.1.15 user=deploy auth=password passwordEnvVar=SSH_STAGING_PASS test=true use=true`
