# Villa Horizonte � Reserva de lotes

Aplicativo academico de gestion interna. Frontend en HTML, CSS y JavaScript
nativo, sin frameworks ni dependencias de ejecucion externas.

## Ejecutar

Requiere Node.js 22 o superior. No es necesario ejecutar npm install.

```sh
npm run dev
```

Abrir http://127.0.0.1:5173. Tambien se puede ejecutar `node scripts/serve.mjs`.
No abrir index.html directamente con file:// porque utiliza modulos ES.

## Organizacion

- frontend/: interfaz, estilos, componentes y adaptador de datos.
- backend/: espacio reservado para la futura API PHP/PostgreSQL.
- scripts/: servidor estatico de desarrollo, solo publica frontend/.
- tests/: comprobaciones con el runner nativo de Node.js.
- docs/: decisiones de interfaz e integracion.

Los documentos de origen, temporales y SQL locales preexistentes no se publican.
La rama main conserva commits por avances funcionales. No se incluyen secretos.
