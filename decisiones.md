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

# Decisiones — App del semestre (ERP mínimo)

**Fecha:** 2026-08-13

El diseño completo está en `docs/superpowers/specs/2026-08-13-erp-minimo-design.md`.
La tabla de la sección 1 reproduce, sin editar, las 24 decisiones tal como quedaron
cerradas en ese diseño, antes de escribir una línea de código. La sección 2 son las
decisiones que se tomaron **durante la implementación** — algunas son ajustes
menores, dos son correcciones de bugs de concurrencia reales que encontró la
revisión de código independiente de cada tarea.

## 1. Las 24 decisiones del diseño

| # | Decisión | Alternativa descartada | Por qué |
|---|----------|------------------------|---------|
| 1 | ERP mínimo (clientes / productos / ventas) como dominio | To-do list, blog, CRUD plano | Tiene reglas de negocio reales y baratas (stock, total, anulación) que dan material genuino para los 8 tests del TP5. Un CRUD plano obliga a inventar tests. |
| 2 | React 18 + Vite, Node + Express, MySQL 8 | Next.js full-stack, Django, Spring Boot | Tres piezas separadas y visibles, como pide la cátedra. Un framework full-stack esconde la frontera front/back, que es justo lo que hay que contenerizar por separado. |
| 3 | `mysql2` con SQL a mano | Sequelize / Prisma / TypeORM | Transparencia total del modelo y transacciones explícitas en la defensa. Menos superficie que explicar y que pueda fallar en CI. Costo asumido: escribir el SQL, siempre parametrizado. |
| 4 | MVC en tres capas con la regla "el controller nunca ve SQL, el model nunca ve req/res" | Todo en las rutas; o arquitectura hexagonal completa | La regla dura es la que permite mockear `models/` y correr los tests sin base. La hexagonal agrega puertos y adaptadores que no compran nada a esta escala. |
| 5 | `app.js` separado de `server.js` | Un solo archivo con `listen()` al final | supertest levanta la app sin abrir puerto: tests paralelos, sin conflictos de puerto ni procesos colgados. |
| 6 | Único `errorHandler` centralizado con contrato `{ error: { code, message } }` | `try/catch` con `res.status()` en cada controller | Un solo lugar traduce error a HTTP. El frontend maneja errores de forma uniforme porque hay un único formato. |
| 7 | `precio_unitario` y `subtotal` congelados en `venta_items` | JOIN a `productos.precio` al consultar | Sin congelar, cambiar el precio de un producto reescribiría el histórico y el `total` dejaría de cuadrar con sus ítems. La redundancia es intencional: son valores históricos. |
| 8 | Creación de venta en una sola transacción con `SELECT ... FOR UPDATE` y rollback | Validar stock antes y después descontar sin transacción | Sin transacción, una venta que falla en el ítem 3 deja descontados los ítems 1 y 2. `FOR UPDATE` además evita que dos ventas simultáneas vendan el mismo stock. Es la regla 3 del TP5. |
| 9 | Anular = transición de estado que repone stock | `DELETE` de la venta | Borrar destruye el historial y no repone stock. `pendiente → anulada` es una máquina de estados real, y da dos tests distintos (regla 5 y regla 6). |
| 10 | `DELETE` de clientes y productos = baja lógica (`activo = 0`) | Borrado físico | Las FKs con `ON DELETE RESTRICT` harían fallar el borrado de cualquier entidad con ventas, y borrar en cascada destruiría el historial. El flag resuelve las dos cosas. |
| 11 | JWT HS256, 8h, un solo rol | Sesiones con cookie de servidor; o JWT + roles + refresh | El backend queda sin estado (importante para escalar y para el TP6). Un solo rol porque hay un solo usuario: roles sin usuarios distintos es estructura vacía. |
| 12 | Token en `localStorage` | Cookie `httpOnly` + `SameSite` | La cookie es más segura pero arrastra CSRF y configuración de dominio entre contenedores. Se elige `localStorage` **declarando** la limitación (XSS), no por omisión. |
| 13 | Sin registro público; admin sembrado en `init.sql` | Endpoint `POST /api/usuarios` | Elimina verificación de email, recuperación de contraseña y tres pantallas. No aporta nada al objetivo de la materia. |
| 14 | Siete env vars obligatorias, validadas al arrancar, **sin defaults** | `process.env.DB_HOST \|\| 'localhost'` | Con default, un olvido en PROD arranca "bien" y falla en la primera request, disfrazado. Sin default, el contenedor muere en el arranque diciendo exactamente qué falta. |
| 15 | `config/env.js` como única puerta a `process.env` | Leer `process.env` donde haga falta | Un solo lugar para validar, un solo lugar para agregar variables. `db.js` no sabe que existen las env vars. |
| 16 | El frontend usa **rutas relativas** y nginx hace de proxy inverso de `/api` | `VITE_API_URL` inyectada en build | Vite congela las `VITE_*` en tiempo de build: una env var del contenedor no puede cambiarlas. El proxy elimina CORS, hace que dev (proxy de Vite) y prod (nginx) se comporten igual, y deja al frontend con cero variables de entorno. |
| 17 | Vitest en backend y frontend | Jest en el back + Vitest en el front | Un solo runner que aprender y explicar. Vitest es nativo de Vite (JSX sin configurar) y corre ESM en Node sin ceremonia. |
| 18 | Tests de backend con `models/` mockeado, **sin MySQL** | Base de test real o Testcontainers | El pipeline del TP4 se reduce a `npm ci && npm test`. Tests deterministas y rápidos. La verificación del SQL real llega en el e2e del TP6: cada nivel de la pirámide cubre lo suyo. |
| 19 | `backend/Dockerfile` de una sola etapa, copiando `package*.json` antes que `src/` | `COPY . .` antes del `npm ci` | El backend no compila, no necesita multi-stage. El orden de copiado hace que la capa de `npm ci` solo se invalide cuando cambian las dependencias, no en cada edición de código. |
| 20 | `frontend/Dockerfile` multi-stage (Node builda → nginx sirve) | Servir el frontend con Node en producción | La imagen final no lleva Node ni `node_modules`, y por eso pesa **93 MB** contra los **212 MB** del backend, que sí los lleva. Muchísima menos superficie de ataque para el TP9: lo que no está en la imagen no se puede explotar (ver la nota de abajo y la decisión 26). |
| 21 | `healthcheck` en `db` + `depends_on: condition: service_healthy` | `depends_on: [db]` a secas | `depends_on` solo espera a que el contenedor arranque, no a que MySQL acepte conexiones. Sin healthcheck el backend muere en el primer `docker compose up`. |
| 22 | Volumen nombrado `db_data` + `init.sql` en `/docker-entrypoint-initdb.d/` | Sembrar con un script manual después de levantar | La imagen oficial ejecuta el `.sql` sola en el primer arranque. Un comando (`docker compose up`) y el sistema queda usable. |
| 23 | El backend no publica puertos al host | `ports: "3000:3000"` | Menos superficie expuesta y obliga a que el proxy funcione de verdad, en vez de que el frontend le pegue directo por casualidad. |
| 24 | `decisiones.md` y `evidencias.md` desde el primer commit | Documentar al final | El §6 del reglamento pide uso de IA declarado, verificado y defendible. Documentar al final es reconstruir de memoria: se pierden las alternativas descartadas, que son la mitad de la defensa. |

