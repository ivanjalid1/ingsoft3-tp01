# ERP mínimo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el ERP mínimo (clientes, productos, ventas) con backend Express + MySQL, frontend React + Vite y los tres contenedores de Docker, cubriendo los 8 tests de backend y los 4 de frontend que exige el TP5.

**Architecture:** Backend MVC en tres capas con frontera dura — `controllers/` nunca ve SQL, `models/` nunca ve `req`/`res`, y toda la lógica de negocio vive en `services/`. Esa frontera es la que permite mockear `models/` y correr los tests sin MySQL levantado. El frontend es un SPA que llama siempre a rutas relativas `/api/...`; quien resuelve a dónde va `/api` es el proxy (Vite en desarrollo, nginx en producción), así que el frontend no tiene ni una variable de entorno.

**Tech Stack:** Node.js 20 + Express 4 + `mysql2` (SQL a mano) + `bcrypt` + `jsonwebtoken` · React 18 + Vite 5 + React Router 6 · MySQL 8 (InnoDB, utf8mb4) · Vitest + supertest + React Testing Library · Docker + Docker Compose + nginx.

**Spec:** `docs/superpowers/specs/2026-08-13-erp-minimo-design.md`

**Raíz del repositorio:** `C:\Users\ADMIN\ingsoft3-tp01`. Todas las rutas de este plan son relativas a esa carpeta. El `app/` que aparece como raíz en el §4 del spec **es** esta raíz: `decisiones.md`, `evidencias.md` y `README.md` ya existen ahí desde el TP1.

---

## Global Constraints

Valores copiados textuales del spec. Aplican a **todas** las tareas.

- **Runtime backend:** Node.js 20, ESM (`"type": "module"` en `package.json`).
- **Frontend:** React 18 + Vite. Build estático servido por nginx.
- **Base de datos:** MySQL 8, motor `InnoDB`, charset `utf8mb4`, collation `utf8mb4_unicode_ci`.
- **Acceso a datos:** `mysql2` con SQL escrito a mano. **Nunca** se concatena input de usuario en una query: siempre placeholders `?`. Sin ORM, sin migraciones.
- **Regla dura de capas:** el controller nunca ve SQL. El model nunca ve `req` ni `res`. El service no importa Express ni `config/db.js`.
- **Errores:** los services lanzan `AppError(status, code, message)`. Los controllers hacen `next(err)`. `middlewares/errorHandler.js` es el **único** traductor error → JSON. Contrato: `{ "error": { "code": "...", "message": "..." } }`. Lo no previsto sale como `500 / ERROR_INTERNO` sin stack trace en la respuesta.
- **Auth:** JWT **HS256**, firmado con `JWT_SECRET`, expiración **8 horas**, payload `{ sub: usuario.id, email }`. Hash `bcrypt` con **cost 10**. Un solo rol. Sin registro público. `SELECT *` sobre `usuarios` está prohibido: el `password_hash` nunca sale de la API.
- **Middleware de auth:** se monta **una sola vez** en `routes/index.js`, protegiendo todo `/api` salvo `/api/auth/login`. Nunca endpoint por endpoint.
- **Env vars del backend (las siete, obligatorias, SIN defaults):** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`. Prohibido `process.env.X || 'default'`. Si falta una, el proceso muere en el arranque con `process.exit(1)` y un mensaje que dice cuál.
- **Env vars del frontend:** **ninguna**. Cero. Rutas relativas + proxy.
- **`config/env.js` es la única puerta a `process.env`.** Ningún otro archivo lee `process.env`.
- **Puertos:** backend Express `3000` · MySQL `3306` · nginx del frontend `80`, publicado en el host como `8080`. El backend **no** publica puertos al host.
- **Credenciales del compose:** `MYSQL_ROOT_PASSWORD: rootpass`, `MYSQL_DATABASE: erp`, `MYSQL_USER: erp_user`, `MYSQL_PASSWORD: erp_pass`, `JWT_SECRET: dev-secret-cambiar-en-prod`.
- **Usuario sembrado:** `admin@erp.local` / contraseña `Admin123!` (hash bcrypt cost 10 generado a mano, ver Tarea 2).
- **Tests:** un solo runner, **Vitest**, de los dos lados. `npm test` es `vitest run` (una pasada, sin watch) para que el pipeline del TP4 no quede colgado. Los 8 tests de backend corren **sin MySQL levantado**: la capa `models/` se mockea con `vi.mock`.
- **Sin CORS.** No se instala ni se usa el paquete `cors`. Todo es mismo origen gracias al proxy.
- **Idioma del código:** identificadores del dominio en español (`nombre`, `precio`, `stock`, `ventas`, `crear`, `anular`). Se respeta la convención del ecosistema donde corresponde (`default`, `props`, `useState`).
- **Commits:** conventional commits, en español, uno por tarea terminada como mínimo.
- **Shell:** el alumno está en Windows con PowerShell 5.1, donde `&&` **no existe**. Por eso los comandos de este plan van en líneas separadas (`cd backend` y después `npm test`), no encadenados.
- **Rama:** `main` está protegida desde el TP1. Todo el trabajo va en la rama `feature/erp-minimo` y entra por Pull Request.

---

## File Structure

### Backend — `backend/`

| Archivo | Responsabilidad |
|---------|-----------------|
| `package.json` | Manifiesto, dependencias y scripts (`start`, `dev`, `test`, `test:watch`). |
| `vitest.config.js` | Config de Vitest para Node + las 7 env vars falsas que necesitan los tests. |
| `.env.example` | Las 7 variables con valores de ejemplo. Se versiona. |
| `src/config/env.js` | Única puerta a `process.env`. Valida las 7 obligatorias y aborta si falta alguna. Exporta `env` y la función pura `faltantesDeEnv`. |
| `src/config/db.js` | Crea el pool de `mysql2/promise` a partir de `env`. No conoce `process.env`. |
| `src/utils/AppError.js` | `Error` con `status` y `code`. Lo único que los services lanzan a propósito. |
| `src/middlewares/errorHandler.js` | Único traductor error → JSON. |
| `src/middlewares/auth.js` | Valida `Authorization: Bearer <token>` y setea `req.usuario`. |
| `src/models/usuarioModel.js` | SQL de `usuarios`. Solo el método del login trae el hash. |
| `src/models/clienteModel.js` | SQL de `clientes`, incluida la baja lógica. |
| `src/models/productoModel.js` | SQL de `productos`: CRUD, `SELECT ... FOR UPDATE`, descuento y reposición de stock. |
| `src/models/ventaModel.js` | SQL de `ventas` y `venta_items` + `obtenerConexion()` (la única puerta al pool para transacciones). |
| `src/services/authService.js` | Login: bcrypt + firma del JWT. Descarta el hash antes de devolver. |
| `src/services/clienteService.js` | Validaciones y unicidad de email. |
| `src/services/productoService.js` | Validaciones de nombre, precio y stock. |
| `src/services/ventaService.js` | Reglas 1 a 6, transacción de creación y transición de anulación. |
| `src/controllers/authController.js` | HTTP del login. |
| `src/controllers/clienteController.js` | HTTP del ABM de clientes. |
| `src/controllers/productoController.js` | HTTP del ABM de productos. |
| `src/controllers/ventaController.js` | HTTP de ventas + anular. |
| `src/routes/index.js` | Monta los routers y **el middleware de auth, una sola vez**. |
| `src/routes/authRoutes.js` | `POST /login`. Público. |
| `src/routes/clienteRoutes.js` | Las 5 rutas de clientes. |
| `src/routes/productoRoutes.js` | Las 5 rutas de productos. |
| `src/routes/ventaRoutes.js` | Las 4 rutas de ventas. |
| `src/app.js` | Arma Express y **exporta** la instancia. No abre ningún puerto. |
| `src/server.js` | Importa la app y hace `listen(env.PORT)`. |
| `db/init.sql` | DDL de las 5 tablas + semilla del admin y datos de demo. |
| `tests/env.test.js` | Validación de env vars y health. No cuenta para los 8. |
| `tests/auth.test.js` | Test 8 (login inválido, hash ausente) + el extra del middleware. |
| `tests/clientes.test.js` | Test 7 (email duplicado). |
| `tests/productos.test.js` | Validación de precio. No cuenta para los 8. |
| `tests/ventas.test.js` | Tests 1, 2, 3, 4 (crear) y 5, 6 (anular). |
| `Dockerfile` | Una sola etapa. `package*.json` antes que `src/`. |
| `.dockerignore` | Deja afuera `node_modules`, `tests`, `.env`, `.git`, `coverage`. |

### Frontend — `frontend/`

| Archivo | Responsabilidad |
|---------|-----------------|
| `package.json` | Manifiesto y scripts (`dev`, `build`, `preview`, `test`, `test:watch`). |
| `vite.config.js` | Plugin de React, **proxy de `/api` a `http://localhost:3000`** y config de Vitest (jsdom). |
| `index.html` | Punto de entrada del SPA. |
| `src/main.jsx` | Monta React, `BrowserRouter` y `AuthProvider`. |
| `src/App.jsx` | Tabla de rutas. Exporta el componente sin Router adentro, para poder testear con `MemoryRouter`. |
| `src/estilos.css` | Estilos mínimos de toda la app. Un solo archivo, sin framework de CSS. |
| `src/api/client.js` | Único lugar que llama a `fetch`. Arma `/api/...`, adjunta el `Bearer`, parsea y convierte cualquier no-2xx en un `ApiError`. |
| `src/context/AuthContext.jsx` | `{ token, usuario, login, logout }`. Lee `localStorage` al montar. |
| `src/components/RutaProtegida.jsx` | Sin token → `<Navigate to="/login" />`. |
| `src/components/Nav.jsx` | Barra de navegación + botón de logout. |
| `src/pages/Login.jsx` | Formulario de login. Pública. |
| `src/pages/Productos.jsx` | ABM de productos con validación de formulario. |
| `src/pages/Clientes.jsx` | ABM de clientes. |
| `src/pages/NuevaVenta.jsx` | Selector de cliente y producto, carrito y total en vivo. |
| `src/pages/Ventas.jsx` | Listado con detalle expandible y botón "Anular". |
| `tests/setup.js` | `jest-dom`, `cleanup` y limpieza de `localStorage` entre tests. |
| `tests/rutaProtegida.test.jsx` | Test frontend 4. |
| `tests/productos.test.jsx` | Test frontend 1. |
| `tests/nuevaVenta.test.jsx` | Tests frontend 2 y 3. |
| `Dockerfile` | Multi-stage: Node buildea, nginx sirve. |
| `nginx.conf` | `try_files` para el SPA + proxy inverso de `/api`. |
| `.dockerignore` | Deja afuera `node_modules`, `dist`, `.env`, `.git`, `coverage`. |

### Raíz del repositorio

| Archivo | Responsabilidad |
|---------|-----------------|
| `docker-compose.yml` | Los tres servicios: `db`, `backend`, `frontend`. |
| `.gitignore` | Ya existe. Se le agregan `coverage/` y `*.log`. |
| `README.md` | Ya existe. Se reescribe con las instrucciones de arranque. |
| `decisiones.md` | Ya existe. Se le agregan las decisiones del ERP y la declaración de uso de IA. |
| `evidencias.md` | Ya existe. Se le agrega la evidencia de la app funcionando. |

---

## Tarea 1: Scaffold del backend, `config/env.js` y health

**Files:**
- Create: `backend/package.json`
- Create: `backend/vitest.config.js`
- Create: `backend/.env.example`
- Create: `backend/src/config/env.js`
- Create: `backend/src/config/db.js`
- Create: `backend/src/utils/AppError.js`
- Create: `backend/src/middlewares/errorHandler.js`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`
- Modify: `.gitignore`
- Test: `backend/tests/env.test.js`

**Interfaces:**
- Consumes: nada (es la primera tarea).
- Produces:
  - `backend/src/config/env.js` → `export const REQUERIDAS: string[]` (los 7 nombres, en ese orden); `export function faltantesDeEnv(fuente: Record<string,string|undefined>): string[]`; `export const env: { DB_HOST: string, DB_PORT: number, DB_USER: string, DB_PASSWORD: string, DB_NAME: string, JWT_SECRET: string, PORT: number }`.
  - `backend/src/config/db.js` → `export const pool` (pool de `mysql2/promise`).
  - `backend/src/utils/AppError.js` → `export class AppError extends Error { constructor(status: number, code: string, message: string); status: number; code: string }`.
  - `backend/src/middlewares/errorHandler.js` → `export function errorHandler(err, req, res, next): void`.
  - `backend/src/app.js` → `export const app` y `export default app` (instancia de Express, **sin** `listen`).

- [ ] **Paso 1: Crear la rama de trabajo**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git switch -c feature/erp-minimo
```

- [ ] **Paso 2: Crear `backend/package.json`**

```json
{
  "name": "erp-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Backend del ERP mínimo — IngSoft3 UCC 2026",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.11.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Paso 3: Instalar dependencias**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm install
```

Esperado: se crea `node_modules/` y `package-lock.json` sin errores. `package-lock.json` **se versiona** (el `npm ci` del Dockerfile y del pipeline del TP4 lo necesitan).

- [ ] **Paso 4: Crear `backend/vitest.config.js`**

Los tests importan `config/env.js`, que aborta el proceso si falta una variable. Estas siete variables falsas viven acá y solo acá: no se pisa el `.env` del alumno ni hace falta que exista.

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Variables de entorno SOLO para los tests. No apuntan a ninguna base real:
    // la capa models/ está mockeada, así que nadie abre una conexión.
    env: {
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'erp_test',
      JWT_SECRET: 'secreto-de-test',
      PORT: '3000'
    }
  }
});
```

- [ ] **Paso 5: Escribir el test que falla**

Crear `backend/tests/env.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { faltantesDeEnv, REQUERIDAS } from '../src/config/env.js';
import app from '../src/app.js';

describe('config/env', () => {
  it('lista las siete variables obligatorias', () => {
    expect(REQUERIDAS).toEqual([
      'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD',
      'DB_NAME', 'JWT_SECRET', 'PORT'
    ]);
  });

  it('devuelve las variables que faltan', () => {
    expect(faltantesDeEnv({ DB_HOST: 'localhost' })).toEqual([
      'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'PORT'
    ]);
  });

  it('no devuelve nada cuando están todas', () => {
    const completo = Object.fromEntries(REQUERIDAS.map((clave) => [clave, 'valor']));
    expect(faltantesDeEnv(completo)).toEqual([]);
  });

  it('trata el string vacío como faltante', () => {
    const completo = Object.fromEntries(REQUERIDAS.map((clave) => [clave, 'valor']));
    expect(faltantesDeEnv({ ...completo, JWT_SECRET: '' })).toEqual(['JWT_SECRET']);
  });
});

