# API PHP / PostgreSQL

El servidor local publica exclusivamente frontend/ y las rutas /api/.
Las credenciales y datos se encuentran en .runtime/, fuera de la raiz publica.

- GET /api/health: disponibilidad de PostgreSQL.
- GET /api/state: snapshot consistente de las ocho tablas.
- POST /api/config: prueba y guarda la conexion a una base existente sin
  modificar sus tablas ni datos. La contrasena no se devuelve al navegador.
- POST /api/command: JSON {"operation":"...","args":[...]}; devuelve result y data
  despues de confirmar la transaccion.

Operaciones: save, remove, savePhone, removePhone, reserve, changeReservation,
updateNote. El adaptador frontend/js/services/repository.js define las firmas.
Los parametros se enlazan mediante PDO, y los nombres de procedimientos y
tablas provienen de listas cerradas en el servidor.

Errores JSON: 409 para duplicados o conflictos concurrentes, 422 para datos o
reglas rechazadas y 503 cuando no se puede completar el servicio. El cliente
conserva el formulario y no confirma una operacion rechazada.

En Docker, la conexion se administra por DB_HOST, DB_PORT, DB_NAME, DB_USER
y DB_PASSWORD_FILE, con un rol de base sin permisos administrativos.
/api/config informa managed=true y rechaza cambios de conexion.

El arranque de desarrollo conecta a proyecto_villa_horizonte sin instalar SQL.
Docker instala esquema, datos ficticios y rutinas en el primer volumen nuevo.
En desarrollo, schema.sql y routines.sql se instalan solamente al usar
APP_MANAGED_DATABASE=1 en una instancia aislada para pruebas. Los cambios futuros
de esquema requieren migraciones explicitas; el arranque no reinstala tablas.

Servidor PHP incorporado para uso local. No incluye autenticacion ni roles;
no debe publicarse en red con esta configuracion.