> **Corrección de la decisión 20 — el número era una estimación de diseño.** La
> versión original de esta tabla (copiada del spec, escrita antes de construir
> nada) decía "~25 MB contra ~400 MB". Cuando se midió de verdad, con
> `docker images` sobre las imágenes construidas, dio **93 MB** el frontend y
> **212 MB** el backend. El número se corrigió arriba y el argumento se reescribió
> con los datos reales, que sostienen la decisión igual: la imagen del frontend
> pesa **menos de la mitad** que la del backend precisamente porque no lleva
> Node ni `node_modules`, y de sus 93 MB la enorme mayoría es la base
> `nginx:alpine` — el `dist/` de Vite son unos pocos MB encima. Los ~25 MB
> originales subestimaban la base. Se deja la corrección declarada en vez de
> reescribir la historia: estimé, medí, y mandó la medición.

## 2. Decisiones tomadas durante la implementación

Estas no estaban en el diseño original: aparecieron al programar, casi todas por
una revisión de código que encontró algo que el spec no había previsto.

| # | Decisión | Alternativa descartada | Por qué |
|---|----------|------------------------|---------|
| 25 | `bcryptjs` (JS puro) en vez de `bcrypt` (nativo) | Mantener `bcrypt` y agregar toolchain de compilación a la imagen alpine | `bcrypt` arrastra `@mapbox/node-pre-gyp → tar`, con 1 CVE crítico y 1 alto en dependencias de producción (`npm audit --omit=dev`). Compilar el módulo nativo en `node:20-alpine` además obliga a instalar `build-base`, `python3` y `make` en la imagen, lo contrario del multi-stage liviano de la decisión 20. Misma API (`hash`/`compare`), mismo cost 10. Tras el cambio, `npm audit --omit=dev` da 0 vulnerabilidades. |
| 26 | Las vulnerabilidades que reporta `npm audit` en el frontend se dejan sin arreglar | Fijar versiones nuevas de `jsdom`/`vite` para silenciar el audit | Son todas de dependencias **de desarrollo**. El `frontend/Dockerfile` (decisión 20) es multi-stage: la imagen final solo tiene el `dist/` estático servido por nginx, sin Node ni `node_modules`. Esas dependencias no existen en la imagen de producción y no son superficie de ataque real para el TP9. |
| 27 | Consolidar los ítems de una venta por `producto_id` (sumando cantidades y ordenando) antes de leer stock, en vez de rechazar con 400 | Dejar que el cliente mande líneas repetidas y validar cada una por separado | La revisión de la tarea de creación de venta encontró que un `producto_id` repetido en la misma venta evadía la validación de stock: las dos lecturas veían el mismo stock, las dos pasaban, y el bucle de escritura descontaba dos veces, commiteando **stock negativo**. Consolidar antes del bucle de lectura deja la API correcta pase lo que mande el cliente. Ordenar las líneas consolidadas por `producto_id` de paso fija el orden en que se toman los locks y elimina un deadlock posible entre dos ventas con los mismos productos en orden inverso. |
| 28 | Validar "¿ya está anulada?" con un `SELECT ... FOR UPDATE` **dentro** de la transacción de anulación, y verificar el `affectedRows` del `UPDATE` | Validar el estado antes de abrir la transacción | La revisión de la tarea de anulación encontró que el chequeo corría antes del `beginTransaction()`, sin lock: dos anulaciones simultáneas de la misma venta pasaban las dos, reponían el stock **dos veces**, y el service devolvía 200 sin darse cuenta porque no miraba el `affectedRows` del `UPDATE`. Es la misma regla que ya cumplía la creación de venta (decisión 8): lo que se valida, se valida bajo el lock que lo protege. |
| 29 | Ante una venta, manda el precio que el backend relee de la base dentro de la transacción, no el que tiene cacheado la pantalla | Recalcular el total en el frontend y confiar en ese valor | Si el precio de un producto cambia entre que se carga la pantalla de nueva venta y se confirma, el total mostrado y el guardado pueden divergir. Se decide a propósito que gane la base — es la razón de fondo de la decisión 7 (`precio_unitario` congelado en `venta_items`, no un `JOIN` contra `productos.precio`). |
| 30 | Los tests de backend mockean `models/` y por lo tanto no ejercitan el SQL real | Correr los tests contra una base de test real o Testcontainers | Es la contracara deliberada de la decisión 18: si alguien sacara el `FOR UPDATE` de `productoModel`, la suite seguiría en verde, porque el mock no sabe que la cláusula existe. A cambio, el pipeline del TP4 no necesita levantar MySQL. La verificación real del bloqueo transaccional llegó con el e2e manual contra los tres contenedores (ver `evidencias.md`), no con la suite. |
| 31 | JWT sin verificación de existencia del usuario en cada request | Consultar la base en el middleware de auth en cada request | Es stateless por diseño (decisión 11). El costo conocido: un token vigente de un usuario que se borró sigue pasando el middleware hasta que expira, hasta 8 horas. No hay revocación. Se documenta para no improvisar la respuesta si sale el tema en la defensa. |
| 32 | Health check en `GET /health`, fuera de `/api` | `GET /api/health` público | Si el health check viviera bajo `/api`, la regla "todo `/api` pide token salvo `/api/auth/login`" necesitaría una excepción más para no exigirle JWT a un healthcheck de Docker. Sacarlo de `/api` deja la regla sin excepciones. |
| 33 | Node 20 fijado en la imagen (`node:20-alpine`), aunque el desarrollo corrió sobre Node 24 | Igualar la versión local a la de la imagen antes de continuar | Lo que se evalúa y se despliega es la imagen, no la máquina del alumno. `node:20-alpine` es la que fija la versión de verdad en el build reproducible; la versión de desarrollo no interviene. |
| 34 | El backend corre como `USER node` (uid 1000), y el cambio de usuario va **antes** del `npm ci` | Dejarlo como root, que es el default de la imagen | "¿Por qué tu contenedor corre como root?" es una pregunta cantada del TP9 (DevSecOps), y la imagen oficial ya trae el usuario `node`: no hay que crear nada. Cambiar de usuario antes del `npm ci` hace que ni siquiera `node_modules` quede escrito por root, así que no queda un solo archivo del proyecto con dueño root dentro de la imagen. Se verificó con `docker compose exec backend whoami`. |
| 35 | El **frontend sigue corriendo como root**, a propósito y declarado | Aplicarle el mismo `USER` que al backend | nginx necesita root para bindear el puerto 80; correrlo sin privilegios obliga a cambiar el puerto a uno > 1024, reescribir el `nginx.conf`, mover los directorios de `pid`/`cache`/logs a rutas escribibles y reajustar el mapeo de puertos del compose. Es desproporcionado para lo que compra en este TP. La diferencia con el backend es real: nginx **baja de privilegios** los procesos worker (el master queda como root solo para bindear), mientras que el proceso de Node corría como root de punta a punta. Se documenta como limitación conocida, no se omite. |
| 36 | El healthcheck de `db` pinguea por **TCP** (`-h 127.0.0.1`), no por socket (`-h localhost`) | Dejar `-h localhost`, que "funcionaba" | Durante la inicialización, la imagen `mysql:8` levanta un servidor **temporal** con `--skip-networking` para ejecutar los scripts de `/docker-entrypoint-initdb.d/`. Ese servidor contesta el ping por socket Unix, así que compose podía marcar `db` como healthy **antes** de que el 3306 real escuchara, y el backend arrancaba contra una base que todavía no estaba. Es el clásico "anda en mi máquina y falla en una más lenta". Por TCP, el ping solo responde cuando escucha el servidor definitivo, que es la condición que el `depends_on: service_healthy` necesita de verdad. |
| 37 | Un body con JSON malformado devuelve **400 DATOS_INVALIDOS**, no 500 | Dejar que el `SyntaxError` de body-parser caiga al branch genérico | El `SyntaxError` que lanza `express.json()` no es un `AppError` y salía como `500 ERROR_INTERNO`. Un JSON mal armado es un error del **cliente** y es previsible: le corresponde el mismo 400 y el mismo `code` que a cualquier otro dato inválido. Dejarlo en 500 contradecía el principio aplicado en todo el resto del proyecto ("lo previsible no sale 500") y hacía ruido en los logs por culpa de quien llama, no del servidor. No lo dispara la SPA, que siempre manda `JSON.stringify` válido, pero sí cualquiera con `curl`. La traducción vive donde tiene que vivir: en `errorHandler.js`, el único traductor error → JSON del backend. |
| 38 | El test que verifica el arranque sin env vars corre el proceso hijo en un **directorio temporal vacío** | Dejarlo heredando el cwd de vitest (`backend/`) | `config/env.js` empieza con `import 'dotenv/config'`, y dotenv lee `path.resolve(process.cwd(), '.env')`. Con el cwd heredado, el `backend/.env` que el propio README manda crear le reponía la variable borrada al hijo y el proceso salía con código 0: el test pasaba a fallar en la máquina de cualquiera que hubiera seguido las instrucciones del README. Con un cwd vacío no hay `.env` que leer y el test mide lo que dice medir. Verificado corriendo la suite completa **con** `backend/.env` presente y **sin** él: 56/56 en las dos. |
| 39 | `api/client.js` degrada a `null` un cuerpo de respuesta que no es JSON, en vez de dejar reventar el `JSON.parse` | Confiar en que la respuesta siempre es JSON, porque el backend siempre manda JSON | El backend siempre manda JSON, pero **quien contesta puede no ser el backend**: si nginx no lo alcanza devuelve su propia página `502 Bad Gateway` en HTML, y `JSON.parse('<html>…')` tiraba un `SyntaxError: Unexpected token '<'` crudo en la pantalla del usuario. Con la guarda, un error de infraestructura sale por el mismo camino que cualquier otro error de la app —un `ApiError` con el status real— y el contrato del cliente de API queda intacto en todos los caminos. |

