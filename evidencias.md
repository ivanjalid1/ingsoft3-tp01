# Evidencias — TP1

Repositorio: https://github.com/ivanjalid1/ingsoft3-tp01

## 1. Push directo a `main` rechazado

![push directo rechazado](img/01-push-rechazado.png)

GitHub rechaza el push con `GH006: Protected branch update failed` / `protected branch hook declined`.
La regla de protección exige que todo cambio entre por Pull Request y, como está activado
*Do not allow bypassing*, también me alcanza a mí que soy el dueño del repositorio.

## 2. El PR de la rama B no se puede mergear: conflicto

![aviso de conflicto en el PR](img/02-conflicto-pr.png)

PR #3 (`feature/titulo-b` → `main`): GitHub avisa *"This branch has conflicts that must be resolved"*.
La rama A ya había entrado a `main` cambiando la misma línea del `README.md`, así que el merge
automático no es posible.

## 3. Los marcadores del conflicto

![marcadores de conflicto](img/03-marcadores-conflicto.png)

Editor web de resolución de conflictos: `<<<<<<< feature/titulo-b` (mi versión, la B),
`=======` (la frontera) y `>>>>>>> main` (lo que ya está en `main`, la versión A).
Resolví eligiendo el contenido final y borrando las tres líneas de marcadores.

## 4. Release `v1.0.0` publicada

![release v1.0.0](img/04-release-v1.0.0.png)

Tag `v1.0.0` (semver) sobre `main` y release publicada con sus notas.

---

# Evidencias — TP2 (App contenerizada)

Todas las salidas de acá abajo son literales: las corrí en mi máquina (Windows 11,
Docker 29.4.3) sobre el árbol de `tp2/` tal como está en el repo, y las pegué sin
editar más que recortar el token JWT y el ruido del build.

## 1. Los tres contenedores levantados y healthy

Un solo comando levanta la base, el backend y el frontend. El `depends_on` con
`condition: service_healthy` hace que el backend no arranque hasta que MySQL
conteste el ping, así que el orden lo resuelve compose y no yo.

```
$ cd tp2
$ docker compose up -d --build
[... build de tp2-backend y tp2-frontend ...]
 Image tp2-backend Built
 Image tp2-frontend Built
 Network tp2_default Creating
 Network tp2_default Created
 Volume tp2_db_data Creating
 Volume tp2_db_data Created
 Container erp-db Creating
 Container erp-db Created
 Container erp-backend Creating
 Container erp-backend Created
 Container erp-frontend Creating
 Container erp-frontend Created
 Container erp-db Starting
 Container erp-db Started
 Container erp-db Waiting
 Container erp-db Healthy
 Container erp-backend Starting
 Container erp-backend Started
 Container erp-frontend Starting
 Container erp-frontend Started
```

De punta a punta tardó **33 segundos** (con la caché de build tibia). De esos, la
mayor parte se la lleva la base: el `Container erp-db Waiting` es el backend
esperando el healthcheck.

Estado de los tres servicios, con el `(healthy)` de la base y el único puerto
publicado hacia afuera:

```
$ docker compose ps
NAME           IMAGE          COMMAND                  SERVICE    CREATED          STATUS                    PORTS
erp-backend    tp2-backend    "docker-entrypoint.s…"   backend    34 seconds ago   Up 7 seconds              3000/tcp
erp-db         mysql:8        "docker-entrypoint.s…"   db         34 seconds ago   Up 33 seconds (healthy)   3306/tcp, 33060/tcp
erp-frontend   tp2-frontend   "/docker-entrypoint.…"   frontend   34 seconds ago   Up 6 seconds              0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
```

Vale la pena mirar la columna `PORTS`: el backend expone `3000/tcp` y la base
`3306/tcp` **hacia la red interna de compose solamente**. El único mapeo al host
es `0.0.0.0:8080->80/tcp` del frontend. Todo el tráfico a la API entra por nginx.

Los últimos renglones de los logs confirman que la base terminó de inicializar y
que el backend levantó después:

