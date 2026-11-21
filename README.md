# Villa Horizonte — sistema de reserva de lotes

Aplicacion con ocho modulos, API PHP y PostgreSQL. El modo recomendado para
probarla y trasladarla a otro equipo es Docker: incluye Apache/PHP, PostgreSQL,
las ocho tablas, procedimientos, triggers y datos ficticios autorizados.

## Iniciar con Docker en Windows

1. Instalar y abrir Docker Desktop con contenedores Linux.
2. Ejecutar `Iniciar-Docker.cmd` en la carpeta del proyecto.
3. Abrir http://127.0.0.1:8080.

Tambien se puede iniciar desde PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/docker.ps1 -Action start
```

No necesitas instalar Node, PHP, XAMPP ni PostgreSQL en el equipo de destino.
El primer arranque requiere internet para descargar las imagenes y compilar PHP.
En Linux o macOS, con Docker y Compose disponibles:

```sh
sh scripts/docker-init.sh
```

La conexion es automatica. No tienes que introducir la contrasena de pgAdmin.
La base Docker es independiente de las bases que tengas instaladas en Windows.
Se crean claves aleatorias en .docker/secrets; no se incluyen en Git ni en la
imagen. La aplicacion usa villa_app, un rol sin permisos de administrador.

## Datos de prueba

La primera inicializacion carga 3 proyectos, 8 lotes, 4 clientes, 4 asesores,
4 telefonos y 4 notas ficticias. Los lotes incluyen estados Disponible,
Separado y Vendido, con una separacion vigente y otra vencida.

Recorrido: Lotes > Separar > buscar DNI 00000001 > elegir asesor y forma de
pago > confirmar. La siguiente nota sugerida comienza en NV01-000129.
En Separaciones se puede liberar el lote vencido de Villa del Sol y concretar
el lote vigente de Los Girasoles. Estas fechas se fijan al crear la base; no
se rejuvenecen cada vez que reinicias el sistema.

Los datos de prueba se cargan UNA sola vez al crear el volumen. Iniciar o
actualizar contenedores no duplica datos ni borra tus cambios. backend/seed-demo.sql
es exclusivamente para instalaciones de prueba nuevas, antes de instalar triggers.
Nunca se ejecuta sobre tu base de pgAdmin.

## Detener, revisar y respaldar

```powershell
powershell -File scripts/docker.ps1 -Action stop
powershell -File scripts/docker.ps1 -Action status
powershell -File scripts/docker.ps1 -Action backup
```

El respaldo de datos queda en .docker/backups/*.dump. Guarda tambien una copia
segura de .docker/secrets por separado. Para restaurar una copia en una base
nueva preparada con el mismo esquema, consultar docs/docker.md.

`docker compose stop` y `docker compose down` conservan el volumen. No ejecutar
`docker compose down -v` si quieres conservar los datos. El volumen de datos
no reemplaza una copia de seguridad. Cambiar una contrasena en el archivo no
cambia automaticamente la contrasena del rol que ya existe en PostgreSQL.

La web se publica solo en 127.0.0.1:8080. La base no publica ningun puerto al
host. Si 8080 esta ocupado, definir VILLA_HTTP_PORT antes de iniciar.
Esta entrega sirve para pruebas locales reproducibles. No incluye autenticacion
de usuarios; no se debe abrir a internet ni a la red de trabajo sin esa etapa.

## Desarrollo sin Docker

```sh
npm run dev
```

Requiere Node 22+, PHP 8.2+ con PDO PostgreSQL y PostgreSQL. Este modo conserva
la conexion manual a proyecto_villa_horizonte en http://127.0.0.1:5173/conexion.html.
No modifica esa base ni carga datos ficticios. La configuracion local permanece
en .runtime/, fuera de la carpeta publica y de Git.

## Pruebas

```sh
npm test
npm run test:integration
npm run test:browser
npm run test:docker-sql
npm run test:docker
```

Las primeras cuatro usan datos ficticios en memoria o bases temporales aisladas.
La ultima verifica la instalacion Docker en 8080, sin modificar sus datos.
Las pruebas de integracion locales requieren los ejecutables PHP y PostgreSQL;
la prueba de navegador usa Chrome. CI construye las imagenes, prueba operaciones
contra los contenedores y reinicia los servicios para comprobar persistencia.

## Estructura

- frontend/: interfaz nativa, formularios, adaptador HTTP y diez reportes.
- backend/: API, esquema, procedimientos, triggers y datos de prueba.
- deploy/docker/: imagenes, Apache, inicializacion y permisos de PostgreSQL.
- compose.yaml: contenedores, red privada, volumen y comprobaciones de salud.
- scripts/: arranque, respaldos y herramientas de desarrollo.
- tests/: reglas, integracion, navegador y API Docker.
- docs/: instrucciones de uso e integracion.

El plazo comercial vence al inicio de fecha_emision + 8 dias en America/Lima.
La separacion registra S/ 100. Liberar conserva la nota; concretar cambia el
lote a Vendido sin registrar el pago total del terreno.