La decisión 24 de la sección 1 (`decisiones.md` y `evidencias.md` desde el primer
commit) sigue vigente sin cambios: este mismo archivo, ampliado por fecha en vez de
reescrito, es la prueba.

## 3. Los números de tests, sin inflar

`npm test` da **56 casos en backend** y **15 en frontend**: 71 en total. El TP5
exige un subconjunto identificado de esos 71 — **8 de backend** (uno por regla de
negocio, tabla en `README.md`) y **4 de frontend** — pero los 71 son reales y corren
en verde; el resto se sumó porque el ciclo TDD del plan pedía un test por cada
función antes de escribirla (validación de entorno, casos límite como
`precio === 0`, ABM de clientes, formato de error, etc.). Decir "12 tests" o
"8 tests" acá sería impreciso: la corrida real tiene más casos que esos, y decir
menos de los que hay es tan poco defendible como inflar el número.

Los últimos 6 casos entraron en la tanda de arreglos previa al PR y cubren huecos
que la revisión final encontró: el redondeo de dinero con precios con **centavos**
(los otros fixtures usaban precios enteros, así que la función `redondear` no la
ejercitaba nadie), el `409 EMAIL_DUPLICADO` de `PUT /api/clientes/:id` (una regla
del §9.2 del spec que no verificaba ningún test), el `400` ante un body con JSON
malformado (decisión 37) y la guarda del cliente de API ante una respuesta que no
es JSON (decisión 39).