describe('GET /health', () => {
  it('devuelve 200 y status ok', async () => {
    const respuesta = await request(app).get('/health');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Paso 6: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: FAIL. Vitest no puede ni cargar el archivo: `Error: Failed to resolve import "../src/config/env.js" from "tests/env.test.js". Does the file exist?`

- [ ] **Paso 7: Crear `backend/src/config/env.js`**

```js
import 'dotenv/config';

// Las siete variables que el backend necesita para arrancar. Sin defaults:
// si falta una, es mejor morir acá que fallar en la primera request.
export const REQUERIDAS = [
  'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD',
  'DB_NAME', 'JWT_SECRET', 'PORT'
];

// Función pura: recibe el objeto de variables y devuelve las que faltan.
// Está separada del chequeo de abajo justamente para poder testearla
// sin matar el proceso de test.
export function faltantesDeEnv(fuente) {
  return REQUERIDAS.filter((clave) => !fuente[clave]);
}

const faltantes = faltantesDeEnv(process.env);

if (faltantes.length > 0) {
  console.error(
    `[config] Faltan variables de entorno obligatorias: ${faltantes.join(', ')}.\n` +
    `[config] Copiá .env.example a .env y completalas, o pasalas desde docker-compose.`
  );
  process.exit(1);
}

export const env = {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: Number(process.env.DB_PORT),
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: Number(process.env.PORT)
};
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué no le ponés un valor por defecto a `DB_HOST`?"**
> Porque un default convierte un error de configuración en un bug de aplicación. Si en el TP6 me olvido de setear `DB_HOST` en PROD, con default la app arranca "bien", se conecta al `localhost` del propio contenedor, no hay base ahí y el error aparece recién en la primera request disfrazado de error de app. Sin default el contenedor muere en el arranque diciendo exactamente qué variable falta, y eso lo veo en la primera línea de `docker compose logs backend`. Fallar temprano y ruidoso es más barato que fallar tarde y en silencio.

- [ ] **Paso 8: Crear `backend/src/config/db.js`**

```js
import mysql from 'mysql2/promise';
import { env } from './env.js';

// createPool no abre ninguna conexión: las abre recién en la primera query.
// Por eso importar este archivo en los tests es inofensivo.
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

- [ ] **Paso 9: Crear `backend/src/utils/AppError.js`**

```js
// Error de dominio: lleva el status HTTP y el code del contrato de error.
// Es lo único que los services lanzan a propósito; cualquier otra cosa
// que explote es un error no previsto y sale como 500.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
```

- [ ] **Paso 10: Crear `backend/src/middlewares/errorHandler.js`**

```js
import { AppError } from '../utils/AppError.js';

// ÚNICO lugar de todo el backend que traduce un error a una respuesta HTTP.
// Express reconoce un manejador de errores por tener cuatro parámetros:
// si le sacás `next`, deja de ser error handler y no se ejecuta nunca.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message }
    });
  }

  // Error no previsto: se loguea entero del lado del servidor y al cliente
  // le sale un mensaje genérico. El stack trace no se filtra nunca.
  console.error('[error]', err);
  return res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' }
  });
}
```

- [ ] **Paso 11: Crear `backend/src/app.js`**

```js
import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

app.use(express.json());

// Health check: fuera de /api a propósito, así la regla "todo /api pide token
// salvo el login" se mantiene sin excepciones. Sirve para verificar a mano que
// el contenedor del backend está vivo.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 para cualquier ruta que no exista, con el mismo contrato de error.
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'RUTA_NO_ENCONTRADA',
      message: `No existe ${req.method} ${req.originalUrl}`
    }
  });
});

app.use(errorHandler);

export default app;
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué `app.js` está separado de `server.js`?"**
> Porque `app.js` exporta la instancia de Express sin abrir ningún puerto, y eso es lo que hace testeable el backend: supertest hace `request(app).post('/api/ventas')` levantando la app en memoria. Si el `listen()` estuviera en el mismo archivo, cada archivo de test abriría un puerto TCP, competirían entre sí y quedarían procesos colgados. `server.js` es tres líneas y es lo único que no se testea.

- [ ] **Paso 12: Crear `backend/src/server.js`**

```js
import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`[server] escuchando en el puerto ${env.PORT}`);
});
```

- [ ] **Paso 13: Correr el test y verificar que pasa**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: PASS. `Test Files 1 passed (1)` · `Tests 5 passed (5)`.

- [ ] **Paso 14: Crear `backend/.env.example`**

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=erp
JWT_SECRET=dev-secret-no-usar-en-prod
PORT=3000
```

- [ ] **Paso 15: Agregar `coverage/` y `*.log` al `.gitignore` de la raíz**

Abrir `.gitignore` (raíz del repo) y reemplazar el bloque de dependencias por este, dejando el resto del archivo intacto:

```
# dependencias y artefactos de build
node_modules/
bin/
obj/
dist/
build/
coverage/
*.log
```

- [ ] **Paso 16: Verificar que `.env` no se versiona**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git status --short
```

Esperado: aparecen `backend/package.json`, `backend/.env.example`, `backend/src/...`, `backend/tests/...` y `.gitignore`. **No** aparece `backend/node_modules/` ni ningún `.env`.

- [ ] **Paso 17: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add .gitignore backend/package.json backend/package-lock.json backend/vitest.config.js backend/.env.example backend/src backend/tests
git commit -m "chore(backend): scaffold con Express, Vitest y validacion de entorno"
```

---

## Tarea 2: Esquema de la base y semilla del admin

**Files:**
- Create: `backend/db/init.sql`

**Interfaces:**
- Consumes: nada de código. Es SQL puro.
- Produces: el esquema que asumen todos los models de las tareas 3 a 7. Nombres exactos de tablas y columnas:
  - `usuarios(id, email, password_hash, created_at)`
  - `clientes(id, nombre, email, telefono, activo)`
  - `productos(id, nombre, precio, stock, activo)`
  - `ventas(id, cliente_id, fecha, total, estado)` con `estado ENUM('pendiente','anulada')`
  - `venta_items(id, venta_id, producto_id, cantidad, precio_unitario, subtotal)`

- [ ] **Paso 1: Generar el hash bcrypt de la contraseña del admin**

Las dependencias ya están instaladas desde la Tarea 1, así que `bcrypt` se puede usar desde la carpeta del backend:

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
node -e "console.log(require('bcrypt').hashSync('Admin123!',10))"
```

Esperado: una línea de 60 caracteres que empieza con `$2b$10$`. Copiala: es la que va en el `INSERT` del paso 3.

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el hash del `init.sql` no es el mismo que el mío?"**
> Porque bcrypt genera un **salt aleatorio** en cada hasheo y lo guarda dentro del propio hash (`$2b$10$<22 chars de salt><31 chars de hash>`). Dos hashes distintos de la misma contraseña son los dos válidos, y `bcrypt.compare` funciona con cualquiera porque saca el salt del hash antes de comparar. El salt existe para que dos usuarios con la misma contraseña no tengan el mismo hash, y para que no sirvan las rainbow tables. El `10` es el cost: bcrypt hace 2^10 iteraciones, y es deliberadamente lento para encarecer la fuerza bruta.

- [ ] **Paso 2: Verificar que el hash generado es correcto**

Reemplazar `<hash>` por el hash del paso anterior:

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
node -e "console.log(require('bcrypt').compareSync('Admin123!','<hash>'))"
```

Esperado: `true`.

- [ ] **Paso 3: Crear `backend/db/init.sql`**

Pegar el hash del paso 1 en el `INSERT INTO usuarios` (donde dice `$2b$10$REEMPLAZAR...`).

```sql
-- ============================================================
-- ERP mínimo — esquema inicial
-- MySQL lo ejecuta automáticamente en el PRIMER arranque del
-- contenedor, por estar montado en /docker-entrypoint-initdb.d/
-- ============================================================

CREATE DATABASE IF NOT EXISTS erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE erp;

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(60)  NOT NULL,           -- bcrypt = exactamente 60 chars
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- clientes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  nombre   VARCHAR(150) NOT NULL,
  email    VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(30)  NULL,
  activo   BOOLEAN      NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- productos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150)   NOT NULL,
  precio DECIMAL(10,2)  NOT NULL,
  stock  INT            NOT NULL DEFAULT 0,
  activo BOOLEAN        NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- ventas (cabecera)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT           NOT NULL,
  fecha      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estado     ENUM('pendiente','anulada') NOT NULL DEFAULT 'pendiente',
  CONSTRAINT fk_ventas_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- venta_items (detalle)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  venta_id        INT           NOT NULL,
  producto_id     INT           NOT NULL,
  cantidad        INT           NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,  -- congelado al momento de la venta
  subtotal        DECIMAL(10,2) NOT NULL,  -- cantidad * precio_unitario
  CONSTRAINT fk_items_venta
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_items_producto
    FOREIGN KEY (producto_id) REFERENCES productos(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_items_venta ON venta_items (venta_id);
CREATE INDEX idx_ventas_cliente ON ventas (cliente_id);

-- ============================================================
-- Semilla: usuario admin
-- ------------------------------------------------------------
-- El hash de abajo corresponde a la contraseña 'Admin123!' con
-- bcrypt cost 10. bcrypt usa salt aleatorio, así que CADA máquina
-- genera un hash distinto y todos son válidos.
--
-- Generá el tuyo y pegalo acá antes del primer `docker compose up`:
--   node -e "console.log(require('bcrypt').hashSync('Admin123!',10))"
--
-- Verificá que quedó bien:
--   node -e "console.log(require('bcrypt').compareSync('Admin123!','<hash>'))"
-- ============================================================
INSERT INTO usuarios (email, password_hash) VALUES
  ('admin@erp.local', '$2b$10$REEMPLAZAR_POR_EL_HASH_QUE_GENERASTE_EN_EL_PASO_1')
ON DUPLICATE KEY UPDATE email = email;

-- Datos de prueba mínimos (útiles para la demo y el e2e del TP6)
INSERT INTO clientes (nombre, email, telefono) VALUES
  ('Cliente Demo', 'demo@cliente.local', '3510000000')
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO productos (nombre, precio, stock) VALUES
  ('Teclado',  15000.00, 20),
  ('Monitor',  180000.00, 5);
```

- [ ] **Paso 4: Verificar que el hash quedó pegado**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git diff --stat
```

Abrir `backend/db/init.sql` y confirmar que la línea del `INSERT INTO usuarios` **no** contiene el texto `REEMPLAZAR`. Si lo contiene, el login del TP va a fallar con `401` y vas a perder media hora buscando el bug en el backend.

> **Qué contestar si te preguntan esto en la defensa — "¿cómo se crea el esquema?"**
> La imagen oficial de MySQL ejecuta todos los `.sql` y `.sh` que encuentre en `/docker-entrypoint-initdb.d/` en el **primer** arranque, cuando el directorio de datos está vacío. Yo monto `init.sql` ahí desde el compose, así que `docker compose up` deja la base creada y sembrada sin ningún paso manual. El corolario importante: como los datos viven en el volumen nombrado `db_data`, si cambio el esquema el script **no** se vuelve a ejecutar; hay que hacer `docker compose down -v` para borrar el volumen y que se siembre de nuevo.

- [ ] **Paso 5: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add backend/db/init.sql
git commit -m "feat(db): esquema inicial de cinco tablas y semilla del admin"
```

---
## Tarea 3: Autenticación (test backend 8 + el extra del middleware)

**Files:**
- Create: `backend/src/models/usuarioModel.js`
- Create: `backend/src/services/authService.js`
- Create: `backend/src/controllers/authController.js`
- Create: `backend/src/routes/authRoutes.js`
- Create: `backend/src/routes/index.js`
- Create: `backend/src/middlewares/auth.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/auth.test.js`

**Interfaces:**
- Consumes:
  - `AppError` de `backend/src/utils/AppError.js` → `new AppError(status: number, code: string, message: string)`.
  - `env` de `backend/src/config/env.js` → `env.JWT_SECRET: string`.
  - `pool` de `backend/src/config/db.js`.
  - `app` de `backend/src/app.js`.
- Produces:
  - `usuarioModel.js` → `export async function buscarPorEmailConHash(email: string): Promise<{ id: number, email: string, password_hash: string } | null>`.
  - `authService.js` → `export async function login(email: string, password: string): Promise<{ token: string, usuario: { id: number, email: string } }>`.
  - `authController.js` → `export async function login(req, res, next): Promise<void>`.
  - `middlewares/auth.js` → `export function verificarToken(req, res, next): void` — setea `req.usuario = { id: number, email: string }`.
  - `routes/index.js` → `export default router` con `/auth` público y **todo lo demás detrás de `verificarToken`**.
  - Contrato HTTP: `POST /api/auth/login` con `{ email, password }` → `200 { token, usuario: { id, email } }`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `backend/tests/auth.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import * as usuarioModel from '../src/models/usuarioModel.js';

// La capa models/ se mockea entera: estos tests no necesitan MySQL.
vi.mock('../src/models/usuarioModel.js', () => ({
  buscarPorEmailConHash: vi.fn()
}));

// Hash REAL de 'Admin123!' con cost 10. Se calcula una vez al cargar el archivo
// y hace que el test ejercite bcrypt de verdad, no un doble.
const HASH_ADMIN = bcrypt.hashSync('Admin123!', 10);

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 8 del TP5 — Autorización ──────────────────────────────
  it('devuelve 401 con la contraseña incorrecta y no filtra el password_hash', async () => {
    usuarioModel.buscarPorEmailConHash.mockResolvedValue({
      id: 1,
      email: 'admin@erp.local',
      password_hash: HASH_ADMIN
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.local', password: 'contraseña-mal' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('CREDENCIALES_INVALIDAS');
    // La segunda mitad del test: el hash no aparece por ningún lado del body.
    expect(JSON.stringify(respuesta.body)).not.toContain('password_hash');
    expect(JSON.stringify(respuesta.body)).not.toContain(HASH_ADMIN);
  });

  it('devuelve 401 con el mismo code cuando el email no existe', async () => {
    usuarioModel.buscarPorEmailConHash.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@erp.local', password: 'Admin123!' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('devuelve 200 con token y usuario sin hash cuando las credenciales son válidas', async () => {
    usuarioModel.buscarPorEmailConHash.mockResolvedValue({
      id: 1,
      email: 'admin@erp.local',
      password_hash: HASH_ADMIN
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.local', password: 'Admin123!' });

    expect(respuesta.status).toBe(200);
    expect(typeof respuesta.body.token).toBe('string');
    expect(respuesta.body.usuario).toEqual({ id: 1, email: 'admin@erp.local' });
    expect(respuesta.body.usuario.password_hash).toBeUndefined();
  });

  it('devuelve 400 si falta el password', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@erp.local' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(usuarioModel.buscarPorEmailConHash).not.toHaveBeenCalled();
  });
});

// ── Test extra (no cuenta para los 8, pero cubre el middleware) ────
describe('middlewares/auth', () => {
  it('rechaza con 401 TOKEN_FALTANTE un endpoint protegido sin header', async () => {
    const respuesta = await request(app).get('/api/clientes');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('TOKEN_FALTANTE');
  });

  it('rechaza con 401 TOKEN_INVALIDO un token que no verifica', async () => {
    const respuesta = await request(app)
      .get('/api/clientes')
      .set('Authorization', 'Bearer esto-no-es-un-jwt');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('TOKEN_INVALIDO');
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: FAIL. `Error: Failed to resolve import "../src/models/usuarioModel.js" from "tests/auth.test.js". Does the file exist?`

- [ ] **Paso 3: Crear `backend/src/models/usuarioModel.js`**

Los models no tienen test unitario propio: son la capa que se mockea, y su SQL se verifica en el end-to-end del TP6 (§11.1 del spec). Se escriben como parte de la tarea cuyo test los ejercita a través del service.

```js
import { pool } from '../config/db.js';

// ÚNICO método de todo el backend que trae el password_hash.
// Lo usa el login y nadie más. Nunca hay un SELECT * sobre usuarios.
export async function buscarPorEmailConHash(email) {
  const [filas] = await pool.execute(
    'SELECT id, email, password_hash FROM usuarios WHERE email = ? LIMIT 1',
    [email]
  );
  return filas[0] ?? null;
}

// Columnas explícitas: acá el hash no aparece.
export async function buscarPorId(id) {
  const [filas] = await pool.execute(
    'SELECT id, email FROM usuarios WHERE id = ? LIMIT 1',
    [id]
  );
  return filas[0] ?? null;
}
```

- [ ] **Paso 4: Crear `backend/src/services/authService.js`**

```js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import * as usuarioModel from '../models/usuarioModel.js';

const EXPIRACION = '8h';

export async function login(email, password) {
  if (!email || !password) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'Faltan email o password');
  }

  const usuario = await usuarioModel.buscarPorEmailConHash(email);

  // Mismo code y mismo mensaje para "email inexistente" y "password mal":
  // si fueran distintos, cualquiera podría enumerar qué emails existen.
  if (!usuario) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos');
  }

  const token = jwt.sign(
    { sub: usuario.id, email: usuario.email },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: EXPIRACION }
  );

  // El hash se descarta acá: se arma un objeto nuevo con dos campos.
  return { token, usuario: { id: usuario.id, email: usuario.email } };
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué bcrypt y no un hash común como SHA-256?"**
> Porque SHA-256 está diseñado para ser **rápido**, y para contraseñas eso es exactamente lo que no querés: una GPU prueba miles de millones de SHA-256 por segundo. bcrypt es deliberadamente lento y su costo es configurable (el `10` son 2^10 iteraciones), así que encarece la fuerza bruta. Además incorpora un salt aleatorio dentro del propio hash, así que dos usuarios con la misma contraseña tienen hashes distintos y las rainbow tables no sirven. Y nunca desencripto nada: bcrypt es de una sola vía, `compare` vuelve a hashear el candidato con el mismo salt y compara.

> **Qué contestar si te preguntan esto en la defensa — "¿qué es el JWT y por qué no guardás sesión en el servidor?"**
> El JWT es un token firmado con `JWT_SECRET` usando HS256: lleva adentro `{ sub, email }` y una expiración de 8 horas. El backend no guarda nada — verifica la firma con el mismo secreto y con eso sabe que el token lo emitió él y que no fue modificado. Eso deja al backend **sin estado**, que es lo que permite correr varias instancias sin sesiones compartidas (importante para el TP6). Lo que está firmado no está cifrado: cualquiera puede leer el payload con base64, por eso adentro solo va el id y el email, nada sensible.

- [ ] **Paso 5: Crear `backend/src/controllers/authController.js`**

```js
import * as authService from '../services/authService.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const resultado = await authService.login(email, password);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Paso 6: Crear `backend/src/routes/authRoutes.js`**

```js
import { Router } from 'express';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/login', authController.login);

export default router;
```

- [ ] **Paso 7: Crear `backend/src/middlewares/auth.js`**

```js
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function verificarToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(
      401, 'TOKEN_FALTANTE', 'Falta el header Authorization: Bearer <token>'
    ));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.usuario = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    // jwt.verify lanza tanto si la firma no valida como si el token venció.
    return next(new AppError(401, 'TOKEN_INVALIDO', 'Token inválido o vencido'));
  }
}
```

- [ ] **Paso 8: Crear `backend/src/routes/index.js`**

Por ahora solo monta `/auth`. Las tareas 4, 5, 6 y 7 le agregan una línea cada una, **debajo** de `router.use(verificarToken)`.

```js
import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.js';
import authRoutes from './authRoutes.js';

const router = Router();

// Público: es el único endpoint al que se llega sin token.
router.use('/auth', authRoutes);

// De acá para abajo, todo pide token. El middleware se monta una sola vez:
// cualquier router nuevo que se agregue debajo queda protegido sin hacer nada.
router.use(verificarToken);

export default router;
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el middleware se monta una vez y no en cada ruta?"**
> Porque montarlo endpoint por endpoint hace que proteger una ruta nueva sea un acto de memoria, y algún día te la vas a olvidar: el bug resultante es un endpoint abierto, que es exactamente el hallazgo que busca el TP9. Montándolo una sola vez en `routes/index.js`, después del router público de `/auth`, el default es "protegido" y hay que hacer algo explícito para abrir algo. El default seguro es lo que no se puede olvidar.

- [ ] **Paso 9: Modificar `backend/src/app.js` para montar `/api`**

Contenido completo del archivo después del cambio:

```js
import express from 'express';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

export const app = express();

app.use(express.json());

// Health check: fuera de /api a propósito, así la regla "todo /api pide token
// salvo el login" se mantiene sin excepciones. Sirve para verificar a mano que
// el contenedor del backend está vivo.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', routes);

// 404 para cualquier ruta que no exista, con el mismo contrato de error.
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'RUTA_NO_ENCONTRADA',
      message: `No existe ${req.method} ${req.originalUrl}`
    }
  });
});

app.use(errorHandler);

export default app;
```

- [ ] **Paso 10: Correr los tests y verificar que pasan**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: PASS. `Test Files 2 passed (2)` · `Tests 11 passed (11)` (5 de `env.test.js` + 6 de `auth.test.js`).

Nota: los dos tests del middleware pegan a `GET /api/clientes`, que todavía no existe. Pasan igual, y eso es justamente lo que se quiere demostrar: el middleware corta **antes** de que Express busque la ruta, así que un endpoint inexistente tampoco filtra información sobre qué rutas hay.

- [ ] **Paso 11: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add backend/src backend/tests/auth.test.js
git commit -m "feat(auth): login con bcrypt y JWT, middleware de verificacion"
```

---

## Tarea 4: Clientes — CRUD completo (test backend 7)

**Files:**
- Create: `backend/src/models/clienteModel.js`
- Create: `backend/src/services/clienteService.js`
- Create: `backend/src/controllers/clienteController.js`
- Create: `backend/src/routes/clienteRoutes.js`
- Modify: `backend/src/routes/index.js`
- Test: `backend/tests/clientes.test.js`

**Interfaces:**
- Consumes:
  - `AppError` de `backend/src/utils/AppError.js` → `new AppError(status: number, code: string, message: string)`.
  - `pool` de `backend/src/config/db.js`.
  - `verificarToken` de `backend/src/middlewares/auth.js` — ya montado en `routes/index.js`, no hay que volver a aplicarlo.
  - Para los tests: el token se firma con `jwt.sign({ sub: 1, email: 'admin@erp.local' }, 'secreto-de-test', { expiresIn: '8h' })`, donde `'secreto-de-test'` es el `JWT_SECRET` de `vitest.config.js`.
- Produces:
  - Tipo `Cliente = { id: number, nombre: string, email: string, telefono: string | null, activo: boolean }`.
  - `clienteModel.js` →
    - `export async function listar(incluirInactivos: boolean): Promise<Cliente[]>`
    - `export async function buscarPorId(id: number): Promise<Cliente | null>`
    - `export async function buscarPorEmail(email: string): Promise<Cliente | null>`
    - `export async function crear(datos: { nombre: string, email: string, telefono?: string }): Promise<Cliente>`
    - `export async function actualizar(id: number, datos: { nombre: string, email: string, telefono?: string }): Promise<Cliente>`
    - `export async function desactivar(id: number): Promise<number>` (filas afectadas)
  - `clienteService.js` → `listar(incluirInactivos)`, `obtener(id)`, `crear(datos)`, `actualizar(id, datos)`, `desactivar(id)` — este último devuelve `{ id: number, activo: false }`.
  - `clienteController.js` → `listar`, `obtener`, `crear`, `actualizar`, `desactivar`, todos `(req, res, next)`.
  - Contrato HTTP: `GET /api/clientes` (`?incluir_inactivos=true`), `GET /api/clientes/:id`, `POST /api/clientes`, `PUT /api/clientes/:id`, `DELETE /api/clientes/:id`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `backend/tests/clientes.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import * as clienteModel from '../src/models/clienteModel.js';

vi.mock('../src/models/clienteModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorEmail: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn()
}));

// El mismo secreto que declara vitest.config.js.
const TOKEN = jwt.sign(
  { sub: 1, email: 'admin@erp.local' },
  'secreto-de-test',
  { algorithm: 'HS256', expiresIn: '8h' }
);

const CLIENTE_DEMO = {
  id: 1,
  nombre: 'Cliente Demo',
  email: 'demo@cliente.local',
  telefono: '3510000000',
  activo: true
};

