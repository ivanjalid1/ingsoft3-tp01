# Decisiones — TP1

## 1. Por qué Git no pudo resolver el conflicto solo

Las ramas `feature/titulo-a` y `feature/titulo-b` salieron las dos del mismo commit de `main` y
modificaron **la misma línea** del `README.md` (el título). Cuando mergeé A, `main` avanzó; al
intentar mergear B, Git comparó las dos puntas contra el ancestro común y encontró dos cambios
distintos sobre la misma línea.

Git fusiona solo cuando los cambios tocan partes distintas del archivo. Acá no hay forma de saber
cuál versión es "la correcta": es una decisión de **contenido**, no técnica. Por eso Git no elige
y me delega la decisión marcando el archivo con `<<<<<<<`, `=======` y `>>>>>>>`.

**Qué habría tenido que pasar para que no apareciera:** que las ramas no tocaran la misma línea, o
que B se hubiera actualizado con `main` (`git pull`/merge de `main`) **antes** de que A entrara —
es decir, integrar seguido y con ramas cortas. El conflicto es la consecuencia de trabajar en
paralelo sobre lo mismo; lo evitable no es el conflicto, es que sea grande.

## 2. Problemas que encontré y cómo los solucioné

- **El primer intento de push directo falló por el motivo equivocado.** Copié la línea de la guía
  con el comentario incluido (`git push          # ← esto TIENE que fallar`) y, como estoy en
  Windows con `cmd`, el `#` no se interpreta como comentario: Git lo tomó como refspecs y devolvió
  `src refspec ← does not match any`. Eso **no** era la protección de rama. Lo corregí ejecutando
  solo `git push`, y ahí sí apareció el rechazo real (`GH006: Protected branch update failed`), que
  es la captura que quedó como evidencia.

- **Deshacer el commit de prueba.** El commit `test: intento de push directo` quedó en mi `main`
  local y no servía para nada. Lo saqué con `git reset --hard HEAD~1`.

- **El merge de GitHub no aparecía en mi máquina.** Después de mergear el PR #1 desde la web, mi
  `main` local seguía sin el cambio: `git switch main` me avisó *"Your branch is behind
  'origin/main' by 1 commit"*. El merge ocurre en el remoto, no en mi clon. Se arregla con
  `git pull`.

- **Ojo al crear la rama B.** Si la rama B nace de la A no hay conflicto. Tuve que asegurarme de
  partir de `main` para que las dos ramas fueran hermanas y el conflicto se produjera.

- **Resolver el conflicto en la web.** El botón de resolver queda deshabilitado hasta borrar
  **todos** los marcadores. Dejé el archivo como si el conflicto nunca hubiera existido y recién
  ahí pude confirmar.