Este archivo, `README.md` y `evidencias.md` dicen **los mismos números**. Antes de
esta tanda no era así —`evidencias.md` decía "52 en total" y esta tabla decía
"~25 MB" para una imagen de 93— y una contradicción entre dos documentos del mismo
repositorio es material de pregunta en la mesa. Se corrigieron los tres a la vez y
se re-corrieron las dos suites para confirmar los números que quedaron escritos.

## 4. Declaración de uso de IA (§6 del reglamento)

**Qué hice con IA.** El diseño, el plan de implementación y el código de esta app
se hicieron con Claude (Claude Code), en un flujo de **subagent-driven
development**: por cada una de las 12 tareas del plan hubo un agente implementador
que escribía el código y los tests, y un agente revisor independiente — sin
memoria de lo que había pensado el implementador — que auditaba el resultado
contra el spec y la calidad del código antes de darla por cerrada.

**Qué encontraron las revisiones.** No fue trámite: encontraron y corrigieron
defectos reales, entre ellos dos bugs de concurrencia que un test que mockea
`models/` no puede detectar porque no ejercita SQL real:

- En la creación de venta, un `producto_id` repetido en la misma venta evadía la
  validación de stock y terminaba commiteando stock negativo (decisión 27).
- En la anulación, el chequeo de "¿ya está anulada?" corría fuera del lock de la
  transacción, y dos anulaciones simultáneas de la misma venta podían reponer el
  stock dos veces (decisión 28).