describe('POST /api/clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 7 del TP5 — Restricción (unicidad) ────────────────────
  it('devuelve 409 EMAIL_DUPLICADO cuando el email ya existe y no inserta', async () => {
    clienteModel.buscarPorEmail.mockResolvedValue(CLIENTE_DEMO);

    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Otro', email: 'demo@cliente.local', telefono: '3511111111' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('EMAIL_DUPLICADO');
    expect(clienteModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 409 EMAIL_DUPLICADO si la base rechaza con ER_DUP_ENTRY', async () => {
    clienteModel.buscarPorEmail.mockResolvedValue(null);
    const errorDeMysql = new Error('Duplicate entry');
    errorDeMysql.code = 'ER_DUP_ENTRY';
    clienteModel.crear.mockRejectedValue(errorDeMysql);

    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Ana Pérez', email: 'ana@mail.com', telefono: '3511111111' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('EMAIL_DUPLICADO');
  });

  it('devuelve 201 con el cliente creado cuando los datos son válidos', async () => {
    clienteModel.buscarPorEmail.mockResolvedValue(null);
    clienteModel.crear.mockResolvedValue({
      id: 2, nombre: 'Ana Pérez', email: 'ana@mail.com',
      telefono: '3511111111', activo: true
    });

    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Ana Pérez', email: 'ana@mail.com', telefono: '3511111111' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: 2, nombre: 'Ana Pérez', email: 'ana@mail.com',
      telefono: '3511111111', activo: true
    });
  });

  it('devuelve 400 DATOS_INVALIDOS con el nombre vacío', async () => {
    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: '   ', email: 'ana@mail.com' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(clienteModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS con un email sin formato', async () => {
    const respuesta = await request(app)
      .post('/api/clientes')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Ana Pérez', email: 'ana-arroba-mail' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(clienteModel.crear).not.toHaveBeenCalled();
  });
});

describe('GET /api/clientes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 CLIENTE_NO_ENCONTRADO si no existe', async () => {
    clienteModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/clientes/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('CLIENTE_NO_ENCONTRADO');
  });
});

describe('DELETE /api/clientes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace baja lógica y devuelve activo en false', async () => {
    clienteModel.buscarPorId.mockResolvedValue(CLIENTE_DEMO);
    clienteModel.desactivar.mockResolvedValue(1);

    const respuesta = await request(app)
      .delete('/api/clientes/1')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id: 1, activo: false });
    expect(clienteModel.desactivar).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: FAIL. `Error: Failed to resolve import "../src/models/clienteModel.js" from "tests/clientes.test.js". Does the file exist?`

- [ ] **Paso 3: Crear `backend/src/models/clienteModel.js`**

```js
import { pool } from '../config/db.js';

const COLUMNAS = 'id, nombre, email, telefono, activo';

// MySQL devuelve BOOLEAN como 0/1. La conversión a booleano se hace acá,
// en un solo lugar, para que el resto del backend vea siempre true/false.
function aCliente(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    telefono: fila.telefono,
    activo: Boolean(fila.activo)
  };
}

export async function listar(incluirInactivos = false) {
  const sql = incluirInactivos
    ? `SELECT ${COLUMNAS} FROM clientes ORDER BY nombre`
    : `SELECT ${COLUMNAS} FROM clientes WHERE activo = 1 ORDER BY nombre`;
  const [filas] = await pool.query(sql);
  return filas.map(aCliente);
}

export async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM clientes WHERE id = ?`,
    [id]
  );
  return aCliente(filas[0]);
}

export async function buscarPorEmail(email) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM clientes WHERE email = ?`,
    [email]
  );
  return aCliente(filas[0]);
}

export async function crear({ nombre, email, telefono }) {
  const [resultado] = await pool.execute(
    'INSERT INTO clientes (nombre, email, telefono) VALUES (?, ?, ?)',
    [nombre, email, telefono ?? null]
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, { nombre, email, telefono }) {
  await pool.execute(
    'UPDATE clientes SET nombre = ?, email = ?, telefono = ? WHERE id = ?',
    [nombre, email, telefono ?? null, id]
  );
  return buscarPorId(id);
}

// Baja LÓGICA: no hay DELETE físico en toda la app.
export async function desactivar(id) {
  const [resultado] = await pool.execute(
    'UPDATE clientes SET activo = 0 WHERE id = ?',
    [id]
  );
  return resultado.affectedRows;
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el `DELETE` no borra?"**
> Porque `ventas.cliente_id` tiene una FK con `ON DELETE RESTRICT`: la base directamente no me deja borrar un cliente que tenga ventas, así que un borrado físico fallaría con un error de integridad. Y si la FK fuera `CASCADE`, borrar un cliente me borraría el historial de ventas, que es peor. El flag `activo` resuelve las dos cosas: el cliente desaparece de los selectores del frontend y las ventas viejas siguen siendo consultables. La restricción de la base me empujó a la decisión de diseño correcta.

- [ ] **Paso 4: Crear `backend/src/services/clienteService.js`**

```js
import { AppError } from '../utils/AppError.js';
import * as clienteModel from '../models/clienteModel.js';

// Validación deliberadamente simple: hay un @, hay un punto después y no hay
// espacios. Validar emails con una regex "completa" es un pozo sin fondo;
// la verificación real de un email es mandarle un mail.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarDatos({ nombre, email }) {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El nombre es obligatorio');
  }
  if (typeof email !== 'string' || !RE_EMAIL.test(email)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El email tiene formato inválido');
  }
}

export async function listar(incluirInactivos = false) {
  return clienteModel.listar(incluirInactivos);
}

export async function obtener(id) {
  const cliente = await clienteModel.buscarPorId(id);
  if (!cliente) {
    throw new AppError(404, 'CLIENTE_NO_ENCONTRADO', `No existe el cliente ${id}`);
  }
  return cliente;
}

export async function crear(datos) {
  validarDatos(datos);

  // Consulta previa: solo para dar un mensaje lindo.
  const existente = await clienteModel.buscarPorEmail(datos.email);
  if (existente) {
    throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${datos.email}`);
  }

  try {
    return await clienteModel.crear(datos);
  } catch (err) {
    // Garantía REAL: el UNIQUE de la base. Si dos requests entran en simultáneo,
    // las dos pasan la consulta previa y una de las dos rebota acá.
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${datos.email}`);
    }
    throw err;
  }
}

export async function actualizar(id, datos) {
  validarDatos(datos);
  await obtener(id); // lanza 404 si no existe

  const existente = await clienteModel.buscarPorEmail(datos.email);
  if (existente && existente.id !== Number(id)) {
    throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${datos.email}`);
  }

  try {
    return await clienteModel.actualizar(id, datos);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'EMAIL_DUPLICADO', `Ya existe un cliente con el email ${datos.email}`);
    }
    throw err;
  }
}

export async function desactivar(id) {
  await obtener(id); // lanza 404 si no existe
  await clienteModel.desactivar(id);
  return { id: Number(id), activo: false };
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué chequeás el email dos veces, con un SELECT y con un catch?"**
> Porque son dos cosas distintas. El `SELECT` previo existe para dar un mensaje claro en el caso normal. El `catch` del `ER_DUP_ENTRY` existe porque entre mi `SELECT` y mi `INSERT` hay una ventana: si dos requests llegan a la vez, las dos leen "no existe" y las dos intentan insertar. La garantía real es el `UNIQUE` de la base, que es atómico; mi consulta previa es cosmética. Si tuviera que sacar una de las dos, saco el `SELECT`, no el `catch`.

- [ ] **Paso 5: Crear `backend/src/controllers/clienteController.js`**

```js
import * as clienteService from '../services/clienteService.js';

export async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const clientes = await clienteService.listar(incluirInactivos);
    res.status(200).json(clientes);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const cliente = await clienteService.obtener(Number(req.params.id));
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, email, telefono } = req.body;
    const cliente = await clienteService.crear({ nombre, email, telefono });
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { nombre, email, telefono } = req.body;
    const cliente = await clienteService.actualizar(Number(req.params.id), { nombre, email, telefono });
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function desactivar(req, res, next) {
  try {
    const resultado = await clienteService.desactivar(Number(req.params.id));
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Paso 6: Crear `backend/src/routes/clienteRoutes.js`**

```js
import { Router } from 'express';
import * as clienteController from '../controllers/clienteController.js';

const router = Router();

router.get('/', clienteController.listar);
router.get('/:id', clienteController.obtener);
router.post('/', clienteController.crear);
router.put('/:id', clienteController.actualizar);
router.delete('/:id', clienteController.desactivar);

export default router;
```

- [ ] **Paso 7: Modificar `backend/src/routes/index.js`**

Contenido completo del archivo después del cambio:

```js
import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.js';
import authRoutes from './authRoutes.js';
import clienteRoutes from './clienteRoutes.js';

const router = Router();

// Público: es el único endpoint al que se llega sin token.
router.use('/auth', authRoutes);

// De acá para abajo, todo pide token. El middleware se monta una sola vez:
// cualquier router nuevo que se agregue debajo queda protegido sin hacer nada.
router.use(verificarToken);

router.use('/clientes', clienteRoutes);

export default router;
```

- [ ] **Paso 8: Correr los tests y verificar que pasan**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: PASS. `Test Files 3 passed (3)` · `Tests 18 passed (18)`.

- [ ] **Paso 9: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add backend/src backend/tests/clientes.test.js
git commit -m "feat(clientes): CRUD con baja logica y unicidad de email"
```

---
## Tarea 5: Productos — CRUD completo y operaciones de stock

**Files:**
- Create: `backend/src/models/productoModel.js`
- Create: `backend/src/services/productoService.js`
- Create: `backend/src/controllers/productoController.js`
- Create: `backend/src/routes/productoRoutes.js`
- Modify: `backend/src/routes/index.js`
- Test: `backend/tests/productos.test.js`

**Interfaces:**
- Consumes:
  - `AppError` de `backend/src/utils/AppError.js` → `new AppError(status: number, code: string, message: string)`.
  - `pool` de `backend/src/config/db.js`.
  - `verificarToken`, ya montado en `routes/index.js`.
- Produces:
  - Tipo `Producto = { id: number, nombre: string, precio: number, stock: number, activo: boolean }`.
  - `productoModel.js` →
    - `export async function listar(incluirInactivos: boolean): Promise<Producto[]>`
    - `export async function buscarPorId(id: number): Promise<Producto | null>`
    - `export async function buscarPorIdParaActualizar(conn, id: number): Promise<{ id: number, nombre: string, precio: number, stock: number } | null>` — hace `SELECT ... FOR UPDATE`, filtra por `activo = 1`
    - `export async function crear(datos: { nombre: string, precio: number, stock: number }): Promise<Producto>`
    - `export async function actualizar(id: number, datos: { nombre: string, precio: number, stock: number }): Promise<Producto>`
    - `export async function desactivar(id: number): Promise<number>`
    - `export async function descontarStock(conn, productoId: number, cantidad: number): Promise<number>`
    - `export async function reponerStock(conn, productoId: number, cantidad: number): Promise<number>`
  - `productoService.js` → `listar(incluirInactivos)`, `obtener(id)`, `crear(datos)`, `actualizar(id, datos)`, `desactivar(id)` — este último devuelve `{ id: number, activo: false }`.
  - `productoController.js` → `listar`, `obtener`, `crear`, `actualizar`, `desactivar`, todos `(req, res, next)`.
  - Contrato HTTP: `GET /api/productos`, `GET /api/productos/:id`, `POST /api/productos`, `PUT /api/productos/:id`, `DELETE /api/productos/:id`.

**Nota sobre `descontarStock` y `reponerStock`:** los usa la Tarea 6 (crear venta) y la Tarea 7 (anular venta), pero viven acá porque todo el SQL de `productos` va en un solo archivo. Reciben `conn` como **primer** argumento para poder participar de una transacción abierta afuera.

- [ ] **Paso 1: Escribir el test que falla**

Crear `backend/tests/productos.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import * as productoModel from '../src/models/productoModel.js';

vi.mock('../src/models/productoModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorIdParaActualizar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn(),
  descontarStock: vi.fn(),
  reponerStock: vi.fn()
}));

const TOKEN = jwt.sign(
  { sub: 1, email: 'admin@erp.local' },
  'secreto-de-test',
  { algorithm: 'HS256', expiresIn: '8h' }
);

describe('POST /api/productos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 400 DATOS_INVALIDOS con precio negativo y no inserta', async () => {
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: -5, stock: 30 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS con precio en cero', async () => {
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: 0, stock: 30 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 400 DATOS_INVALIDOS con stock negativo', async () => {
    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: 9500.5, stock: -1 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
    expect(productoModel.crear).not.toHaveBeenCalled();
  });

  it('devuelve 201 con el producto creado cuando los datos son válidos', async () => {
    productoModel.crear.mockResolvedValue({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });

    const respuesta = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ nombre: 'Mouse', precio: 9500.5, stock: 30 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });
    expect(productoModel.crear).toHaveBeenCalledWith({
      nombre: 'Mouse', precio: 9500.5, stock: 30
    });
  });
});

describe('GET /api/productos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 PRODUCTO_NO_ENCONTRADO si no existe', async () => {
    productoModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/productos/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
  });
});

describe('DELETE /api/productos/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace baja lógica y devuelve activo en false', async () => {
    productoModel.buscarPorId.mockResolvedValue({
      id: 3, nombre: 'Mouse', precio: 9500.5, stock: 30, activo: true
    });
    productoModel.desactivar.mockResolvedValue(1);

    const respuesta = await request(app)
      .delete('/api/productos/3')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id: 3, activo: false });
    expect(productoModel.desactivar).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: FAIL. `Error: Failed to resolve import "../src/models/productoModel.js" from "tests/productos.test.js". Does the file exist?`

- [ ] **Paso 3: Crear `backend/src/models/productoModel.js`**

```js
import { pool } from '../config/db.js';

const COLUMNAS = 'id, nombre, precio, stock, activo';

// mysql2 devuelve DECIMAL como STRING para no perder precisión.
// La conversión a número se hace acá, en un solo lugar.
function aProducto(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    precio: Number(fila.precio),
    stock: fila.stock,
    activo: Boolean(fila.activo)
  };
}

export async function listar(incluirInactivos = false) {
  const sql = incluirInactivos
    ? `SELECT ${COLUMNAS} FROM productos ORDER BY nombre`
    : `SELECT ${COLUMNAS} FROM productos WHERE activo = 1 ORDER BY nombre`;
  const [filas] = await pool.query(sql);
  return filas.map(aProducto);
}

export async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS} FROM productos WHERE id = ?`,
    [id]
  );
  return aProducto(filas[0]);
}

// Lectura DENTRO de una transacción. FOR UPDATE bloquea la fila hasta el
// commit o el rollback: dos ventas simultáneas no pueden leer el mismo stock
// y descontarlo las dos. Filtra por activo = 1: un producto dado de baja
// no se puede vender.
export async function buscarPorIdParaActualizar(conn, id) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    'SELECT id, nombre, precio, stock FROM productos WHERE id = ? AND activo = 1 FOR UPDATE',
    [id]
  );
  const fila = filas[0];
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    precio: Number(fila.precio),
    stock: fila.stock
  };
}

export async function crear({ nombre, precio, stock }) {
  const [resultado] = await pool.execute(
    'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
    [nombre, precio, stock]
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, { nombre, precio, stock }) {
  await pool.execute(
    'UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?',
    [nombre, precio, stock, id]
  );
  return buscarPorId(id);
}

export async function desactivar(id) {
  const [resultado] = await pool.execute(
    'UPDATE productos SET activo = 0 WHERE id = ?',
    [id]
  );
  return resultado.affectedRows;
}

// Las dos operaciones de stock reciben `conn` como PRIMER argumento para
// poder correr dentro de la transacción que abre ventaService. Sin eso,
// cada una tomaría una conexión distinta del pool y sus escrituras
// quedarían fuera de la transacción (y no las alcanzaría el rollback).
export async function descontarStock(conn, productoId, cantidad) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    'UPDATE productos SET stock = stock - ? WHERE id = ?',
    [cantidad, productoId]
  );
  return resultado.affectedRows;
}

export async function reponerStock(conn, productoId, cantidad) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    'UPDATE productos SET stock = stock + ? WHERE id = ?',
    [cantidad, productoId]
  );
  return resultado.affectedRows;
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué `DECIMAL` y no `FLOAT`, y por qué el `Number()`?"**
> `FLOAT` y `DOUBLE` son binarios: no pueden representar exactamente valores como 0,1, y sumando precios el error se acumula. Para plata eso es inaceptable, así que uso `DECIMAL(10,2)`, que guarda los dígitos exactos. Como `DECIMAL` puede exceder la precisión de un número de JavaScript, `mysql2` me lo devuelve como **string**; por eso convierto con `Number()` en un único lugar, el mapper del model, sobre un valor que ya viene redondeado a dos decimales. Si convirtiera en cada página, tendría la conversión repartida por todos lados.

- [ ] **Paso 4: Crear `backend/src/services/productoService.js`**

```js
import { AppError } from '../utils/AppError.js';
import * as productoModel from '../models/productoModel.js';

function validarDatos({ nombre, precio, stock }) {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El nombre es obligatorio');
  }
  if (typeof precio !== 'number' || Number.isNaN(precio) || precio <= 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El precio debe ser mayor a cero');
  }
  if (!Number.isInteger(stock) || stock < 0) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'El stock debe ser un entero mayor o igual a cero');
  }
}

export async function listar(incluirInactivos = false) {
  return productoModel.listar(incluirInactivos);
}

export async function obtener(id) {
  const producto = await productoModel.buscarPorId(id);
  if (!producto) {
    throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', `No existe el producto ${id}`);
  }
  return producto;
}

export async function crear(datos) {
  validarDatos(datos);
  return productoModel.crear(datos);
}

export async function actualizar(id, datos) {
  validarDatos(datos);
  await obtener(id); // lanza 404 si no existe
  return productoModel.actualizar(id, datos);
}

export async function desactivar(id) {
  await obtener(id); // lanza 404 si no existe
  await productoModel.desactivar(id);
  return { id: Number(id), activo: false };
}
```

> **Qué contestar si te preguntan esto en la defensa — "si cambio el precio de un producto, ¿qué pasa con las ventas viejas?"**
> Nada, y es a propósito. `venta_items.precio_unitario` guarda el precio **congelado** al momento de la venta, no una referencia a `productos.precio`. Si no lo congelara, cambiar un precio hoy reescribiría el histórico de ayer y el `total` de la cabecera dejaría de coincidir con la suma de sus ítems. La redundancia aparente entre `total`, `subtotal` y `precio_unitario` es intencional: son valores históricos, no cachés.

- [ ] **Paso 5: Crear `backend/src/controllers/productoController.js`**

```js
import * as productoService from '../services/productoService.js';

export async function listar(req, res, next) {
  try {
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const productos = await productoService.listar(incluirInactivos);
    res.status(200).json(productos);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const producto = await productoService.obtener(Number(req.params.id));
    res.status(200).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, precio, stock } = req.body;
    const producto = await productoService.crear({ nombre, precio, stock });
    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { nombre, precio, stock } = req.body;
    const producto = await productoService.actualizar(Number(req.params.id), { nombre, precio, stock });
    res.status(200).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function desactivar(req, res, next) {
  try {
    const resultado = await productoService.desactivar(Number(req.params.id));
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Paso 6: Crear `backend/src/routes/productoRoutes.js`**

```js
import { Router } from 'express';
import * as productoController from '../controllers/productoController.js';

