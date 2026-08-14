# ERP mínimo — IngSoft3 UCC 2026

App del semestre: clientes, productos y ventas. Tres piezas separadas —
frontend, backend y base de datos— para recorrer los TPs 2 a 9.

- **Diseño técnico completo:** `docs/superpowers/specs/2026-08-13-erp-minimo-design.md`
- **Plan de implementación:** `docs/superpowers/plans/2026-08-13-erp-minimo.md`
- **Decisiones y declaración de uso de IA:** `decisiones.md`
- **Evidencias:** `evidencias.md`

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite, servido por nginx |
| Backend | Node.js 20 + Express, `mysql2` con SQL a mano, `bcryptjs` para hashing |
| Base de datos | MySQL 8 (InnoDB, utf8mb4) |
| Tests | Vitest + supertest (backend) · Vitest + React Testing Library (frontend) |

## Levantar todo con Docker (recomendado)

Requiere Docker Desktop.

```bash
docker compose up -d --build
```

Después, abrir **http://localhost:8080**.

Usuario: `admin@erp.local` · Contraseña: `Admin123!`

> El hash del usuario está sembrado en `backend/db/init.sql`. Si lo regenerás,
> usá `node -e "console.log(require('bcryptjs').hashSync('Admin123!',10))"`
> desde `backend/` (el proyecto usa `bcryptjs`, no `bcrypt` — ver `decisiones.md`)
> y acordate de hacer `docker compose down -v` para que la base se vuelva a
> sembrar.

Comandos útiles:

```bash
docker compose logs -f backend    # ver el arranque y los errores de entorno
docker compose down               # bajar todo, la base persiste en el volumen
docker compose down -v            # bajar y BORRAR el volumen (re-ejecuta init.sql)
```

Tamaño de las imágenes construidas: backend **~212MB**, frontend **~93MB** (la
del frontend es casi enteramente la base `nginx:alpine`; el `dist/` de Vite
pesa unos pocos MB encima).

## Levantar en desarrollo, sin Docker

Necesitás un MySQL 8 corriendo en `localhost:3306` con el `init.sql` ya
ejecutado.

Backend (PowerShell, que es donde se desarrolló y se probó):

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

En Git Bash o en Linux, la primera línea del bloque de arriba es
`cp .env.example .env`; el resto es igual.

Frontend, en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

El frontend queda en http://localhost:5173 y su dev server hace de proxy de
`/api` hacia el backend en el 3000, así que no hay que configurar ninguna URL.

## Variables de entorno

El backend necesita **las siete**, sin valores por defecto: si falta alguna, el
proceso no arranca y dice cuál. Están documentadas en `backend/.env.example`.

| Variable | Local | En compose |
|----------|-------|-----------|
| `DB_HOST` | `localhost` | `db` |
| `DB_PORT` | `3306` | `3306` |
| `DB_USER` | `root` | `erp_user` |
| `DB_PASSWORD` | `root` | `erp_pass` |
| `DB_NAME` | `erp` | `erp` |
| `JWT_SECRET` | `dev-secret-no-usar-en-prod` | `dev-secret-cambiar-en-prod` (literal en `docker-compose.yml`) |
| `PORT` | `3000` | `3000` |

El `JWT_SECRET` del compose es un **valor de desarrollo escrito a mano en el
archivo**, no un secreto inyectado desde afuera: sirve para que `docker compose
up` funcione sin configuración previa, y **en producción hay que cambiarlo**
(pasarlo por el entorno del runner o por un gestor de secretos, que es lo que
corresponde a partir del TP6/TP9). Lo mismo vale para `rootpass` y `erp_pass`.

El frontend **no usa ninguna variable de entorno**: llama siempre a rutas
relativas `/api/...` y quien resuelve a dónde van es el proxy (Vite en
desarrollo, nginx en producción).

El health check del backend vive en `GET /health`, **fuera** de `/api`, para
que la regla "todo `/api` pide token salvo el login" no tenga excepciones.

## Tests

```bash
cd backend
npm test          # 56 tests
```

```bash
cd frontend
npm test          # 15 tests
```

Total: **71 casos** (56 backend + 15 frontend). El TP5 exige un subconjunto
identificado de esos 71: **8 de backend** (uno por cada regla de negocio de la
tabla de abajo) y **4 de frontend**. El resto son tests adicionales de
cobertura (casos límite, validación de entorno, ABM de clientes, etc.) que se
sumaron durante la implementación porque el ciclo TDD del plan los pedía antes
de escribir cada función. Ningún número de este README está inflado: son los
que produce `npm test` tal cual, sin filtrar.

