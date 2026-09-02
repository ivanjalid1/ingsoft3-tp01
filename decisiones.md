# Decisiones

## TP2 — Contenedores

### App elegida y justificación

La app containerizada es el **ERP mínimo** de `tp2/app/`: clientes, productos y
ventas. Backend **Node.js 20 + Express**, con SQL a mano vía `mysql2` (sin ORM)
y `bcryptjs` para el hashing de contraseñas; frontend **React 18 + Vite**,
servido por nginx; base de datos **MySQL 8** (InnoDB, utf8mb4). Es la app del
semestre — se usa de punta a punta desde TP2 hasta TP9, no un sample de
práctica.

> Nota: el repo también tiene un proyecto **.NET 8 + React** en
> `tp2/backend`/`tp2/frontend`. Ese es el sample de práctica de la cátedra
> (así lo dice su propio `tp2/README.md`) y queda en el repo tal cual, sin
> tocar — esta sección describe únicamente el ERP de `tp2/app/`.

Cumple los criterios de la guía:

- **Buildea y corre local**: `docker compose up -d --build` levanta los tres
  contenedores y la app responde en `http://localhost:8080` (documentado en
  `tp2/app/README.md`, con usuario semilla `admin@erp.local` /
  `Admin123!`). También corre sin Docker, contra un MySQL local en
  `localhost:3306`.
- **Tiene tests**: **71 casos en total** — 56 en backend (`vitest` +
  `supertest`, la capa `models/` mockeada con `vi.mock` así que no necesitan
  MySQL levantado) y 15 en frontend (`vitest` + React Testing Library +
  `jsdom`). El TP5 exige un subconjunto de 12 (8 backend + 4 frontend); el
  resto es cobertura adicional que fue apareciendo por el ciclo TDD del plan
  de implementación.
- **Se entiende el código**: capas separadas y con responsabilidad única —
  `config/` (validación de entorno y pool de conexión), `models/` (SQL
  parametrizado, sin ver `req`/`res`), `services/` (reglas de negocio y
  transacciones), `controllers/` (HTTP, sin SQL), `routes/` y `middlewares/`
  (`auth.js`, `errorHandler.js`).
- **Tamaño razonable**: imágenes ya construidas y medidas — backend **~212
  MB** (lleva Node + `node_modules` de producción), frontend **~93 MB** (casi
  enteramente la base `nginx:alpine`, el `dist/` de Vite pesa unos pocos MB
  encima). Ambos números están documentados en el README y fueron corregidos
  una vez contra la medición real (ver "Problemas encontrados").

### Decisiones de contenerización

- **Imágenes base**:
  - Backend — **una sola etapa**, `node:20-alpine`: no hay paso de build/
    bundling (es JS plano sin compilar), así que no aplica separar build de
    runtime; la imagen final instala solo dependencias de producción
    (`npm ci --omit=dev`) y copia `src/`.
  - Frontend — **multi-stage**: build en `node:20-alpine` (`npm ci` respeta
    el lockfile, `npm run build` genera `/app/dist`), runtime en
    `nginx:alpine`, que sirve los estáticos y no lleva Node ni el código
    fuente ni `node_modules`. Es la comparación (212 MB vs 93 MB) que
    sostiene por qué vale la pena el patrón multi-stage acá.
  - Base de datos: `mysql:8` oficial, sin Dockerfile propio — se configura
    por variables de entorno y se siembra con un script montado.
- **Qué persiste y qué no**: el volumen nombrado `db_data` monta
  `/var/lib/mysql`, así que los datos sobreviven a `docker compose down` (se
  pierden con `down -v`, que es justamente lo que hay que correr para que
  `init.sql` se vuelva a ejecutar si cambia el seed). `./backend/db/init.sql`
  se monta como bind mount de solo lectura en
  `/docker-entrypoint-initdb.d/init.sql` — es el script de esquema+semilla,
  no un dato que persista por sí mismo. Backend y frontend no tienen volumen
  propio: son stateless.