const router = Router();

router.get('/', productoController.listar);
router.get('/:id', productoController.obtener);
router.post('/', productoController.crear);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.desactivar);

export default router;
```

- [ ] **Paso 7: Modificar `backend/src/routes/index.js`**

Contenido completo del archivo después del cambio:

```js
import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.js';
import authRoutes from './authRoutes.js';
import clienteRoutes from './clienteRoutes.js';
import productoRoutes from './productoRoutes.js';

const router = Router();

// Público: es el único endpoint al que se llega sin token.
router.use('/auth', authRoutes);

// De acá para abajo, todo pide token. El middleware se monta una sola vez:
// cualquier router nuevo que se agregue debajo queda protegido sin hacer nada.
router.use(verificarToken);

router.use('/clientes', clienteRoutes);
router.use('/productos', productoRoutes);

export default router;
```

- [ ] **Paso 8: Correr los tests y verificar que pasan**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: PASS. `Test Files 4 passed (4)` · `Tests 24 passed (24)`.

- [ ] **Paso 9: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add backend/src backend/tests/productos.test.js
git commit -m "feat(productos): CRUD con validaciones y operaciones de stock"
```

---

## Tarea 6: Ventas — crear con transacción (tests backend 1, 2, 3 y 4)

**Files:**
- Create: `backend/src/models/ventaModel.js`
- Create: `backend/src/services/ventaService.js`
- Create: `backend/src/controllers/ventaController.js`
- Create: `backend/src/routes/ventaRoutes.js`
- Modify: `backend/src/routes/index.js`
- Test: `backend/tests/ventas.test.js`

**Interfaces:**
- Consumes:
  - `AppError` de `backend/src/utils/AppError.js`.
  - `pool` de `backend/src/config/db.js`.
  - De `backend/src/models/clienteModel.js` (Tarea 4): `buscarPorId(id): Promise<Cliente | null>`, donde `Cliente` tiene `{ id, nombre, email, telefono, activo }`.
  - De `backend/src/models/productoModel.js` (Tarea 5): `buscarPorIdParaActualizar(conn, id): Promise<{ id, nombre, precio: number, stock: number } | null>` y `descontarStock(conn, productoId, cantidad): Promise<number>`.
- Produces:
  - Tipos:
    - `Cabecera = { id: number, cliente_id: number, cliente_nombre: string, fecha: string, total: number, estado: 'pendiente' | 'anulada' }`
    - `Item = { id: number, producto_id: number, producto_nombre: string, cantidad: number, precio_unitario: number, subtotal: number }`
    - `Venta = Cabecera & { items: Item[] }`
  - `ventaModel.js` →
    - `export async function obtenerConexion(): Promise<PoolConnection>` — **la única puerta al pool para transacciones**; los services nunca importan `config/db.js`
    - `export async function listar(): Promise<Cabecera[]>`
    - `export async function buscarCabecera(conn, id: number): Promise<Cabecera | null>`
    - `export async function listarItems(conn, ventaId: number): Promise<Item[]>`
    - `export async function crearCabecera(conn, clienteId: number, total: number): Promise<number>` (devuelve el `insertId`)
    - `export async function crearItem(conn, ventaId: number, item: { producto_id: number, cantidad: number, precio_unitario: number, subtotal: number }): Promise<number>`
    - `export async function marcarAnulada(conn, ventaId: number): Promise<number>` (filas afectadas)
  - `ventaService.js` →
    - `export async function listar(): Promise<Cabecera[]>`
    - `export async function obtener(ventaId: number): Promise<Venta>`
    - `export async function crear(clienteId: number, items: { producto_id: number, cantidad: number }[]): Promise<Venta>`
    - (`anular` llega en la Tarea 7)
  - `ventaController.js` → `listar`, `obtener`, `crear`, todos `(req, res, next)`.
  - Contrato HTTP: `GET /api/ventas`, `GET /api/ventas/:id`, `POST /api/ventas` con `{ cliente_id, items: [{ producto_id, cantidad }] }` → `201` con el mismo cuerpo que `GET /api/ventas/:id`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `backend/tests/ventas.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import * as ventaModel from '../src/models/ventaModel.js';
import * as clienteModel from '../src/models/clienteModel.js';
import * as productoModel from '../src/models/productoModel.js';

vi.mock('../src/models/ventaModel.js', () => ({
  obtenerConexion: vi.fn(),
  listar: vi.fn(),
  buscarCabecera: vi.fn(),
  listarItems: vi.fn(),
  crearCabecera: vi.fn(),
  crearItem: vi.fn(),
  marcarAnulada: vi.fn()
}));

vi.mock('../src/models/clienteModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorEmail: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn()
}));

vi.mock('../src/models/productoModel.js', () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorIdParaActualizar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  desactivar: vi.fn(),
  descontarStock: vi.fn(),
  reponerStock: vi.fn()
}));

const TOKEN = jwt.sign(
  { sub: 1, email: 'admin@erp.local' },
  'secreto-de-test',
  { algorithm: 'HS256', expiresIn: '8h' }
);

const CLIENTE = {
  id: 1, nombre: 'Cliente Demo', email: 'demo@cliente.local',
  telefono: '3510000000', activo: true
};

const TECLADO = { id: 1, nombre: 'Teclado', precio: 15000, stock: 20 };
const MONITOR = { id: 2, nombre: 'Monitor', precio: 180000, stock: 5 };

// Doble de la conexión de mysql2. Registra si se hizo commit o rollback,
// que es exactamente lo que hay que poder afirmar en el test 3.
function conexionFalsa() {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    execute: vi.fn().mockResolvedValue([[], []])
  };
}

describe('POST /api/ventas', () => {
  let conn;

  beforeEach(() => {
    vi.clearAllMocks();
    conn = conexionFalsa();
    ventaModel.obtenerConexion.mockResolvedValue(conn);
    clienteModel.buscarPorId.mockResolvedValue(CLIENTE);
  });

  // ── TEST 1 del TP5 — Validación ────────────────────────────────
  it('rechaza con 400 VENTA_SIN_ITEMS una venta sin ítems', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VENTA_SIN_ITEMS');
    // Ni siquiera se abrió una transacción.
    expect(ventaModel.obtenerConexion).not.toHaveBeenCalled();
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
  });

  // ── TEST 2 del TP5 — Validación ────────────────────────────────
  it('rechaza con 400 CANTIDAD_INVALIDA una cantidad en cero', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [{ producto_id: 1, cantidad: 0 }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('CANTIDAD_INVALIDA');
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
  });

  it('rechaza con 400 CANTIDAD_INVALIDA una cantidad negativa', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [{ producto_id: 1, cantidad: -3 }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('CANTIDAD_INVALIDA');
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
  });

  // ── TEST 3 del TP5 — Restricción / integridad transaccional ─────
  it('rechaza con 409 STOCK_INSUFICIENTE y NO descuenta stock de ningún ítem', async () => {
    // El primer ítem tiene stock de sobra; el segundo no. La venta entera
    // se cae y no se descuenta NADA, ni siquiera lo del primero.
    productoModel.buscarPorIdParaActualizar
      .mockResolvedValueOnce(TECLADO)                        // pide 2, hay 20
      .mockResolvedValueOnce({ ...MONITOR, stock: 1 });      // pide 3, hay 1

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        cliente_id: 1,
        items: [
          { producto_id: 1, cantidad: 2 },
          { producto_id: 2, cantidad: 3 }
        ]
      });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('STOCK_INSUFICIENTE');
    expect(productoModel.descontarStock).not.toHaveBeenCalled();
    expect(ventaModel.crearCabecera).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  // ── TEST 4 del TP5 — Cálculo ───────────────────────────────────
  it('crea la venta con 201, calcula el total y descuenta el stock exacto', async () => {
    productoModel.buscarPorIdParaActualizar
      .mockResolvedValueOnce(TECLADO)
      .mockResolvedValueOnce(MONITOR);
    ventaModel.crearCabecera.mockResolvedValue(7);
    ventaModel.crearItem.mockResolvedValue(1);
    ventaModel.buscarCabecera.mockResolvedValue({
      id: 7, cliente_id: 1, cliente_nombre: 'Cliente Demo',
      fecha: '2026-08-13T14:22:05.000Z', total: 210000, estado: 'pendiente'
    });
    ventaModel.listarItems.mockResolvedValue([
      { id: 1, producto_id: 1, producto_nombre: 'Teclado', cantidad: 2, precio_unitario: 15000, subtotal: 30000 },
      { id: 2, producto_id: 2, producto_nombre: 'Monitor', cantidad: 1, precio_unitario: 180000, subtotal: 180000 }
    ]);

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        cliente_id: 1,
        items: [
          { producto_id: 1, cantidad: 2 },
          { producto_id: 2, cantidad: 1 }
        ]
      });

    expect(respuesta.status).toBe(201);
    // 2 * 15000 + 1 * 180000 = 210000
    expect(ventaModel.crearCabecera).toHaveBeenCalledWith(conn, 1, 210000);
    expect(respuesta.body.total).toBe(210000);
    expect(respuesta.body.items).toHaveLength(2);

    // El precio se congela: el ítem lleva el precio leído del producto.
    expect(ventaModel.crearItem).toHaveBeenNthCalledWith(1, conn, 7, {
      producto_id: 1, cantidad: 2, precio_unitario: 15000, subtotal: 30000
    });
    expect(ventaModel.crearItem).toHaveBeenNthCalledWith(2, conn, 7, {
      producto_id: 2, cantidad: 1, precio_unitario: 180000, subtotal: 180000
    });

    // Y el stock se descuenta con las cantidades exactas.
    expect(productoModel.descontarStock).toHaveBeenNthCalledWith(1, conn, 1, 2);
    expect(productoModel.descontarStock).toHaveBeenNthCalledWith(2, conn, 2, 1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 404 PRODUCTO_NO_ENCONTRADO si el producto no existe o está inactivo', async () => {
    productoModel.buscarPorIdParaActualizar.mockResolvedValueOnce(null);

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: [{ producto_id: 99, cantidad: 1 }] });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('PRODUCTO_NO_ENCONTRADO');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 404 CLIENTE_NO_ENCONTRADO si el cliente no existe', async () => {
    clienteModel.buscarPorId.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 99, items: [{ producto_id: 1, cantidad: 1 }] });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('CLIENTE_NO_ENCONTRADO');
    expect(ventaModel.obtenerConexion).not.toHaveBeenCalled();
  });

  it('rechaza con 400 DATOS_INVALIDOS si items no es un array', async () => {
    const respuesta = await request(app)
      .post('/api/ventas')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ cliente_id: 1, items: 'dos teclados' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('DATOS_INVALIDOS');
  });
});

describe('GET /api/ventas/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 404 VENTA_NO_ENCONTRADA si no existe', async () => {
    ventaModel.buscarCabecera.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/ventas/99')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('VENTA_NO_ENCONTRADA');
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: FAIL. `Error: Failed to resolve import "../src/models/ventaModel.js" from "tests/ventas.test.js". Does the file exist?`

- [ ] **Paso 3: Crear `backend/src/models/ventaModel.js`**

```js
import { pool } from '../config/db.js';

function aCabecera(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    cliente_id: fila.cliente_id,
    cliente_nombre: fila.cliente_nombre,
    fecha: fila.fecha,
    total: Number(fila.total),
    estado: fila.estado
  };
}

function aItem(fila) {
  return {
    id: fila.id,
    producto_id: fila.producto_id,
    producto_nombre: fila.producto_nombre,
    cantidad: fila.cantidad,
    precio_unitario: Number(fila.precio_unitario),
    subtotal: Number(fila.subtotal)
  };
}

// ÚNICA puerta al pool para transacciones. Está acá y no en el service
// porque el service no puede conocer config/db.js: si lo conociera, no se
// podría mockear la capa de datos y los tests necesitarían MySQL.
export async function obtenerConexion() {
  return pool.getConnection();
}

export async function listar() {
  const [filas] = await pool.query(
    `SELECT v.id, v.cliente_id, c.nombre AS cliente_nombre, v.fecha, v.total, v.estado
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
      ORDER BY v.fecha DESC, v.id DESC`
  );
  return filas.map(aCabecera);
}

export async function buscarCabecera(conn, id) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    `SELECT v.id, v.cliente_id, c.nombre AS cliente_nombre, v.fecha, v.total, v.estado
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = ?`,
    [id]
  );
  return aCabecera(filas[0]);
}

export async function listarItems(conn, ventaId) {
  const c = conn ?? pool;
  const [filas] = await c.execute(
    `SELECT i.id, i.producto_id, p.nombre AS producto_nombre,
            i.cantidad, i.precio_unitario, i.subtotal
       FROM venta_items i
       JOIN productos p ON p.id = i.producto_id
      WHERE i.venta_id = ?
      ORDER BY i.id`,
    [ventaId]
  );
  return filas.map(aItem);
}

export async function crearCabecera(conn, clienteId, total) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    "INSERT INTO ventas (cliente_id, total, estado) VALUES (?, ?, 'pendiente')",
    [clienteId, total]
  );
  return resultado.insertId;
}

export async function crearItem(conn, ventaId, item) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
     VALUES (?, ?, ?, ?, ?)`,
    [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]
  );
  return resultado.insertId;
}

// El WHERE incluye el estado: aunque el service ya lo validó, la base
// tampoco deja anular dos veces. Devuelve 0 filas si ya estaba anulada.
export async function marcarAnulada(conn, ventaId) {
  const c = conn ?? pool;
  const [resultado] = await c.execute(
    "UPDATE ventas SET estado = 'anulada' WHERE id = ? AND estado = 'pendiente'",
    [ventaId]
  );
  return resultado.affectedRows;
}
```

- [ ] **Paso 4: Crear `backend/src/services/ventaService.js`**

```js
import { AppError } from '../utils/AppError.js';
import * as ventaModel from '../models/ventaModel.js';
import * as clienteModel from '../models/clienteModel.js';
import * as productoModel from '../models/productoModel.js';

// Los montos vienen de DECIMAL(10,2). Redondear a dos decimales después
// de cada operación evita que un 0.1 + 0.2 binario se cuele en el total.
function redondear(monto) {
  return Math.round(monto * 100) / 100;
}

function validarForma(clienteId, items) {
  if (!clienteId) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'Falta cliente_id');
  }
  if (!Array.isArray(items)) {
    throw new AppError(400, 'DATOS_INVALIDOS', 'items debe ser un array');
  }
  if (items.length === 0) {
    throw new AppError(400, 'VENTA_SIN_ITEMS', 'La venta no tiene ítems');
  }
  for (const item of items) {
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0) {
      throw new AppError(
        400, 'CANTIDAD_INVALIDA',
        `Cantidad inválida para el producto ${item.producto_id}`
      );
    }
  }
}

export async function listar() {
  return ventaModel.listar();
}

export async function obtener(ventaId) {
  const cabecera = await ventaModel.buscarCabecera(null, ventaId);
  if (!cabecera) {
    throw new AppError(404, 'VENTA_NO_ENCONTRADA', `No existe la venta ${ventaId}`);
  }
  const items = await ventaModel.listarItems(null, ventaId);
  return { ...cabecera, items };
}

export async function crear(clienteId, items) {
  // 1) Validaciones de forma: baratas y sin tocar la base.
  validarForma(clienteId, items);

  // 2) El cliente tiene que existir y estar activo.
  const cliente = await clienteModel.buscarPorId(clienteId);
  if (!cliente || !cliente.activo) {
    throw new AppError(404, 'CLIENTE_NO_ENCONTRADO', `No existe el cliente ${clienteId}`);
  }

  // 3) Todo lo que toca stock va adentro de UNA transacción.
  const conn = await ventaModel.obtenerConexion();
  try {
    await conn.beginTransaction();

    // 3.a) Primero se leen y bloquean todos los productos y se valida el
    // stock de todos. Recién después se escribe algo. Así, si el ítem 3
    // no tiene stock, los ítems 1 y 2 nunca llegaron a descontarse.
    let total = 0;
    const detalle = [];

    for (const item of items) {
      const producto = await productoModel.buscarPorIdParaActualizar(conn, item.producto_id);

      if (!producto) {
        throw new AppError(404, 'PRODUCTO_NO_ENCONTRADO', `No existe el producto ${item.producto_id}`);
      }
      if (item.cantidad > producto.stock) {
        throw new AppError(409, 'STOCK_INSUFICIENTE', `Stock insuficiente para el producto ${item.producto_id}`);
      }

      const precioUnitario = producto.precio;              // se congela acá
      const subtotal = redondear(item.cantidad * precioUnitario);
      total = redondear(total + subtotal);

      detalle.push({
        producto_id: producto.id,
        cantidad: item.cantidad,
        precio_unitario: precioUnitario,
        subtotal
      });
    }

    // 3.b) Escrituras.
    const ventaId = await ventaModel.crearCabecera(conn, clienteId, total);

    for (const linea of detalle) {
      await ventaModel.crearItem(conn, ventaId, linea);
      await productoModel.descontarStock(conn, linea.producto_id, linea.cantidad);
    }

    await conn.commit();

    return obtener(ventaId);
  } catch (err) {
    // Cualquier error deshace todo lo escrito en esta transacción.
    await conn.rollback();
    throw err;
  } finally {
    // Pase lo que pase, la conexión vuelve al pool. Sin esto, después de
    // diez errores el pool se queda sin conexiones y la app se cuelga.
    conn.release();
  }
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿cómo garantizás que no se descuente stock si la venta falla?"**
> Con una transacción explícita. Abro la conexión, hago `beginTransaction()`, y todo lo que sigue —lecturas bloqueantes, `INSERT` de la cabecera, `INSERT` de los ítems y los `UPDATE` de stock— va por **esa misma conexión**. Si cualquier paso lanza, el `catch` hace `rollback()` y la base vuelve al estado anterior como si nada hubiera pasado; el `finally` devuelve la conexión al pool en los dos caminos. Por eso los models reciben `conn` como primer parámetro: si cada uno tomara una conexión distinta del pool, sus escrituras quedarían fuera de la transacción y el rollback no las alcanzaría. Además valido el stock de todos los ítems **antes** de escribir nada, así que el caso del test 3 ni siquiera llega a necesitar el rollback: es defensa en profundidad.

> **Qué contestar si te preguntan esto en la defensa — "¿para qué sirve el `FOR UPDATE`?"**
> Bloquea las filas de `productos` que leí hasta que hago commit o rollback. Sin él, dos ventas simultáneas del último teclado leerían las dos `stock = 1`, las dos pasarían la validación y las dos descontarían: el stock quedaría en -1. Con `FOR UPDATE`, la segunda transacción se queda esperando en el `SELECT` hasta que la primera termina, y cuando lee ya ve `stock = 0` y rebota con `409 STOCK_INSUFICIENTE`. Es una condición de carrera clásica, y la solución es del motor, no mía.

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el frontend no manda el precio?"**
> Porque el precio lo determina el negocio, no el navegador. Si el `POST /api/ventas` aceptara un `precio_unitario` del cliente, cualquiera con `curl` podría comprar el monitor a un peso. El request solo manda `cliente_id` y una lista de `{ producto_id, cantidad }`; el precio lo lee el backend de la base, dentro de la transacción, y lo congela en el ítem. La regla general: nunca confiar en el cliente para nada que determine plata o permisos.

- [ ] **Paso 5: Crear `backend/src/controllers/ventaController.js`**

```js
import * as ventaService from '../services/ventaService.js';