Los dos se corrigieron moviendo la validación **adentro** del `FOR UPDATE` que ya
protegía la operación relacionada — no fueron features nuevas, fue la misma regla
("lo que se valida se valida bajo el lock") aplicada donde todavía faltaba.

**Qué NO hice con IA.** La elección del dominio, el recorte de alcance, la
decisión final sobre cada hallazgo de revisión (qué se corrige y qué se difiere),
la ejecución y lectura de la verificación end-to-end, y la validación de que cada
afirmación de este repositorio es cierta.

**Cómo lo verifiqué.** No acepté el resultado de la IA por reporte, lo comprobé
contra la ejecución:

- Los 71 tests corren y pasan: `npm test` en `backend/` y en `frontend/` (detalle
  de los que exige el TP5 en la sección 3 de este archivo).
- Los tres contenedores levantan con `docker compose up -d --build` y la app
  responde en `http://localhost:8080`.
- La verificación final fue una corrida end-to-end real contra los tres
  contenedores ya construidos, no contra los mocks de la suite: login, alta de
  producto, venta con descuento de stock (20→18), anulación con reposición de
  stock (18→20), y una segunda anulación de la misma venta devolviendo
  `409 VENTA_YA_ANULADA` con el body visible. Documentado con capturas en
  `evidencias.md`.
- El hash bcrypt del admin sembrado en `init.sql` se generó y se verificó a mano
  con `bcryptjs.compareSync`.

**Defendible.** Puedo explicar cada decisión de este archivo y de
`docs/superpowers/specs/2026-08-13-erp-minimo-design.md`, incluidos los dos bugs
de concurrencia que encontró el revisor: por qué existían, por qué el mock no los
detectaba, y por qué el arreglo es mover la validación bajo el lock y no agregar
una capa nueva. Si en la mesa preguntan por una decisión que tomó la IA y no la
puedo explicar, ese punto no se aprueba — es la regla del §6, y la aplico contra
mí mismo antes de que la aplique el tribunal.