- **Commiteé la entrega en `main` local y me la volví a chocar.** Agregué el `.gitignore` y estos
  dos archivos parado en `main`, y al hacer `git pull` (mi `main` local y `origin/main` habían
  divergido: yo tenía mi commit, el remoto tenía el merge del PR #3) Git me pidió resolver un
  conflicto en el `README.md`. Además, aunque lo resolviera, ese commit **no lo podía pushear**:
  `main` está protegida. Lo solucioné moviendo el trabajo a una rama y haciendo que entre por PR,
  que es como tenía que haber empezado:

  ```bash
  git merge --abort
  git branch feature/entrega-tp01 <mi-commit>   # el trabajo se va a una rama
  git reset --hard origin/main                  # main local vuelve a ser igual al remoto
  git switch feature/entrega-tp01
  git rebase origin/main                        # mis cambios, arriba de la punta de main
  ```

  La lección concreta: la protección de `main` no solo bloquea el push, **empuja a trabajar en
  ramas**. Cuando me la saltée por costumbre, el problema apareció igual, solo que más tarde.

## 3. Declaración de uso de IA

Usé Claude (Claude Code) para **redactar estos dos archivos** (`decisiones.md` y `evidencias.md`) a
partir de mis capturas y del historial del repositorio, y para revisar la redacción de la
explicación del conflicto.

**Qué NO hice con IA:** la configuración del repositorio, las protecciones de rama, los Pull
Requests, la resolución del conflicto y el tag/release los hice yo a mano siguiendo la guía.

**Cómo lo verifiqué:** contrasté lo que dice cada archivo contra lo que realmente pasó —
las capturas, `git log --oneline --graph --all`, el listado de PRs del repositorio y la
configuración de protección de `main` (`required_approving_review_count: 0`,
`enforce_admins: true`). Todo lo que está escrito acá lo puedo mostrar y explicar en la defensa.

---

# Decisiones — TP2 (App del semestre / ERP contenerizado)

## App elegida y justificación

La app containerizada es el **ERP mínimo** de `tp2/`: clientes, productos y
ventas. Backend **Node.js 20 + Express**, con SQL a mano vía `mysql2` (sin ORM)
y `bcryptjs` para el hashing de contraseñas; frontend **React 18 + Vite**,
servido por nginx; base de datos **MySQL 8** (InnoDB, utf8mb4). Es la app del
semestre — se usa de punta a punta desde TP2 hasta TP9, no un sample de
práctica.

> Nota: el repo tenía además el sample de práctica de la cátedra (**.NET 8 +
> React + PostgreSQL**) conviviendo en `tp2/`. Lo eliminé para que `tp2/`
> contenga únicamente la app del semestre. Las imágenes
> `ghcr.io/ivanjalid1/mi-backend` y `ghcr.io/ivanjalid1/mi-frontend` que siguen
> publicadas en el registry son de ese ejercicio de práctica; las de la entrega
> son `erp-backend` y `erp-frontend`.

Cumple los criterios de la guía:

- **Buildea y corre local**: `docker compose up -d --build` levanta los tres
  contenedores y la app responde en `http://localhost:8080` (documentado en
  `tp2/README.md`, con usuario semilla `admin@erp.local` /
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

## Decisiones de contenerización

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
  `tp2/docker-compose.registry.yml` es la variante que consume esas
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

## Problemas encontrados y cómo se resolvieron

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
  dos dependen. En la corrida real documentada, la base tardó ~26s en dar
  `healthy` y el backend arrancó recién después, sin reintentos. (Este
  documento decía antes "~36s". Era una estimación al ojo y el número se
  corrigió contra la medición real — igual que con el tamaño de la imagen del
  frontend más abajo, no se borró el error sino que se deja declarada la
  corrección. El dato sale de los timestamps de `evidencias.md` §TP2.5: `db`
  arrancó a las 16:06:44.98, dio `ready for connections` a las 16:07:08.99 y
  el backend recién a las 16:07:11.42. Como todos los tiempos de estos
  documentos, es lo que tardó en mi máquina, no una constante.)

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

## Declaración de uso de IA (§6 del reglamento)

**Qué hice con IA.** Solo la creación de la App, la creación de imágenes y puesta 
en público NO.

**Qué encontraron las revisiones.** No fue trámite: encontraron y corrigieron
defectos reales, entre ellos dos bugs de concurrencia que un test que mockea
`models/` no puede detectar porque no ejercita SQL real:

- En la creación de venta, un `producto_id` repetido en la misma venta evadía la
  validación de stock y terminaba commiteando stock negativo.
- En la anulación, el chequeo de "¿ya está anulada?" corría fuera del lock de la
  transacción, y dos anulaciones simultáneas de la misma venta podían reponer el
  stock dos veces.

Los dos se corrigieron moviendo la validación **adentro** del `FOR UPDATE` que ya
protegía la operación relacionada — no fueron features nuevas, fue la misma regla
("lo que se valida se valida bajo el lock") aplicada donde todavía faltaba.

**Qué NO hice con IA.** La elección del dominio, el recorte de alcance, la
decisión final sobre cada hallazgo de revisión (qué se corrige y qué se difiere),
la ejecución y lectura de la verificación end-to-end, y la validación de que cada
afirmación de este repositorio es cierta.

**Cómo lo verifiqué.** No acepté el resultado de la IA por reporte, lo comprobé
contra la ejecución:

- Los 71 tests corren y pasan: `npm test` en `backend/` y en `frontend/` (el
  detalle de cuáles exige el TP5 está en la tabla de `README.md`).
- Los tres contenedores levantan con `docker compose up -d --build` y la app
  responde en `http://localhost:8080`.
- La verificación final fue una corrida end-to-end real contra los tres
  contenedores ya construidos, no contra los mocks de la suite: login, alta de
  producto, venta con descuento de stock (20→18), anulación con reposición de
  stock (18→20), y una segunda anulación de la misma venta devolviendo
  `409 VENTA_YA_ANULADA` con el body visible.
- El hash bcrypt del admin sembrado en `init.sql` se generó y se verificó a mano
  con `bcryptjs.compareSync`.

---

# Decisiones — TP3 (Planificación y trazabilidad)

## 1. Duración del sprint

Elegí un sprint de **1 semana**. La cátedra entrega los TPs con cadencia corta
(cada práctico es, en los hechos, una iteración chica de trabajo), así que un
sprint más largo —dos o cuatro semanas, que es lo típico en la industria— no
tendría sentido acá: para cuando terminara el sprint ya habría otro TP encima.
Una semana es lo bastante chico para que el Sprint Goal ("dejar el CI
funcionando end to end") sea alcanzable y medible, y lo bastante grande como
para no convertir cada sprint en una sola tarjeta.

## 2. Límite de trabajo en progreso (WIP)

Lo dejé en **2**, siguiendo la regla de arranque del enunciado: cantidad de
personas + 1. Trabajando solo, eso da 2. La "válvula" del +1 es para cuando una
tarjeta queda esperando algo externo (un PR en revisión, una respuesta) y
necesito poder avanzar en otra cosa sin quedar bloqueado, pero sin abrir tantos
frentes que pierda el foco. Señal de que está mal calibrado: si nunca lo toco
(siempre tengo 0 o 1 en progreso) está demasiado alto y no cumple ninguna
función; si lo piso todo el tiempo sin poder avanzar en nada, está demasiado
bajo.

## 3. Diagnóstico de la historia mal escrita

La historia del ejercicio (issue #14) es:

> "Como desarrollador quiero crear la tabla usuarios para guardar los datos."

Está mal escrita por dos motivos, no uno:

- **Es una tarea técnica disfrazada de historia.** El "rol" es "desarrollador",
  no un usuario real de la app — nadie fuera del equipo técnico "quiere" que
  exista una tabla. Eso es exactamente el anti-patrón que describe la guía: una
  historia solo tiene sentido si el rol es alguien que percibe el valor desde
  afuera del código.
- **El beneficio es circular.** "Para guardar los datos" no es un beneficio, es
  una repetición de la capacidad ("crear la tabla" ↔ "guardar datos" son casi lo
  mismo). Un beneficio de verdad explica *para qué* le sirve a ese rol, y acá no
  hay ningún "para qué" adicional.

**Cómo la reescribiría:** subiendo un nivel, a algo que sí sea observable por un
usuario, y bajando "crear la tabla usuarios" a una **tarea** dentro de esa
historia:

> Historia: "Como usuario quiero iniciar sesión con mi usuario y contraseña
> para acceder solo yo a mis datos."
> Tarea técnica de esa historia: "Crear la tabla `usuarios` con el hash de la
> contraseña."

Así la tabla sigue existiendo como trabajo a hacer, pero colgada de una historia
que sí es testeable (se puede loguear o no) y tiene un beneficio real (acceso
protegido), no de una excusa técnica.

## 4. Problemas encontrados y cómo los resolví

- **Comandos de la guía en sintaxis bash, corriendo en `cmd.exe`.** Los
  `gh issue create` de la guía usan comillas simples y continuación de línea con
  `\`, que en `cmd.exe` no significan nada — el prompt quedaba colgado en `>`
  esperando que cerrara un string que nunca se abrió. Lo resolví pasando todo a
  una sola línea con comillas dobles, y para los issues con body largo (varias
  líneas, checklists) usé `--body-file` apuntando a un `.txt` escrito con
  `notepad`, en vez de pelear con el escapado en la terminal.
- **Confundí el ID del proyecto con su número.** `gh project edit` pide el
  `NUMBER` (un entero chico, `1`), no el node ID `PVT_...` que muestra la URL o
  la API — probé pasarle el ID largo entre `< >` (que además `cmd.exe` interpreta
  como redirección de archivo) y tiraba error. Se resolvió corriendo
  `gh project list --owner "@me"` y usando la columna `NUMBER`.
- **Le puse el label `bug` al issue equivocado.** En vez de crear un issue nuevo
  para el bug, edité el issue #14 (el de la historia mal escrita del ejercicio)
  y le agregué el label `bug`, dejándolo con un título que no describe ningún
  bug real. Lo corregí sacándole el label a `#14` (`gh issue edit 14
  --remove-label bug`) y creando el bug de verdad como issue nuevo (`#16`), con
  el título y el cuerpo (qué pasa / qué esperaba / cómo reproducirlo)
  correspondientes.
- **El Pull Request no se sumó solo al Project.** El *auto-add* del Project
  toma los issues del repo, pero no agregó automáticamente el PR que abrí para
  la tarea de CI. Lo agregué a mano con `gh project item-add <numero_proyecto>
  --url <url_del_pr>`.
- **No entendía por qué el Project no vive dentro del repo.** GitHub Projects
  (v2) es una entidad de **cuenta** (`github.com/users/<usuario>/projects/<n>`),
  no del repositorio — un mismo Project puede agrupar issues de varios repos, o
  un mismo repo puede tener issues repartidos en varios Projects. La conexión
  con `ingsoft3-tp01` es por contenido (qué issues/PRs tiene agregados como
  ítems), no por ubicación. Es la diferencia de filosofía frente a Azure Boards,
  donde el tablero sí es parte integral del "Proyecto" de la organización.

## 5. Declaración de uso de IA

**Qué hice con IA.** Para este TP le pedí a Claude (Claude Code) que redactara este
mismo apartado de `decisiones.md`. 

**Qué NO hice con IA.** La configuración del Board, el campo Iteration (Sprint)
y el límite de trabajo en progreso los hice yo a mano en la web de GitHub,
siguiendo las instrucciones — no son automatizables por `gh`. También revisé
antes de mergear que el PR realmente implementara la tarea que decía cerrar
(el workflow de CI), y elegí yo los números de duración de sprint y de WIP
limit (la IA propuso la redacción y la justificación, pero los números y el
razonamiento los entendí y los puedo sostener en la defensa, no son una caja
negra).

**Cómo lo verifiqué.** Después de cada tanda de comandos corrí `gh issue list
--state all` y `gh issue view <n>` para confirmar que los issues quedaron con
el título, el label y el body correctos (así detecté el error del punto
anterior, el label `bug` mal puesto). Confirmé el cierre automático de la tarea
con `gh issue view 12 --json state,closed` después de mergear el PR, y la
visibilidad pública del Project con `gh project view 1 --owner "@me" --format
json --jq '.public'`. Puedo reproducir y explicar cada comando en la defensa:
qué hace, por qué esa forma y no otra, y qué pasa si algo de esto falla (por
ejemplo, qué pasaría si el PR apuntara a una rama que no es `main`, o si me
olvidara el `--label`).

---

# Decisiones — TP4 (CI: Pipelines as Code)

## 1. Estructura del pipeline: por qué esos jobs y por qué en paralelo

El workflow (`.github/workflows/ci.yml`) tiene **dos jobs**, `build-backend` y
`build-frontend`, porque mi app tiene **dos Dockerfiles**: uno por servicio, como
quedó del TP2. No es un número elegido para llegar a una cuota — es lo que la app
tiene. El de la base de datos no se construye: `mysql:8` es una imagen oficial que
se baja de Docker Hub, no algo que yo compile.

Corren **en paralelo** porque no dependen uno del otro. Construir el frontend no
necesita nada de lo que produce el backend, así que serializarlos sólo agregaría
espera. En GitHub Actions el paralelismo es el comportamiento por defecto: los
jobs corren a la vez salvo que se declare `needs:`, y yo no lo declaré
justamente porque no hay dependencia. En la primera corrida del PR #31 los dos
arrancaron **en el mismo segundo** (18:02:05), en máquinas distintas.

Que sean dos jobs y no dos steps del mismo job tiene una consecuencia que se vio
en la demostración del gate: **son independientes también al fallar**. Cuando
rompí el frontend a propósito, `build-frontend` quedó en rojo y `build-backend`
siguió en verde. Si fueran steps del mismo job, el fallo del primero habría
abortado el resto y no habría sabido si el otro construía o no.

Lo que **no** comparten dos jobs es el filesystem: cada uno arranca en una
máquina limpia que GitHub destruye al terminar. Si uno necesitara algo del otro,
tendría que viajar como artefacto o declararse con `needs:`.

Los triggers son dos. `pull_request` sobre `main` es el que hace el trabajo:
corre **antes** del merge, sobre el resultado propuesto, y es el que alimenta el
gate. `push` a `main` corre **después** de cada merge, y sirve para dos cosas
distintas: le da al badge una corrida de la cual leer el estado, y deja el cache
en la rama por defecto para que cualquier PR nuevo lo pueda reutilizar ya en su
primera corrida.

**Adaptación a mi repo:** la guía asume que la app está en la raíz y usa
`context: ./backend`. En mi repo la app vive en `tp2/`, así que los contextos son
`./tp2/backend` y `./tp2/frontend`. Copiar la guía tal cual habría fallado con
`failed to read dockerfile`.

## 2. Qué cachea el pipeline y qué pasa si el cache desaparece

Lo que se cachea son **las capas de la imagen Docker**, no dependencias de npm ni
nada del runner. Se guardan en el cache de GitHub Actions (`type=gha`) con
`cache-to`, y se recuperan con `cache-from`.

Para que eso funcione hizo falta agregar `docker/setup-buildx-action@v4` en los
dos jobs. El constructor que trae Docker de fábrica guarda las capas en el disco
de la máquina y no sabe exportarlas afuera; como esa máquina se destruye al
terminar la corrida, guardarlas ahí no serviría de nada. Si me lo olvidaba, el
build no quedaba callado: fallaba con `Cache export is not supported for the
docker driver`.

Cada job usa su propio `scope` (`scope=backend` y `scope=frontend`). Sin eso los
dos compartirían el mismo estante por defecto y **se pisarían**: el último en
terminar sobreescribe el cache del otro, y el síntoma es desconcertante porque
parece azar — un job muestra `CACHED` y el otro no, y cuál cambia en cada
corrida.

**Qué se reutiliza y qué no.** Lo comprobé en el `docker build` local del
frontend, donde se ve capa por capa:

| Capa | ¿Reutilizada? |
|---|---|
| `WORKDIR /app` | `CACHED` |
| `COPY package*.json ./` | `CACHED` |
| `RUN npm ci` | `CACHED` |
| `COPY . .` | se rehace |
| `RUN npm run build` | se rehace |

Eso es exactamente el orden del Dockerfile del TP2 pagando: copiar primero los
manifiestos y recién después el código hace que un cambio en el código **no**
invalide la capa que instala dependencias, que es la cara. Si el Dockerfile
copiara todo junto al principio, cualquier cambio de una línea de código
obligaría a reinstalar todo.

En la segunda corrida del PR #31 el pipeline reutilizó **5 capas en el backend**
(`#8`–`#12`) y **7 en el frontend** (`#11`–`#17`). Los tiempos bajaron de 36s a
13s y de 40s a 18s. Aclaro esto último porque es fácil defenderlo mal: **la
evidencia de que el cache funciona es la palabra `CACHED` en el log, no el
cronómetro**. Guardar el cache también cuesta —al final de cada corrida se suben
las capas— y en un proyecto chico la segunda corrida puede tardar igual o incluso
más. Que en mi caso haya bajado es una consecuencia agradable, no la prueba.

**Si el cache desaparece, el pipeline funciona igual, sólo que más lento.** El
cache es una optimización, no una entrada: la plataforma lo desaloja cuando
quiere y tiene límite de tamaño, así que no se puede depender de él. Si el
pipeline **fallara** sin cache, eso no sería un problema de cache: sería una
dependencia escondida, o sea un bug. Es fácil de comprobar — cambiando el
`scope` a un valor nuevo, la corrida arranca sin nada guardado y tiene que
terminar en verde igual.

Hay una segunda propiedad del cache que me costó entender: su **alcance**. Una
corrida puede recuperar lo que guardó su propia rama o la rama base, pero no lo
que guardaron otras ramas u otros PRs. Por eso las dos corridas de la evidencia
tuvieron que ser del mismo PR (con un `git commit --allow-empty`), y por eso
además hay que esperar a que la primera **termine**: el cache se sube al final,
así que dos pushes seguidos se solapan y la segunda corrida no encuentra nada.

## 3. Por qué el pipeline construye con mi Dockerfile en vez de compilar por su cuenta

Porque si el workflow compilara por su lado con `npm ci` y `npm run build`,
tendría **dos definiciones de build**: la del pipeline y la del Dockerfile que
después se despliega. Esas dos definiciones divergen tarde o temprano —alguien
cambia una versión de Node en un lado y no en el otro, o agrega un paso de build
en uno solo— y el día que pasa, el pipeline verifica una compilación que **no es
la que corre en producción**. Un verde así no significa nada.

Construyendo con el Dockerfile, lo que el pipeline verifica es exactamente lo
mismo que después se levanta con `docker compose` y se publica en `ghcr.io`.

El efecto lateral es que en el workflow **no hay una sola línea de Node**. El
pipeline no sabe qué hay adentro de la imagen: eso lo sabe el Dockerfile. El
mismo archivo le serviría a un compañero con .NET o Python cambiando sólo los
`context:`.

## 4. Qué verifica realmente cada job (y qué no)

Esto lo entendí recién al romper el build a propósito, y me parece lo más
importante que aprendí en este TP.

Rompí el **frontend** —un `import x from './no-existe'` en `src/main.jsx`— y el
job falló como esperaba, en `RUN npm run build`, con
`Could not resolve "./no-existe" from "src/main.jsx"`. Falla porque el frontend
**se empaqueta**: Vite resuelve los imports durante el build.

El backend no habría fallado con el mismo error. Mi backend es Node + Express: no
compila ni empaqueta, y su Dockerfile sólo hace `npm ci --omit=dev` y copia
`src/` — **nunca ejecuta mi código**. Podría meter un `import estonoexiste` en
cualquier archivo del backend y el `docker build` daría verde igual. Lo que ese
job verifica de verdad es que **las dependencias se instalen** en una máquina
limpia, que no es poco (detecta un `package.json` y un `package-lock.json`
desincronizados, o una dependencia que sólo existe en mi máquina), pero no es lo
mismo que verificar el código.

O sea: hoy mi pipeline verifica **la mitad** de lo que la definición de CI pide.
Construye, pero no prueba. La otra mitad llega en el TP5, cuando los tests entren
como una etapa más del Dockerfile — y ahí sí un error de código en el backend va
a poner el job en rojo.

## 5. El gate: qué exige `main` hoy para aceptar un merge

Dos condiciones, y las dos se vieron actuando:

1. **PR obligatorio** (viene del TP1): nadie pushea directo a `main`, ni yo.
   `enforce_admins: true` hace que la regla me alcance también como dueño del
   repo. Los approvals quedan en **0** a propósito: el trabajo es individual y
   GitHub no deja aprobar el propio PR, así que pedir 1 me dejaría sin poder
   mergear nunca. Lo que bloquea acá no es una aprobación humana.
2. **Pipeline en verde**: `build-backend` y `build-frontend` como
   `required_status_checks`. Los nombres de los checks salen del **id del job**,
   así que renombrar un job rompería el gate — quedaría esperando un check que ya
   no existe.

Además puse `strict: true`, que es *Require branches to be up to date*: no
alcanza con que los checks estén verdes, la rama además tiene que estar
actualizada con `main`. La razón es que un verde viejo se sacó contra un `main`
que ya no existe, y no dice nada sobre cómo queda la mezcla. Lo vi las dos veces:
el PR #33, ya con los dos checks en verde después del fix, **seguía con el merge
bloqueado** hasta que apreté *Update branch* y el pipeline volvió a correr sobre
la combinación.

La configuración se puede verificar sin capturas, que es la ventaja de tenerla
declarada:

```bash
gh api "repos/ivanjalid1/ingsoft3-tp01/branches/main/protection" --jq '.required_status_checks'
```

## 6. Problemas encontrados y cómo los resolví

- **El bloque del gate estaba en sintaxis bash y yo corro `cmd.exe`.** El
  `gh api --method PUT ... --input - <<'EOF'` de la guía usa un *heredoc*, que es
  de bash: `cmd` contestó `No se esperaba << en este momento.` Lo resolví
  escribiendo el JSON en un archivo aparte y pasándolo con
  `--input "%TEMP%\protection.json"`, que funciona igual en las dos shells. Es el
  mismo problema que ya me había pasado en el TP3 con los `gh issue create`.
- **Mi `main` local estaba desactualizado y las ramas salían de un commit
  viejo.** Hice `git checkout main && git pull` antes de que el merge del PR #31
  terminara del todo, así que `main` local quedó en el commit anterior y las dos
  ramas que saqué después nacieron desde ahí. El síntoma fue confuso: abría
  `ci.yml` y veía el archivo viejo de 7 líneas, como si el merge se hubiera
  perdido. No se había perdido nada — `origin/main` tenía el workflow nuevo, y el
  PR sólo tocaba un archivo (`gh pr view 32 --json files` lo confirma: `+1 -0` en
  `tp2/README.md`). Git tampoco iba a revertir el workflow, porque la rama nunca
  modificó ese archivo y en el merge gana la versión de `main`. Efecto colateral:
  los dos PRs quedaron `BEHIND`, que resultó ser justo lo que hacía falta para
  mostrar *Update branch*.
- **Los contextos de la guía no aplican a mi repo.** La guía usa
  `context: ./backend`; mi app está en `tp2/`. Lo detecté antes de la primera
  corrida y ajusté a `./tp2/backend` y `./tp2/frontend`.
- **No había `README.md` en la raíz del repositorio.** El badge tiene que verse
  al entrar al repo, y lo que GitHub muestra al entrar es el README de la raíz —
  el único que tenía era `tp2/README.md`, que documenta la app. Revisando el
  historial vi que en la raíz sí hubo uno, pero era la línea que deja `git init`
  (`"# ingsoft3-tp01"`), y en el commit que reorganizó las carpetas se movió a
  `tp2/`. Escribí uno nuevo en la raíz, corto: badge, índice de los TPs con sus
  tags, y links a los documentos. No moví el de `tp2/`, que cumple otra función.
- **Para ver `CACHED` no alcanza con pushear dos veces seguidas.** La primera vez
  no entendía por qué no aparecía. El cache se sube **al final** de la corrida,
  así que si el segundo push llega antes de que la primera termine, las corridas
  se solapan y la segunda no encuentra nada guardado. Hay que esperar, y recién
  ahí disparar la segunda con `git commit --allow-empty`.

## 7. Declaración de uso de IA

**Qué hice con IA.** Le pedí a Claude (Claude Code) que escribiera el
`.github/workflows/ci.yml`, el `README.md` de la raíz y este apartado de
`decisiones.md`. También le pedí que me armara la lista de comandos a ejecutar,
en orden, y que me tradujera a `cmd.exe` los bloques de la guía que estaban en
sintaxis bash.

**Qué NO hice con IA.** Corrí yo, a mano, todos los comandos de `git`, `gh` y
`docker`: las ramas, los commits, los pushes, los PRs, el `PUT` de la protección
de rama y el `docker build` local. Rompí y arreglé el import del frontend
editando el archivo yo. Saqué las capturas y decidí en qué orden hacer cada paso.
La decisión de romper el **frontend** y no el backend la entendí antes de
hacerla, y es la que explico en el punto 4: elegí el frontend porque es el único
de los dos que empaqueta, y por lo tanto el único donde un import roto detiene el
build.

**Cómo lo verifiqué.** No di por buena ninguna afirmación sin comprobarla contra
el repo:

- Antes de la primera corrida verifiqué que las versiones de las actions que usa
  el workflow existan de verdad (`actions/checkout@v6`,
  `docker/build-push-action@v7`, `docker/setup-buildx-action@v4`), consultando los
  tags de cada repositorio con `gh api`.
- Antes de pushear la rotura a propósito corrí `docker build .\tp2\frontend` en
  mi máquina y confirmé que fallaba, y en qué línea del Dockerfile
  (`Dockerfile:8`, `RUN npm run build`). Así no gasté una corrida para descubrir
  que la rotura no rompía nada.
- El cache lo verifiqué leyendo el log de la segunda corrida y contando las
  capas `CACHED`, no mirando los tiempos.
- El gate lo verifiqué con
  `gh api "repos/{owner}/{repo}/branches/main/protection" --jq '.required_status_checks'`,
  confirmando `strict: true` y los dos contexts, y comprobando que el `PUT` no
  hubiera pisado nada del TP1 (`enforce_admins` siguió en `true`,
  `allow_force_pushes` y `allow_deletions` en `false`). Eso último importa porque
  el `PUT` **reescribe la protección entera**: todo campo omitido vuelve a su
  default.
- Que el PR de relleno no revirtiera el workflow lo verifiqué con
  `gh pr view 32 --json files`, que mostró un solo archivo modificado.

Puedo reproducir y explicar cada línea del workflow en la defensa: qué hace, por
qué está, y qué se rompe si la saco — incluido el `scope` del cache, el
`setup-buildx-action` y por qué los contextos apuntan a `tp2/`.

---

# Nota sobre el historial del repositorio y los tags

La cátedra pide que, si se corrige un TP ya etiquetado, se mueva el tag y se
documente acá el porqué. Es el caso de este repositorio: moví los tres tags, y el
motivo es un error mío. Lo dejo con SHAs y fechas para que se pueda verificar.

## 1. Qué pasó

Ese día estaba reordenando el repositorio en carpetas por TP antes de entregar:
mover `tp1/` y `tp2/app/` a carpetas dedicadas (`821ddff`, 10:51:05), sacar una
copia desactualizada de `decisiones.md` (`d5dabd9`, 11:00:30) y sumar el
proyecto .NET del TP2 (`f75a856`, 11:03:26). Todo eso entró por el PR #18, que
mergeé desde la web a las 14:07:40 UTC (merge commit `dd12e4b`); más tarde el
PR #25 (`b28ba45`) cerró la reorganización sacando el sample de la cátedra y
promoviendo el ERP de `tp2/app/` a `tp2/`.

- **Hice un `git push --force` sobre `main`.** Dieciséis minutos después de
  haber mergeado bien el PR #18 — el 2026-09-02 a las 14:23:57 UTC — la punta
  pasó de `dd12e4b` a `f75a856` sin ser un avance: reescribí la historia en vez
  de extenderla. El merge lo había hecho en la web, así que mi `main` local
  quedó divergido del remoto; en lugar de traerlo con `git pull`, forcé mi
  versión local y me llevé puesto el merge. Es el mismo error que ya está
  documentado en el TP1 (§2), el `main` local atrasado tras mergear en la web,
  solo que esta vez, en vez de que el push me lo rechazara, lo forcé.
- **Después recreé los tres tags sobre el commit final**, porque el force-push
  dejó a los viejos apuntando a puntos de la historia nueva donde la entrega no
  está (lo desarrollo en §3). `v1.0.0`, `v2.0.0` y `v3.0.0` apuntan hoy los tres
  a la punta de `main` al momento de la entrega, y comparten `taggerdate` al
  segundo porque los rehago siempre en la misma tanda. Los moví dos veces: la
  primera enseguida del force-push, y la segunda al sumar esta misma nota,
  porque si no la documentación de los tags quedaba fuera de los tags.

## 2. Qué se perdió y qué no

- **No se perdió trabajo.** El contenido de los tres TPs está completo en la
  punta de `main`.
- **Sí se perdieron los merges originales** de los PR #1 a #18 (`5126806`,
  `2a39898`, `8854d31`, `464124d`, `4f823c5`, `d5483be`, `df61c14`, `b85e8a1`,
  `dd12e4b`): ya no son alcanzables desde `HEAD`. En su lugar hay gemelos con el
  mismo subject y la misma fecha de autor, pero distinto SHA y distinto árbol
  (`464124d` → `2a78d56`, `4f823c5` → `23016ed`). El merge del PR #17
  (`b85e8a1`) ni siquiera tiene gemelo.
- **Se perdió la trazabilidad de este archivo.** En la historia reescrita
  `decisiones.md` aparece recién en `4f0cbe1` (2026-09-02 12:09:58), pero los
  merges originales ya lo traían (`464124d`: 56 líneas, `4f823c5`: 190,
  `b85e8a1`: 200). El archivo sí se fue escribiendo TP a TP; lo que borró esa
  evidencia de los commits previos fue la reescritura, no una omisión al
  entregar.

## 3. Por qué los tres tags están en el mismo commit

Porque el último commit de la entrega —la punta de `main`— es el único punto de
la historia actual que contiene la documentación completa de los tres TPs, esta
nota incluida. Etiquetar tres commits distintos habría sido más prolijo, pero en
la historia nueva ninguno de ellos contiene lo que su tag diría contener.
Preferí que los tags apunten a algo verificable y explicar acá el porqué, antes
que dejar tres etiquetas que no se sostienen.

## 4. Dónde está la historia original

- **Tags de respaldo, publicados también en el remoto**:
  `backup/pr17-decisiones-tp3` → `d5b2828d75fb57e8d5e4eac277f66e4909fac621` y
  `backup/pr18-prev-force-push` → `dd12e4b355c7211e329587dc63bcd5858ef93d67`.
  Son tags ligeros y su único propósito es mantener vivos los objetos que
  quedaron huérfanos, para que no se los lleve el `gc`.
- **Los Pull Requests cerrados en GitHub**: del #1 al #18 conservan intactas sus
  fechas, sus diffs y sus commits, porque GitHub los guarda aparte de la rama.
  Esa es, en los hechos, la línea de tiempo real de las entregas.

## 5. Los releases: `created_at` no es la fecha de publicación

Los tres releases muestran el mismo `created_at` al segundo, que es el
`taggerdate` de los tags: el `created_at` de un release en GitHub refleja la
fecha del objeto tag, así que cada vez que moví los tags se reescribió ese
campo. La fecha real de publicación quedó en `published_at`, que no se tocó:
v1.0.0 el 2026-08-12T18:19:07Z, v2.0.0 el 2026-08-27T19:24:53Z y v3.0.0 el
2026-08-27T20:00:00Z.

## 6. Estado actual de la protección de `main`

`gh api repos/ivanjalid1/ingsoft3-tp01/branches/main/protection` devuelve hoy
`allow_force_pushes: false`, `allow_deletions: false` y `enforce_admins: true`:
la rama no acepta push forzado ni borrado, y la regla me alcanza también a mí
como dueño del repo — que es la parte que importa, porque el force-push lo hice
con permisos de admin. No puedo afirmar cómo estaba esa configuración en el
momento exacto del force-push; lo que está verificado es el estado de hoy.
