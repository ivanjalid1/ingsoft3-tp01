> **Enlaces rápidos:** [Enlaces del TP6](#enlaces-de-este-tp) · [Enlaces del TP7](#enlaces-del-tp7)
> (cada TP tiene su bloque de enlaces al principio de su sección; las secciones están en orden, TP1 → TP7).

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

---

# Decisiones — TP5 (Testing, coverage y quality gate)

**Guía traducida.** La guía de la cátedra está escrita sobre .NET (xUnit,
`coverlet`, `ReportGenerator`). Mi stack es Node.js 20 + Express en el backend
y React + Vite en el frontend, así que todo este apartado usa la columna
"JS/TS" de esa guía: **Vitest** como test runner y motor de coverage (`v8`) en
los dos lados, **Supertest** para los tests HTTP del backend y **React Testing
Library** para los del frontend. El PR de este TP es el #36
(https://github.com/ivanjalid1/ingsoft3-tp01/pull/36), con CI en verde en la
corrida https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/35174806125,
que publica dos artifacts descargables: `coverage-backend` y
`coverage-frontend`.

## 1. Números: de dónde salí y a dónde llegué

| | Backend (antes → después) | Frontend (antes → después) |
|---|---|---|
| Líneas | 73.45% → **97.23%** | 73.66% → **93.4%** |
| Ramas | 90.78% → **95.67%** | 79.83% → **87.95%** |
| Tests | 56 → **111** | 15 → **36** |

Los números "antes" son los que tenía el proyecto viniendo del TP2/TP3, sin que
nadie hubiera tocado coverage todavía. Los de "después" salen de correr yo
mismo `npm run test:coverage` en cada carpeta después de escribir la suite
nueva (la tabla completa del backend está en el punto 5, con la corrida real).

## 2. El umbral: por qué 80% y no otro número

El umbral que dejé configurado en los dos `vitest.config.js`
(`coverage.thresholds: { lines: 80, branches: 80 }`) es **80% en líneas y 80%
en ramas, en los dos lados**. La razón que tenía en la cabeza al arrancar era
la típica: 80% es el estándar razonable para la mayoría de las aplicaciones
comerciales, el punto medio entre seguridad y velocidad de desarrollo. Pero esa
razón sola no alcanza para este TP, porque la consigna pide anclar la
justificación a la medición real del proyecto, no a un número que traigo de
afuera.

Lo que importa acá es el **orden en que pasaron las cosas**: no ajusté el
umbral a lo que ya tenía. Primero escribí la suite nueva (modelos del backend
que estaban en 27-45%, `Ventas.jsx` en el frontend que estaba en 0.86%, los
casos de error de `ventaService`) y **después** miré el número final —97%/95%
en el backend, 93%/88% en el frontend— y recién ahí fijé el gate en 80%.

Eso deja un margen real, no cosmético: hoy el proyecto podría perder entre
**15 y 17 puntos de cobertura** en cualquiera de las dos métricas antes de que
el gate se dispare. Es intencional: 80% no es "lo que ya tengo menos un
colchón chico", es un piso que deja crecer el código sin que un PR chico rompa
el build por una línea sin testear, pero que sigue frenando de verdad una
regresión grande (borrar un archivo de tests entero, por ejemplo, como
demuestro en el punto 6).

## 3. Qué excluí de la medición y qué NO excluí a propósito

- **`tp2/backend/src/server.js`**: excluido (`coverage.exclude` en
  `vitest.config.js`). Es puro bootstrap, `app.listen(...)` y nada más — no
  hay ninguna regla de negocio que testear ahí, y el arranque real ya lo
  cubre `env.test.js` invocando el proceso.
- **`tp2/frontend/src/main.jsx`**: excluido por el mismo motivo. Crea el root
  de React y monta `<App />`; no tiene lógica propia.
- **`tp2/backend/src/config/db.js`** (crea el pool de conexión mysql2):
  **lo evalué y decidí NO excluirlo.** La tentación estaba porque es un
  archivo de infraestructura, como `server.js`. Pero al correr el coverage ya
  tenía **100%** con los tests existentes (se lo ejercita indirectamente vía
  los modelos que lo importan) — no había nada que estuviera "escondiendo" del
  umbral, así que excluirlo no tenía ningún propósito real, sólo habría sido
  copiar un patrón sin necesidad.
- **Ningún modelo del backend** (`src/models/*.js`) se excluyó, a pesar de que
  antes de esta semana estaban entre 27% y 45% de cobertura. Tienen lógica de
  verdad: mapeo de filas SQL a objetos (`aItem` en `ventaModel.js`), queries
  condicionales, el ruteo de conexión en transacciones (`conn ?? pool`) y el
  `FOR UPDATE` del locking pesimista en las ventas. Se decidió testearlos, no
  excluirlos.
- **`tp2/frontend/src/pages/Ventas.jsx`**, mismo criterio: estaba en **0.86%**
  de cobertura, una página entera sin un solo test. Se le escribió una suite
  en vez de sacarla de la medición.

## 4. Las tres técnicas pedidas: parametrizado, caso de error, mock

**Backend:**

- **Parametrizado** — `tp2/backend/tests/productos.test.js`, dentro de
  `describe('POST /api/productos')`:
  `it.each([...])('devuelve 400 DATOS_INVALIDOS con %s y no inserta', ...)`,
  con 5 casos: precio negativo, precio en cero, stock negativo, nombre vacío,
  stock no entero. Antes de este TP este grupo eran tres tests casi idénticos
  escritos a mano; convertirlos a `it.each` los hizo más fáciles de extender
  (agregar el quinto caso fue una línea, no un test nuevo copiado y pegado).
- **Caso de error** — `tp2/backend/tests/ventas.test.js`: `rechaza con 409
  STOCK_INSUFICIENTE y NO descuenta stock de ningún ítem` y `rechaza con 400
  DATOS_INVALIDOS un ítem null`.
- **Mock con verificación de interacción** — `tp2/backend/tests/ventas.test.js`:
  `crea la venta con 201, calcula el total y descuenta el stock exacto`, que
  hace `expect(ventaModel.crearCabecera).toHaveBeenCalledWith(conn, 1, 210000)`
  y `expect(productoModel.descontarStock).toHaveBeenNthCalledWith(...)` — no
  alcanza con que la respuesta HTTP esté bien, el test verifica que el service
  llamó a la capa de datos con los argumentos exactos.

**Frontend:**

- **Parametrizado** — `tp2/frontend/tests/productos.test.jsx`:
  `it.each([...])('no envía el formulario con precio %s: muestra el error y no
  llama a la API', ...)`, con precio negativo, precio cero (el borde exacto de
  la regla) y precio no numérico.
- **Caso de error** — `tp2/frontend/tests/rutaProtegida.test.jsx`: `redirige a
  /login cuando no hay token en localStorage`.
- **Mock con verificación de interacción** — `tp2/frontend/tests/clientes.test.jsx`:
  `con datos válidos sí llama a la API`, que hace
  `expect(fetch).toHaveBeenCalledTimes(3)` e inspecciona
  `fetch.mock.calls[1]` para chequear método y body de la llamada real.

## 5. La corrida real de coverage (backend) y el ejercicio de la rama sin cubrir

Corrí `npm run test:coverage` en `tp2/backend` para este mismo apartado y el
reporte de consola (`v8`, `text`) dio esto:

```
 Test Files  9 passed (9)
      Tests  111 passed (111)

File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |   97.23 |    95.67 |   97.14 |   97.23
 src/config        |      88 |    66.66 |     100 |      88
  env.js           |   82.85 |    66.66 |     100 |   82.85   Uncovered: 20-25
```

El archivo con menor cobertura de rama del proyecto es
`tp2/backend/src/config/env.js`, líneas 20-25:

```js
if (faltantes.length > 0) {
  console.error(
    `[config] Faltan variables de entorno obligatorias: ${faltantes.join(', ')}.\n` +
    `[config] Copiá .env.example a .env y completalas, o pasalas desde docker-compose.`
  );
  process.exit(1);
}
```

1. **Qué línea/archivo es:** `src/config/env.js:20-25`, la rama del `if` que
   se toma cuando falta alguna variable de entorno obligatoria al arrancar el
   proceso (`console.error` + `process.exit(1)`).
2. **Qué entrada la recorrería:** arrancar el proceso con al menos una de las
   siete variables de `REQUERIDAS` (`DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`) ausente o vacía en
   `process.env`.
3. **Qué decidí hacer y por qué:** no agregar un test nuevo, porque **esta
   rama ya está probada** — sólo que `v8` no puede verlo. El test `el arranque
   muere nombrando la variable que falta` (`tests/env.test.js:15-51`) hace
   exactamente esa entrada: arranca `env.js` con `PORT` faltante vía
   `execFileSync(process.execPath, [envModulePath], ...)` y confirma
   `error.status === 1` y que el `stderr` contiene `PORT`. El motivo por el
   que igual sale "sin cubrir" es que ese arranque corre en un **proceso hijo
   separado**, y el coverage `v8` que junta Vitest sólo instrumenta el proceso
   donde corre el test runner — lo que pasa adentro del proceso hijo (que es
   justamente donde vive el `if`) queda fuera de esa instrumentación. Escribir
   un segundo test que importe `env.js` en el mismo proceso para "pintar" esas
   líneas de verde exigiría mockear `process.exit` y `console.error`, lo cual
   sería **menos** honesto que lo que ya tengo: pasaría el coverage pero
   dejaría de verificar el comportamiento real (que el proceso efectivamente
   termina con código 1 y un mensaje útil en stderr). Prefiero un reporte que
   diga 66.66% de ramas en este archivo puntual y sea cierto, a maquillarlo.

## 6. Verificación del freno: que el gate no sea decorativo

En los dos lados hice la prueba de bajar la cobertura a propósito y confirmar
que el pipeline la frena, **en local, antes de abrir el PR**:

- **Backend:** deshabilité temporalmente archivos de test enteros (bajando el
  número de asserts reales sobre el código) y corrí `npm run test:coverage`.
- **Frontend:** dejé un test saltado (`it.skip`) y subí el threshold para
  forzar el mismo efecto.

En ambos casos la salida fue el mismo mensaje, con exit code distinto de 0:

```
ERROR: Coverage for lines (X%) does not meet global threshold (Y%)
```

Después de confirmar el mensaje y el código de salida, restauré todo (los
tests deshabilitados y el threshold) y volví a correr para confirmar que
quedaba verde otra vez antes de commitear.

**Lo que esto demuestra y lo que todavía no.** Esta verificación prueba que el
umbral de Vitest funciona como gate *localmente* — que el comando
`test:ci` realmente corta con error si la cobertura cae. Lo que **falta** es
la demostración *en el pipeline*, con dos PRs reales que muestren el ciclo
rojo → verde en GitHub Actions: eso es la Tarea 3 del TP y todavía está
pendiente.

- **PR de demo #1 (mergeado) — frontend**: [#38](https://github.com/ivanjalid1/ingsoft3-tp01/pull/38).
  Agregó `tp2/frontend/src/utils/estadoVenta.js` sin tests → CI se puso rojo
  por cobertura (corrida roja:
  [run 35176181433](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/35176181433),
  error `ERROR: Coverage for branches (79.31%) does not meet global threshold
  (80%)`, con los 36 tests preexistentes en verde) → se agregaron los tests
  que faltaban → CI verde (corrida verde:
  [run 35176361800](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/35176361800),
  93.98% líneas / 90.36% ramas) → mergeado.
- **PR de demo #2 (queda abierto y rojo hasta la defensa, NO se mergea) —
  backend**: [#39](https://github.com/ivanjalid1/ingsoft3-tp01/pull/39).
  Agregó `tp2/backend/src/services/descuentoService.js` sin tests → CI en
  rojo por cobertura (corrida roja:
  [run 35176989733](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/35176989733),
  error `ERROR: Coverage for lines (76.7%) does not meet global threshold
  (80%)`, con los 111 tests preexistentes en verde y el job de frontend sin
  tocar, en verde). Este PR se deja así, sin arreglar, hasta la defensa oral.

## 7. Docker y CI: la etapa `test` y qué extrae el pipeline

Cada Dockerfile (backend y frontend) ganó una etapa intermedia:

```
FROM build AS test
ENTRYPOINT ["npm", "run", "test:ci"]
```

`test:ci` es un script nuevo en los dos `package.json`:

```
vitest run --coverage --coverage.reportsDirectory=${COVERAGE_DIR:-coverage}
```

El `${COVERAGE_DIR:-coverage}` existe para que el pipeline pueda extraer el
reporte por volumen **sin pisar** el `coverage/` que uso en mi máquina cuando
corro los tests local. `ci.yml` (commit `c5636a2`) construye esa etapa con
`docker/build-push-action@v7` (`target: test`, `load: true`, porque sin
`load: true` la imagen queda sólo en el build cache del buildx remoto y
`docker run` no la encuentra), la corre con:

```
docker run --rm -e COVERAGE_DIR=/salida/reporte -v "$GITHUB_WORKSPACE/backend-coverage:/salida" backend-test:ci
```

arma un resumen en `$GITHUB_STEP_SUMMARY` leyendo `coverage-summary.json` (una
tabla con líneas/ramas/funciones), y publica el reporte completo —incluido el
HTML navegable— como artifact (`coverage-backend`, `coverage-frontend`) con
`actions/upload-artifact@v4`. El código de salida de `test:ci` es lo que
decide si el job pasa: si el umbral no se cumple, `vitest run --coverage`
termina distinto de 0, el `docker build` de la etapa `test` falla, el step
falla, y el job —que ya era uno de los dos `required_status_checks` desde el
TP4— bloquea el merge igual que si hubiera fallado la compilación.

**El bug latente que encontré: `.dockerignore` excluía `tests/`.** Desde el
TP2, `tp2/backend/.dockerignore` tenía una línea `tests` que excluía toda esa
carpeta del contexto de build. Eso significa que cualquier `docker build`
**sin cache** (de cero, como correría en una máquina nueva o el día que
GitHub desaloje el cache de Actions) iba a fallar el `RUN npm test` de la
etapa `build` con `No test files found`, porque los archivos de test nunca
llegaban al contenedor. Nadie lo había pisado porque siempre se buildeaba con
cache local. Lo corregí sacando esa línea del `.dockerignore` en el mismo
commit que subió la cobertura (`6d7bc41`).

## 8. Por qué no hizo falta ningún refactor para poder mockear

La guía advierte que puede hacer falta refactorizar el código de producción
para volverlo mockeable (inyección de dependencias, extraer interfaces). Acá
**no hizo falta ninguno**, y no porque lo resolviera esta semana: el backend
ya tenía la capa `models/` separada de `services/` y `controllers/` desde
antes del TP5, con esta razón dejada explícita en el propio código
(`src/models/ventaModel.js`, línea 30):

```js
// ÚNICA puerta al pool para transacciones. Está acá y no en el service
// porque el service no puede conocer config/db.js: si lo conociera, no se
// podría mockear la capa de datos y los tests necesitarían MySQL.
```

Gracias a esa separación previa, `vi.mock('../src/models/ventaModel.js')` (y
lo mismo para `productoModel`, `clienteModel`, `usuarioModel`) alcanzó
directamente para testear los services y controllers sin tocar una base de
datos real. Lo documento como una decisión de diseño que ya estaba tomada y
que esta semana **pagó dividendos**, no como un refactor nuevo.

## 9. Declaración de uso de IA

**Qué hice con IA.** Usé Claude Code (modelo Sonnet 5) de forma extensiva
para: instalar y configurar coverage (`@vitest/coverage-v8`) en los dos lados,
escribir la mayoría de los tests nuevos (los cuatro modelos del backend,
`Ventas.jsx`, `useRecurso`, `Login` y `AuthContext` del frontend), convertir
grupos de tests repetidos a `it.each`, modificar los dos Dockerfiles y
`ci.yml`, y armar los commits y el PR #36.

**Qué NO hice con IA (verificación humana).** Revisé el diff de cada commit
antes de pushearlo. Confirmé la decisión de dejar el umbral en 80% recién
después de ver los números reales (97%/95% backend, 93%/88% frontend), no
antes. Decidí qué excluir de la cobertura, incluyendo revertir la exclusión
de `db.js` al ver que ya tenía 100% sin necesidad de esconderlo. Confirmé y
después revertí un cambio no relacionado en `nginx.conf` que había quedado de
una clase con el profesor y no pertenecía a este TP.

**Cómo lo verifiqué.** Cada assert de los tests que escribió la IA es
verificable leyendo el archivo de test correspondiente y corriendo
`npm run test:coverage` en `tp2/backend` o `tp2/frontend` — los números de
este apartado (111 tests backend, 36 frontend, los porcentajes de la tabla
del punto 1) salen de correr esos comandos yo mismo, no de la palabra de la
IA. El mensaje exacto del gate (`ERROR: Coverage for lines (X%) does not meet
global threshold (Y%)`, punto 6) lo vi en mi propia terminal antes de
restaurar los archivos. La rama sin cubrir del punto 5 la elegí yo mirando la
tabla de consola real, no un ejemplo que me haya sugerido la IA.

---

# Decisiones — TP6 (CD: environments, aprobaciones y deployment patterns)

## Enlaces de este TP

**Paquetes públicos (ghcr.io)** — tag `sha-<commit>`, se bajan sin login:

- Backend: https://github.com/users/ivanjalid1/packages/container/package/ingsoft3-tp01-backend
- Frontend: https://github.com/users/ivanjalid1/packages/container/package/ingsoft3-tp01-frontend

```bash
docker pull ghcr.io/ivanjalid1/ingsoft3-tp01-backend:sha-25e16885987878410d28d0187b488714f1e0c1e4
```

**Los dos eslabones de la cadena** (explicados en el punto 2):

- PR #42, corrida de `pull_request`: *Entrar al registry* queda **skipped** y la
  imagen sólo se construye —
  https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37659563442/job/112923298988
- Merge del PR #42 en `main` (`25e1688`): *Construir y publicar la imagen del
  backend* es el último paso, después de los tests —
  https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37660396718/job/112926134053

**Entornos:**

- QA: https://qa.testingwebapp.site
- PROD: https://prod.testingwebapp.site

En los dos, `/api/health` devuelve `{status, version}` con el SHA desplegado y
`/api/health/db` hace un `SELECT` sobre una tabla real (503 si falta la base o el
esquema).

## 1. Dónde despliego y por qué no Render + Neon

La guía asume Render para los contenedores y Neon (Postgres) para la base. Mi app
usa **MySQL 8**: portar los modelos, el `init.sql` y los tests a Postgres para
poder usar Neon era meter un cambio grande y riesgoso en la capa de datos sólo
para acomodarme al proveedor, en un TP que es de entrega continua, no de base de
datos. Elegí un **VPS propio** (un Ubuntu 24 de Hostinger, compartido con otros
proyectos míos, con nginx y certbot en el host). La guía acepta cualquier
proveedor que cumpla los cinco puntos del contrato; así los cumplo:

| Punto del contrato | Cómo se cumple acá |
|---|---|
| 1. Dos entornos separados con URL pública | Dos proyectos de compose (`tp6-qa` y `tp6-prod`), cada uno detrás de su vhost de nginx con TLS de Let's Encrypt: `qa.` → `127.0.0.1:3610`, `prod.` → `127.0.0.1:3620`. |
| 2. Una base por entorno | Un contenedor `mysql:8` por proyecto, con volumen propio (`tp6-qa_db_data`, `tp6-prod_db_data`) y contraseñas distintas. Prueba en el punto 7. |
| 3. Front y back como contenedores de mis Dockerfiles | Las imágenes que corren son las que publica mi CI desde `tp2/backend` y `tp2/frontend`. El VPS no construye nada. |
| 4. El deploy lo dispara mi pipeline con el commit verificado; auto-deploy del proveedor apagado | Acá no existe auto-deploy: lo único que despliega es el comando SSH forzado, y sólo lo invoca el pipeline con `github.sha` (punto 4). |
| 5. PROD detrás de una aprobación | Environment `production` de GitHub con *required reviewer* (punto 8). |

## 2. La cadena de tres eslabones: de commit verificado a imagen publicada

1. **En el PR la imagen se construye pero no se publica.** El paso *Entrar al
   registry* tiene `if: github.event_name == 'push' && github.ref ==
   'refs/heads/main'` y el `build-push-action` tiene `push:` con la misma
   condición. En la corrida del PR #42 se ve el login **skipped**: desde una rama
   no hay credenciales para escribir en `ghcr.io`.
2. **En `main` se publica sólo después de los tests.** En la corrida del merge
   (`37660396718`) el orden de los pasos del job es tests → coverage → login →
   *Construir y publicar*, que es el último. Si los tests fallan, el job corta
   antes y no se publica nada.
3. **El tag es el commit.** La imagen sale como `sha-<github.sha>`, y eso es lo
   que después piden QA, PROD y el rollback. No hay `latest`.

Juntos dicen: "si existe `sha-X` en el registry, es porque `X` pasó por `main`
con los tests en verde".

**Lo que la cadena no garantiza.** Nada me impide a mí, con un token con
`write:packages`, hacer un `docker push` a mano con un tag `sha-X` que no salió
del pipeline: la cadena es una convención del workflow, no una regla del
registry. Y los **tags son mutables**: alguien con permisos puede reescribir
`sha-X` apuntando a otra imagen. Lo inmutable sería desplegar por **digest**
(`@sha256:...`); hoy despliego por tag y lo dejo explícito.

## 3. Desplegar por imagen, no por rebuild

Esta es la diferencia más importante con la guía. En Render el proveedor vuelve
a construir desde el repo (el problema del §3.2: lo que corre no es exactamente
lo que verificó el CI). Acá eso **no aplica**: el VPS hace `docker compose pull`
de la imagen `sha-<commit>` que el CI construyó, testeó y publicó. Lo que corre
en QA y en PROD es el mismo artefacto, byte a byte (por tag).

Lo que queda, dicho honestamente:

- El tag es mutable en teoría (punto 2); un digest lo cerraría del todo.
- `mysql:8` es un tag flotante: si Docker Hub lo mueve, dos deploys del mismo
  commit pueden bajar una base distinta. Fijarlo a una versión exacta (o digest)
  sería lo correcto para producción real.
- QA y PROD comparten máquina: si el VPS se cae, se caen los dos (punto 12).

## 4. Cómo se despliega: environments, secrets y el comando forzado

- **Dos environments en GitHub:** `qa` sin reglas y `production` con
  *required reviewer* `ivanjalid1` (`prevent_self_review` apagado, porque soy el
  único que puede aprobar).
- **Un secret con el mismo nombre en los dos, con valor distinto.**
  `DEPLOY_SSH_KEY` existe en `qa` y en `production`, pero son dos keys
  diferentes. El job toma la del environment en el que corre, así que el YAML es
  idéntico y aun así `deploy-qa` no puede tocar PROD. `VPS_HOST` y
  `VPS_KNOWN_HOSTS` son variables del repo; la host key está fijada y el SSH usa
  `StrictHostKeyChecking=yes`, así que no se acepta un host que no sea el mío.
- **En el VPS, un usuario `tp6deploy` con comando forzado.** En
  `authorized_keys` la key de QA sólo puede ejecutar
  `/opt/ingsoft3-tp6/deploy.sh qa` y la de PROD sólo `deploy.sh prod`, sin
  importar qué comando mande el cliente. El script acepta únicamente un SHA de
  40 hex: lo probé mandando `ls /` y `not-a-sha` y los dos salieron con código 2.
  Es el equivalente al *deploy hook* de Render con `&ref=`: una URL (acá una key)
  que sólo sabe hacer una cosa, con un parámetro validado.
- **Qué hace `deploy.sh`:** baja `deploy/compose.yml` y `init.sql` **de ese
  mismo SHA** desde `raw.githubusercontent.com`, corre
  `IMAGE_TAG=<sha> docker compose -p tp6-<env> --env-file .env pull` y después
  `up -d --wait`, y deja una línea en `deploy.log`. El `.env` de cada entorno
  vive sólo en el VPS (`chmod 600`), con contraseñas de base y `JWT_SECRET`
  distintos por entorno; nunca está en el repo.
  El script está versionado en [`deploy/deploy.sh`](deploy/README.md) (junto
  con un `.env.example`, el `authorized_keys` de ejemplo y los vhosts), pero el
  VPS no se actualiza solo: si cambia, hay que reinstalarlo a mano (riesgo de
  *drift*, documentado en `deploy/README.md`).
- **Una acción compuesta para los tres usos.** `.github/actions/deploy-vps`
  (SSH + smoke test) la usan `deploy-qa`, `deploy-prod` y el rollback. Si
  cambio cómo se despliega, lo cambio en un solo lugar.
- **La cadena de `needs`/`if`:** `deploy-qa` necesita los dos builds y tiene
  `if` de push a `main`; `deploy-prod` necesita `deploy-qa` y no tiene `if`
  propio — lo hereda, porque si `deploy-qa` se saltea, `deploy-prod` también.
  `deploy-prod` (y el rollback) están en el grupo de `concurrency: deploy-prod`,
  que evita dos deploys a PROD a la vez, **pero no ordena la cola de
  aprobaciones**: si quedan dos corridas esperando, la vieja hay que rechazarla a
  mano.

## 5. Qué prueba el smoke test (y qué no)

Después del deploy, hasta 30 intentos cada 20 s (`curl --max-time 10`):

1. `/api/health` responde 200 **y** su `version` es igual al SHA que se acaba de
   desplegar. Esto cierra el hueco del §3.3 de la guía: sin comparar la versión,
   el smoke puede dar verde contra **la versión vieja** que todavía está
   corriendo.
2. `/api/health/db` responde 200: la base existe y el esquema está.
3. `/` responde 200: el frontend sirve y nginx está bien configurado.

**Lo que no prueba:** que los flujos funcionen (login, cargar una venta), la
performance, ni que los datos sean correctos. Es un "está vivo y es la versión
correcta", no un test funcional.

## 6. Una imagen, dos entornos: qué va en la imagen y qué por variable

El nginx del frontend dejó de tener la dirección del backend fija:
`tp2/frontend/default.conf.template` usa `${BACKEND_URL}` y `${DNS_RESOLVER}`, y
la imagen oficial de nginx los reemplaza al arrancar. Los defaults están en el
Dockerfile (`backend:3000`, `127.0.0.11`), así que el `docker compose` local del
TP2 sigue andando igual.

- **En la imagen:** el `dist/` estático y el template.
- **Por variable:** dirección del backend, resolver, credenciales de la base,
  `JWT_SECRET` y `APP_VERSION`.

La **misma imagen** corre en QA y en PROD. En este VPS los dos entornos usan
`http://backend:3000`, porque cada proyecto de compose tiene su propia red; la
variable igual hace falta para que la imagen no quede atada a una dirección
(con otro proveedor el backend estaría en otra URL).

## 7. Una base por entorno: la prueba

Inserté un cliente `SOY PROD` (id 2) **sólo** en la base de `tp6-prod`, con
`docker compose exec` contra ese proyecto. En QA la misma consulta devuelve 0
filas: QA sólo tiene el `Cliente Demo` del `init.sql`. Los volúmenes son
`tp6-qa_db_data` y `tp6-prod_db_data`.

El esquema lo crea `init.sql`, montado en `docker-entrypoint-initdb.d`, que
MySQL ejecuta **sólo la primera vez que arranca con el volumen vacío**. No hay
migraciones, y lo digo como límite: el día que cambie el esquema, `init.sql` no
se va a volver a correr sobre una base existente. Para eso hace falta una
herramienta de migraciones.

## 8. El gate a PROD: qué miro antes de aprobar

**Evidencia:** la corrida `37668884076` (merge del PR #46, `d7b35ae`). Como
re-corrí el job rechazado, la corrida tiene dos intentos: el 1 rechazado y el 2
aprobado. Primero la **rechacé**
([intento 1](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37668884076/attempts/1))
con este comentario:

> Rechazo: el PR #46 decide el entorno mirando el hostname (qa./prod.); si el
> dominio cambia, PROD mostraría LOCAL y el aprobador perdería la señal visual.
> Quiero confirmar primero en QA que el badge dice QA antes de autorizar PROD.

Revisé QA, re-corrí el job y lo **aprobé**
([intento 2, el último](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37668884076))
con:

> Confirmé en QA: el badge dice QA y el pie muestra el SHA d7b35ae de esta
> corrida. Smoke de QA verde. Apruebo el deploy a PROD.

**Qué miro antes de aprobar:**

- Que la corrida de QA esté verde y que el smoke haya validado `version == sha`.
- Qué cambia el PR: el diff, con atención especial a configuración, base de
  datos, secrets y tests debilitados o borrados.
- El cambio visible en QA (para eso están el pie con el SHA y el badge de
  entorno).
- Que no haya otra corrida más vieja esperando en la cola.
- El momento: no aprobar un deploy si no voy a poder mirar PROD después.

**Qué no puedo ver desde el gate:** el tráfico real de usuarios, errores o
latencia en PROD (no hay monitoreo todavía; llega en el TP9), y si un cambio de
base es reversible.

## 9. Continuous Delivery, no Continuous Deployment

Lo que implementé es **Continuous Delivery**: cada merge a `main` queda
desplegado en QA y listo para PROD, pero a PROD entra sólo con una decisión
humana. Para pasar a **Continuous Deployment** (sin gate) me faltan: tests e2e
que prueben flujos reales, monitoreo y alertas, rollback automático ante errores
y feature flags para separar "desplegado" de "activado". Sin eso, sacar el gate
sería sacar la única red que hay.

## 10. Release y rollback medido

**Release:** `v6.0.0` sobre `c231030b79e243e3fdad46f793d7503402140e50`, con
notas generadas: https://github.com/ivanjalid1/ingsoft3-tp01/releases/tag/v6.0.0.
El SHA lo saqué de la API de Deployments (lo que **PROD tenía corriendo**), no
de la punta de `main`, que puede estar adelante.

**Rollback:** `.github/workflows/rollback.yml`, un `workflow_dispatch` que recibe
un SHA. Corre en el environment `production`, así que **también pide
aprobación**. Plan:

1. Elegir el último SHA bueno (`git rev-list -n1 v6.0.0`).
2. Disparar el workflow con ese SHA.
3. El workflow valida que sea un SHA de 40 hex y que existan las dos imágenes
   (`docker manifest inspect`): si el commit nunca pasó por `main`, corta.
4. Aprobar.
5. Despliega con la misma acción compuesta y el smoke exige que PROD conteste
   **esa** versión.
6. Escribe los segundos en el resumen de la corrida.

**Medido** en https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37669622780,
volviendo de `d7b35ae` (PR #46) a `c231030` (`v6.0.0`):

| Momento | Hora (UTC) |
|---|---|
| Dispatch | 18:48:16 |
| Aprobación / arranca el job | 18:49:59 |
| Cronómetro INICIO | 18:50:01 |
| `deploy.log` en el VPS: `env=prod sha=c231030… exit=0` | 18:50:27 |
| Smoke verde / FIN | 18:50:29 |

**28 s** desde la aprobación hasta PROD verificada en la versión anterior, y
**2 min 15 s** de punta a punta incluyendo la espera humana. Hoy PROD sigue en
`c231030` y QA en `d7b35ae`, que se puede comprobar en `/api/health` de cada uno.

**Lo que el rollback no deshace:** los datos y el esquema. Si una versión nueva
cambió tablas o escribió filas con otro formato, volver la imagen atrás no las
vuelve. Para eso hacen falta migraciones compatibles hacia atrás
(expand/contract: primero agregar, después dejar de usar, recién al final
borrar) y un backup antes de cada deploy (un `mysqldump` del volumen de PROD).

## 11. Qué patrón usaría en producción real

Para esta app recomiendo **blue-green**:

- **Costo:** es chica; duplicarla en el mismo VPS son dos proyectos de compose
  más. No hace falta otra máquina.
- **Riesgo y rollback:** el cambio de versión es cambiar el upstream de nginx de
  `blue` a `green` y recargar. El rollback es lo mismo al revés: instantáneo, sin
  bajar imágenes ni esperar arranques.
- **La condición:** la base es **una sola**, compartida por blue y green, así que
  todo cambio de esquema tiene que ser compatible hacia atrás (el mismo
  expand/contract del punto 10).

**Por qué no canary:** necesita volumen de tráfico para que el porcentaje que va
a la versión nueva diga algo, y métricas por versión para comparar. No tengo
ninguna de las dos. **Feature flags** los sumaría más adelante para features
riesgosas, no como patrón de deploy.

Cualquiera de estos patrones necesita observabilidad que hoy no hay: métricas por
versión, tasa de errores, latencia, logs centralizados y alertas. Sin eso, el
switch de blue-green es rápido pero a ciegas.

## 12. Letra chica de la infraestructura (y seguridad)

- **No hay free tier: es un VPS propio y compartido** con otros proyectos en
  producción. Eso implica no hacer `docker system prune` a ciegas, competir por
  CPU y memoria, y que fail2ban banea IPs que abren muchas conexiones SSH; lo
  mitigué con **una sola conexión SSH por deploy**.
- **No hay cold start:** los contenedores están siempre arriba
  (`restart: unless-stopped`). Los reintentos del smoke cubren sobre todo el
  `pull` de las imágenes y el primer arranque de MySQL con el volumen vacío.
- Los certificados se renuevan solos con el timer de certbot; los registros DNS
  `qa.` y `prod.testingwebapp.site` son registros A al VPS.
- **Riesgo principal:** si el VPS muere, mueren QA y PROD juntos.
- **Seguridad:** las keys de deploy están separadas por entorno y limitadas por
  el comando forzado; los secrets nunca están en el repo; los paquetes son
  públicos a propósito (no contienen secretos: todo lo sensible entra por
  variable). Lo que digo honestamente: `tp6deploy` está en el grupo `docker`, y
  en ese host eso equivale a root: con ese usuario se podrían ver o parar los
  contenedores de los otros proyectos, o montar `/` en un contenedor. Lo que lo
  limita hoy es el comando forzado (cada key sólo despliega su entorno y sólo
  acepta un sha), no el usuario.
- **Siguiente paso identificado, a propósito no hecho en este VPS compartido de
  producción:** Docker *rootless* con un usuario por entorno (`tp6qa`,
  `tp6prod`), para que una credencial filtrada no pueda salir de su entorno.
  Eso además permitiría mover la lógica del deploy al YAML del workflow sin
  necesitar una key sin restricciones.
- **Alternativas descartadas.** (a) **Toda la lógica en el YAML por SSH** (el
  job manda los comandos de `docker compose`): exige una key que pueda ejecutar
  cualquier cosa en una máquina compartida, con un usuario que equivale a root;
  con la de QA se podría tocar PROD. (b) **Un bootstrap fijo que baje
  `deploy.sh` del repo en cada sha**: resuelve el *drift*, pero agrega piezas
  (descarga, fallback para commits viejos) a cambio de poco, para un script que
  casi nunca cambia. Me quedé con el script único en el VPS, versionado en
  [`deploy/`](deploy/README.md) y reinstalado a mano cuando cambia.
- **Si el VPS desaparece, sobrevive casi todo:** el CI, las imágenes en ghcr, el
  `compose.yml`, los environments y el gate, el smoke y el workflow de rollback.
  Lo único que cambia es el destino del paso de deploy (host, key SSH y vhosts).

## 13. Problemas encontrados y cómo los resolví

- **La app es MySQL y la guía asume Neon (Postgres).** Lo resolví cambiando de
  proveedor en vez de cambiar de base (punto 1).
- **El VPS es compartido.** nginx del host ya ocupaba 80/443, así que no pude
  usar Caddy en un contenedor: usé vhosts de nginx en el host apuntando a puertos
  sólo de `127.0.0.1`, y certbot para TLS.
- **QA no resolvía en mi máquina** después de crear el registro DNS. Era el cache
  DNS de Cloudflare WARP en mi máquina, no un problema del servidor: alcanzó con
  esperar a que expirara.
- **`npm run test:ci` no expande `${COVERAGE_DIR:-coverage}` en `cmd.exe`.** Es
  sintaxis de shell POSIX; en el CI (Linux) anda bien, que es donde importa.
- **Apreté *Approve* habiendo escrito un texto de rechazo.** En las corridas
  `37665923884` y `37667927904` escribí comentarios de rechazo pero apreté
  *Approve* (y uno de los primeros rechazos dice sólo "Test"). El historial de
  aprobaciones lo muestra tal cual. La lección: el gate registra exactamente lo
  que hizo el humano; **lo que decide es el botón, no el comentario**. En la
  corrida `37668884076` lo hice bien: rechazo con motivo y después aprobación
  con evidencia.

## 14. Declaración de uso de IA

**Qué hice con IA.** Usé Claude Code (Anthropic) como asistente para: analizar
el repo contra la guía y decidir el proveedor, escribir los scripts de
preparación del VPS (`deploy.sh`, usuario, `authorized_keys`, vhosts), el YAML
de los workflows, la acción compuesta, los endpoints de health con sus tests, el
template de nginx y este texto.

**Qué NO hice con IA.** Las decisiones de aprobar o rechazar en el gate, y sus
comentarios, fueron mías.

**Cómo lo verifiqué.** Cada paso lo comprobé con corridas reales (los enlaces de
arriba), con `curl` contra QA y PROD (`/api/health` y `/api/health/db`), con las
pruebas negativas del comando forzado (`ls /` y `not-a-sha` rechazados con
código 2), con la consulta de separación de bases y midiendo el rollback desde
los logs (el resumen de la corrida y el `deploy.log` del VPS). Puedo explicar
cada gate, cada secret y cada espera que hay entre un merge y PROD.

---

# Decisiones — TP7 (Contenedores en el pipeline + integración y e2e)

## Enlaces del TP7

**Paquetes públicos (ghcr.io).** La versión que corre en PROD (`v7.0.0`) tiene el tag
`sha-b4630600d430e889a27473bec6cfd8674110b5a0` en los dos:

- Backend: https://github.com/users/ivanjalid1/packages/container/package/ingsoft3-tp01-backend
- Frontend: https://github.com/users/ivanjalid1/packages/container/package/ingsoft3-tp01-frontend

```bash
docker pull ghcr.io/ivanjalid1/ingsoft3-tp01-backend:sha-b4630600d430e889a27473bec6cfd8674110b5a0
docker pull ghcr.io/ivanjalid1/ingsoft3-tp01-frontend:sha-b4630600d430e889a27473bec6cfd8674110b5a0
```

**La corrida roja (la e2e frena un bug real):**

- Commit que rompió la app: el merge del PR #52,
  [`fa921526c293a6c20d6482748465413a5076fa2f`](https://github.com/ivanjalid1/ingsoft3-tp01/commit/fa921526c293a6c20d6482748465413a5076fa2f).
  Es un cambio de una línea en `tp2/frontend/src/pages/Clientes.jsx`:
  `cliente.email` → `cliente.correo`.
- Corrida: https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37839260057
- Reporte de integración (verde, 3 passed):
  https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37839260057/artifacts/11576727940
- Reporte e2e (rojo, 1 failed / 2 passed):
  https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37839260057/artifacts/11576853286

  (GitHub sólo deja bajar artefactos con la sesión iniciada: sin login, esos
  enlaces dan 404. Vencen el 2027-01-06.)

**La corrida verde completa después del arreglo:** el merge del PR #53 (`b463060`),
desde el build hasta PROD con aprobación:
https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37840446131

**Release:** https://github.com/ivanjalid1/ingsoft3-tp01/releases/tag/v7.0.0

**Entornos:**

- QA: https://qa.testingwebapp.site
- PROD: https://prod.testingwebapp.site

## 1. Build once, deploy many: ya estaba hecho desde el TP6

La consigna 1 pide dejar de reconstruir en el proveedor y desplegar la imagen
que construyó el CI. Eso lo tengo desde el TP6, porque a mi VPS despliego
**por imagen** (punto 3 del TP6). `deploy-qa` y `deploy-prod` entran por SSH con
la key de su environment (comando forzado). Después `deploy.sh` baja
`deploy/compose.yml` de ese mismo sha y corre `IMAGE_TAG=<sha> docker compose pull`
y `up -d --wait` con `ghcr.io/ivanjalid1/ingsoft3-tp01-{backend,frontend}:sha-<sha>`.
No se reconstruye en ningún lado, y QA y PROD corren el mismo tag.

Lo que es propio de Render no aplica acá: no hay *Existing Image*, ni URL de
imagen que configurar, ni la trampa del *Manual Deploy* que vuelve a construir.
No hay ningún proveedor que pueda construir por su cuenta.

**Cómo se prueba desde afuera** (lo que en Render serían los *Events*):

1. **El log del paso de deploy** en Actions muestra el `pull` de
   `sha-<commit>` de las dos imágenes.
2. **`/api/health` devuelve `{version: <commit>}`**, y el smoke test exige que
   coincida con `github.sha`. Con eso queda implementado el concepto del §2.4
   ("la app sabe qué versión es"), pero **a medias, y lo digo**: `APP_VERSION`
   no está horneada en la imagen, la pone `deploy/compose.yml`
   (`APP_VERSION: ${IMAGE_TAG}`). Por lo tanto prueba **qué tag se mandó a
   desplegar**, no qué bits hay adentro de la imagen. Si la pasara con un `ARG`
   en el build, la prueba sería más fuerte, porque la versión saldría de la
   imagen misma.
3. **En el VPS:** `/opt/ingsoft3-tp6/<env>/deploy.log` guarda una línea por
   deploy con el sha y el código de salida, y
   `docker compose -p tp6-qa images` muestra el tag que está corriendo.

Por ejemplo, hoy PROD contesta `version: b4630600…` (`v7.0.0`, después del
rollback del punto 13) y QA contesta `646acc2…`, que es el merge del PR #55
(sólo documentación): está en QA pero no en PROD.

## 2. Estrategia de tags

- **En el registry sólo hay `sha-<40 hex>`.** No publico `latest` porque es un tag
  que se mueve solo: "desplegar `latest`" no dice qué versión corre y tampoco
  deja volver atrás a algo concreto. Con el sha, la imagen y el commit son lo mismo.
- **La versión legible va en Git.** El tag `v7.0.0` está sobre el commit que
  corre en PROD. Para pasar de la versión a la imagen:
  `git rev-list -n1 v7.0.0` → `b4630600d430e889a27473bec6cfd8674110b5a0` →
  `sha-b4630600…` en los dos paquetes.
- **Los tags del registry son mutables, el digest no.** Si re-corro una
  corrida de `main`, se vuelve a publicar `sha-<commit>`: el código es el mismo, pero
  la imagen puede ser otra. Desplegar por digest (`@sha256:…`) lo resolvería, pero
  hay que pasar el digest del job de build a los de deploy. No lo hice; queda
  como el siguiente paso.
- **Dónde puse `v7.0.0` y por qué.** El commit lo saqué de la API de Deployments del
  environment `production`, pero **no** del primer elemento: `.[0]` es el último
  deployment **creado**, no el último **desplegado**. En ese momento el más nuevo
  era `51e774c` (la corrida del PR #54), en estado `waiting`. Filtré por estado
  `success` y me quedó `b463060`, que era lo que PROD tenía de verdad.
  (Después esa corrida se aprobó por error y hubo que hacer rollback, punto 13.
  El deployment del rollback quedó registrado con el sha del workflow,
  `646acc2`, no con el de la imagen que desplegó; por eso la fuente de verdad
  de qué corre en PROD es `/api/health`, no la API de Deployments.)

## 3. Host único: el backend no se publica aparte

El backend no tiene URL propia. A la API se llega por el mismo host del front, en
`/api`: el template de nginx de la imagen del front le pasa el tráfico a
`backend:3000` por la red del compose. Por eso en el pipeline
`API_BASE_URL` = `E2E_BASE_URL` = `https://qa.testingwebapp.site`. Siguen siendo
dos imágenes y dos paquetes. Lo único que cambia es por dónde entra el tráfico.

## 4. La suite de integración (`tp2/frontend/e2e/api.spec.js`)

Usa Playwright con `request`: HTTP directo, sin navegador y sin dobles, contra la
API de QA y su MySQL real. Antes de arrancar se loguea con un usuario de prueba
que existe **sólo en QA** (`e2e@erp.local`). El usuario está en la variable
`QA_E2E_USER` y la contraseña en el secret `QA_E2E_PASSWORD`. Verifiqué que en la
base de PROD ese usuario no existe (count 0).

1. **Alta, lectura y baja.** Crea un cliente con un email único (lleva
   `Date.now()`) y espera un 201 con sus datos y `activo: true`.
   Un `GET /api/clientes` nuevo lo encuentra. `DELETE /api/clientes/:id`
   devuelve `{id, activo: false}`. Después el cliente ya no está en el listado de activos
   y `GET /api/clientes/:id` lo muestra con `activo: false`. Es así porque en la app
   la baja es **lógica** (`UPDATE … SET activo = 0`) y no hay borrado
   físico. El test verifica lo que la app hace de verdad.
2. **Datos inválidos.** Con el nombre vacío responde 400 `DATOS_INVALIDOS` "El nombre es
   obligatorio"; con el email mal formado, 400 `DATOS_INVALIDOS` "El email tiene
   formato inválido". Además, en el listado **completo** (que incluye los inactivos) la
   cantidad de filas no cambió.
3. **Mi elección: email duplicado.** El segundo alta con el mismo email da
   409 `EMAIL_DUPLICADO` y queda **una sola fila** con ese email. Lo elegí porque
   es la única regla que garantiza la **base** y no el código. El service hace
   una consulta previa para responder un 409 prolijo, pero lo que lo garantiza de verdad es el
   `UNIQUE` de `clientes.email` (si dos altas entran a la vez, el service traduce
   `ER_DUP_ENTRY` a 409). En los unitarios la base es un mock que acepta
   cualquier cosa. Sólo contra MySQL real se ve que la respuesta es 409 y no
   500, y que no se duplicó nada. La baja del cliente va en un `finally` para
   que no quede activo aunque falle una aserción del medio.

## 5. La suite e2e (`tp2/frontend/e2e/clientes.spec.js`)

Es Chromium real contra QA. Cada prueba arranca logueándose **por la UI**. Al
entrar a Clientes espera la respuesta real del `GET /api/clientes`: si no, un
"no aparece" podría pasar contra una tabla que todavía está vacía.

1. **Crear un cliente.** Completa el formulario y aparece la fila con el nombre
   **y** el email. El formulario se limpia, lo da de baja y la fila desaparece.
2. **Datos inválidos.** Con un email mal formado, el usuario ve un
   `role=alert` que dice "El email tiene formato inválido" y no aparece ninguna fila.
   Además confirma contra la API (en el listado completo) que no se creó nada.
3. **Flujo diario.** Crea un cliente, recarga la página y el cliente sigue ahí: sale de la
   base, no de la memoria de React. Lo da de baja, recarga otra vez y ya no
   está.

**Decisiones de la suite:**

- **Selectores por accesibilidad:** `getByLabel` y `getByRole`, nunca clases
  CSS ni ids. Para apuntar al botón de baja de **ese** cliente,
  le agregué a la app nombres accesibles por fila ("Dar de baja <nombre>",
  "Editar <nombre>"). Es una mejora real de accesibilidad: antes, un lector de
  pantalla leía "Dar de baja" diez veces sin decir de quién era cada botón.
- **`afterEach` de limpieza.** Si una prueba falla entre el alta y la baja, lo
  que haya quedado activo se da de baja por la API.
- **`workers: 1`.** Todas las pruebas comparten la misma base real, y la de
  datos inválidos compara cantidades. En paralelo, el alta de otra prueba podría
  cambiar el conteo en el medio y dar un rojo falso.

## 6. Qué NO puse en cada suite (la pirámide)

- Las validaciones campo por campo y las reglas de negocio (ventas, stock)
  se quedan en los unitarios del TP5, que son rápidos y no necesitan un entorno.
- En integración puse sólo lo que pasa **donde el código toca la base**: el
  contrato HTTP real, la persistencia y el `UNIQUE`.
- En e2e puse sólo los **flujos críticos** de un usuario. Son tres pruebas, no treinta,
  porque cada una es lenta, depende de la red y comparte QA.

## 7. Integración "amplia" contra QA, no "estrecha"

Elegí probar contra QA ya desplegado en vez de levantar backend + MySQL dentro
del runner.

- **Lo que gano:** se prueban el deploy real, el proxy de nginx y la MySQL de
  verdad, sin infraestructura extra en el CI.
- **Lo que pierdo:** antes hace falta un deploy, así que el feedback llega más tarde. Además
  comparte QA con otras corridas (punto 11) y depende de la red entre GitHub y
  el VPS, que ya me falló (punto 10).

## 8. La cadena del pipeline

`build-backend` + `build-frontend` → `deploy-qa` (smoke: `version == sha`,
`/api/health/db` y `/`) → `integracion` (`needs: deploy-qa`) → `e2e`
(`needs: integracion`) → `deploy-prod` (`needs: e2e`, environment `production`
con *required reviewer*, `concurrency: deploy-prod`).

No hay `continue-on-error`, ni `|| true`, ni `always()`. Lo único que lleva
`!cancelled()` son las subidas de reportes, porque el reporte hace falta justamente
cuando la suite falla. Cada suite sube su propio artefacto
(`playwright-report-integracion` / `playwright-report-e2e`) y escribe en el
resumen de la corrida cuántas pruebas pasaron.

## 9. La corrida roja: un bug real que frenó la e2e

**El bug.** En el PR #52 cambié una línea del listado de Clientes:
`cliente.email` → `cliente.correo`. La API sigue mandando `email`, así que la
columna Email queda vacía. El ejemplo de la guía (mandar `correo` en vez de
`email` en el alta) no me servía: ya hay un unitario que verifica el body exacto
del POST, y lo habría atrapado antes. Por eso rompí el lado de **lectura**.

**Qué pasó en la corrida `37839260057`:**

| Job | Resultado |
|---|---|
| Builds + unitarios | verde (ningún unitario miraba la celda del email) |
| `deploy-qa` + smoke | verde |
| `integracion` | verde, 3 passed |
| `e2e` | **rojo**, 1 failed / 2 passed |
| `deploy-prod` | **skipped**: ni siquiera llegó a pedir aprobación |

Falló "crear un cliente…" en la línea
`expect(fila.getByRole('cell', { name: datos.email, exact: true })).toBeVisible()`:
la fila estaba, pero la celda con el email no.

**Diagnóstico con la tabla del §2.5:** integración verde + e2e roja quiere decir que la API y
la base andan (la integración leyó el `email` directo de la API y estaba bien), y
que el problema está en cómo el front usa esos datos. **No es un flaky:** falló en
los tres intentos (el original y los dos reintentos), siempre en la misma
aserción.

**El arreglo (PR #53)** volvió a `cliente.email` y además **agregó un unitario de
Vitest** que verifica la celda del email en la fila. La e2e encontró un hueco en
los unitarios, y ese hueco se cerró más abajo en la pirámide, donde es
más barato. Comprobé que el test nuevo falla con el código roto. Después, la corrida
`37840446131` quedó verde de punta a punta, hasta PROD.

## 10. Flaky tests, cold start y la red

**Un flaky test** es uno que a veces pasa y a veces falla con el mismo código.
Es peor que no tener test: la gente se acostumbra a re-correr hasta que dé
verde, y el día que el rojo es real también lo re-corre. Un test que no existe,
por lo menos, no enseña a ignorar el rojo.

**Cold start no hay:** en el VPS los contenedores están siempre arriba. Lo que
sí tuve fueron **cortes de red transitorios** entre algunos runners de GitHub
(Azure) y el VPS:

- En la corrida `37833222579`, el `page.goto` de la e2e quedó colgado unos 7 minutos
  (status -1, ningún request llegó al nginx del VPS), mientras que la integración,
  desde otro runner, ya había pasado. Al re-correr, pasó.
- En las corridas `37677961855` y `37840446131` (primer intento), el SSH del deploy dio
  `Connection timed out`, y en el firewall del VPS no quedó registrado ningún descarte.
- En la corrida [`37850975213`](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37850975213)
  (merge del PR #55, sólo documentación) saltó el paso previo nuevo de
  `integracion`: mostró la IP del runner, `104.209.7.224`, el `curl` a QA dio
  timeout las 6 veces y el job cortó en ~1,5 minutos (no a los 7 minutos de un
  `page.goto` colgado) con el mensaje "corte de red entre GitHub y el VPS, no un
  fallo de las pruebas". `e2e` y `deploy-prod` quedaron *skipped*. En el VPS
  busqué esa IP: aparece **0 veces** en el `access.log` de nginx y **0 veces**
  en los logs del kernel/UFW. Los paquetes nunca llegaron al servidor, así que
  el corte está antes, en el proveedor o en la ruta, y no en mi firewall ni en
  la app: confirma la hipótesis. No la re-corrí porque sólo cambiaba
  documentación y re-correrla me habría vuelto a pedir aprobación para PROD.
- En la corrida [`37853945664`](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37853945664)
  (merge del PR #56) el deploy a QA agotó los 4 reintentos de SSH desde la IP
  `20.127.238.138`, que tampoco aparece en `auth.log` ni en el kernel del VPS.
  Revisé que no fuera algo mío: UFW permite el 22 desde cualquier lado, no hay
  listas de bloqueo, fail2ban no está activo y la misma key entró ese día desde
  otras 5 IPs de Azure. Reintentar no sirve porque el job conserva la IP.

**Solución de fondo: runner self-hosted en el VPS.** Los jobs que hablan con el
VPS (`deploy-qa`, `integracion`, `e2e`, `deploy-prod` y el rollback) pasaron a
`runs-on: [self-hosted, tp6-vps]`. El runner abre él la conexión saliente a
GitHub, así que la ruta Azure → VPS que se cortaba deja de usarse. Corre con un
usuario propio (`tp6runner`) sin sudo ni grupo `docker`: para desplegar sigue
entrando por SSH con la key del environment y el comando forzado, así que el
límite "cada key despliega un solo entorno" no cambia. Como el repo es público,
activé que ningún workflow de un fork corra sin mi aprobación. Detalle en
`deploy/README.md`.

**Mitigaciones (siguen, para fallos que no son de red):**

- `navigationTimeout: 20s`: una navegación colgada falla rápido, y el reintento
  entra dentro del timeout del test.
- `retries: 2` en CI. Una prueba que pasa sólo en el reintento aparece como
  **flaky** en el reporte, y eso hay que mirarlo, no ignorarlo.
- Un paso previo (PR #51) que muestra la IP del runner y le hace un `curl` con
  reintentos a QA. Si QA no responde, corta con un mensaje que aclara que
  es la red y no las pruebas, y la IP queda en el log para buscarla en los logs del VPS.
- El SSH del deploy se reintenta **sólo ante un exit 255** (error de conexión de
  SSH), desde el PR #54. Es seguro porque el deploy es idempotente y el comando
  forzado sólo acepta un sha: repetirlo no puede hacer nada distinto.

## 11. QA compartido: el límite conocido

Dos corridas pueden pisarse en QA: una despliega mientras la otra está
corriendo la e2e. Me pasó con dos corridas de `main` para el mismo commit
(#67 y #68), y cancelé la duplicada. La regla que sigo hoy es **un merge a la vez**;
las corridas viejas que quedan esperando aprobación las rechazo a mano. El
arreglo de verdad sería un entorno efímero por corrida.

## 12. La misma imagen del front en QA y PROD

Es igual que en el TP6: el template de nginx toma `BACKEND_URL` y `DNS_RESOLVER`
del entorno. **En la imagen** van el `dist/` estático y el template. **Por
entorno** van la dirección del backend, las credenciales de la base, el
`JWT_SECRET` y el `APP_VERSION`.

## 13. El gate en este TP

- **Rechacé** la corrida `37838244892` (PR #51) con este motivo:

  > Solo cambia la configuración de las pruebas (timeouts, reintentos y chequeo
  > de red); la imagen de la app es igual a la que ya está en PROD. No hay nada
  > nuevo que promover.

- **Aprobé** `37833222579` (después de re-correr por el corte de red, aclarando en
  el comentario que el primer intento falló por la red y no por la app) y
  `37840446131` (el arreglo del bug).
- **`37841788683` (corrida #74, PR #54, el reintento del SSH) la aprobé por
  error.** La quería rechazar por el mismo motivo que la del PR #51, y el
  comentario lo dice ("…la imagen de la app es la misma que ya corre en PROD.
  PROD queda en v7.0.0"), pero apreté *Approve*: la API de approvals la
  registra como `approved`. PROD pasó a `51e774c`. El código de la app era el
  mismo (sólo cambiaba la acción de deploy), pero se rompía "`v7.0.0` = lo que
  corre en PROD".
- **Lo corregí con el workflow de rollback:** corrida
  [`37852840994`](https://github.com/ivanjalid1/ingsoft3-tp01/actions/runs/37852840994)
  con el sha `b4630600…`. El job duró 45 s (22:21:29 → 22:22:14 UTC) y el
  resumen mide **41 s** desde el inicio del rollback hasta el smoke verde. PROD
  volvió a `b463060` = `v7.0.0` (`/api/health` lo confirma).
- **La lección:** el gate registra el botón, no el comentario. Ya me había
  pasado en el TP6 (punto 13 de esa sección), así que es un error humano que se
  repite, no un accidente aislado. Una mitigación sería exigir un segundo
  revisor o un *wait timer* en el environment `production`, para que un clic
  equivocado no llegue directo a PROD.

**Lo que el gate (con estas suites) no atrapa:** los flujos que no cubren las tres
e2e, las regresiones visuales o de layout, la performance, los problemas de migración de
datos, la configuración que sólo existe en PROD (su `.env`) y la concurrencia.

## 14. Riesgos que dejo anotados

- **El admin de PROD usa las credenciales del seed**, que son públicas en
  `init.sql`. En una producción real las rotaría; decidí no cambiarlas ahora.
- **Un cliente dado de baja conserva su email bajo el `UNIQUE`**, así que no se puede
  dar de alta otro cliente con ese email. Es una decisión de producto,
  no un bug de los tests.
- **Los datos de prueba se acumulan en QA** como filas inactivas, una por cada
  alta de cada corrida.
- **Si cambio de proveedor**, sobrevive todo menos el destino del deploy: la
  acción `deploy-vps` (SSH), `deploy.sh` y los vhosts.

## 15. Declaración de uso de IA

**Qué hice con IA.** Usé Claude Code (Anthropic) como asistente para escribir
las dos specs de Playwright y los jobs `integracion` y `e2e` del workflow, para el
diagnóstico de los cortes de red entre los runners y el VPS, y para este texto.

**Qué NO hice con IA.** Las decisiones de aprobar o rechazar en el gate, y sus
comentarios, fueron mías.

**Cómo lo verifiqué.** Con corridas reales (enlazadas arriba). La roja la
reproduje con un cambio real en la app, no con un test forzado a fallar. Revisé
los dos reportes de esa corrida, y antes de dar por bueno el unitario nuevo del
PR #53 comprobé que falla con el código roto. Además, `/api/health` de QA y PROD
devuelve los shas que menciono arriba.