export async function listar(req, res, next) {
  try {
    const ventas = await ventaService.listar();
    res.status(200).json(ventas);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req, res, next) {
  try {
    const venta = await ventaService.obtener(Number(req.params.id));
    res.status(200).json(venta);
  } catch (err) {
    next(err);
  }
}

export async function crear(req, res, next) {
  try {
    const { cliente_id: clienteId, items } = req.body;
    const venta = await ventaService.crear(clienteId, items);
    res.status(201).json(venta);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Paso 6: Crear `backend/src/routes/ventaRoutes.js`**

La ruta de anular llega en la Tarea 7.

```js
import { Router } from 'express';
import * as ventaController from '../controllers/ventaController.js';

const router = Router();

router.get('/', ventaController.listar);
router.get('/:id', ventaController.obtener);
router.post('/', ventaController.crear);

export default router;
```

- [ ] **Paso 7: Modificar `backend/src/routes/index.js`**

Contenido completo del archivo después del cambio:

```js
import { Router } from 'express';
import { verificarToken } from '../middlewares/auth.js';
import authRoutes from './authRoutes.js';
import clienteRoutes from './clienteRoutes.js';
import productoRoutes from './productoRoutes.js';
import ventaRoutes from './ventaRoutes.js';

const router = Router();

// Público: es el único endpoint al que se llega sin token.
router.use('/auth', authRoutes);

// De acá para abajo, todo pide token. El middleware se monta una sola vez:
// cualquier router nuevo que se agregue debajo queda protegido sin hacer nada.
router.use(verificarToken);

router.use('/clientes', clienteRoutes);
router.use('/productos', productoRoutes);
router.use('/ventas', ventaRoutes);

export default router;
```

- [ ] **Paso 8: Correr los tests y verificar que pasan**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: PASS. `Test Files 5 passed (5)` · `Tests 33 passed (33)`.

> **Qué contestar si te preguntan esto en la defensa — "¿por qué mockeás `models/` en vez de usar una base de test?"**
> Porque lo que la cátedra pide verificar es la lógica de negocio, y eso vive en `services/`. Que `INSERT INTO ventas` funcione me lo garantiza MySQL; que la venta se rechace cuando falta stock me lo garantiza mi código, y eso es lo que testeo. El beneficio concreto es que el job de CI del TP4 es `npm ci` y `npm test`: sin servicio de base de datos, sin esperar un healthcheck, sin sembrar datos ni limpiar entre tests, y en segundos. Lo que estos tests **no** verifican es que el SQL sea correcto — eso lo cubren los tests end-to-end contra los contenedores reales en el TP6. Cada nivel de la pirámide cubre lo suyo. Y esto solo es posible por la regla de capas: como el service no importa Express ni el pool, mockear `models/` alcanza para aislarlo.

- [ ] **Paso 9: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add backend/src backend/tests/ventas.test.js
git commit -m "feat(ventas): creacion transaccional con bloqueo de stock y rollback"
```

---
## Tarea 7: Ventas — anular (tests backend 5 y 6)

**Files:**
- Modify: `backend/src/services/ventaService.js` (agregar `anular`)
- Modify: `backend/src/controllers/ventaController.js` (agregar `anular`)
- Modify: `backend/src/routes/ventaRoutes.js` (agregar `POST /:id/anular`)
- Test: `backend/tests/ventas.test.js` (agregar un `describe` al final)

**Interfaces:**
- Consumes:
  - De `backend/src/models/ventaModel.js` (Tarea 6): `obtenerConexion(): Promise<PoolConnection>`, `buscarCabecera(conn, id): Promise<Cabecera | null>` con `Cabecera.estado: 'pendiente' | 'anulada'`, `listarItems(conn, ventaId): Promise<Item[]>` con `Item.producto_id` y `Item.cantidad`, `marcarAnulada(conn, ventaId): Promise<number>`.
  - De `backend/src/models/productoModel.js` (Tarea 5): `reponerStock(conn, productoId, cantidad): Promise<number>`.
  - `AppError` de `backend/src/utils/AppError.js`.
- Produces:
  - `ventaService.js` → `export async function anular(ventaId: number): Promise<{ id: number, estado: 'anulada', stock_repuesto: true }>`.
  - `ventaController.js` → `export async function anular(req, res, next): Promise<void>`.
  - Contrato HTTP: `POST /api/ventas/:id/anular`, sin body → `200 { id, estado: "anulada", stock_repuesto: true }`.

- [ ] **Paso 1: Escribir el test que falla**

Agregar al **final** de `backend/tests/ventas.test.js`, después del `describe('GET /api/ventas/:id', ...)` que ya está. Los mocks del principio del archivo ya incluyen `marcarAnulada` y `reponerStock`, así que no hay que tocar la cabecera.

```js
describe('POST /api/ventas/:id/anular', () => {
  let conn;

  beforeEach(() => {
    vi.clearAllMocks();
    conn = conexionFalsa();
    ventaModel.obtenerConexion.mockResolvedValue(conn);
  });

  // ── TEST 5 del TP5 — Transición de estado ──────────────────────
  it('anula una venta pendiente, repone el stock de cada ítem y devuelve 200', async () => {
    ventaModel.buscarCabecera.mockResolvedValue({
      id: 7, cliente_id: 1, cliente_nombre: 'Cliente Demo',
      fecha: '2026-08-13T14:22:05.000Z', total: 210000, estado: 'pendiente'
    });
    ventaModel.listarItems.mockResolvedValue([
      { id: 1, producto_id: 1, producto_nombre: 'Teclado', cantidad: 2, precio_unitario: 15000, subtotal: 30000 },
      { id: 2, producto_id: 2, producto_nombre: 'Monitor', cantidad: 1, precio_unitario: 180000, subtotal: 180000 }
    ]);
    ventaModel.marcarAnulada.mockResolvedValue(1);

    const respuesta = await request(app)
      .post('/api/ventas/7/anular')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ id: 7, estado: 'anulada', stock_repuesto: true });

    // Una reposición por ítem, con la cantidad exacta de ese ítem.
    expect(productoModel.reponerStock).toHaveBeenCalledTimes(2);
    expect(productoModel.reponerStock).toHaveBeenNthCalledWith(1, conn, 1, 2);
    expect(productoModel.reponerStock).toHaveBeenNthCalledWith(2, conn, 2, 1);

    expect(ventaModel.marcarAnulada).toHaveBeenCalledWith(conn, 7);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  // ── TEST 6 del TP5 — Transición de estado inválida ─────────────
  it('rechaza con 409 VENTA_YA_ANULADA una venta ya anulada y NO repone stock', async () => {
    ventaModel.buscarCabecera.mockResolvedValue({
      id: 7, cliente_id: 1, cliente_nombre: 'Cliente Demo',
      fecha: '2026-08-13T14:22:05.000Z', total: 210000, estado: 'anulada'
    });

    const respuesta = await request(app)
      .post('/api/ventas/7/anular')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('VENTA_YA_ANULADA');
    // Lo importante: no se repone stock de más.
    expect(productoModel.reponerStock).not.toHaveBeenCalled();
    expect(ventaModel.marcarAnulada).not.toHaveBeenCalled();
    // Ni siquiera se abrió una transacción.
    expect(ventaModel.obtenerConexion).not.toHaveBeenCalled();
  });

  it('devuelve 404 VENTA_NO_ENCONTRADA si la venta no existe', async () => {
    ventaModel.buscarCabecera.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/ventas/99/anular')
      .set('Authorization', `Bearer ${TOKEN}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('VENTA_NO_ENCONTRADA');
    expect(productoModel.reponerStock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: FAIL con 3 tests rojos. El primero falla con `expected 404 to be 200` y el body `{"error":{"code":"RUTA_NO_ENCONTRADA","message":"No existe POST /api/ventas/7/anular"}}`, porque la ruta todavía no existe.

- [ ] **Paso 3: Agregar `anular` a `backend/src/services/ventaService.js`**

Agregar al final del archivo, después de `crear`. Los imports del principio ya incluyen `productoModel`, así que no hay que tocarlos.

```js
export async function anular(ventaId) {
  // Se valida ANTES de abrir la transacción: si la venta ya está anulada,
  // no hace falta tomar una conexión ni bloquear nada.
  const cabecera = await ventaModel.buscarCabecera(null, ventaId);

  if (!cabecera) {
    throw new AppError(404, 'VENTA_NO_ENCONTRADA', `No existe la venta ${ventaId}`);
  }
  if (cabecera.estado === 'anulada') {
    throw new AppError(409, 'VENTA_YA_ANULADA', `La venta ${ventaId} ya está anulada`);
  }

  const conn = await ventaModel.obtenerConexion();
  try {
    await conn.beginTransaction();

    const items = await ventaModel.listarItems(conn, ventaId);
    for (const item of items) {
      await productoModel.reponerStock(conn, item.producto_id, item.cantidad);
    }

    await ventaModel.marcarAnulada(conn, ventaId);

    await conn.commit();

    return { id: Number(ventaId), estado: 'anulada', stock_repuesto: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué anular es un `POST /:id/anular` y no un `DELETE` o un `PUT`?"**
> Porque anular no es borrar ni reemplazar: es ejecutar una transición de estado con efectos colaterales. La venta sigue existiendo (`estado = 'anulada'`) porque destruir el historial sería peor que conservarlo, y además la operación repone el stock de cada ítem. Un `DELETE` diría "esto ya no existe", que es falso, y un `PUT` diría "reemplazá el recurso por este otro", que tampoco es lo que pasa. El verbo describe la operación de negocio. La máquina de estados completa es `pendiente → anulada`, y `anulada` es terminal: por eso anular dos veces es un `409`, no un no-op.

- [ ] **Paso 4: Agregar `anular` a `backend/src/controllers/ventaController.js`**

Agregar al final del archivo:

```js
export async function anular(req, res, next) {
  try {
    const resultado = await ventaService.anular(Number(req.params.id));
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Paso 5: Agregar la ruta en `backend/src/routes/ventaRoutes.js`**

Contenido completo del archivo después del cambio:

```js
import { Router } from 'express';
import * as ventaController from '../controllers/ventaController.js';

const router = Router();

router.get('/', ventaController.listar);
router.get('/:id', ventaController.obtener);
router.post('/', ventaController.crear);
router.post('/:id/anular', ventaController.anular);

export default router;
```

- [ ] **Paso 6: Correr los tests y verificar que pasan**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: PASS. `Test Files 5 passed (5)` · `Tests 36 passed (36)`. **Los 8 tests del TP5 están cubiertos.**

- [ ] **Paso 7: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add backend/src backend/tests/ventas.test.js
git commit -m "feat(ventas): anulacion que repone stock y rechaza doble anulacion"
```

---

## Tarea 8: Scaffold del frontend, proxy, auth y ruta protegida (test frontend 4)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/estilos.css`
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/components/RutaProtegida.jsx`
- Create: `frontend/src/components/Nav.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/Productos.jsx`
- Create: `frontend/tests/setup.js`
- Test: `frontend/tests/rutaProtegida.test.jsx`

**Interfaces:**
- Consumes (del backend, tareas 3 a 7 — el frontend habla HTTP, no importa código del backend):
  - `POST /api/auth/login` con `{ email, password }` → `200 { token, usuario: { id, email } }`; error `401 { error: { code: 'CREDENCIALES_INVALIDAS', message } }`.
  - `GET /api/productos` → `200 [{ id, nombre, precio, stock, activo }]`.
  - Contrato de error de **todos** los endpoints: `{ error: { code, message } }`.
- Produces:
  - `src/api/client.js` →
    - `export class ApiError extends Error { status: number; code: string }`
    - `export const CLAVE_TOKEN = 'erp_token'` y `export const CLAVE_USUARIO = 'erp_usuario'` (las dos claves de `localStorage`; las importa `AuthContext.jsx`, no se repite el string)
    - `export async function apiFetch(ruta: string, opciones?: { method?: string, body?: object }): Promise<any>` — `ruta` empieza con `/` y **no** incluye el prefijo `/api`. Ante un `401` limpia la sesión y redirige a `/login`
    - `export function get(ruta): Promise<any>`
    - `export function post(ruta, body): Promise<any>`
    - `export function put(ruta, body): Promise<any>`
    - `export function del(ruta): Promise<any>`
  - `src/context/AuthContext.jsx` →
    - `export function AuthProvider({ children })`
    - `export function useAuth(): { token: string | null, usuario: { id, email } | null, login(email: string, password: string): Promise<{ id, email }>, logout(): void }`
  - `src/components/RutaProtegida.jsx` → `export default function RutaProtegida({ children })`
  - `src/App.jsx` → `export default function App()` — **solo las `<Routes>`, sin Router adentro**, para poder testear con `MemoryRouter`.

- [ ] **Paso 1: Crear `frontend/package.json`**

```json
{
  "name": "erp-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Frontend del ERP mínimo — IngSoft3 UCC 2026",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.1",
    "vite": "^5.4.8",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Paso 2: Instalar dependencias**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm install
```

Esperado: se crean `node_modules/` y `package-lock.json` sin errores.

- [ ] **Paso 3: Crear `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, el dev server hace de proxy: /api/productos sale del
    // navegador al puerto 5173 y Vite lo reenvía al backend en el 3000.
    // Es lo mismo que hace nginx en producción, así que el código del
    // frontend no cambia entre dev y prod.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './tests/setup.js' }
});
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el frontend no tiene una variable con la URL del backend?"**
> Porque Vite reemplaza las variables `VITE_*` en **tiempo de build**: después de `npm run build`, `VITE_API_URL` ya no es una variable, es un string literal incrustado en el bundle. Pasarle una env var al contenedor de nginx en runtime no cambiaría nada, el `.js` ya está escrito — tendría que rebuildear una imagen distinta para cada entorno, y eso rompe el "build once, deploy anywhere" que pide el TP6. La solución es que el frontend no conozca ninguna URL: llama siempre a `/api/...` relativo y quien resuelve a dónde va es el servidor que lo sirve (el proxy de Vite en dev, nginx en prod). De paso desaparece el CORS, porque el navegador ve un solo origen.

- [ ] **Paso 4: Crear `frontend/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ERP mínimo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Paso 5: Crear `frontend/tests/setup.js`**

```js
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Después de cada test: se desmonta el DOM y se limpia localStorage, para que
// un token de un test no se filtre al siguiente.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
```

- [ ] **Paso 6: Escribir el test que falla**

Crear `frontend/tests/rutaProtegida.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

function renderizarEn(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('RutaProtegida', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  // ── TEST 4 del frontend — Autorización ─────────────────────────
  it('redirige a /login cuando no hay token en localStorage', async () => {
    renderizarEn('/productos');

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // La pantalla protegida no llegó a montarse, así que nunca pidió datos.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deja pasar a /productos cuando hay token', async () => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    });

    renderizarEn('/productos');

    expect(await screen.findByRole('heading', { name: /productos/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Paso 7: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: FAIL. `Error: Failed to resolve import "../src/App.jsx" from "tests/rutaProtegida.test.jsx". Does the file exist?`

- [ ] **Paso 8: Crear `frontend/src/api/client.js`**

```js
// Error de API con la misma forma que el contrato del backend.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const CLAVE_TOKEN = 'erp_token';
export const CLAVE_USUARIO = 'erp_usuario';

function armarCabeceras() {
  const cabeceras = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(CLAVE_TOKEN);
  if (token) {
    cabeceras.Authorization = `Bearer ${token}`;
  }
  return cabeceras;
}

// ÚNICO lugar de todo el frontend que llama a fetch. La ruta va sin el /api:
// apiFetch('/productos') pega a '/api/productos'. Siempre relativa: quien
// resuelve a dónde va /api es el proxy (Vite en dev, nginx en prod).
export async function apiFetch(ruta, opciones = {}) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: opciones.method ?? 'GET',
    headers: armarCabeceras(),
    body: opciones.body ? JSON.stringify(opciones.body) : undefined
  });

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;

  if (!respuesta.ok) {
    // Token vencido o inválido: se limpia la sesión y se vuelve al login.
    // Sin esto, el usuario quedaría con un token muerto y vería errores
    // sueltos en cada pantalla sin entender por qué.
    if (respuesta.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
      window.location.assign('/login');
    }

    const error = datos?.error ?? {};
    throw new ApiError(
      respuesta.status,
      error.code ?? 'ERROR_DESCONOCIDO',
      error.message ?? 'Error inesperado'
    );
  }

  return datos;
}

export const get = (ruta) => apiFetch(ruta);
export const post = (ruta, body) => apiFetch(ruta, { method: 'POST', body });
export const put = (ruta, body) => apiFetch(ruta, { method: 'PUT', body });
export const del = (ruta) => apiFetch(ruta, { method: 'DELETE' });
```

- [ ] **Paso 9: Crear `frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useState } from 'react';
import { post, CLAVE_TOKEN, CLAVE_USUARIO } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // El estado se inicializa DESDE localStorage: así un F5 no desloguea.
  const [token, setToken] = useState(() => localStorage.getItem(CLAVE_TOKEN));
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    return guardado ? JSON.parse(guardado) : null;
  });

  async function login(email, password) {
    const datos = await post('/auth/login', { email, password });
    localStorage.setItem(CLAVE_TOKEN, datos.token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos.usuario));
    setToken(datos.token);
    setUsuario(datos.usuario);
    return datos.usuario;
  }

  function logout() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    setToken(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ token, usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué guardás el token en `localStorage` si es vulnerable a XSS?"**
> Porque es una limitación que asumo **declarada**, no por omisión. Es cierto: cualquier script inyectado en la página puede leer `localStorage` y robarse el token. La alternativa correcta en producción es una cookie `httpOnly` + `SameSite`, que el JavaScript no puede leer; pero eso arrastra manejo de CSRF y configuración de dominio entre contenedores, que es complejidad que no aporta al objetivo de la materia. Lo elegí sabiendo el costo y está escrito en `decisiones.md`. Si el proyecto saliera a producción, esto es lo primero que cambiaría.

- [ ] **Paso 10: Crear `frontend/src/components/RutaProtegida.jsx`**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RutaProtegida({ children }) {
  const { token } = useAuth();

  if (!token) {
    // replace: el /productos al que no pudo entrar no queda en el historial,
    // así el botón "atrás" del navegador no lo devuelve al mismo rebote.
    return <Navigate to="/login" replace />;
  }

  return children;
}
```

- [ ] **Paso 11: Crear `frontend/src/pages/Login.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(email, password);
      navigate('/productos');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="contenedor contenedor--angosto">
      <h1>Iniciar sesión</h1>

      <form onSubmit={manejarSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p role="alert" className="error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Paso 12: Crear `frontend/src/components/Nav.jsx`**

```jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Nav() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function manejarLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="nav">
      <NavLink to="/productos">Productos</NavLink>
      <NavLink to="/clientes">Clientes</NavLink>
      <NavLink to="/ventas/nueva">Nueva venta</NavLink>
      <NavLink to="/ventas">Ventas</NavLink>
      <span className="nav__usuario">{usuario?.email}</span>
      <button type="button" onClick={manejarLogout}>Salir</button>
    </nav>
  );
}
```

- [ ] **Paso 13: Crear `frontend/src/pages/Productos.jsx` (versión mínima)**

La Tarea 9 la convierte en el ABM completo. Por ahora solo lista, que es lo que necesita el test de esta tarea.

```jsx
import { useEffect, useState } from 'react';
import { get } from '../api/client.js';
import Nav from '../components/Nav.jsx';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/productos')
      .then(setProductos)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Productos</h1>
        {error && <p role="alert" className="error">{error}</p>}
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td>{producto.nombre}</td>
                <td>{producto.precio.toFixed(2)}</td>
                <td>{producto.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
```

- [ ] **Paso 14: Crear `frontend/src/App.jsx`**

Las rutas de clientes y ventas se agregan en las tareas 9 y 10.

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import Login from './pages/Login.jsx';
import Productos from './pages/Productos.jsx';

// Este componente NO trae el Router adentro: lo pone main.jsx (BrowserRouter)
// y los tests (MemoryRouter). Así se puede testear una ruta concreta sin
// tocar la URL del navegador.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/productos"
        element={<RutaProtegida><Productos /></RutaProtegida>}
      />
      <Route path="*" element={<Navigate to="/productos" replace />} />
    </Routes>
  );
}
```

- [ ] **Paso 15: Crear `frontend/src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import App from './App.jsx';
import './estilos.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Paso 16: Crear `frontend/src/estilos.css`**

```css
:root {
  font-family: system-ui, sans-serif;
  color-scheme: light;
}

body {
  margin: 0;
  background: #f4f5f7;
  color: #1c1e21;
}

.contenedor {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}

.contenedor--angosto {
  max-width: 380px;
}

.nav {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #1c1e21;
  color: #fff;
}

.nav a {
  color: #fff;
  text-decoration: none;
}

.nav a.active {
  text-decoration: underline;
}

.nav__usuario {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.8;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
}

input,
select {
  padding: 0.45rem;
  border: 1px solid #c4c7cc;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  padding: 0.5rem 0.9rem;
  border: 0;
  border-radius: 4px;
  background: #1c1e21;
  color: #fff;
  font-size: 0.95rem;
  cursor: pointer;
}

button:disabled {
  background: #9aa0a6;
  cursor: not-allowed;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}

th,
td {
  padding: 0.5rem;
  border-bottom: 1px solid #e3e5e8;
  text-align: left;
}

.error {
  color: #b3261e;
  font-weight: 600;
}

.total {
  font-size: 1.2rem;
  font-weight: 700;
}
```

- [ ] **Paso 17: Correr los tests y verificar que pasan**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: PASS. `Test Files 1 passed (1)` · `Tests 2 passed (2)`.

- [ ] **Paso 18: Verificar a mano que el dev server levanta**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm run dev
```

Esperado: `VITE v5.x ready` con la URL `http://localhost:5173/`. Abrirla: como no hay token, la app redirige sola a `/login` y se ve el formulario. Cortar con `Ctrl+C`.

- [ ] **Paso 19: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/src frontend/tests
git commit -m "feat(frontend): scaffold con Vite, proxy a la API, AuthContext y ruta protegida"
```

---
## Tarea 9: Pantallas de Productos y Clientes (test frontend 1)

**Files:**
- Modify: `frontend/src/pages/Productos.jsx` (de listado a ABM completo)
- Create: `frontend/src/pages/Clientes.jsx`
- Modify: `frontend/src/App.jsx` (agregar la ruta `/clientes`)
- Test: `frontend/tests/productos.test.jsx`

**Interfaces:**
- Consumes:
  - De `frontend/src/api/client.js` (Tarea 8): `get(ruta)`, `post(ruta, body)`, `put(ruta, body)`, `del(ruta)`, `CLAVE_TOKEN`, `ApiError` con `{ status, code, message }`. La `ruta` va **sin** el prefijo `/api`.
  - De `frontend/src/components/Nav.jsx` (Tarea 8): `export default function Nav()`.
  - Del backend: `GET/POST/PUT/DELETE /api/productos` con `{ id, nombre, precio, stock, activo }`, y `GET/POST/PUT/DELETE /api/clientes` con `{ id, nombre, email, telefono, activo }`.
- Produces:
  - `frontend/src/pages/Productos.jsx` → `export default function Productos()` — ABM con validación de formulario en el cliente.
  - `frontend/src/pages/Clientes.jsx` → `export default function Clientes()` — ABM equivalente para clientes.

- [ ] **Paso 1: Escribir el test que falla**

Crear `frontend/tests/productos.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Productos from '../src/pages/Productos.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function renderizarProductos() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Productos />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Pantalla de productos', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
    vi.stubGlobal('fetch', vi.fn(async () => respuestaOk([
      { id: 1, nombre: 'Teclado', precio: 15000, stock: 20, activo: true }
    ])));
  });

  // ── TEST 1 del frontend — Validación ───────────────────────────
  it('no envía el formulario con precio negativo: muestra el error y no llama a la API', async () => {
    const usuario = userEvent.setup();
    renderizarProductos();

    // Esperar a que termine el GET inicial del listado.
    expect(await screen.findByText('Teclado')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);

    await usuario.type(screen.getByLabelText(/nombre/i), 'Mouse');
    await usuario.type(screen.getByLabelText(/precio/i), '-5');
    await usuario.type(screen.getByLabelText(/stock/i), '30');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/precio debe ser mayor a cero/i);
    // Lo importante: no hubo un segundo fetch. El POST nunca salió.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('no envía el formulario con el nombre vacío: muestra el error y no llama a la API', async () => {
    const usuario = userEvent.setup();
    renderizarProductos();

    expect(await screen.findByText('Teclado')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);

    await usuario.type(screen.getByLabelText(/precio/i), '9500');
    await usuario.type(screen.getByLabelText(/stock/i), '30');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/nombre es obligatorio/i);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('con datos válidos sí llama a la API', async () => {
    const usuario = userEvent.setup();
    renderizarProductos();

    expect(await screen.findByText('Teclado')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/nombre/i), 'Mouse');
    await usuario.type(screen.getByLabelText(/precio/i), '9500.5');
    await usuario.type(screen.getByLabelText(/stock/i), '30');
    await usuario.click(screen.getByRole('button', { name: /guardar/i }));

    // 1 = GET inicial, 2 = POST, 3 = GET de recarga del listado.
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toBe('/api/productos');
    expect(fetch.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      nombre: 'Mouse', precio: 9500.5, stock: 30
    });
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: FAIL. `TestingLibraryElementError: Unable to find a label with the text of: /nombre/i` — la pantalla todavía es solo un listado, no tiene formulario.

- [ ] **Paso 3: Reescribir `frontend/src/pages/Productos.jsx`**

Contenido completo del archivo después del cambio:

```jsx
import { useEffect, useState } from 'react';
import { get, post, put, del } from '../api/client.js';
import Nav from '../components/Nav.jsx';

const FORMULARIO_VACIO = { id: null, nombre: '', precio: '', stock: '' };

// Las MISMAS reglas que valida productoService en el backend.
// Duplicarlas es intencional: acá para dar feedback inmediato, allá porque
// el backend es la única frontera confiable.
function validar({ nombre, precio, stock }) {
  if (nombre.trim() === '') return 'El nombre es obligatorio';
  const precioNumero = Number(precio);
  if (precio === '' || Number.isNaN(precioNumero) || precioNumero <= 0) {
    return 'El precio debe ser mayor a cero';
  }
  const stockNumero = Number(stock);
  if (stock === '' || !Number.isInteger(stockNumero) || stockNumero < 0) {
    return 'El stock debe ser un entero mayor o igual a cero';
  }
  return null;
}

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');

  async function cargar() {
    try {
      setProductos(await get('/productos'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();

    const problema = validar(formulario);
    if (problema) {
      setError(problema);
      return; // ← acá se corta: la API no se llama.
    }

    setError('');
    const cuerpo = {
      nombre: formulario.nombre.trim(),
      precio: Number(formulario.precio),
      stock: Number(formulario.stock)
    };

    try {
      if (formulario.id === null) {
        await post('/productos', cuerpo);
      } else {
        await put(`/productos/${formulario.id}`, cuerpo);
      }
      setFormulario(FORMULARIO_VACIO);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function editar(producto) {
    setError('');
    setFormulario({
      id: producto.id,
      nombre: producto.nombre,
      precio: String(producto.precio),
      stock: String(producto.stock)
    });
  }

  async function darDeBaja(id) {
    try {
      await del(`/productos/${id}`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Productos</h1>

        <form onSubmit={manejarSubmit}>
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            value={formulario.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
          />

          <label htmlFor="precio">Precio</label>
          <input
            id="precio"
            value={formulario.precio}
            onChange={(e) => cambiar('precio', e.target.value)}
          />

          <label htmlFor="stock">Stock</label>
          <input
            id="stock"
            value={formulario.stock}
            onChange={(e) => cambiar('stock', e.target.value)}
          />

          {error && <p role="alert" className="error">{error}</p>}

          <div>
            <button type="submit">Guardar</button>
            {formulario.id !== null && (
              <button type="button" onClick={() => setFormulario(FORMULARIO_VACIO)}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <tr key={producto.id}>
                <td>{producto.nombre}</td>
                <td>{producto.precio.toFixed(2)}</td>
                <td>{producto.stock}</td>
                <td>
                  <button type="button" onClick={() => editar(producto)}>Editar</button>
                  <button type="button" onClick={() => darDeBaja(producto.id)}>Dar de baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿no es redundante validar el precio en el frontend si el backend ya lo valida?"**
> No, porque validan por motivos distintos. El frontend valida para dar feedback inmediato: el usuario ve el error sin esperar un round-trip. El backend valida porque es la **única frontera confiable**: el frontend es código que corre en la máquina del usuario y cualquiera puede saltearlo con `curl` o con las DevTools. Si tuviera que quedarme con una sola, me quedo con la del backend; la del frontend es comodidad, la del backend es correctitud. Lo que sí cuido es que las reglas digan lo mismo en los dos lados.

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: PASS. `Test Files 2 passed (2)` · `Tests 5 passed (5)`.

- [ ] **Paso 5: Commit del ABM de productos**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add frontend/src/pages/Productos.jsx frontend/tests/productos.test.jsx
git commit -m "feat(frontend): ABM de productos con validacion de formulario"
```

- [ ] **Paso 6: Crear `frontend/src/pages/Clientes.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { get, post, put, del } from '../api/client.js';
import Nav from '../components/Nav.jsx';

const FORMULARIO_VACIO = { id: null, nombre: '', email: '', telefono: '' };

// Las mismas reglas que valida clienteService en el backend.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar({ nombre, email }) {
  if (nombre.trim() === '') return 'El nombre es obligatorio';
  if (!RE_EMAIL.test(email)) return 'El email tiene formato inválido';
  return null;
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');

  async function cargar() {
    try {
      setClientes(await get('/clientes'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  async function manejarSubmit(evento) {
    evento.preventDefault();

    const problema = validar(formulario);
    if (problema) {
      setError(problema);
      return;
    }

    setError('');
    const cuerpo = {
      nombre: formulario.nombre.trim(),
      email: formulario.email.trim(),
      telefono: formulario.telefono.trim()
    };

    try {
      if (formulario.id === null) {
        await post('/clientes', cuerpo);
      } else {
        await put(`/clientes/${formulario.id}`, cuerpo);
      }
      setFormulario(FORMULARIO_VACIO);
      await cargar();
    } catch (err) {
      // Acá cae el 409 EMAIL_DUPLICADO del backend, con su mensaje.
      setError(err.message);
    }
  }

  function editar(cliente) {
    setError('');
    setFormulario({
      id: cliente.id,
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono ?? ''
    });
  }

  async function darDeBaja(id) {
    try {
      await del(`/clientes/${id}`);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Clientes</h1>

        <form onSubmit={manejarSubmit}>
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            value={formulario.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            value={formulario.email}
            onChange={(e) => cambiar('email', e.target.value)}
          />

          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            value={formulario.telefono}
            onChange={(e) => cambiar('telefono', e.target.value)}
          />

          {error && <p role="alert" className="error">{error}</p>}

          <div>
            <button type="submit">Guardar</button>
            {formulario.id !== null && (
              <button type="button" onClick={() => setFormulario(FORMULARIO_VACIO)}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>{cliente.email}</td>
                <td>{cliente.telefono}</td>
                <td>
                  <button type="button" onClick={() => editar(cliente)}>Editar</button>
                  <button type="button" onClick={() => darDeBaja(cliente.id)}>Dar de baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
```

- [ ] **Paso 7: Modificar `frontend/src/App.jsx` para agregar `/clientes`**

Contenido completo del archivo después del cambio:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import Login from './pages/Login.jsx';
import Productos from './pages/Productos.jsx';
import Clientes from './pages/Clientes.jsx';

// Este componente NO trae el Router adentro: lo pone main.jsx (BrowserRouter)
// y los tests (MemoryRouter). Así se puede testear una ruta concreta sin
// tocar la URL del navegador.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/productos"
        element={<RutaProtegida><Productos /></RutaProtegida>}
      />
      <Route
        path="/clientes"
        element={<RutaProtegida><Clientes /></RutaProtegida>}
      />
      <Route path="*" element={<Navigate to="/productos" replace />} />
    </Routes>
  );
}
```

- [ ] **Paso 8: Correr los tests y verificar que siguen pasando**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: PASS. `Test Files 2 passed (2)` · `Tests 5 passed (5)`.

- [ ] **Paso 9: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add frontend/src
git commit -m "feat(frontend): ABM de clientes y ruta protegida en el router"
```

---

## Tarea 10: Pantallas de Ventas — carrito y listado (tests frontend 2 y 3)

**Files:**
- Create: `frontend/src/pages/NuevaVenta.jsx`
- Create: `frontend/src/pages/Ventas.jsx`
- Modify: `frontend/src/App.jsx` (agregar `/ventas/nueva` y `/ventas`)
- Test: `frontend/tests/nuevaVenta.test.jsx`

**Interfaces:**
- Consumes:
  - De `frontend/src/api/client.js` (Tarea 8): `get(ruta)`, `post(ruta, body)`. La `ruta` va **sin** el prefijo `/api`.
  - De `frontend/src/components/Nav.jsx` (Tarea 8): `export default function Nav()`.
  - Del backend: `GET /api/clientes` → `[{ id, nombre, email, telefono, activo }]`; `GET /api/productos` → `[{ id, nombre, precio, stock, activo }]`; `POST /api/ventas` con `{ cliente_id, items: [{ producto_id, cantidad }] }`; `GET /api/ventas` → `[{ id, cliente_id, cliente_nombre, fecha, total, estado }]`; `GET /api/ventas/:id` → cabecera + `items`; `POST /api/ventas/:id/anular` → `{ id, estado, stock_repuesto }`.
- Produces:
  - `frontend/src/pages/NuevaVenta.jsx` → `export default function NuevaVenta()` — carrito con total en vivo y botón deshabilitado si está vacío. El total se muestra en un elemento con `data-testid="total-carrito"`.
  - `frontend/src/pages/Ventas.jsx` → `export default function Ventas()` — listado con detalle expandible y botón "Anular".

- [ ] **Paso 1: Escribir el test que falla**

Crear `frontend/tests/nuevaVenta.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NuevaVenta from '../src/pages/NuevaVenta.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { CLAVE_TOKEN } from '../src/api/client.js';

const CLIENTES = [
  { id: 1, nombre: 'Cliente Demo', email: 'demo@cliente.local', telefono: '3510000000', activo: true }
];

const PRODUCTOS = [
  { id: 1, nombre: 'Teclado', precio: 15000, stock: 20, activo: true },
  { id: 2, nombre: 'Monitor', precio: 180000, stock: 5, activo: true }
];

function respuestaOk(datos) {
  return { ok: true, status: 200, text: async () => JSON.stringify(datos) };
}

function renderizarNuevaVenta() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <NuevaVenta />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Pantalla de nueva venta', () => {
  beforeEach(() => {
    localStorage.setItem(CLAVE_TOKEN, 'token-de-prueba');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/clientes') return respuestaOk(CLIENTES);
      if (url === '/api/productos') return respuestaOk(PRODUCTOS);
      return respuestaOk(null);
    }));
  });

  // ── TEST 3 del frontend — Restricción de UI ────────────────────
  it('deshabilita "Confirmar venta" mientras el carrito esté vacío', async () => {
    renderizarNuevaVenta();

    const boton = await screen.findByRole('button', { name: /confirmar venta/i });
    expect(boton).toBeDisabled();
    expect(screen.getByTestId('total-carrito')).toHaveTextContent('0.00');
  });

  // ── TEST 2 del frontend — Cálculo ──────────────────────────────
  it('recalcula el total al agregar y al quitar líneas del carrito', async () => {
    const usuario = userEvent.setup();
    renderizarNuevaVenta();

    // Esperar a que carguen los selectores.
    await screen.findByRole('option', { name: 'Teclado' });

    // Línea 1: 2 teclados a 15000 = 30000
    await usuario.selectOptions(screen.getByLabelText(/producto/i), '1');
    await usuario.clear(screen.getByLabelText(/cantidad/i));
    await usuario.type(screen.getByLabelText(/cantidad/i), '2');
    await usuario.click(screen.getByRole('button', { name: /agregar/i }));

    expect(screen.getByTestId('total-carrito')).toHaveTextContent('30000.00');

    // Línea 2: 1 monitor a 180000 → total 210000
    await usuario.selectOptions(screen.getByLabelText(/producto/i), '2');
    await usuario.clear(screen.getByLabelText(/cantidad/i));
    await usuario.type(screen.getByLabelText(/cantidad/i), '1');
    await usuario.click(screen.getByRole('button', { name: /agregar/i }));

    expect(screen.getByTestId('total-carrito')).toHaveTextContent('210000.00');

    // Con el carrito lleno, el botón se habilita.
    expect(screen.getByRole('button', { name: /confirmar venta/i })).toBeEnabled();

    // Quitar el monitor → vuelve a 30000
    await usuario.click(screen.getByRole('button', { name: /quitar monitor/i }));

    expect(screen.getByTestId('total-carrito')).toHaveTextContent('30000.00');
    expect(screen.queryByText('Monitor')).not.toBeInTheDocument();
  });

  it('manda al backend solo producto_id y cantidad, sin precios', async () => {
    const usuario = userEvent.setup();
    renderizarNuevaVenta();

    await screen.findByRole('option', { name: 'Teclado' });

    await usuario.selectOptions(screen.getByLabelText(/cliente/i), '1');
    await usuario.selectOptions(screen.getByLabelText(/producto/i), '1');
    await usuario.clear(screen.getByLabelText(/cantidad/i));
    await usuario.type(screen.getByLabelText(/cantidad/i), '2');
    await usuario.click(screen.getByRole('button', { name: /agregar/i }));
    await usuario.click(screen.getByRole('button', { name: /confirmar venta/i }));

    const llamadaPost = fetch.mock.calls.find((llamada) => llamada[1].method === 'POST');
    expect(llamadaPost[0]).toBe('/api/ventas');
    expect(JSON.parse(llamadaPost[1].body)).toEqual({
      cliente_id: 1,
      items: [{ producto_id: 1, cantidad: 2 }]
    });
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: FAIL. `Error: Failed to resolve import "../src/pages/NuevaVenta.jsx" from "tests/nuevaVenta.test.jsx". Does the file exist?`

- [ ] **Paso 3: Crear `frontend/src/pages/NuevaVenta.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../api/client.js';
import Nav from '../components/Nav.jsx';

export default function NuevaVenta() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      try {
        const [listaClientes, listaProductos] = await Promise.all([
          get('/clientes'),
          get('/productos')
        ]);
        setClientes(listaClientes);
        setProductos(listaProductos);
      } catch (err) {
        setError(err.message);
      }
    }
    cargar();
  }, []);

  // El total se DERIVA del carrito en cada render. No hay un useState para
  // el total: si lo hubiera, habría dos fuentes de verdad y podrían quedar
  // desincronizadas. Al quitar una línea el total se recalcula solo.
  const total = carrito.reduce((suma, linea) => suma + linea.subtotal, 0);

  function agregar() {
    const producto = productos.find((p) => p.id === Number(productoId));
    const cantidadNumero = Number(cantidad);

    if (!producto) {
      setError('Elegí un producto');
      return;
    }
    if (!Number.isInteger(cantidadNumero) || cantidadNumero <= 0) {
      setError('La cantidad debe ser un entero mayor a cero');
      return;
    }

    setError('');
    setCarrito((anterior) => [
      ...anterior,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: cantidadNumero,
        precio_unitario: producto.precio,
        subtotal: Math.round(cantidadNumero * producto.precio * 100) / 100
      }
    ]);
    setCantidad('1');
  }

  function quitar(indice) {
    setCarrito((anterior) => anterior.filter((_, i) => i !== indice));
  }

  async function confirmar() {
    if (!clienteId) {
      setError('Elegí un cliente');
      return;
    }
    setError('');
    try {
      // Solo producto_id y cantidad: el precio y el total los calcula el
      // backend. Mandarlos desde acá sería confiar en el navegador para
      // determinar cuánto se cobra.
      await post('/ventas', {
        cliente_id: Number(clienteId),
        items: carrito.map((linea) => ({
          producto_id: linea.producto_id,
          cantidad: linea.cantidad
        }))
      });
      setCarrito([]);
      navigate('/ventas');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Nueva venta</h1>

        <label htmlFor="cliente">Cliente</label>
        <select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Elegí un cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
          ))}
        </select>

        <label htmlFor="producto">Producto</label>
        <select id="producto" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
          <option value="">Elegí un producto</option>
          {productos.map((producto) => (
            <option key={producto.id} value={producto.id}>{producto.nombre}</option>
          ))}
        </select>

        <label htmlFor="cantidad">Cantidad</label>
        <input id="cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />

        <button type="button" onClick={agregar}>Agregar</button>

        {error && <p role="alert" className="error">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carrito.map((linea, indice) => (
              <tr key={`${linea.producto_id}-${indice}`}>
                <td>{linea.nombre}</td>
                <td>{linea.cantidad}</td>
                <td>{linea.precio_unitario.toFixed(2)}</td>
                <td>{linea.subtotal.toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => quitar(indice)}>
                    {`Quitar ${linea.nombre}`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="total">
          Total: <span data-testid="total-carrito">{total.toFixed(2)}</span>
        </p>

        <button type="button" onClick={confirmar} disabled={carrito.length === 0}>
          Confirmar venta
        </button>
      </main>
    </>
  );
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el total no está en un `useState`?"**
> Porque el total no es un dato: es una función del carrito. Si lo guardara en estado, tendría dos fuentes de verdad y cada operación —agregar, quitar, editar una cantidad— tendría que acordarse de actualizar las dos; el día que me olvide en una sola, el total muestra un número que no coincide con las líneas. Derivándolo con un `reduce` en cada render, es imposible que se desincronice. La regla general: si un valor se puede calcular a partir de otro estado, no se guarda.

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: PASS. `Test Files 3 passed (3)` · `Tests 8 passed (8)`.

- [ ] **Paso 5: Crear `frontend/src/pages/Ventas.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { get, post } from '../api/client.js';
import Nav from '../components/Nav.jsx';

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [detalle, setDetalle] = useState(null);   // venta expandida, con items
  const [error, setError] = useState('');

  async function cargar() {
    try {
      setVentas(await get('/ventas'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function alternarDetalle(id) {
    if (detalle && detalle.id === id) {
      setDetalle(null);
      return;
    }
    try {
      setDetalle(await get(`/ventas/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function anular(id) {
    setError('');
    try {
      await post(`/ventas/${id}/anular`);
      setDetalle(null);
      await cargar();
    } catch (err) {
      // Acá cae el 409 VENTA_YA_ANULADA con su mensaje.
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="contenedor">
        <h1>Ventas</h1>

        {error && <p role="alert" className="error">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((venta) => (
              <tr key={venta.id}>
                <td>{venta.id}</td>
                <td>{venta.cliente_nombre}</td>
                <td>{new Date(venta.fecha).toLocaleString('es-AR')}</td>
                <td>{venta.total.toFixed(2)}</td>
                <td>{venta.estado}</td>
                <td>
                  <button type="button" onClick={() => alternarDetalle(venta.id)}>
                    {detalle && detalle.id === venta.id ? 'Ocultar' : 'Ver detalle'}
                  </button>
                  <button
                    type="button"
                    onClick={() => anular(venta.id)}
                    disabled={venta.estado === 'anulada'}
                  >
                    Anular
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {detalle && (
          <section>
            <h2>{`Detalle de la venta ${detalle.id}`}</h2>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalle.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.producto_nombre}</td>
                    <td>{item.cantidad}</td>
                    <td>{item.precio_unitario.toFixed(2)}</td>
                    <td>{item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}
```

- [ ] **Paso 6: Modificar `frontend/src/App.jsx` con las dos rutas de ventas**

Contenido completo del archivo después del cambio:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida.jsx';
import Login from './pages/Login.jsx';
import Productos from './pages/Productos.jsx';
import Clientes from './pages/Clientes.jsx';
import NuevaVenta from './pages/NuevaVenta.jsx';
import Ventas from './pages/Ventas.jsx';

// Este componente NO trae el Router adentro: lo pone main.jsx (BrowserRouter)
// y los tests (MemoryRouter). Así se puede testear una ruta concreta sin
// tocar la URL del navegador.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/productos"
        element={<RutaProtegida><Productos /></RutaProtegida>}
      />
      <Route
        path="/clientes"
        element={<RutaProtegida><Clientes /></RutaProtegida>}
      />
      <Route
        path="/ventas/nueva"
        element={<RutaProtegida><NuevaVenta /></RutaProtegida>}
      />
      <Route
        path="/ventas"
        element={<RutaProtegida><Ventas /></RutaProtegida>}
      />
      <Route path="*" element={<Navigate to="/productos" replace />} />
    </Routes>
  );
}
```

- [ ] **Paso 7: Correr los tests y verificar que siguen pasando**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: PASS. `Test Files 3 passed (3)` · `Tests 8 passed (8)`. **Los 4 tests de frontend del TP5 están cubiertos.**

- [ ] **Paso 8: Verificar que el build de producción funciona**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm run build
```

Esperado: `✓ built in ...` y una carpeta `dist/` con `index.html` y `assets/`. Es lo que va a copiar la etapa 2 del Dockerfile. `dist/` está en el `.gitignore`, así que no se versiona.

- [ ] **Paso 9: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add frontend/src frontend/tests/nuevaVenta.test.jsx
git commit -m "feat(frontend): carrito de nueva venta y listado con anulacion"
```

---
## Tarea 11: Docker — los tres contenedores y verificación end-to-end

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes:
  - `backend/src/server.js` (Tarea 1) — el `CMD` del contenedor es `node src/server.js`.
  - Las 7 env vars que valida `backend/src/config/env.js` (Tarea 1): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT`. Se inyectan desde el `environment` del compose.
  - `backend/db/init.sql` (Tarea 2) — se monta en `/docker-entrypoint-initdb.d/init.sql`.
  - `frontend/package.json` (Tarea 8) — el script `build` genera `/app/dist`.
  - `GET /health` de `backend/src/app.js` (Tarea 1) — para verificar a mano que el backend está vivo.
- Produces:
  - El sistema corriendo con `docker compose up --build`, accesible en `http://localhost:8080`.
  - El nombre de servicio `backend` resoluble por DNS interno de compose, que es lo que usa `proxy_pass http://backend:3000` en `nginx.conf`.

- [ ] **Paso 1: Crear `backend/.dockerignore`**

Va **antes** que el Dockerfile: si se crea después, el primer build puede copiar `node_modules` del host.

```
node_modules
npm-debug.log
tests
.env
.git
coverage
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué excluís `node_modules` del contexto?"**
> Por dos motivos. El primero es de correctitud: mis `node_modules` del host tienen binarios compilados para Windows (bcrypt es una dependencia nativa), y adentro del contenedor corre Alpine Linux — copiarlos rompería la imagen. El `npm ci` de adentro instala los binarios correctos para esa plataforma. El segundo es de velocidad: el contexto de build se le manda entero al daemon de Docker, y `node_modules` son cientos de megas que se transfieren en cada build para después ser pisados.

- [ ] **Paso 2: Crear `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 1) Primero solo los manifiestos
COPY package*.json ./

# 2) Instalar dependencias de producción
RUN npm ci --omit=dev

# 3) Recién ahora el código
COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
```

Si el `npm ci` fallara al compilar `bcrypt` (la imagen de Alpine no siempre tiene binarios precompilados disponibles), agregar como segunda línea del archivo, antes del `WORKDIR`:

```dockerfile
RUN apk add --no-cache python3 make g++
```

> **Qué contestar si te preguntan esto en la defensa — "¿por qué copiás `package.json` antes que el código?"**
> Porque Docker cachea capa por capa e invalida desde la primera capa que cambió hacia abajo. Si hiciera `COPY . .` antes del `npm ci`, cualquier cambio de una línea en un controller cambiaría esa capa y me obligaría a reinstalar `node_modules` entero en cada build. Copiando primero los `package*.json`, la capa del `npm ci` solo se invalida cuando cambian de verdad las dependencias. En el pipeline del TP4 eso es la diferencia entre un build de segundos y uno de minutos.

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el backend no es multi-stage?"**
> Porque el backend no compila nada: el código que se ejecuta es exactamente el mismo que escribo. Multi-stage sirve cuando hay un artefacto de build que se puede separar de las herramientas que lo produjeron, y acá no existe ese artefacto. Lo que sí hago es `npm ci --omit=dev`, que deja afuera Vitest y supertest: la imagen de producción no necesita el runner de tests. Poner multi-stage igual sería ceremonia sin beneficio.

- [ ] **Paso 3: Crear `frontend/.dockerignore`**

```
node_modules
dist
.env
.git
coverage
```

- [ ] **Paso 4: Crear `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA: cualquier ruta que no sea un archivo real cae en index.html,
    # y React Router resuelve la navegación del lado del cliente.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy inverso hacia el backend: mismo origen, sin CORS.
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Qué contestar si te preguntan esto en la defensa — "¿qué hace el proxy inverso y por qué elimina el CORS?"**
> nginx sirve el frontend y, cuando le llega una request que empieza con `/api`, en vez de buscar un archivo la reenvía a `http://backend:3000`. El navegador nunca se entera de que hay dos contenedores: para él existe un solo origen, `http://localhost:8080`, así que no hay petición cruzada, no hay preflight `OPTIONS` y no hace falta ningún `app.use(cors())` en el backend. El `backend` del `proxy_pass` no es un DNS público: lo resuelve el DNS interno de Docker Compose, que mapea los nombres de servicio dentro de la red del proyecto.

> **Qué contestar si te preguntan esto en la defensa — "¿para qué es el `try_files`?"**
> Es lo que hace funcionar el routing del SPA. Si el usuario está en `/ventas/nueva` y aprieta F5, el navegador le pide ese path a nginx, y nginx no tiene ningún archivo ahí: sin el `try_files` devolvería 404. Con él, nginx prueba el archivo, prueba el directorio y, si no encuentra nada, sirve `index.html`; ahí carga React, React Router lee la URL y muestra la pantalla correcta. Las rutas del SPA existen en el navegador, no en el disco del servidor.

- [ ] **Paso 5: Crear `frontend/Dockerfile`**

```dockerfile
# ---------- Etapa 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # genera /app/dist

# ---------- Etapa 2: runtime ----------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Notar que acá el `npm ci` va **sin** `--omit=dev`: Vite es una devDependency y hace falta para buildear.

> **Qué contestar si te preguntan esto en la defensa — "¿qué es un build multi-stage y por qué acá sí?"**
> Es un Dockerfile con varias imágenes base donde la última se queda solo con lo que copia explícitamente de las anteriores. El frontend sí compila: Node, Vite y unos 300 MB de `node_modules` son necesarios para producir `dist/`, y completamente inútiles después. La etapa 2 arranca de `nginx:alpine` y copia únicamente `dist/`, que es HTML, CSS y JS estáticos. El resultado son unos 25 MB en lugar de unos 400. Y no es solo tamaño: la imagen final no tiene Node, ni npm, ni el código fuente, así que la superficie de ataque baja muchísimo — es el ejemplo canónico para el TP9, menos cosas en la imagen, menos CVEs que reportar.

- [ ] **Paso 6: Crear `docker-compose.yml` en la raíz del repo**

```yaml
services:
  db:
    image: mysql:8
    container_name: erp-db
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: erp
      MYSQL_USER: erp_user
      MYSQL_PASSWORD: erp_pass
    volumes:
      - db_data:/var/lib/mysql
      - ./backend/db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-prootpass"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  backend:
    build: ./backend
    container_name: erp-backend
    environment:
      DB_HOST: db
      DB_PORT: 3306
      DB_USER: erp_user
      DB_PASSWORD: erp_pass
      DB_NAME: erp
      JWT_SECRET: dev-secret-cambiar-en-prod
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: erp-frontend
    ports:
      - "8080:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  db_data:
```

> **Qué contestar si te preguntan esto en la defensa — "¿para qué el healthcheck si ya tenés `depends_on`?"**
> Porque `depends_on` a secas solo espera a que el contenedor **arranque**, no a que MySQL esté aceptando conexiones — y MySQL tarda decenas de segundos en inicializarse la primera vez, mientras corre el `init.sql`. Sin healthcheck, el backend arranca, no puede conectarse y muere. Con `condition: service_healthy`, Docker espera a que `mysqladmin ping` responda antes de levantar el backend. Es la diferencia entre "el contenedor existe" y "el servicio está listo".

> **Qué contestar si te preguntan esto en la defensa — "¿por qué el backend no publica puertos al host?"**
> Porque no hace falta: el único que le habla es nginx, y lo alcanza por la red interna de compose con el nombre de servicio `backend`. Publicarlo sería exponer superficie sin motivo. Además me obliga a que el proxy funcione de verdad: si publicara el 3000, podría estar pegándole directo desde el navegador sin darme cuenta y descubrir el problema recién en la entrega. Y esas variables de entorno están en el compose, no adentro de la imagen: la imagen no sabe nada de su entorno, que es exactamente lo que el TP6 necesita para apuntar el mismo digest a QA y a PROD.

- [ ] **Paso 7: Levantar todo**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
docker compose up --build
```

Esperado: los tres servicios buildean y arrancan. En los logs de `erp-backend` tiene que aparecer `[server] escuchando en el puerto 3000`. Si en cambio aparece `[config] Faltan variables de entorno obligatorias: ...`, falta una variable en el bloque `environment` del compose.

- [ ] **Paso 8: Verificar que la base se sembró**

En otra terminal:

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
docker compose exec db mysql -uerp_user -perp_pass erp -e "SELECT id, email FROM usuarios; SELECT id, nombre, stock FROM productos;"
```

Esperado: una fila con `admin@erp.local` y dos productos, `Teclado` con stock 20 y `Monitor` con stock 5. Si la tabla `usuarios` está vacía, el `init.sql` no corrió: bajá con `docker compose down -v` (que borra el volumen) y volvé a levantar.

- [ ] **Paso 9: Verificar el health del backend**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
docker compose exec backend wget -qO- http://localhost:3000/health
```

Esperado: `{"status":"ok"}`.

- [ ] **Paso 10: Verificación end-to-end a mano (esta es la evidencia del TP)**

Abrir `http://localhost:8080` y hacer, en este orden, sacando una captura de pantalla en cada punto marcado con 📸:

1. La app redirige sola a `/login`.
2. Loguearse con `admin@erp.local` / `Admin123!`. Entra a `/productos`. 📸
3. Probar primero el error: loguearse con una contraseña mal escrita muestra "Email o contraseña incorrectos". 📸
4. En `/productos`, cargar `Mouse` con precio `9500.50` y stock `30`, y apretar Guardar. Aparece en la tabla. 📸
5. Intentar guardar un producto con precio `-5`: aparece el mensaje de error y **no** se agrega nada a la tabla. 📸
6. En `/clientes`, crear un cliente con el email `demo@cliente.local` (el que ya existe): aparece "Ya existe un cliente con el email demo@cliente.local". 📸
7. En `/ventas/nueva`, verificar que "Confirmar venta" arranca deshabilitado. Elegir el cliente `Cliente Demo`, agregar 2 `Teclado` y 1 `Monitor`: el total tiene que decir `210000.00`. Quitar el monitor: baja a `30000.00`. Volver a agregarlo. 📸
8. Confirmar la venta. Redirige a `/ventas` y la venta aparece con total `210000.00` y estado `pendiente`. 📸
9. Volver a `/productos`: **el stock del Teclado bajó de 20 a 18 y el del Monitor de 5 a 4**. 📸
10. En `/ventas`, "Ver detalle" de la venta: se ven los dos ítems con sus precios congelados.
11. Apretar "Anular". El estado pasa a `anulada`. 📸
12. Volver a `/productos`: **el stock volvió a 20 y a 5**. 📸
13. En `/ventas`, el botón "Anular" de esa venta ahora está deshabilitado. Para verificar el `409` del backend directamente:

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
docker compose exec backend wget -qO- --header="Content-Type: application/json" --post-data='{"email":"admin@erp.local","password":"Admin123!"}' http://localhost:3000/api/auth/login
```

Copiar el `token` de la respuesta y usarlo (reemplazando `<token>` y `<id>` por los valores reales):

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
docker compose exec backend wget -qO- --header="Authorization: Bearer <token>" --post-data='' http://localhost:3000/api/ventas/<id>/anular
```

Esperado: falla con `409 Conflict` y el cuerpo `{"error":{"code":"VENTA_YA_ANULADA","message":"La venta <id> ya está anulada"}}`. 📸

14. Verificar que el SPA no rompe con F5: estando en `http://localhost:8080/ventas/nueva`, refrescar. Tiene que seguir mostrando la pantalla de nueva venta (eso prueba el `try_files`) y **no** pedir el login de nuevo (eso prueba que el token se lee de `localStorage` al montar). 📸

- [ ] **Paso 11: Bajar los contenedores**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
docker compose down
```

- [ ] **Paso 12: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add docker-compose.yml backend/Dockerfile backend/.dockerignore frontend/Dockerfile frontend/.dockerignore frontend/nginx.conf
git commit -m "feat(docker): contenedores de db, backend y frontend con proxy nginx"
```

---

## Tarea 12: Documentación de cierre

**Files:**
- Modify: `README.md`
- Modify: `decisiones.md`
- Modify: `evidencias.md`

**Interfaces:**
- Consumes: todo lo construido en las tareas 1 a 11. En particular, los comandos verificados en la Tarea 11 (`docker compose up --build`, `http://localhost:8080`, el usuario `admin@erp.local` / `Admin123!`) y los comandos de test de las tareas 1 a 10 (`npm test` en `backend/` y en `frontend/`).
- Produces: nada de código. Es la entrega documental que exige el §6 del reglamento.

- [ ] **Paso 1: Reescribir `README.md`**

Contenido completo del archivo (el bloque de afuera va con cuatro backticks
porque adentro hay bloques de código; en el `README.md` real van tres):

````markdown
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
| Backend | Node.js 20 + Express, `mysql2` con SQL a mano |
| Base de datos | MySQL 8 (InnoDB, utf8mb4) |
| Tests | Vitest + supertest (backend) · Vitest + React Testing Library (frontend) |

## Levantar todo con Docker (recomendado)

Requiere Docker Desktop.

```bash
docker compose up --build
```

Después, abrir **http://localhost:8080**.

Usuario: `admin@erp.local` · Contraseña: `Admin123!`

> El hash del usuario está sembrado en `backend/db/init.sql`. Si lo regenerás,
> usá `node -e "console.log(require('bcrypt').hashSync('Admin123!',10))"` desde
> `backend/` y acordate de hacer `docker compose down -v` para que la base se
> vuelva a sembrar.

Comandos útiles:

```bash
docker compose logs -f backend    # ver el arranque y los errores de entorno
docker compose down               # bajar todo, la base persiste en el volumen
docker compose down -v            # bajar y BORRAR el volumen (re-ejecuta init.sql)
```

## Levantar en desarrollo, sin Docker

Necesitás un MySQL 8 corriendo en `localhost:3306` con el `init.sql` ya
ejecutado.

Backend:

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

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
| `JWT_SECRET` | `dev-secret-no-usar-en-prod` | secreto del entorno |
| `PORT` | `3000` | `3000` |

El frontend **no usa ninguna variable de entorno**: llama siempre a rutas
relativas `/api/...` y quien resuelve a dónde van es el proxy (Vite en
desarrollo, nginx en producción).

## Tests

```bash
cd backend
npm test          # 8 tests de reglas de negocio + validación de entorno
```

```bash
cd frontend
npm test          # 4 tests de comportamiento de UI
```

Los tests de backend **no necesitan MySQL levantado**: la capa `models/` se
mockea con `vi.mock`.

## Estructura

```
backend/
  src/config/      env.js (valida las 7 variables) y db.js (pool de mysql2)
  src/models/      SQL parametrizado. Nunca ve req ni res.
  src/services/    Reglas de negocio y transacciones.
  src/controllers/ HTTP. Nunca ve SQL.
  src/routes/      Rutas + el middleware de auth, montado una sola vez.
  src/middlewares/ auth.js y errorHandler.js
  db/init.sql      Esquema y semilla
  tests/
frontend/
  src/api/         Único lugar que llama a fetch
  src/context/     AuthContext
  src/components/  RutaProtegida, Nav
  src/pages/       Login, Productos, Clientes, NuevaVenta, Ventas
  tests/
  nginx.conf       try_files del SPA + proxy inverso de /api
docker-compose.yml
```
````

- [ ] **Paso 2: Agregar las entradas nuevas a `decisiones.md`**

Agregar al **final** del archivo, después de la sección "3. Declaración de uso de IA" del TP1. El archivo del TP1 no se toca: las entradas se acumulan por fecha, que es lo que pide el reglamento.

```markdown
---

# Decisiones — App del semestre (ERP mínimo)

**Fecha:** 2026-08-13

El diseño completo está en `docs/superpowers/specs/2026-08-13-erp-minimo-design.md`.
Esta tabla es el resumen defendible: qué elegí, contra qué, y por qué.

| # | Decisión | Alternativa descartada | Por qué |
|---|----------|------------------------|---------|
| 1 | ERP mínimo (clientes / productos / ventas) como dominio | To-do list, blog, CRUD plano | Tiene reglas de negocio reales y baratas (stock, total, anulación) que dan material genuino para los 8 tests del TP5. Un CRUD plano obliga a inventar tests. |
| 2 | React 18 + Vite, Node + Express, MySQL 8 | Next.js full-stack, Django, Spring Boot | Tres piezas separadas y visibles, como pide la cátedra. Un framework full-stack esconde la frontera front/back, que es justo lo que hay que contenerizar por separado. |
| 3 | `mysql2` con SQL a mano | Sequelize / Prisma / TypeORM | Transparencia total del modelo y transacciones explícitas en la defensa. Menos superficie que explicar y que pueda fallar en CI. Costo asumido: escribir el SQL, siempre parametrizado con `?`. |
| 4 | MVC en tres capas con la regla "el controller nunca ve SQL, el model nunca ve req/res" | Todo en las rutas; o arquitectura hexagonal completa | La regla dura es la que permite mockear `models/` y correr los tests sin base. La hexagonal agrega puertos y adaptadores que no compran nada a esta escala. |
| 5 | `app.js` separado de `server.js` | Un solo archivo con `listen()` al final | supertest levanta la app sin abrir puerto: tests paralelos, sin conflictos de puerto ni procesos colgados. |
| 6 | Único `errorHandler` centralizado con contrato `{ error: { code, message } }` | `try/catch` con `res.status()` en cada controller | Un solo lugar traduce error a HTTP. El frontend maneja errores de forma uniforme porque hay un único formato. |
| 7 | `precio_unitario` y `subtotal` congelados en `venta_items` | JOIN a `productos.precio` al consultar | Sin congelar, cambiar el precio de un producto reescribiría el histórico y el `total` dejaría de cuadrar con sus ítems. La redundancia es intencional: son valores históricos. |
| 8 | Creación de venta en una sola transacción con `SELECT ... FOR UPDATE` y rollback | Validar stock antes y después descontar sin transacción | Sin transacción, una venta que falla en el ítem 3 deja descontados los ítems 1 y 2. `FOR UPDATE` además evita que dos ventas simultáneas vendan el mismo stock. Es la regla 3 del TP5. |
| 9 | Anular = transición de estado que repone stock (`POST /:id/anular`) | `DELETE` de la venta | Borrar destruye el historial y no repone stock. `pendiente → anulada` es una máquina de estados real, y da dos tests distintos (reglas 5 y 6). |
| 10 | `DELETE` de clientes y productos = baja lógica (`activo = 0`) | Borrado físico | Las FKs con `ON DELETE RESTRICT` harían fallar el borrado de cualquier entidad con ventas, y borrar en cascada destruiría el historial. El flag resuelve las dos cosas. |
| 11 | JWT HS256, 8h, un solo rol | Sesiones con cookie de servidor; o JWT + roles + refresh | El backend queda sin estado (importante para el TP6). Un solo rol porque hay un solo usuario: roles sin usuarios distintos es estructura vacía. |
| 12 | Token en `localStorage` | Cookie `httpOnly` + `SameSite` | La cookie es más segura pero arrastra CSRF y configuración de dominio entre contenedores. Elijo `localStorage` **declarando** la limitación (XSS), no por omisión. |
| 13 | Sin registro público; admin sembrado en `init.sql` | Endpoint `POST /api/usuarios` | Elimina verificación de email, recuperación de contraseña y tres pantallas. No aporta nada al objetivo de la materia. |
| 14 | Siete env vars obligatorias, validadas al arrancar, **sin defaults** | `process.env.DB_HOST \|\| 'localhost'` | Con default, un olvido en PROD arranca "bien" y falla en la primera request, disfrazado de error de app. Sin default, el contenedor muere en el arranque diciendo exactamente qué falta. |
| 15 | `config/env.js` como única puerta a `process.env` | Leer `process.env` donde haga falta | Un solo lugar para validar, un solo lugar para agregar variables. `db.js` no sabe que existen las env vars. |
| 16 | El frontend usa **rutas relativas** y nginx hace de proxy inverso de `/api` | `VITE_API_URL` inyectada en build | Vite congela las `VITE_*` en tiempo de build: una env var del contenedor no puede cambiarlas. El proxy elimina CORS, hace que dev y prod se comporten igual, y deja al frontend con cero variables de entorno. |
| 17 | Vitest en backend y frontend | Jest en el back + Vitest en el front | Un solo runner que aprender y explicar. Vitest es nativo de Vite (JSX sin configurar) y corre ESM en Node sin ceremonia. |
| 18 | Tests de backend con `models/` mockeado, **sin MySQL** | Base de test real o Testcontainers | El pipeline del TP4 se reduce a `npm ci` y `npm test`. Tests deterministas y rápidos. La verificación del SQL real llega en el e2e del TP6: cada nivel de la pirámide cubre lo suyo. |
| 19 | `backend/Dockerfile` de una sola etapa, copiando `package*.json` antes que `src/` | `COPY . .` antes del `npm ci` | El backend no compila, no necesita multi-stage. El orden de copiado hace que la capa de `npm ci` solo se invalide cuando cambian las dependencias, no en cada edición de código. |
| 20 | `frontend/Dockerfile` multi-stage (Node buildea → nginx sirve) | Servir el frontend con Node en producción | La imagen final no lleva Node ni `node_modules`: ~25 MB contra ~400 MB, y muchísima menos superficie de ataque para el TP9. |
| 21 | `healthcheck` en `db` + `depends_on: condition: service_healthy` | `depends_on: [db]` a secas | `depends_on` solo espera a que el contenedor arranque, no a que MySQL acepte conexiones. Sin healthcheck el backend muere en el primer `docker compose up`. |
| 22 | Volumen nombrado `db_data` + `init.sql` en `/docker-entrypoint-initdb.d/` | Sembrar con un script manual después de levantar | La imagen oficial ejecuta el `.sql` sola en el primer arranque. Un comando y el sistema queda usable. |
| 23 | El backend no publica puertos al host | `ports: "3000:3000"` | Menos superficie expuesta y obliga a que el proxy funcione de verdad, en vez de que el frontend le pegue directo por casualidad. |
| 24 | Health check en `GET /health`, fuera de `/api` | `GET /api/health` público | Así la regla "todo `/api` pide token salvo el login" queda sin excepciones y no hay que acordarse de ninguna. |

## Fuera de alcance, a propósito

No se implementan, y no por falta de tiempo: roles y permisos, rate limiting,
refresh tokens, paginación, reportes, soft-delete de ventas (ya existe
`estado = 'anulada'`), registro público de usuarios, ORM y migraciones.
El criterio está en el §13 del diseño. Cada línea que no existe es una línea
que no hay que testear, mantener ni defender.

## Declaración de uso de IA (§6 del reglamento)

**Qué hice con IA.** Usé Claude (Claude Code) en tres momentos:

1. **Diseño.** Exploración de alternativas (ORM contra SQL a mano, cookie
   `httpOnly` contra `localStorage`, base de test contra mockear `models/`) y
   redacción del documento de diseño
   `docs/superpowers/specs/2026-08-13-erp-minimo-design.md`.
2. **Plan de implementación.** Descomposición en tareas con ciclo TDD, en
   `docs/superpowers/plans/2026-08-13-erp-minimo.md`.
3. **Código.** Escritura del código de la app siguiendo ese plan.

**Qué NO hice con IA.** La elección del dominio, el recorte de alcance, la
verificación de que todo corre y la validación de cada decisión contra lo que
pide la cátedra.

**Cómo lo verifiqué.** Todas las afirmaciones de este repositorio están
comprobadas contra la ejecución real:

- Los 12 tests corren y pasan: `npm test` en `backend/` y en `frontend/`.
- Los tres contenedores levantan con `docker compose up --build` y la app
  responde en http://localhost:8080.
- El recorrido completo (login, alta de producto, venta, descuento de stock,
  anulación, reposición de stock) está documentado con capturas en
  `evidencias.md`.
- El hash bcrypt sembrado en `init.sql` lo generé y lo verifiqué a mano con
  `bcrypt.compareSync`.

**Defendible.** No hay una sola línea de este diseño que no pueda explicar. Si
algo no se podía explicar, se sacó: ese fue el criterio para descartar el ORM,
los roles y todo lo que está en "fuera de alcance".
```

- [ ] **Paso 3: Agregar las entradas nuevas a `evidencias.md`**

Agregar al **final** del archivo, sin tocar las cuatro secciones del TP1. Las imágenes son las capturas del Paso 10 de la Tarea 11: guardalas en `img/` con esos nombres exactos.

```markdown
---

# Evidencias — App del semestre (ERP mínimo)

**Fecha:** 2026-08-13

## 5. Login y credenciales inválidas

![login exitoso](img/05-login.png)

Login con `admin@erp.local`. El token se guarda en `localStorage` y la app
redirige a `/productos`.

![credenciales inválidas](img/06-login-invalido.png)

Con la contraseña incorrecta la API devuelve `401 CREDENCIALES_INVALIDAS` y el
mismo mensaje que para un email inexistente, para no revelar qué emails están
registrados. El `password_hash` no aparece en ninguna respuesta.

## 6. ABM de productos y validación del formulario

![alta de producto](img/07-alta-producto.png)

![validación de precio](img/08-validacion-precio.png)

Con `precio = -5` el formulario muestra el error y **no llama a la API**: no
hay una segunda request en la pestaña Network. La misma regla la valida el
backend, que es la frontera confiable.

## 7. Email duplicado de cliente

![email duplicado](img/09-email-duplicado.png)

`409 EMAIL_DUPLICADO`. La garantía real es la restricción `UNIQUE` de la base;
la consulta previa del service solo da un mensaje más claro.

## 8. Carrito: total en vivo y botón deshabilitado

![carrito con total](img/10-carrito-total.png)

Dos teclados a $15.000 más un monitor a $180.000 dan $210.000. Al quitar el
monitor, el total baja a $30.000 sin recargar: el total se deriva del carrito,
no se guarda en estado. Con el carrito vacío, "Confirmar venta" está
deshabilitado.

## 9. Venta creada y descuento de stock

![venta creada](img/11-venta-creada.png)

![stock descontado](img/12-stock-descontado.png)

Después de confirmar, el stock del Teclado bajó de 20 a 18 y el del Monitor de
5 a 4. El descuento ocurre dentro de la misma transacción que crea la venta.

## 10. Anulación y reposición de stock

![venta anulada](img/13-venta-anulada.png)

![stock repuesto](img/14-stock-repuesto.png)

La venta pasa a `anulada` (no se borra) y el stock vuelve a 20 y a 5.

![doble anulación rechazada](img/15-doble-anulacion.png)

Anular una venta ya anulada devuelve `409 VENTA_YA_ANULADA`. `anulada` es un
estado terminal.

## 11. Los 12 tests en verde

![tests de backend](img/16-tests-backend.png)

![tests de frontend](img/17-tests-frontend.png)

Los 8 tests de backend corren **sin MySQL levantado**: la capa `models/` está
mockeada con `vi.mock`.

## 12. Los tres contenedores corriendo

![docker compose ps](img/18-docker-compose.png)

`db`, `backend` y `frontend`. El backend no publica puertos al host: solo se
llega a él por la red interna de compose, a través del proxy inverso de nginx.

![refresh en una ruta del SPA](img/19-spa-refresh.png)

F5 estando en `/ventas/nueva` sigue mostrando la pantalla (`try_files` de
nginx) y no pide el login de nuevo (el token se lee de `localStorage` al
montar el `AuthContext`).
```

- [ ] **Paso 4: Verificar que los 12 tests pasan de punta a punta**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\backend
npm test
```

Esperado: `Test Files 5 passed (5)` · `Tests 36 passed (36)`.

```bash
cd C:\Users\ADMIN\ingsoft3-tp01\frontend
npm test
```

Esperado: `Test Files 3 passed (3)` · `Tests 8 passed (8)`.

- [ ] **Paso 5: Commit**

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git add README.md decisiones.md evidencias.md img
git commit -m "docs: README de arranque, decisiones del ERP y evidencias"
```

- [ ] **Paso 6: Pushear la rama y abrir el Pull Request**

`main` está protegida desde el TP1: el trabajo entra por PR.

```bash
cd C:\Users\ADMIN\ingsoft3-tp01
git push -u origin feature/erp-minimo
```

Después, desde GitHub, abrir el PR de `feature/erp-minimo` hacia `main` y
mergearlo.

---

## Mapeo de los 12 tests del TP5 a las tareas

### Backend (8)

| # | Test | Categoría | Tarea | Archivo |
|---|------|-----------|-------|---------|
| 1 | `POST /api/ventas` con `items: []` → `400 VENTA_SIN_ITEMS` y ningún model llamado | Validación | **6** | `backend/tests/ventas.test.js` |
| 2 | `POST /api/ventas` con `cantidad: 0` (y `-3`) → `400 CANTIDAD_INVALIDA` | Validación | **6** | `backend/tests/ventas.test.js` |
| 3 | `POST /api/ventas` con `cantidad > stock` → `409 STOCK_INSUFICIENTE`, `descontarStock` **no** llamado y `rollback()` sí | Restricción / integridad transaccional | **6** | `backend/tests/ventas.test.js` |
| 4 | `POST /api/ventas` válida → `201`, `total = 210000` y `descontarStock` llamado con las cantidades exactas | Cálculo | **6** | `backend/tests/ventas.test.js` |
| 5 | `POST /api/ventas/:id/anular` sobre venta `pendiente` → `200`, estado `anulada` y `reponerStock` por cada ítem | Transición de estado | **7** | `backend/tests/ventas.test.js` |
| 6 | `POST /api/ventas/:id/anular` sobre venta `anulada` → `409 VENTA_YA_ANULADA` y `reponerStock` **no** llamado | Transición de estado inválida | **7** | `backend/tests/ventas.test.js` |
| 7 | `POST /api/clientes` con email existente → `409 EMAIL_DUPLICADO` y `crear` no llamado | Restricción (unicidad) | **4** | `backend/tests/clientes.test.js` |
| 8 | `POST /api/auth/login` con password incorrecta → `401` y `password_hash` ausente del body | Autorización | **3** | `backend/tests/auth.test.js` |
| extra | Endpoint protegido sin header `Authorization` → `401 TOKEN_FALTANTE` | Autorización | **3** | `backend/tests/auth.test.js` |

### Frontend (4)

| # | Test | Categoría | Tarea | Archivo |
|---|------|-----------|-------|---------|
| 1 | Formulario de producto con `precio: -5` o nombre vacío → aparece el error y `fetch` no se vuelve a llamar | Validación | **9** | `frontend/tests/productos.test.jsx` |
| 2 | Agregar dos líneas al carrito y quitar una → el total mostrado coincide con la suma restante | Cálculo | **10** | `frontend/tests/nuevaVenta.test.jsx` |
| 3 | Carrito vacío → "Confirmar venta" tiene el atributo `disabled` | Restricción de UI | **10** | `frontend/tests/nuevaVenta.test.jsx` |
| 4 | Renderizar `/productos` sin token en `localStorage` → se muestra la pantalla de login | Autorización | **8** | `frontend/tests/rutaProtegida.test.jsx` |

---

## Resumen de tareas

| Tarea | Entregable verificable | Cierra |
|-------|------------------------|--------|
| 1 | Backend arranca, valida las 7 env vars y responde `/health` | — |
| 2 | `init.sql` con las 5 tablas y el admin sembrado | — |
| 3 | Login funcionando y todo `/api` protegido | Test backend 8 + extra |
| 4 | CRUD de clientes con baja lógica y unicidad de email | Test backend 7 |
| 5 | CRUD de productos con validaciones y operaciones de stock | — |
| 6 | Venta creada en una transacción, con bloqueo y rollback | Tests backend 1, 2, 3, 4 |
| 7 | Anulación que repone stock y rechaza la doble anulación | Tests backend 5, 6 |
| 8 | Frontend con proxy, login y ruta protegida | Test frontend 4 |
| 9 | ABM de productos y clientes | Test frontend 1 |
| 10 | Carrito de venta y listado con anulación | Tests frontend 2, 3 |
| 11 | Los tres contenedores y el recorrido end-to-end verificado | — |
| 12 | README, `decisiones.md` y `evidencias.md` | §6 del reglamento |