- **Comunicación frontend-backend**: por **ruta relativa + proxy inverso**,
  no por URL absoluta ni CORS. El README lo dice explícito: *"El frontend no
  usa ninguna variable de entorno: llama siempre a rutas relativas
  `/api/...`"*. En contenedor, `nginx.conf` lo resuelve con
  `location /api { proxy_pass http://backend:3000; ... }` (más los headers
  `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`); en desarrollo
  sin Docker lo resuelve el proxy de Vite. Al ser same-origin para el
  browser, no hace falta CORS — a diferencia del sample .NET de la cátedra,
  el backend de este ERP no tiene CORS habilitado, porque nunca lo necesita.
- **Usuario no-root (backend)**: `node:20-alpine` ya trae el usuario `node`
  (uid 1000), así que el Dockerfile no crea ninguno — hace `mkdir -p /app &&
  chown node:node /app`, después `USER node` **antes** del `npm ci`, para que
  ni siquiera `node_modules` quede escrito por root. Verificado con
  `docker compose exec backend whoami` → `node` (documentado en el README,
  tabla de verificación end-to-end). El frontend se deja corriendo como root
  **a propósito**, decisión documentada en el commit `50db7e8`: nginx
  necesita privilegios para bindear el puerto 80, y reconfigurar eso
  (cambiar puerto, `nginx.conf`, rutas escribibles y el mapeo del compose)
  era desproporcionado para lo que aporta acá — con la salvedad real de que
  nginx baja de privilegios sus *workers*, mientras que antes del fix del
  backend el proceso de Node corría como root de punta a punta.
- **Imagen publicada en un registry**: publicadas en `ghcr.io`, mismo
  procedimiento que el sample .NET (§3.7 de la guía): `docker build` de cada
  Dockerfile, `docker tag` a `ghcr.io/ivanjalid1/erp-backend:v0.1.0` y
  `ghcr.io/ivanjalid1/erp-frontend:v0.1.0`, login con
  `gh auth token | docker login ghcr.io -u ivanjalid1 --password-stdin`,
  `docker push` de las dos, y visibilidad cambiada a **pública** a mano desde
  *Package settings* en GitHub (el endpoint de la API para cambiar
  visibilidad no está disponible con el token de `gh auth token`, hay que
  hacerlo desde la web — igual que documenta la guía). Verificado bajando sin
  sesión (`docker logout` + `docker pull` de cero: éxito).
  `tp2/app/docker-compose.registry.yml` es la variante que consume esas
  imágenes (`image:` en vez de `build:`) — probada de punta a punta:
  `docker compose down --rmi local` + `docker rmi` de los dos nombres +
  `docker builder prune -af` para vaciar los tres lugares donde Docker
  esconde capas, y recién ahí `docker compose -f docker-compose.registry.yml
  up -d` bajó las imágenes de `ghcr.io` (no construyó nada local): `db`
  healthy, backend escuchando, frontend respondiendo `200` en
  `localhost:8080`.
  **Pendiente de verificar**: arquitectura de la imagen (no se usó
  `docker buildx`/`--platform`, se construyó local sin más — mismo caso que
  el sample .NET).

### Problemas encontrados y cómo se resolvieron

A diferencia del sample .NET, el ERP tiene historial de commits incrementales
con los problemas reales documentados en los propios mensajes:

- **`bcrypt` nativo era un problema de imagen, no solo de seguridad**
  (`9874a8b fix(backend): reemplazar bcrypt nativo por bcryptjs`): `bcrypt`
  arrastra `@mapbox/node-pre-gyp` → `tar`, con CVEs crítico/alto en
  producción, y además obliga a compilar en `node:20-alpine` (hay que meter
  `build-base`, `python3`, `make` en la imagen), justo lo contrario de la
  imagen liviana que se buscaba. Se reemplazó por `bcryptjs`, que expone la
  misma API (`hash`/`compare`) y el mismo formato de hash interoperable
  (`$2a$`/`$2b$`) con el mismo cost factor (10) — sin compilación nativa.
  `npm audit --omit=dev` pasó de tener vulnerabilidades en producción a 0.
  (El README avisa de este cambio explícitamente para quien regenere el hash
  del seed a mano.)

