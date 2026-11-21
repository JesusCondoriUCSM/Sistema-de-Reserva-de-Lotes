$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'Hay cambios preparados previamente. Revisalos antes de ejecutar este script.' }
$milestones = @(
    @{ Message = 'feat(backend): incorporar esquema y rutinas PostgreSQL'; Files = @('.gitignore', 'backend/schema.sql', 'backend/routines.sql') },
    @{ Message = 'feat(backend): implementar API transaccional y conexion a base existente'; Files = @('backend/bootstrap.php', 'backend/router.php', 'backend/README.md', 'scripts/serve.mjs', 'Iniciar-sistema.cmd') },
    @{ Message = 'feat(frontend): conectar modulos y formularios con API PHP'; Files = @('frontend') },
    @{ Message = 'feat(docker): preparar Apache PostgreSQL y datos ficticios'; Files = @('.dockerignore', '.gitattributes', 'compose.yaml', 'deploy', 'backend/seed-demo.sql', 'Iniciar-Docker.cmd', 'scripts/docker.ps1', 'scripts/docker-init.sh', 'scripts/generate-demo-sql.mjs') },
    @{ Message = 'test: verificar API concurrencia Docker y recorridos en Chrome'; Files = @('tests', 'package.json', 'scripts/test-browser.mjs') },
    @{ Message = 'ci: construir Docker y verificar persistencia'; Files = @('.github/workflows/docker.yml') },
    @{ Message = 'docs: documentar conexion y arranque del sistema'; Files = @('README.md', 'docs', 'scripts/registrar-avances.ps1') }
)
foreach ($milestone in $milestones) {
    git add -- @($milestone.Files)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar los archivos. Comprueba los permisos del repositorio.' }
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        git commit -m $milestone.Message
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el commit. Revisa el mensaje de Git.' }
    } elseif ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar el estado de Git.' }
}
git log -5 --oneline
