# Instalacion Docker de pruebas

## Componentes

| Servicio | Funcion | Persistencia |
| --- | --- | --- |
| web | Apache y PHP 8.3 con pdo_pgsql | Codigo incluido en la imagen |
| db | PostgreSQL 17 | Volumen villa-horizonte_postgres_data |

PostgreSQL se comunica solo con la red de Compose. El navegador accede a la
API de Apache; no recibe credenciales de PostgreSQL. La aplicacion resuelve
el host db mediante la red de Docker y lee una clave montada como secreto.

El primer arranque instala esquema, datos ficticios, rutinas y permisos en una
sola transaccion. Los registros historicos se cargan antes de activar triggers.
Luego web espera a que la base este inicializada y disponible. No se utilizan
las rutas C:/xampp o D:/PostgreSQL dentro de las imagenes.

Las imagenes fijan las familias PHP 8.3 y PostgreSQL 17 con Debian Bookworm.
Las actualizaciones menores se incorporan al reconstruir. No cambiar la version
mayor de PostgreSQL reutilizando el mismo volumen sin realizar una migracion.
Cambios futuros del esquema requieren migraciones: los scripts de inicializacion
no se vuelven a ejecutar sobre un volumen existente.

## Inicio y verificacion

En Windows: Iniciar-Docker.cmd. En Linux/macOS: sh scripts/docker-init.sh.
Abrir http://127.0.0.1:8080. No abrir conexion.html del servidor de desarrollo
5173 para probar Docker: son instalaciones diferentes. En Docker, conexion.html
regresa al inicio porque la conexion ya se administra automaticamente.

```sh
docker compose ps
docker compose exec web apache2ctl -t
docker compose logs --tail=80
```

El chequeo de db comprueba tablas, no solo que el puerto este abierto. El de
web consulta /api/health. /api/config no permite reemplazar la conexion Docker.
No se montan archivos personales ni una base de pgAdmin.

## Copias y recuperacion

El script PowerShell con -Action backup usa pg_dump -Fc. El formato binario
se copia directamente desde el contenedor, evitando redirecciones de PowerShell
que puedan alterar el archivo. Guardar el dump y los secretos fuera del equipo.

Para verificar un respaldo sin tocar la base en uso, restaurarlo en una base
NUEVA con otro nombre. El siguiente createdb falla si ya existe el destino;
no elimina ni vacia una base existente. Reemplazar respaldo.dump por la ruta
de tu copia:

```sh
docker compose cp respaldo.dump db:/tmp/restaurar.dump
docker compose exec db createdb -U villa_admin villa_validacion_respaldo
docker compose exec db pg_restore -U villa_admin -d villa_validacion_respaldo --no-owner --no-privileges --single-transaction /tmp/restaurar.dump
docker compose exec db psql -U villa_admin -d villa_validacion_respaldo -c "SELECT count(*) FROM public.nota_venta;"
```

Esta restauracion no cambia la base que usa web. Comprobar conteos, notas,
estados y secuencias en el destino antes de decidir un cambio de base. Para
usar una base restaurada hay que conceder permisos a villa_app y ajustar
DB_NAME en la configuracion del despliegue. No se sobrescribe automaticamente
la base de uso ni se ofrece un boton que elimine datos para restaurar.

## Limites de esta entrega

Es una instalacion local de pruebas, con datos ficticios y sin autenticacion.
Para varios usuarios con datos compartidos se debe desplegar UN servidor central,
agregar usuarios y permisos, HTTPS y respaldos programados. Instalar Docker en
cada laptop crea bases independientes, no sincroniza las ventas entre equipos.

El workflow Docker y PostgreSQL de GitHub construye la instalacion desde cero,
prueba operaciones con el rol limitado y reinicia contenedores para verificar
que los datos permanecen. Los datos de CI desaparecen al finalizar el runner.
