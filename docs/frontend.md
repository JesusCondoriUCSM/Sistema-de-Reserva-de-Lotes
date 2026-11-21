# Interfaz e integracion

Ocho modulos: inicio, proyectos, lotes, clientes, asesores, separaciones,
reportes y catalogos. HTML, CSS y modulos JavaScript nativos, sin frameworks.

## Flujo de datos

services/repository.js utiliza fetch para leer GET /api/state y enviar
POST /api/command. Cada cambio espera la respuesta posterior al COMMIT antes
de cerrar el formulario o mostrar exito. Los errores se muestran en el modal,
conservando sus campos. No se utiliza localStorage para los datos del sistema.

La API valida otra vez los parametros, permite un conjunto cerrado de
operaciones y ejecuta procedimientos SQL con parametros PDO. PostgreSQL aplica
restricciones, dependencias, precio calculado, fechas y transiciones de estado.
La nota y la separacion del lote forman una transaccion. El bloqueo de la fila
del lote impide registrar dos separaciones simultaneas.

Las pantallas cargan un snapshot consistente de las ocho tablas al navegar.
Los reportes se calculan en JavaScript sobre ese snapshot de PostgreSQL.
No existe una tabla Reserva adicional ni se registra el pago total del terreno.

## Organizacion

| Ruta | Responsabilidad |
| --- | --- |
| frontend/js/app.js | Navegacion y carga de datos |
| frontend/js/views/ | Pantallas y eventos |
| frontend/js/components/ | Formularios, tablas y modales |
| frontend/js/services/repository.js | Adaptador HTTP asincrono |
| frontend/js/services/domain.js | Plazos y disponibilidad |
| frontend/js/services/reports.js | Diez reportes |
| frontend/js/services/demo-repository.js | Adaptador usado solo por pruebas de dominio |
| backend/router.php | Servidor local, API y errores JSON |
| backend/bootstrap.php | Conexion PDO y lecturas consistentes |
| backend/schema.sql | Ocho tablas y restricciones |
| backend/routines.sql | Procedimientos y triggers |

## Reglas

Una separacion registra S/ 100 y cambia el lote a Separado. Fecha comercial en
America/Lima; vencimiento al inicio de fecha_emision + 8 dias. Solo se libera
una separacion vencida y solo se concreta una vigente. La nota se conserva y
solo permite corregir descripcion y forma de pago. Precio de venta = area por
precio por metro cuadrado. ID de lote hasta 999, area hasta 9999.99, precio por
metro cuadrado hasta 999.99 y precio de venta hasta 999999.99.

Se utiliza la base existente proyecto_villa_horizonte. Los antiguos datos
ficticios de demostracion del navegador no se importan. La conexion se guarda
desde conexion.html tras comprobar las tablas y rutinas existentes. La implementacion es local, sin autenticacion multiusuario.
Ver README.md para arranque, primer uso, datos y pruebas.
