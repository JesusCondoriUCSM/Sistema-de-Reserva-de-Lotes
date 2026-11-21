param([ValidateSet('start','stop','status','backup','check')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
function Invoke-Docker {
    param([string[]]$DockerArgs)
    & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Docker no pudo completar la operacion. Revisa el mensaje anterior.' }
}
Invoke-Docker -DockerArgs @('info','--format','Motor Docker disponible: {{.ServerVersion}}')
if ($Action -in @('start','check')) {
    $secretDir = Join-Path $projectRoot '.docker/secrets'
    $secretNames = @('db_admin_password','db_app_password')
    $missing = @($secretNames | Where-Object { -not (Test-Path -LiteralPath (Join-Path $secretDir ($_ + '.txt'))) })
    if ($missing.Count) {
        $volumes = @(& docker volume ls --format '{{.Name}}')
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron comprobar los volumenes de Docker.' }
        if ($volumes -contains 'villa-horizonte_postgres_data') { throw 'Existe una base Docker, pero faltan sus credenciales. Recupera .docker/secrets de tu respaldo antes de iniciar.' }
        New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
        foreach ($name in $missing) {
            $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
            $bytes = New-Object byte[] 32
            $random.GetBytes($bytes)
            $random.Dispose()
            [System.IO.File]::WriteAllText((Join-Path $secretDir ($name + '.txt')), [Convert]::ToBase64String($bytes), (New-Object System.Text.UTF8Encoding($false)))
        }
    }
    Invoke-Docker -DockerArgs @('compose','config','--quiet')
    if ($Action -eq 'check') { Write-Host 'Configuracion Docker valida.'; exit 0 }
    Invoke-Docker -DockerArgs @('compose','up','--build','--wait','--wait-timeout','240')
    $port = if ($env:VILLA_HTTP_PORT) { $env:VILLA_HTTP_PORT } else { '8080' }
    $url = 'http://127.0.0.1:' + $port
    $health = Invoke-RestMethod ($url + '/api/health')
    if (-not $health.ok -or -not $health.managed) { throw 'La aplicacion no confirmo la conexion administrada.' }
    Write-Host ('Sistema disponible en ' + $url)
    Write-Host 'Base Docker independiente, con datos ficticios cargados en el primer inicio.'
} elseif ($Action -eq 'stop') {
    Invoke-Docker -DockerArgs @('compose','stop')
} elseif ($Action -eq 'status') {
    Invoke-Docker -DockerArgs @('compose','ps')
} elseif ($Action -eq 'backup') {
    $backupDir = Join-Path $projectRoot '.docker/backups'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $filename = 'villa-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
    Invoke-Docker -DockerArgs @('compose','exec','-T','db','pg_dump','-U','villa_admin','-d','proyecto_villa_horizonte','-Fc','-f',('/tmp/' + $filename))
    Invoke-Docker -DockerArgs @('compose','cp',('db:/tmp/' + $filename),(Join-Path $backupDir $filename))
    Write-Host ('Respaldo guardado en .docker/backups/' + $filename)
}