- **El backend corría como root** (`50db7e8`): se corrigió con el patrón
  `chown` + `USER node` antes del `npm ci` descripto arriba.

- **El healthcheck de `db` podía dar "healthy" antes de que MySQL estuviera
  realmente listo** (`50db7e8`): usaba `mysqladmin ping -h localhost`, que
  resuelve por socket Unix. Durante la inicialización, la imagen `mysql:8`
  levanta un servidor **temporal** con `--skip-networking` para correr los
  scripts de `/docker-entrypoint-initdb.d/`, y ese servidor temporal
  respondía el ping por socket — compose podía marcar `db` como `healthy`
  **antes** de que el puerto 3306 real estuviera escuchando, y el backend
  arrancaba contra una base que todavía no existía. Se corrigió forzando TCP
  con `-h 127.0.0.1`, que solo responde cuando el servidor definitivo (no el
  temporal) está escuchando — la condición que `depends_on: service_healthy`
  necesita en serio. De paso se ajustaron los tiempos (`interval: 5s`,
  `start_period: 60s` porque el primer arranque también corre `init.sql`,
  `retries: 12`) y se le agregó `restart: unless-stopped` a `db`, que era el
  único de los tres servicios sin esa política pese a ser el que los otros
  dos dependen. En la corrida real documentada, la base tardó ~36s en dar
  `healthy` y el backend arrancó recién después, sin reintentos.

- **Un test de entorno daba falso positivo por el `.env` local**
  (`298db4c test: independiza env.test del .env local...`): `env.test.js`
  corría el proceso hijo sin fijarle `cwd`, así que heredaba el de vitest
  (`backend/`). Como `config/env.js` arranca con `import 'dotenv/config'` y
  dotenv resuelve `.env` relativo a `process.cwd()`, un `backend/.env`
  presente (que el propio README pide crear dos secciones antes) le reponía
  al proceso hijo la variable que el test borraba a propósito, y el proceso
  salía con código 0 en vez de 1 — el test decía "funciona" sin probar nada.
  Se corrigió corriendo el proceso hijo en un directorio temporal vacío
  recién creado. Verificado a mano en las dos situaciones (con y sin
  `backend/.env`): 56/56.

- **Un número de tamaño de imagen quedó desactualizado en la
  documentación** (`5959dff docs: corrige las contradicciones entre README,
  decisiones y evidencias`): una decisión de diseño previa a implementar
  estimaba la imagen del frontend en "~25 MB"; la medición real dio 93 MB.
  Se corrigió el número contra el dato real (no se borró el error, se dejó
  una nota que declara la corrección) — es el mismo número que se usa arriba
  para justificar el multi-stage. El mismo commit también corrigió que
  `JWT_SECRET`/`rootpass`/`erp_pass` son valores de desarrollo escritos a
  mano en el compose (no "secretos inyectados del entorno"), y documentó la
  decisión de dejar el frontend corriendo como root.

No hubo problemas al publicar en `ghcr.io` ni al probar `docker-compose.registry.yml`
(ver la sección de arriba) — el único punto abierto ahí es la arquitectura de la
imagen, no confirmada por no usar `buildx`. Tampoco hay evidencia de fallas de
build sin resolver — los `.dockerignore` de `backend/` y `frontend/` ya excluyen
`node_modules`, `.env`, `.git`, `coverage` (y `dist` en el frontend), así que
no hay evidencia tampoco de que artefactos de build o secretos se hayan
colado en el contexto de build por error.

### Declaración de uso de IA

[COMPLETAR: describir qué partes fueron asistidas por IA y cómo se
verificaron]