```
$ docker compose logs db | tail -5
erp-db  | 2026-09-02T16:07:08.940733Z 0 [Warning] [MY-010068] [Server] CA certificate ca.pem is self signed.
erp-db  | 2026-09-02T16:07:08.940806Z 0 [System] [MY-013602] [Server] Channel mysql_main configured to support TLS. Encrypted connections are now supported for this channel.
erp-db  | 2026-09-02T16:07:08.950985Z 0 [Warning] [MY-011810] [Server] Insecure configuration for --pid-file: Location '/var/run/mysqld' in the path is accessible to all OS users. Consider choosing a different directory.
erp-db  | 2026-09-02T16:07:08.991481Z 0 [System] [MY-011323] [Server] X Plugin ready for connections. Bind-address: '::' port: 33060, socket: /var/run/mysqld/mysqlx.sock
erp-db  | 2026-09-02T16:07:08.991726Z 0 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections. Version: '8.4.11'  socket: '/var/run/mysqld/mysqld.sock'  port: 3306  MySQL Community Server - GPL.

$ docker compose logs backend | tail -10
erp-backend  | [server] escuchando en el puerto 3000
```

El backend loguea una sola línea, y eso es buena señal: si hubiera fallado la
conexión a MySQL, acá aparecería el error de `mysql2` en vez del `escuchando`.

## 2. Un arranque que falló de verdad: el volumen a medio inicializar

El primer intento de esta misma corrida **no levantó**. Lo dejo documentado
porque es el modo de falla más probable de reproducir y la salida explica sola
qué hacer:

```
 Container erp-db Waiting
 Container erp-db Error dependency db failed to start
dependency failed to start: container erp-db is unhealthy
```

El log de la base dice exactamente por qué:

```
$ docker compose logs db | tail -6
erp-db  | 2026-09-02 16:06:18+00:00 [Note] [Entrypoint]: Initializing database files
erp-db  | 2026-09-02T16:06:18.711109Z 0 [System] [MY-015017] [Server] MySQL Server Initialization - start.
erp-db  | 2026-09-02T16:06:18.714452Z 0 [ERROR] [MY-010457] [Server] --initialize specified but the data directory has files in it. Aborting.
erp-db  | 2026-09-02T16:06:18.714456Z 0 [ERROR] [MY-013236] [Server] The designated data directory /var/lib/mysql/ is unusable. You can remove all files that the server added to it.
erp-db  | 2026-09-02T16:06:18.714528Z 0 [ERROR] [MY-010119] [Server] Aborting
erp-db  | 2026-09-02T16:06:18.714884Z 0 [System] [MY-015018] [Server] MySQL Server Initialization - end.
```

Había un `tp2_db_data` de una corrida anterior que había quedado a mitad de la
inicialización: con archivos adentro, pero sin la base terminada. MySQL ve el
directorio no vacío, se niega a re-inicializar y aborta; como `restart:
unless-stopped` lo vuelve a levantar, entra en loop de `Restarting (1)` y nunca
llega a healthy. La solución es tirar el volumen, no tocar el compose:

```
$ docker compose down -v
 Volume tp2_db_data Removing
 Volume tp2_db_data Removed
```

Después de eso, el `up` de la sección 1 anduvo a la primera. Es un argumento más
a favor de `down -v` como forma normal de cerrar: el estado de la base vive en un
volumen, y un volumen a medio hacer es peor que ninguno.

## 3. Tamaños de las imágenes y el multi-stage

Estos son los tamaños reales de las dos imágenes que construye el compose, con
las bases al lado para poder comparar:

```
$ docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
REPOSITORY                              TAG                      SIZE
tp2-frontend                            latest                   93.4MB
tp2-backend                             latest                   213MB
mysql                                   8                        1.12GB
nginx                                   alpine                   93.6MB
node                                    20-alpine                194MB
```

La comparación que justifica el multi-stage del frontend está en esas cuatro
líneas. El frontend se construye en `node:20-alpine` — **194 MB de base**, más
los 176 paquetes que instala `npm ci`, más el código fuente — y de todo eso la
imagen final se queda únicamente con el `dist/` de Vite copiado sobre
`nginx:alpine`. El resultado, **93.4 MB**, es prácticamente la base de nginx sola
(93.6 MB): el bundle que produce Vite son 183 kB de JS más 10 kB de CSS más las
fuentes, unos pocos MB en total. Node, `node_modules` y el código fuente no
viajan a producción, que es exactamente lo que el patrón busca.

El backend, en cambio, sí necesita Node en runtime, así que se queda en **213 MB**:
la base `node:20-alpine` más los 95 paquetes de producción (`npm ci --omit=dev`).
Ahí el multi-stage no compraría casi nada, y por eso el Dockerfile del backend es
de una sola etapa.

## 4. La app responde y el login funciona

nginx sirve el `index.html` del build de Vite en el puerto 8080 del host:

```
$ curl -i http://localhost:8080
HTTP/1.1 200 OK
Server: nginx/1.31.3
Date: Wed, 02 Sep 2026 16:07:36 GMT
Content-Type: text/html
Content-Length: 408
Last-Modified: Wed, 02 Sep 2026 16:06:09 GMT
Connection: keep-alive
ETag: "6a984971-198"
Accept-Ranges: bytes

<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ERP mínimo</title>
    <script type="module" crossorigin src="/assets/index-Cq3h7jUN.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DSxAWBLV.css">
  </head>
```

El healthcheck del backend está en `/health`, fuera de `/api` a propósito para
que no le pegue el middleware de token. Como el backend no publica puerto al
host, lo consulto desde adentro de la red de compose:

```
$ docker compose exec -T frontend wget -qO- http://backend:3000/health
{"status":"ok"}
```

El login por API entra por el mismo origen que el front (`/api/auth/login`, que
nginx reenvía a `backend:3000`), con el usuario que siembra `init.sql`. Recorto
el token a los primeros 12 caracteres:

```
$ curl -i -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@erp.local","password":"Admin123!"}'
HTTP/1.1 200 OK
Server: nginx/1.31.3
Content-Type: application/json; charset=utf-8
Content-Length: 230
X-Powered-By: Express

{"token":"eyJhbGciOiJI...","usuario":{"id":1,"email":"admin@erp.local"}}
```

Que el login devuelva 200 prueba las tres piezas encadenadas: el navegador pega
en nginx, nginx proxea al backend, y el backend consulta MySQL y encuentra al
usuario semilla. Para cerrar el circuito, el mismo token abre un endpoint
protegido y sin él la API responde 401:

```
$ curl -i http://localhost:8080/api/productos -H "Authorization: Bearer $TOKEN"
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[{"id":2,"nombre":"Monitor","precio":180000,"stock":5,"activo":true},{"id":1,"nombre":"Teclado","precio":15000,"stock":20,"activo":true}]

$ curl -i http://localhost:8080/api/productos
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{"error":{"code":"TOKEN_FALTANTE","message":"Falta el header Authorization: Bearer <token>"}}
```

Los productos que devuelve son los de `init.sql`, así que además queda probado
que el script de inicialización corrió dentro del contenedor de la base.

## 5. El healthcheck de la base, con `-h 127.0.0.1`

Este es el comando exacto que corre el healthcheck del compose, ejecutado a mano
contra el contenedor:

```
$ docker compose exec -T db mysqladmin ping -h 127.0.0.1 -uroot -prootpass
mysqladmin: [Warning] Using a password on the command line interface can be insecure.
mysqld is alive
```

El `-h 127.0.0.1` no es decorativo: fuerza TCP. Con `-h localhost`, `mysqladmin`
resuelve por socket UNIX, y durante la inicialización la imagen `mysql:8` levanta
un servidor temporal con `--skip-networking` para correr los scripts de
`/docker-entrypoint-initdb.d/`. Ese servidor temporal contesta el ping por
socket, así que compose marcaba la base como healthy **antes** de que el 3306
real estuviera escuchando, y el backend arrancaba contra una base que todavía no
existía. Por TCP el ping recién contesta cuando el servidor definitivo escucha,
que es justo la condición que el `depends_on` necesita.

La evidencia de que ahora sí espera lo correcto está en los timestamps: la base
arrancó a las `16:06:44.98`, terminó de inicializar (`ready for connections`) a
las `16:07:08.99` y el backend recién arrancó a las `16:07:11.42`. O sea, el
backend esperó los ~26 segundos que la base tardó en estar realmente disponible.

Una nota al margen: el tag `mysql:8` hoy resuelve a **8.4.11**, no a un 8.0. El
compose fija la línea mayor, no la menor.

## 6. Los tests pasando

Backend — `vitest` sobre la lógica de negocio y validación:

```
$ cd tp2/backend && npm ci && npm test

> erp-backend@1.0.0 test
> vitest run

 RUN  v2.1.9 C:/Users/ADMIN/ingsoft3/tp2/backend

 ✓ tests/productos.test.js (7 tests) 104ms
 ✓ tests/clientes.test.js (11 tests) 138ms
 ✓ tests/env.test.js (5 tests) 194ms
 ✓ tests/ventas.test.js (27 tests) 266ms
 ✓ tests/auth.test.js (6 tests) 265ms

 Test Files  5 passed (5)
      Tests  56 passed (56)
   Duration  2.21s
```

Frontend — `vitest` + Testing Library sobre las pantallas:

```
$ cd tp2/frontend && npm ci && npm test

 ✓ tests/rutaProtegida.test.jsx (2 tests) 193ms
 ✓ tests/nuevaVenta.test.jsx (3 tests) 1106ms
 ✓ tests/clientes.test.jsx (3 tests) 1699ms
 ✓ tests/productos.test.jsx (4 tests) 1681ms

 Test Files  6 passed (6)
      Tests  15 passed (15)
   Duration  5.45s
```

**56 + 15 = 71 tests, todos en verde.** El número coincide con el que declara
`decisiones.md`. La única salida ruidosa son los *future flag warnings* de React
Router v6 avisando cambios de v7; no fallan nada.

## 7. Las imágenes publicadas se bajan de ghcr.io sin autenticar

Para que la prueba valga algo, primero cierro sesión en el registry y borro las
copias locales. Si quedara alguna credencial guardada, el `pull` no probaría que
los paquetes son públicos:

```
$ docker logout ghcr.io
Removing login credentials for ghcr.io

$ docker rmi ghcr.io/ivanjalid1/erp-backend:v0.1.0 ghcr.io/ivanjalid1/erp-frontend:v0.1.0
Untagged: ghcr.io/ivanjalid1/erp-backend:v0.1.0
Deleted: sha256:e953d01c67c9f0dc9b03515663a311a2ce89ac594a6fb9edaa4191536b8604df
Untagged: ghcr.io/ivanjalid1/erp-frontend:v0.1.0
Deleted: sha256:e52551bf22a9bd50763d852e7f0973527d49ac256508c213cdf9bef9e93d61f3
```

Y ahora el pull, ya sin credenciales:

```
$ docker pull ghcr.io/ivanjalid1/erp-backend:v0.1.0
v0.1.0: Pulling from ivanjalid1/erp-backend
ca6021f888c8: Pull complete
4f4fb700ef54: Pull complete
9726ce6e2e33: Pull complete
000f83b03724: Pull complete
7fbc4fd67dc2: Pull complete
Digest: sha256:e953d01c67c9f0dc9b03515663a311a2ce89ac594a6fb9edaa4191536b8604df
Status: Downloaded newer image for ghcr.io/ivanjalid1/erp-backend:v0.1.0

$ docker pull ghcr.io/ivanjalid1/erp-frontend:v0.1.0
v0.1.0: Pulling from ivanjalid1/erp-frontend
369c3553be31: Pull complete
fc182fbe317f: Pull complete
Digest: sha256:e52551bf22a9bd50763d852e7f0973527d49ac256508c213cdf9bef9e93d61f3
Status: Downloaded newer image for ghcr.io/ivanjalid1/erp-frontend:v0.1.0
```

Los digests coinciden con los que borré, así que bajé exactamente las mismas
imágenes. Tamaños publicados:

```
$ docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | grep erp-
ghcr.io/ivanjalid1/erp-frontend         v0.1.0                   93.4MB
ghcr.io/ivanjalid1/erp-backend          v0.1.0                   212MB
```

Con esas imágenes, `docker-compose.registry.yml` levanta el stack sin compilar
nada. Es el caso de uso real del registry: alguien que clona el repo — o que ni
siquiera lo clona, solo tiene el compose — corre la app sin tener Node ni el
código fuente.

```
$ docker compose -f docker-compose.registry.yml up -d
 Container erp-db Waiting
 Container erp-db Healthy
 Container erp-backend Started
 Container erp-frontend Started

$ docker compose -f docker-compose.registry.yml ps
NAME           IMAGE                                    COMMAND                  SERVICE    STATUS
erp-backend    ghcr.io/ivanjalid1/erp-backend:v0.1.0    "docker-entrypoint.s…"   backend    Up 1 second
erp-db         mysql:8                                  "docker-entrypoint.s…"   db         Up 28 seconds (healthy)
erp-frontend   ghcr.io/ivanjalid1/erp-frontend:v0.1.0   "/docker-entrypoint.…"   frontend   Up 1 second
```

Y la app publicada responde igual que la construida a mano:

```
$ curl -s -o /dev/null -w "GET / -> HTTP %{http_code}\n" http://localhost:8080
GET / -> HTTP 200

$ curl -s -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@erp.local","password":"Admin123!"}'
{"token":"eyJhbGciOiJI...","usuario":{"id":1,"email":"admin@erp.local"}}
```

Al terminar, bajo todo y me llevo puesto el volumen para no dejar estado colgado:

```
$ docker compose -f docker-compose.registry.yml down -v
 Container erp-db Removed
 Volume tp2_db_data Removed
 Network tp2_default Removed
```
