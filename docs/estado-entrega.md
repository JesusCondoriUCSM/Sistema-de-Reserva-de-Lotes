# Estado de la entrega Docker

## Cambios preparados

- Apache/PHP y PostgreSQL independientes de XAMPP y pgAdmin.
- Conexion automatica mediante red Docker y secreto montado.
- Rol villa_app sin privilegios de administrador.
- Volumen persistente y controles de disponibilidad.
- Esquema, datos ficticios, triggers y procedimientos instalados en una transaccion.
- Arranque en Windows y Linux/macOS, y copia pg_dump desde PowerShell.
- Correccion de la pagina vacia al enviar la conexion sin JavaScript.
- Workflow para construir y probar los contenedores en GitHub Actions.

## Verificacion realizada en esta sesion

| Comprobacion | Resultado |
| --- | --- |
| npm test | 11 pruebas aprobadas |
| npm run test:browser | Integracion API, concurrencia y Chrome aprobados |
| npm run test:docker-sql | Datos iniciales y permisos aprobados en PostgreSQL temporal |
| BROWSER_TEST=1 npm run test:docker-sql | Conexion automatica y recorrido Chrome aprobados |
| docker compose config --quiet | Configuracion valida |
| Sintaxis de PHP, JavaScript y PowerShell | Correcta |
| Construir y arrancar imagenes Docker aqui | Bloqueado: acceso denegado al motor Docker Desktop |
| Publicar codigo en GitHub | Bloqueado por revision automatica: requiere autorizacion expresa para este codigo en repositorio publico |

Las pruebas SQL y de navegador anteriores utilizaron PostgreSQL temporal y PHP
locales. Verifican el esquema, los datos, las reglas, los permisos y el adaptador
por entorno; no equivalen a haber construido ni ejecutado las imagenes Docker.
El workflow esta preparado, pero no se ha subido ni ejecutado en GitHub.
No se ha escrito en la base de pgAdmin ni se han publicado credenciales.

## Arranque en el equipo del usuario

Abrir Docker Desktop y ejecutar Iniciar-Docker.cmd. El script genera secretos,
construye los servicios, espera su disponibilidad y comprueba la conexion.
Despues abrir http://127.0.0.1:8080. Los datos ficticios se cargaran al crear
el volumen por primera vez; no estan cargados todavia en un contenedor de esta
sesion porque el motor no fue accesible.

## Publicacion pendiente

El repositorio de destino es publico:
https://github.com/JesusCondoriUCSM/Sistema-de-Reserva-de-Lotes

La publicacion propuesta incluye frontend, backend PHP y SQL, configuracion
Docker, scripts de arranque, datos ficticios, pruebas y documentacion.
Excluye .git, .runtime, .docker, credenciales, copias de base, archivos temporales
y el PDF de origen. Requiere aprobar expresamente esta publicacion publica.
