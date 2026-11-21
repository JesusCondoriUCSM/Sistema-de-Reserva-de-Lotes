# Villa Horizonte

Sistema de gestión de proyectos, lotes, clientes, asesores, separaciones y reportes.
Interfaz en JavaScript, API PHP y base de datos PostgreSQL.

## Iniciar

Requiere Docker Desktop con contenedores Linux. Ejecutar `Iniciar-sistema.cmd`
o, desde PowerShell en la carpeta del proyecto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/docker.ps1 -Action start
```

Abrir http://127.0.0.1:8080. En Linux o macOS:

```sh
sh scripts/docker-init.sh
```

La conexión se configura automáticamente. No hace falta instalar PHP ni
PostgreSQL en el equipo. El primer inicio requiere conexión a internet.

## Ejecutable para Windows

El paquete ejecutable incluye `VillaHorizonte.exe` y los archivos del sistema.
Extraer el ZIP completo, abrir Docker Desktop y ejecutar el archivo .exe. El
lanzador inicia los servicios y abre el navegador cuando estan disponibles.
Requiere Docker Desktop y .NET Framework 4.5 o superior; no es un instalador
independiente de Docker. Las instalaciones nuevas comienzan con la base vacia.

Para compilar el lanzador desde el codigo fuente en Windows:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-launcher.ps1
```

El resultado queda en `dist/VillaHorizonte.exe`. Debe distribuirse junto con
`compose.yaml`, `frontend/`, `backend/`, `deploy/` y los scripts de arranque.

## Datos

Las instalaciones nuevas comienzan vacías. Registrar primero ciudades y
distritos, después proyectos, clientes, asesores y lotes.

Los datos se conservan en el volumen `villa-horizonte_postgres_data` al detener
o actualizar los contenedores. Las credenciales y los archivos de prueba de
cada equipo quedan en `.docker/`, excluido de Git. La configuración opcional
`.docker/compose.local.yaml` se aplica solo si existe en ese equipo.

## Actualizar la interfaz

Desde la carpeta del proyecto:

```sh
docker compose up -d --build --no-deps web
```

Después recargar el navegador. Este comando conserva la base de datos.

## Detener y respaldar

```powershell
powershell -File scripts/docker.ps1 -Action stop
powershell -File scripts/docker.ps1 -Action status
powershell -File scripts/docker.ps1 -Action backup
```

Los respaldos se guardan en `.docker/backups/`. Conservar también una copia
segura de `.docker/secrets/`. No ejecutar `docker compose down -v` si se quieren
mantener los datos.

## Separaciones

Cada separación registra una nota por S/ 100. El plazo vence al inicio del
octavo día calendario desde la emisión, según la hora de Lima. Liberar un lote
conserva su nota; concretar la operación cambia el lote a Vendido y no registra
el pago total del terreno.

## Pruebas

Con Node.js 22 o superior:

```sh
npm test
npm run test:docker
```

Las pruebas de navegador e integración local requieren además Chrome, PHP y
PostgreSQL. GitHub Actions construye Docker y comprueba API, interfaz y persistencia.

La configuración incluida publica el sistema solo en el equipo local. Un
servidor compartido requiere configurar autenticación, acceso y HTTPS.
