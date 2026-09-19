[CmdletBinding()]
param([string]$EnvFile = '.env.production')
$ErrorActionPreference = 'Stop'
$required = @('POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','JWT_SIGNING_KEY','BREVO_SMTP_HOST','BREVO_SMTP_PORT','BREVO_SMTP_USERNAME','BREVO_SMTP_PASSWORD','BREVO_FROM_EMAIL','ADMIN_BOOTSTRAP_EMAIL','ADMIN_BOOTSTRAP_PASSWORD','UPLOADS_ROOT','CLAMAV_HOST','CLAMAV_PORT','LETSENCRYPT_EMAIL','PORTAL_DOMAIN','PORTAL_DOMAINS','TLS_PRIMARY_DOMAIN','ALLOWED_HOSTS','CORS_ALLOWED_ORIGINS_0','APP_PUBLIC_URL','GOOGLE_FORM_WEBHOOK_SECRET')
if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Missing $EnvFile. Run deploy/setup-production.ps1 first." }
$values = @{}
Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object { $key,$value = $_ -split '=',2; $values[$key]=$value }
foreach ($key in $required) { if (-not $values[$key] -or $values[$key] -like 'CHANGE_ME*') { throw "Production value $key is missing or still a placeholder." } }
if ($values['JWT_SIGNING_KEY'].Length -lt 64) { throw 'JWT_SIGNING_KEY must contain at least 64 characters.' }
if ($values['ADMIN_BOOTSTRAP_PASSWORD'].Length -lt 16) { throw 'ADMIN_BOOTSTRAP_PASSWORD must contain at least 16 characters.' }
$ports = @('BREVO_SMTP_PORT','CLAMAV_PORT')
foreach ($key in $ports) { $parsed = 0; if (-not [int]::TryParse($values[$key], [ref]$parsed) -or $parsed -lt 1 -or $parsed -gt 65535) { throw "$key must be a valid TCP port." } }
$publicUri = [Uri]$values['APP_PUBLIC_URL']
if ($publicUri.Scheme -ne 'https' -or $publicUri.Host -ne $values['PORTAL_DOMAIN']) { throw 'APP_PUBLIC_URL must use HTTPS and the same host as PORTAL_DOMAIN.' }
if ($values['TLS_PRIMARY_DOMAIN'] -ne $values['PORTAL_DOMAIN']) { throw 'TLS_PRIMARY_DOMAIN must equal PORTAL_DOMAIN.' }
if ($values['ALLOWED_HOSTS'] -notmatch [regex]::Escape($values['PORTAL_DOMAIN'])) { throw 'ALLOWED_HOSTS must include PORTAL_DOMAIN.' }
foreach ($prefix in @('GOOGLE_CALENDAR','MS_CALENDAR')) {
    $hasCredentials = [bool]$values["${prefix}_CLIENT_ID"] -or [bool]$values["${prefix}_CLIENT_SECRET"]
    if ($hasCredentials -and (-not $values["${prefix}_CLIENT_ID"] -or -not $values["${prefix}_CLIENT_SECRET"])) { throw "$prefix must have both client id and client secret set together." }
}
if ($values['MOODLE_SSO_MODE'] -and $values['MOODLE_SSO_MODE'] -notin @('ExternalLink','SignedLaunch','OIDC','SAML')) { throw 'MOODLE_SSO_MODE must be ExternalLink, SignedLaunch, OIDC or SAML.' }
if ($values['MOODLE_SSO_MODE'] -in @('OIDC','SAML') -and -not $values['MOODLE_SSO_ENTRY_URL']) { throw 'MOODLE_SSO_ENTRY_URL is required for Moodle OIDC/SAML.' }
$env:ENV_FILE = $EnvFile
docker compose -f docker-compose.production.yml --env-file $EnvFile config --quiet
Write-Host 'Production configuration is structurally valid.'
