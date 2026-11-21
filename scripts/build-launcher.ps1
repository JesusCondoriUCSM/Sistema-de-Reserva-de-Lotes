$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw 'No se encontro el compilador de .NET Framework.' }
$outputDirectory = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$output = Join-Path $outputDirectory 'VillaHorizonte.exe'
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ /codepage:65001 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/out:' + $output) (Join-Path $projectRoot 'launcher/Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el ejecutable.' }
$check = New-Object System.Diagnostics.Process
$check.StartInfo.FileName = $output
$check.StartInfo.Arguments = '--self-test "' + $projectRoot + '"'
$check.StartInfo.UseShellExecute = $false
$check.StartInfo.CreateNoWindow = $true
$check.Start() | Out-Null
$check.WaitForExit()
if ($check.ExitCode -ne 0) { throw 'El ejecutable no encontro los archivos necesarios.' }
$check.Dispose()
Write-Host ('Ejecutable generado: ' + $output)