Los tests de backend son **independientes del entorno de la máquina**: el caso
que verifica que el arranque muere si falta una variable corre el proceso hijo
en un directorio temporal vacío, así que da lo mismo si existe o no el
`backend/.env` que la sección anterior manda crear. Verificado en las dos
situaciones.

### Los 8 de backend que exige el TP5

| # | Regla | Respuesta |
|---|-------|-----------|
| 1 | Una venta sin ítems se rechaza | `400 VENTA_SIN_ITEMS` |
| 2 | Un ítem con `cantidad <= 0` se rechaza | `400 CANTIDAD_INVALIDA` |
| 3 | Ítem que pide más cantidad que el stock disponible: se rechaza la venta entera y no se descuenta nada | `409 STOCK_INSUFICIENTE` |
| 4 | Venta válida: descuenta stock y calcula `total = Σ (cantidad × precio_unitario)` | `201` |
| 5 | Anular una venta `pendiente` repone stock y pasa a `anulada` | `200` |
| 6 | Anular una venta ya `anulada` se rechaza | `409 VENTA_YA_ANULADA` |
| 7 | Cliente con email ya existente se rechaza | `409 EMAIL_DUPLICADO` |
| 8 | Login con contraseña incorrecta; `password_hash` nunca sale en una respuesta | `401 CREDENCIALES_INVALIDAS` |

### Los 4 de frontend que exige el TP5

| # | Comportamiento |
|---|----------------|
| 1 | El formulario de producto no envía con `precio <= 0` o nombre vacío, y no llama a la API |
| 2 | El total del carrito se recalcula al agregar y quitar líneas |
| 3 | "Confirmar venta" está deshabilitado con el carrito vacío |
| 4 | Una ruta protegida redirige a `/login` sin token |

Los tests de backend **no necesitan MySQL levantado**: la capa `models/` se
mockea con `vi.mock`. Esto tiene una contracara deliberada — ver
`decisiones.md`.

## Estructura

```
backend/
  src/config/      env.js (valida las 7 variables) y db.js (pool de mysql2)
  src/models/      SQL parametrizado. Nunca ve req ni res.
  src/services/    Reglas de negocio, transacciones y validaciones.js compartido.
  src/controllers/ HTTP. Nunca ve SQL.
  src/routes/      Rutas + el middleware de auth, montado una sola vez.
  src/middlewares/ auth.js y errorHandler.js
  db/init.sql      Esquema y semilla
  tests/
frontend/
  src/api/         Único lugar que llama a fetch
  src/context/     AuthContext
  src/components/  RutaProtegida, Nav
  src/hooks/       useRecurso (ciclo de API compartido por Productos y Clientes)
  src/pages/       Login, Productos, Clientes, NuevaVenta, Ventas
  tests/
  nginx.conf       try_files del SPA + proxy inverso de /api
docker-compose.yml
```

## Verificación end-to-end realizada

Contra los tres contenedores levantados con `docker compose up -d --build`, y
**re-corrida entera** después de los últimos cambios al `Dockerfile` del backend
y al healthcheck del compose (una imagen distinta invalida la verificación
anterior):

| Paso | Resultado real |
|------|----------------|
| `docker compose ps` | `db` `(healthy)`, `backend` `Up`, `frontend` `Up` |
| `GET http://localhost:8080/` | `200`, 396 bytes (el `index.html` del SPA) |
| Login `admin@erp.local` / `Admin123!` | `200` con el JWT y `{"id":1,"email":"admin@erp.local"}` |
| Alta de producto (`9500.55`, stock 20) | `201`, `id: 3` |
| Venta de 3 unidades | `201`, `total: 28501.65`, stock **20 → 17** |
| Anulación de esa venta | `200`, `stock_repuesto: true`, stock **17 → 20** |
| Segunda anulación de la misma venta | `409` `{"error":{"code":"VENTA_YA_ANULADA",...}}` |
| `docker compose exec backend whoami` | `node` (uid 1000) — el backend **no corre como root** |

El total `28501.65` no es decorativo: `3 × 9500.55` da `28501.649999999998` en
punto flotante. Que la respuesta traiga exactamente `28501.65` es la regla de
redondeo de dinero funcionando contra MySQL real, no contra un mock.

Los números de esta tabla son los de **esa corrida**, no un guion a repetir:
`evidencias.md` documenta el mismo recorrido paso a paso para las capturas de la
defensa, enunciando en cada una la relación que tiene que probar (que el stock
baja exactamente en la cantidad vendida, que la anulación lo devuelve a su valor
previo) en vez de un valor fijo, porque cada persona que lo repita va a hacerlo
con sus propios datos.
