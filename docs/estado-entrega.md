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
| Publicar codigo en GitHub | Autorizado expresamente por el usuario y publicado en main mediante la integracion GitHub |

Las pruebas SQL y de navegador anteriores utilizaron PostgreSQL temporal y PHP
locales. Verifican el esquema, los datos, las reglas, los permisos y el adaptador
por entorno; no equivalen a haber construido ni ejecutado las imagenes Docker.
El workflow se publico en GitHub. No se pudo comprobar su resultado desde
esta sesion: el conector disponible solo enumera ejecuciones asociadas a PR
y las lecturas alternativas de Actions no estuvieron disponibles. No se afirma
que la construccion Docker ni las pruebas de CI hayan pasado.
No se ha escrito en la base de pgAdmin ni se han publicado credenciales.

## Arranque en el equipo del usuario

Abrir Docker Desktop y ejecutar Iniciar-Docker.cmd. El script genera secretos,
construye los servicios, espera su disponibilidad y comprueba la conexion.
Despues abrir http://127.0.0.1:8080. Los datos ficticios se cargaran al crear
el volumen por primera vez; no estan cargados todavia en un contenedor de esta
sesion porque el motor no fue accesible.

## Publicacion realizada

El repositorio de destino es publico:
https://github.com/JesusCondoriUCSM/Sistema-de-Reserva-de-Lotes

La publicacion autorizada incluye frontend, backend PHP y SQL, configuracion
Docker, scripts de arranque, datos ficticios, pruebas y documentacion.
Excluye .git, .runtime, .docker, credenciales, copias de base, archivos temporales
y el PDF de origen. La autorizacion publica fue confirmada por el usuario.

Se publicaron commits separados para backend, interfaz, Docker, pruebas y
documentacion. Los metadatos .git locales siguen sin escritura en esta sesion;
por eso el historial remoto y el que muestra git log local no estan sincronizados.
El codigo de la carpeta de trabajo contiene los cambios publicados.

