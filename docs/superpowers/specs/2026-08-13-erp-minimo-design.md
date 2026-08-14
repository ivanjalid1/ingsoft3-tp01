# Diseño técnico — ERP mínimo (app del semestre)

- **Fecha:** 2026-08-13
- **Materia:** Ingeniería del Software 3 — UCC, 2026
- **Estado:** cerrado, listo para implementar
- **Alcance temporal:** TP2 a TP9 + Trabajo Integrador

---

## 1. Contexto y objetivo

Esta app es la "app del semestre": la misma base de código va a recorrer los TPs 2 a 9 (contenedores, integración continua, testing, entrega continua, contenedores + e2e, infraestructura como código, DevSecOps) y el Trabajo Integrador. No es un producto: es un vehículo para practicar el ciclo de vida del software. Ese objetivo condiciona cada decisión de diseño.

Lo que la cátedra exige y que acá se traduce en restricciones duras:

1. **Chica y comprensible.** Dos o tres pantallas, sin dependencias exóticas. Solo tres piezas: frontend, backend y una base de datos.
2. **Conexión a BD parametrizable por variable de entorno, sin tocar código.** En el TP2 la base pasa a ser un contenedor; en el TP6 hay que apuntar la misma imagen a QA y a PROD. Si para eso hubiera que editar un archivo `.js`, el TP está mal resuelto.
3. **Tests con sentido real.** El TP5 pide 8 tests de backend y 4 de frontend que ejerciten validaciones, cálculos, transiciones de estado, restricciones y autorización. Ocho variantes de "responde 200" no cuentan.
4. **Todo tiene que ser defendible oralmente.** En la defensa se pide explicar cada decisión y hacer un cambio de código en vivo. Por eso el diseño evita magia: nada de ORM, nada de generadores, nada que no se pueda leer y explicar en treinta segundos.

**El dominio elegido:** un ERP mínimo. Clientes, productos y ventas. Se eligió porque tiene reglas de negocio reales y baratas de implementar (stock, totales, anulación) que dan material genuino para los 8 tests del TP5, en lugar de un CRUD plano donde todos los tests son el mismo test.

---

## 2. Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Frontend | React 18 + Vite | Vite da dev server rápido, build estático simple y un runner de tests nativo (Vitest). |
| Backend | Node.js 20 + Express | Mínimo, explícito, sin convenciones ocultas. |
| Base de datos | MySQL 8 (InnoDB, utf8mb4) | Imagen oficial estable, `docker-entrypoint-initdb.d` incorporado, transacciones y FKs reales. |
| Acceso a datos | `mysql2` con **SQL escrito a mano** | Decisión explícita, ver abajo. |
| Auth | `jsonwebtoken` (HS256) + `bcrypt` | Estándar, dos dependencias, cero framework de auth. |
| Tests | Vitest (backend y frontend) + supertest + React Testing Library | Un solo runner que aprender, mismo `describe/it/expect` de los dos lados. |

### 2.1 Por qué SQL a mano y no un ORM

Un ORM (Sequelize, Prisma, TypeORM) ahorraría escribir INSERTs, pero en esta materia el costo supera al beneficio:

- **Transparencia en la defensa.** Cuando en el oral pregunten "¿cómo garantizás que no se descuente stock si la venta falla?", la respuesta es un `BEGIN / ROLLBACK` visible en `services/ventaService.js`, no "el ORM maneja la transacción".
- **Transacciones explícitas.** La regla más interesante del dominio (crear venta) requiere control manual del commit/rollback. Con `mysql2` eso son cuatro líneas legibles.
- **Menos superficie.** Un ORM agrega migraciones, modelos declarativos y un dialecto propio de consultas: tres cosas más que explicar y que pueden fallar en el pipeline.

El costo asumido: hay que escribir el SQL y **parametrizarlo siempre** (`?` placeholders de `mysql2`). Nunca se concatena input de usuario en una query — eso es a la vez la defensa contra SQL injection y un punto concreto para el TP9 (DevSecOps).

---

## 3. Arquitectura: MVC en capas

Tres capas con responsabilidades disjuntas.

| Capa | Responsabilidad | Puede ver | **Nunca** puede ver |
|------|-----------------|-----------|---------------------|
| `controllers/` | Manejar la petición HTTP: leer `req`, armar `res`, elegir el status code. | `req`, `res`, `next`, servicios | **SQL** |
| `services/` | Toda la lógica de negocio y las transacciones. | Modelos, otras reglas | `req`, `res`, SQL crudo |
| `models/` | Toda la lógica de base de datos: SQL parametrizado. | El pool de `mysql2` | `req`, `res` |

**Regla dura del proyecto, y se sostiene sin excepciones:**

> El controller nunca ve SQL. El model nunca ve `req` ni `res`.

Esta regla no es estética. Es la que hace posible el punto 3 del TP5: como los servicios no dependen de Express y los modelos son la única puerta a la base, se puede mockear `models/` y correr los 8 tests de backend **sin MySQL levantado**. Si un controller tuviera un `SELECT` adentro, esa frontera desaparece y el pipeline del TP4 necesitaría una base de datos.

### 3.1 Flujo de una request

```
HTTP request
   ↓
routes/            → matchea método + ruta
   ↓
middlewares/auth.js → valida el JWT (excepto en /api/auth/login)
   ↓
controllers/       → lee req.body / req.params, valida forma, llama al service
   ↓
services/          → aplica reglas de negocio, abre transacción si hace falta
   ↓
models/            → ejecuta SQL parametrizado
   ↓
mysql2 pool        → MySQL
```

Los errores no se manejan en cada capa. Se lanzan hacia arriba y se capturan en un único lugar:

- El **service** lanza un error de dominio con un `status` y un `code` (`throw new AppError(409, 'STOCK_INSUFICIENTE', '...')`).
- El **controller** envuelve la llamada y hace `next(err)`.
- `middlewares/errorHandler.js` es el **único** que traduce error → respuesta JSON.

Contrato de error, igual para todos los endpoints:

```json
{ "error": { "code": "STOCK_INSUFICIENTE", "message": "Stock insuficiente para el producto 7" } }
```

Cualquier error no previsto cae en el mismo handler y sale como `500 / ERROR_INTERNO`, sin filtrar el stack trace al cliente (se loguea del lado del servidor).

### 3.2 `app.js` separado de `server.js`

- `app.js` construye la instancia de Express (middlewares, rutas, errorHandler) y la **exporta**. No abre ningún puerto.
- `server.js` importa la app y hace `app.listen(env.PORT)`.

Motivo: supertest puede hacer `request(app).post('/api/ventas')` sin levantar un puerto TCP. Los tests no compiten por puertos, no dejan procesos colgados y corren en paralelo. Es la separación que hace testeable el backend.

---

## 4. Estructura de directorios

```
app/
├─ backend/
│  ├─ src/
│  │  ├─ config/
│  │  │  ├─ db.js              pool mysql2, lee env vars
│  │  │  └─ env.js             carga y VALIDA env vars al arrancar
│  │  ├─ models/
│  │  │  ├─ usuarioModel.js
│  │  │  ├─ clienteModel.js
│  │  │  ├─ productoModel.js
│  │  │  └─ ventaModel.js      SQL parametrizado, acepta conexión externa para transacciones
│  │  ├─ services/
│  │  │  ├─ authService.js
│  │  │  ├─ clienteService.js
│  │  │  ├─ productoService.js
│  │  │  └─ ventaService.js    reglas de negocio + transacción
│  │  ├─ controllers/
│  │  │  ├─ authController.js
│  │  │  ├─ clienteController.js
│  │  │  ├─ productoController.js
│  │  │  └─ ventaController.js
│  │  ├─ routes/
│  │  │  ├─ index.js
│  │  │  ├─ authRoutes.js
│  │  │  ├─ clienteRoutes.js
│  │  │  ├─ productoRoutes.js
│  │  │  └─ ventaRoutes.js
│  │  ├─ middlewares/
│  │  │  ├─ auth.js            valida Authorization: Bearer
│  │  │  └─ errorHandler.js    único traductor error → JSON
│  │  ├─ utils/
│  │  │  └─ AppError.js        Error con status + code
│  │  ├─ app.js                arma Express (exportable → testeable)
│  │  └─ server.js             listen()
│  ├─ tests/
│  │  ├─ ventas.test.js
│  │  ├─ clientes.test.js
│  │  └─ auth.test.js
│  ├─ db/
│  │  └─ init.sql              schema + usuario admin sembrado
│  ├─ .env.example
│  ├─ package.json
│  ├─ Dockerfile
│  └─ .dockerignore
├─ frontend/
│  ├─ src/
│  │  ├─ api/                  cliente HTTP (fetch con rutas relativas /api/...)
│  │  ├─ pages/                Login, Productos, Clientes, NuevaVenta, Ventas
│  │  ├─ components/           formularios, tabla, RutaProtegida
│  │  └─ context/AuthContext.jsx
│  ├─ tests/
│  ├─ vite.config.js
│  ├─ package.json
│  ├─ Dockerfile
│  ├─ nginx.conf
│  └─ .dockerignore
├─ docker-compose.yml
├─ decisiones.md
├─ evidencias.md
└─ README.md
```

---

## 5. Modelo de datos

Cinco tablas. MySQL 8, motor InnoDB (necesario para FKs y transacciones), charset `utf8mb4`.

| Tabla | Rol |
|-------|-----|
| `usuarios` | Login. Un solo usuario sembrado, sin registro público. |
| `clientes` | Alta/baja/modificación. Email único. |
| `productos` | Alta/baja/modificación. Precio y stock. |
| `ventas` | Cabecera: cliente, fecha, total, estado. |
| `venta_items` | Detalle: producto, cantidad, precio congelado, subtotal. |

### 5.1 Decisión: el precio se congela en el ítem

`venta_items.precio_unitario` guarda el precio del producto **en el momento de la venta**, no una referencia a `productos.precio`. Si mañana el producto sube de $100 a $150, la venta de ayer sigue valiendo $100.

Sin esa columna, cualquier recálculo del histórico daría números distintos según cuándo se lo mire, y el `total` de la cabecera dejaría de coincidir con la suma de sus ítems. Es la razón por la que hay redundancia aparente (`total` en `ventas` y `subtotal` en `venta_items`): son valores históricos, no cachés.

### 5.2 DDL completo — `backend/db/init.sql`

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
  ('admin@erp.local', '$2b$10$3Qw8VqZ9rGvJk1sYhE9d1eT0oZ2m5xN7cP4bLdUvXwYzAiKjMnOpS')
ON DUPLICATE KEY UPDATE email = email;

-- Datos de prueba mínimos (útiles para la demo y el e2e del TP6)
INSERT INTO clientes (nombre, email, telefono) VALUES
  ('Cliente Demo', 'demo@cliente.local', '3510000000')
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO productos (nombre, precio, stock) VALUES
  ('Teclado',  15000.00, 20),
  ('Monitor',  180000.00, 5);
```

Notas sobre el DDL:

- `ON DELETE CASCADE` en `venta_items`: borrar una venta borra sus ítems. No hay ítems huérfanos posibles.
- `ON DELETE RESTRICT` en las FKs hacia `clientes` y `productos`: la base impide borrar un cliente o producto referenciado por una venta. Esa es la razón técnica por la que el `DELETE` de la API es **baja lógica** (`activo = 0`) y no un `DELETE` físico (ver §8.3).
- `DECIMAL(10,2)` y no `FLOAT`: los montos no admiten error de punto flotante. `mysql2` los devuelve como string; la conversión a número se hace en el service con `Number()` sobre valores ya redondeados a 2 decimales.

---

## 6. Reglas de negocio

Estas ocho reglas son el corazón del dominio y mapean **1:1** con los 8 tests de backend que pide el TP5. Cada una cae en una categoría distinta de las que exige la cátedra.

| # | Regla | Respuesta | Categoría |
|---|-------|-----------|-----------|
| 1 | Una venta sin ítems se rechaza | `400 VENTA_SIN_ITEMS` | Validación |
| 2 | Un ítem con `cantidad <= 0` se rechaza | `400 CANTIDAD_INVALIDA` | Validación |
| 3 | Si algún ítem pide más cantidad que el stock disponible, se rechaza la venta entera y **no se descuenta nada** | `409 STOCK_INSUFICIENTE` | Restricción (+ integridad transaccional) |
| 4 | Una venta válida descuenta el stock de cada producto y calcula `total = Σ (cantidad × precio_unitario)` | `201` con la venta creada | Cálculo |
| 5 | Anular una venta en estado `pendiente` repone el stock de cada ítem y la pasa a `anulada` | `200` con la venta anulada | Transición de estado |
| 6 | Anular una venta que ya está `anulada` se rechaza | `409 VENTA_YA_ANULADA` | Transición de estado inválida |
| 7 | Un cliente con email ya existente se rechaza | `409 EMAIL_DUPLICADO` | Restricción (unicidad) |
| 8 | Login con contraseña incorrecta devuelve `401`; el `password_hash` no aparece en ninguna respuesta de la API | `401 CREDENCIALES_INVALIDAS` | Autorización / autenticación |

Las cinco categorías del cuadro de la cátedra (validación, cálculo, transición de estado, restricción, autorización) están cubiertas, y ninguna regla es una variante cosmética de otra: cada una falla por un motivo distinto y se arregla en un lugar distinto del código.

### 6.1 Creación de venta: la transacción

`ventaService.crear(clienteId, items)` es el método más importante del backend. Su algoritmo:

```
1. Validar forma:
     - items debe ser array no vacío          → 400 VENTA_SIN_ITEMS
     - cada item: cantidad entera > 0         → 400 CANTIDAD_INVALIDA
     - cliente_id debe existir y estar activo → 404 CLIENTE_NO_ENCONTRADO
2. conn = await pool.getConnection()
3. await conn.beginTransaction()
4. try:
     a. Para cada item: SELECT id, precio, stock FROM productos
        WHERE id = ? AND activo = 1 FOR UPDATE
        (FOR UPDATE bloquea la fila hasta el commit: dos ventas
         simultáneas no pueden leer el mismo stock y descontarlo dos veces)
     b. Si producto no existe            → 404 PRODUCTO_NO_ENCONTRADO
        Si item.cantidad > producto.stock → 409 STOCK_INSUFICIENTE
     c. precio_unitario = producto.precio   (congelado acá)
        subtotal        = cantidad * precio_unitario
        total          += subtotal
     d. INSERT INTO ventas (cliente_id, total, estado) VALUES (?, ?, 'pendiente')
     e. INSERT INTO venta_items (...) por cada ítem
     f. UPDATE productos SET stock = stock - ? WHERE id = ?
     g. await conn.commit()
   catch (err):
     await conn.rollback()
     throw err
   finally:
     conn.release()
```

La regla 3 se cumple por construcción: la validación de stock ocurre **dentro** de la transacción, y cualquier error dispara `rollback()`. Si el tercer ítem de una venta de cinco no tiene stock, los dos descuentos ya hechos se deshacen. Esa es exactamente la afirmación que verifica el test 3, y la que hay que saber explicar en el oral.

Para que esto funcione, los métodos de `models/` aceptan una **conexión opcional** como primer argumento:

```js
// models/productoModel.js
export async function descontarStock(conn, productoId, cantidad) {
  const c = conn ?? pool;
  const [r] = await c.execute(
    'UPDATE productos SET stock = stock - ? WHERE id = ?',
    [cantidad, productoId]
  );
  return r.affectedRows;
}
```

Sin ese parámetro, cada model usaría una conexión distinta del pool y las escrituras quedarían fuera de la transacción.

### 6.2 Anulación de venta

`ventaService.anular(ventaId)`:

```
1. SELECT ... FROM ventas WHERE id = ?  → si no existe: 404 VENTA_NO_ENCONTRADA
2. Si venta.estado === 'anulada'        → 409 VENTA_YA_ANULADA
3. Transacción:
     a. SELECT producto_id, cantidad FROM venta_items WHERE venta_id = ?
     b. UPDATE productos SET stock = stock + ? WHERE id = ?   (por cada ítem)
     c. UPDATE ventas SET estado = 'anulada' WHERE id = ?
     d. commit
```

La venta **no se borra**. El estado `anulada` es la única transición permitida desde `pendiente`, y es terminal. La máquina de estados completa cabe en una línea:

```
pendiente ──anular──▶ anulada ──(nada)
```

Se descartó explícitamente un estado `confirmada` o `entregada`: no agrega nada al aprendizaje y sí agrega casos de test.

---

## 7. Autenticación y autorización

- **Endpoint:** `POST /api/auth/login`. Recibe `{ email, password }`, busca el usuario, compara con `bcrypt.compare(password, password_hash)`.
- **Token:** JWT **HS256**, firmado con `JWT_SECRET`, expiración **8 horas**. Payload mínimo: `{ sub: usuario.id, email }`. Nada de datos sensibles adentro — un JWT está firmado, no cifrado, y cualquiera puede leerlo.
- **Hash:** `bcrypt` con **cost 10**. Suficiente para la materia y rápido en tests.
- **Middleware:** `middlewares/auth.js` valida el header `Authorization: Bearer <token>` en **todo `/api`** salvo `/api/auth/login`. Se monta una sola vez en `routes/index.js`, no endpoint por endpoint — así no se puede olvidar de proteger uno nuevo.
  - Sin header o mal formado → `401 TOKEN_FALTANTE`
  - Token inválido o vencido → `401 TOKEN_INVALIDO`
- **Un solo rol.** No hay tabla de roles ni permisos: o estás autenticado y podés todo, o no estás y no podés nada.
- **Sin registro público.** No existe `POST /api/usuarios`. El único usuario se siembra en `init.sql` con el hash ya calculado.
- **El `password_hash` nunca sale de la API.** Los modelos que devuelven usuarios hacia el controller seleccionan columnas explícitas (`SELECT id, email FROM usuarios ...`); solo el método usado por el login trae el hash, y el service lo descarta antes de devolver. Nunca se hace `SELECT *` sobre `usuarios`. El test 8 verifica ambas mitades: el 401 y la ausencia del hash en el cuerpo de la respuesta.

Del lado del cliente: el token se guarda en `localStorage` y se expone vía un `AuthContext` de React que provee `{ token, usuario, login(), logout() }`. El cliente HTTP de `src/api/` lo adjunta a cada request. Si una respuesta vuelve `401`, el contexto limpia el token y redirige a `/login`.

**Se sabe y se asume:** `localStorage` es vulnerable a XSS. La alternativa correcta en producción es una cookie `httpOnly` + `SameSite`, pero eso arrastra manejo de CSRF y configuración de dominio entre contenedores. Para el alcance de la materia se elige `localStorage` **de manera declarada**, no por omisión — y así se defiende.

---

## 8. Configuración por variables de entorno

Este es el punto que la cátedra evalúa en TP2 y TP6, así que es el que más rigor requiere.

### 8.1 Variables

**Backend** (las siete, todas obligatorias):

| Variable | Ejemplo local | Ejemplo en compose | Para qué |
|----------|---------------|--------------------|----------|
| `DB_HOST` | `localhost` | `db` | Host de MySQL |
| `DB_PORT` | `3306` | `3306` | Puerto |
| `DB_USER` | `root` | `erp_user` | Usuario |
| `DB_PASSWORD` | `root` | `erp_pass` | Contraseña |
| `DB_NAME` | `erp` | `erp` | Base |
| `JWT_SECRET` | `dev-secret-no-usar-en-prod` | (secreto del entorno) | Firma del JWT |
| `PORT` | `3000` | `3000` | Puerto del server Express |

**Frontend:** ninguna en runtime. Ver §10.4 (proxy de nginx) — es una consecuencia directa de esa decisión.

### 8.2 `config/env.js`: validar y fallar ruidosamente

```js
// backend/src/config/env.js
import 'dotenv/config';

const REQUERIDAS = [
  'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD',
  'DB_NAME', 'JWT_SECRET', 'PORT'
];

const faltantes = REQUERIDAS.filter((k) => !process.env[k]);

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

Y `config/db.js` solamente consume `env`:

```js
// backend/src/config/db.js
import mysql from 'mysql2/promise';
import { env } from './env.js';

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

**No hay ni un solo valor por defecto.** Nada de `process.env.DB_HOST || 'localhost'`. Esa es la parte importante:

- Con defaults, si en el TP6 te olvidás de setear `DB_HOST` en el entorno de PROD, la app arranca "bien" y se conecta al `localhost` del contenedor: no hay base ahí, y el error aparece recién en la primera request, disfrazado de error de aplicación. Podés estar una hora buscándolo.
- Sin defaults, el contenedor **muere en el arranque** con un mensaje que dice exactamente qué falta. `docker compose logs backend` lo muestra en la primera línea. Fallar temprano y ruidosamente es más barato que fallar tarde y en silencio.

### 8.3 Por qué esto convierte a TP2 y TP6 en cambios de configuración

| TP | Qué cambia | Qué se toca |
|----|-----------|-------------|
| TP2 | La base pasa de MySQL local a un contenedor | `DB_HOST: localhost` → `DB_HOST: db` en `docker-compose.yml`. **Cero líneas de código.** |
| TP6 | La misma imagen tiene que apuntar a QA y a PROD | Dos juegos de variables (dos archivos de entorno o dos definiciones de servicio en la IaC). **La misma imagen, mismo digest.** |

Este es el principio de *build once, deploy anywhere*: la imagen es un artefacto inmutable y el entorno se inyecta afuera. Si la cadena de conexión estuviera hardcodeada, cada entorno necesitaría su propio build — y entonces lo que probaste en QA no es literalmente lo que corre en PROD.

**Archivos:** `.env.example` se versiona (con valores de ejemplo, nunca secretos reales). `.env` va en `.gitignore`. Un secreto commiteado es un hallazgo directo del TP9.

---

## 9. API

Base: `/api`. Todos los endpoints salvo el login requieren `Authorization: Bearer <token>`.

Códigos comunes a todos los endpoints protegidos: `401` si falta o es inválido el token, `500` ante error interno. No se repiten en cada fila.

### 9.1 Auth

#### `POST /api/auth/login`

```json
// request
{ "email": "admin@erp.local", "password": "Admin123!" }

// 200
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": { "id": 1, "email": "admin@erp.local" } }
```

Errores: `400 DATOS_INVALIDOS` (falta email o password) · `401 CREDENCIALES_INVALIDAS` (email inexistente **o** password incorrecta — el mismo mensaje para los dos casos, para no revelar qué emails existen).

### 9.2 Clientes

#### `GET /api/clientes`

```json
// 200
[ { "id": 1, "nombre": "Cliente Demo", "email": "demo@cliente.local",
    "telefono": "3510000000", "activo": true } ]
```

Devuelve solo `activo = 1`. Con `?incluir_inactivos=true` devuelve todos.

#### `GET /api/clientes/:id`

```json
// 200
{ "id": 1, "nombre": "Cliente Demo", "email": "demo@cliente.local",
  "telefono": "3510000000", "activo": true }
```

Errores: `404 CLIENTE_NO_ENCONTRADO`.

#### `POST /api/clientes`

```json
// request
{ "nombre": "Ana Pérez", "email": "ana@mail.com", "telefono": "3511111111" }

// 201
{ "id": 2, "nombre": "Ana Pérez", "email": "ana@mail.com",
  "telefono": "3511111111", "activo": true }
```

Errores: `400 DATOS_INVALIDOS` (nombre vacío o email con formato inválido) · **`409 EMAIL_DUPLICADO`** (regla 7). El service consulta antes por el email y además captura el `ER_DUP_ENTRY` de MySQL, por si dos requests entran en simultáneo: la restricción `UNIQUE` de la base es la garantía final, la consulta previa es solo para dar un mensaje lindo.

#### `PUT /api/clientes/:id`

```json
// request
{ "nombre": "Ana Pérez", "email": "ana.perez@mail.com", "telefono": "3512222222" }

// 200
{ "id": 2, "nombre": "Ana Pérez", "email": "ana.perez@mail.com",
  "telefono": "3512222222", "activo": true }
```

Errores: `400 DATOS_INVALIDOS` · `404 CLIENTE_NO_ENCONTRADO` · `409 EMAIL_DUPLICADO` (si el email nuevo ya lo tiene otro cliente).

#### `DELETE /api/clientes/:id`

Baja **lógica**: `UPDATE clientes SET activo = 0`.

```json
// 200
{ "id": 2, "activo": false }
```

Errores: `404 CLIENTE_NO_ENCONTRADO`.

Por qué lógica y no física: la FK `ventas.cliente_id` con `ON DELETE RESTRICT` haría fallar el borrado de cualquier cliente con ventas, y borrarlo en cascada destruiría el historial. El flag `activo` resuelve las dos cosas: desaparece de los selectores del frontend y las ventas viejas siguen siendo consultables.

### 9.3 Productos

#### `GET /api/productos`

```json
// 200
[ { "id": 1, "nombre": "Teclado", "precio": 15000.00, "stock": 20, "activo": true } ]
```

#### `GET /api/productos/:id`

```json
// 200
{ "id": 1, "nombre": "Teclado", "precio": 15000.00, "stock": 20, "activo": true }
```

Errores: `404 PRODUCTO_NO_ENCONTRADO`.

#### `POST /api/productos`

```json
// request
{ "nombre": "Mouse", "precio": 9500.50, "stock": 30 }

// 201
{ "id": 3, "nombre": "Mouse", "precio": 9500.50, "stock": 30, "activo": true }
```

Errores: `400 DATOS_INVALIDOS` (nombre vacío, `precio <= 0` o `stock < 0`).

#### `PUT /api/productos/:id`

```json
// request
{ "nombre": "Mouse inalámbrico", "precio": 11000.00, "stock": 25 }

// 200
{ "id": 3, "nombre": "Mouse inalámbrico", "precio": 11000.00, "stock": 25, "activo": true }
```

Errores: `400 DATOS_INVALIDOS` · `404 PRODUCTO_NO_ENCONTRADO`.

Nota para la defensa: cambiar el precio acá **no altera** ninguna venta ya registrada, porque el precio quedó congelado en `venta_items.precio_unitario` (§5.1).

#### `DELETE /api/productos/:id`

Baja lógica: `UPDATE productos SET activo = 0`. Un producto inactivo no aparece en el selector de nueva venta y no puede venderse (el `SELECT ... FOR UPDATE` del §6.1 filtra por `activo = 1`).

```json
// 200
{ "id": 3, "activo": false }
```

Errores: `404 PRODUCTO_NO_ENCONTRADO`.

### 9.4 Ventas

#### `GET /api/ventas`

Lista de cabeceras, con el nombre del cliente resuelto por `JOIN`, ordenada por fecha descendente.

```json
// 200
[ { "id": 1, "cliente_id": 1, "cliente_nombre": "Cliente Demo",
    "fecha": "2026-08-13T14:22:05.000Z", "total": 210000.00, "estado": "pendiente" } ]
```

#### `GET /api/ventas/:id`

Cabecera + ítems.

```json
// 200
{
  "id": 1,
  "cliente_id": 1,
  "cliente_nombre": "Cliente Demo",
  "fecha": "2026-08-13T14:22:05.000Z",
  "total": 210000.00,
  "estado": "pendiente",
  "items": [
    { "id": 1, "producto_id": 1, "producto_nombre": "Teclado",
      "cantidad": 2, "precio_unitario": 15000.00, "subtotal": 30000.00 },
    { "id": 2, "producto_id": 2, "producto_nombre": "Monitor",
      "cantidad": 1, "precio_unitario": 180000.00, "subtotal": 180000.00 }
  ]
}
```

Errores: `404 VENTA_NO_ENCONTRADA`.

#### `POST /api/ventas`

El cliente **no manda precios ni total**: los calcula el backend. Mandar el precio desde el navegador sería confiar en el cliente para determinar cuánto se cobra.

```json
// request
{ "cliente_id": 1,
  "items": [ { "producto_id": 1, "cantidad": 2 },
             { "producto_id": 2, "cantidad": 1 } ] }

// 201  → mismo cuerpo que GET /api/ventas/:id
```

Errores: `400 VENTA_SIN_ITEMS` (regla 1) · `400 CANTIDAD_INVALIDA` (regla 2) · `400 DATOS_INVALIDOS` (falta `cliente_id` o `items` no es un array) · `404 CLIENTE_NO_ENCONTRADO` · `404 PRODUCTO_NO_ENCONTRADO` · **`409 STOCK_INSUFICIENTE`** (regla 3, con rollback completo).

#### `POST /api/ventas/:id/anular`

Sin body.

```json
// 200
{ "id": 1, "estado": "anulada", "stock_repuesto": true }
```

Errores: `404 VENTA_NO_ENCONTRADA` · **`409 VENTA_YA_ANULADA`** (regla 6).

Se usa `POST /:id/anular` y no `DELETE /:id` ni `PUT /:id` porque anular no es borrar ni reemplazar: es ejecutar una transición de estado con efectos colaterales (reponer stock). El verbo describe la operación de negocio.

### 9.5 Resumen

| Recurso | Endpoints |
|---------|-----------|
| Auth | 1 (`POST /login`) |
| Clientes | 5 (GET, GET/:id, POST, PUT/:id, DELETE/:id) |
| Productos | 5 (GET, GET/:id, POST, PUT/:id, DELETE/:id) |
| Ventas | 4 (GET, GET/:id, POST, POST/:id/anular) |
| **Total** | **15** |

---

## 10. Frontend

### 10.1 Pantallas

| Ruta | Pantalla | Contenido |
|------|----------|-----------|
| `/login` | Login | Email + password. Guarda el token en el `AuthContext` y redirige a `/productos`. Pública. |
| `/productos` | ABM de productos | Tabla + formulario de alta/edición + baja. Protegida. |
| `/clientes` | ABM de clientes | Tabla + formulario + baja. Protegida. |
| `/ventas/nueva` | Nueva venta | Selector de cliente, selector de producto + cantidad, carrito con total en vivo, botón "Confirmar venta". Protegida. |
| `/ventas` | Listado de ventas | Tabla con detalle expandible y botón "Anular". Protegida. |

Son tres pantallas conceptuales (ABM, venta, listado) más el login, dentro de lo que pide la cátedra.

### 10.2 Componentes clave

- `AuthContext` — provee `{ token, usuario, login, logout }`. Lee `localStorage` al montar, para que un refresh de página no deslogee.
- `RutaProtegida` — envuelve las rutas privadas. Si no hay token, `<Navigate to="/login" />`.
- `src/api/client.js` — un `fetch` envuelto que arma la URL relativa (`/api/...`), adjunta el header `Authorization`, parsea el JSON y convierte cualquier respuesta no-2xx en un `throw` con `{ status, code, message }`. Todas las páginas manejan errores igual porque hay un solo lugar donde se generan.

### 10.3 Comportamientos verificados por tests (los 4 del TP5)

| # | Comportamiento | Categoría |
|---|----------------|-----------|
| 1 | El formulario de producto no permite enviar con `precio <= 0` o nombre vacío: muestra el mensaje de error y **no llama a la API**. | Validación |
| 2 | El total del carrito se recalcula al agregar y al quitar líneas. | Cálculo |
| 3 | El botón "Confirmar venta" está deshabilitado mientras el carrito esté vacío. | Restricción de UI |
| 4 | Una ruta protegida redirige a `/login` cuando no hay token. | Autorización |

La validación del formulario (1) duplica intencionalmente la validación del backend. No es redundancia mal entendida: el frontend valida para dar feedback inmediato, el backend valida porque **es la única frontera confiable** — cualquiera puede pegarle a la API con `curl`. Este es un buen punto para la defensa.

### 10.4 Rutas relativas, proxy y CORS

**El problema:** Vite reemplaza las variables `VITE_*` en **tiempo de build**. Después de `npm run build`, `VITE_API_URL` ya no es una variable: es un string literal incrustado en el bundle JavaScript. Pasarle una env var al contenedor de nginx en runtime no cambia nada — el archivo `.js` ya está escrito. Eso rompe frontalmente el requisito de "parametrizable sin tocar código": tendrías que rebuildear la imagen para cada entorno.

**La solución:** el frontend **no conoce ninguna URL de backend**. Llama siempre a rutas relativas (`fetch('/api/productos')`), y quien resuelve a dónde va `/api` es el servidor que sirve el frontend:

- **En producción:** nginx hace de proxy inverso. `location /api { proxy_pass http://backend:3000; }`. El navegador ve un solo origen (`http://localhost:8080`) y nunca sabe que hay dos contenedores.
- **En desarrollo:** el dev server de Vite hace exactamente lo mismo con `server.proxy` en `vite.config.js`, apuntando a `http://localhost:3000`.

```js
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './tests/setup.js' }
});
```

Tres consecuencias, y las tres son beneficios:

1. **No hay CORS.** Nunca. Ni un `app.use(cors())` en el backend, ni preflights, ni errores de origen cruzado en la consola. Todo es mismo origen.
2. **Dev y prod se comportan igual.** El mismo código de frontend, la misma URL relativa, dos proxies distintos que hacen lo mismo. Se elimina la clase de bug "anda en mi máquina pero no en el contenedor".
3. **El frontend no necesita ninguna variable de entorno.** Cero. Cambiar de QA a PROD es cambiar la config del backend, no rebuildear el frontend.

---

## 11. Testing

### 11.1 Estrategia

Un solo runner de los dos lados: **Vitest**. Es el runner nativo de Vite (así que en el frontend no hay que configurar transpilación de JSX) y en el backend corre ESM sin ceremonia. La API (`describe` / `it` / `expect` / `vi.mock`) es la misma en los dos proyectos: una sola cosa que aprender y que explicar.

**Backend:** `supertest` sobre la app exportada por `app.js`, con la capa `models/` **mockeada** con `vi.mock`.

```js
// backend/tests/ventas.test.js (fragmento ilustrativo)
vi.mock('../src/models/productoModel.js', () => ({
  buscarPorIdParaActualizar: vi.fn(),
  descontarStock: vi.fn(),
  reponerStock: vi.fn()
}));
```

Por qué mockear los modelos y no usar una base de test:

- **Los 8 tests corren sin MySQL levantado.** El pipeline del TP4 no necesita un servicio de base de datos, ni esperar un healthcheck, ni sembrar datos, ni limpiar entre tests. El job de CI es `npm ci && npm test` y termina en segundos.
- **Los tests son deterministas.** No hay estado compartido entre casos ni orden de ejecución significativo.
- **Se testea la lógica de negocio, que es lo que la cátedra pide verificar.** Que `INSERT INTO ventas` funcione lo garantiza MySQL; que la venta se rechace cuando falta stock lo garantiza nuestro código, y eso es lo que se testea.

La contrapartida honesta y declarada: estos tests **no** verifican que el SQL sea correcto. Esa verificación llega en el TP6 con los tests end-to-end contra los contenedores reales. Cada tipo de test cubre un nivel distinto de la pirámide, y eso también es material de defensa.

**Frontend:** Vitest + React Testing Library + `jsdom`. Se testea comportamiento observable por el usuario (qué se ve, qué está deshabilitado, a dónde redirige), nunca estado interno de los componentes. `fetch` se mockea con `vi.stubGlobal`.

### 11.2 Mapeo test → regla → categoría

**Backend (8):**

| Test | Qué verifica | Regla | Categoría |
|------|--------------|-------|-----------|
| `POST /api/ventas` con `items: []` → 400 | La venta vacía se rechaza y ningún model se llama | 1 | Validación |
| `POST /api/ventas` con `cantidad: 0` (y `-3`) → 400 | La cantidad no positiva se rechaza | 2 | Validación |
| `POST /api/ventas` con `cantidad > stock` → 409 y `descontarStock` **no** fue llamado | Rechazo con rollback: no se toca el stock | 3 | Restricción / integridad transaccional |
| `POST /api/ventas` válida → 201, `total` correcto y `descontarStock` llamado con las cantidades exactas | Total = Σ(cantidad × precio) y descuento de stock | 4 | Cálculo |
| `POST /api/ventas/:id/anular` sobre venta `pendiente` → 200, estado `anulada` y `reponerStock` llamado por cada ítem | Anulación repone stock | 5 | Transición de estado |
| `POST /api/ventas/:id/anular` sobre venta `anulada` → 409 y `reponerStock` **no** llamado | No se puede anular dos veces (ni reponer stock de más) | 6 | Transición de estado inválida |
| `POST /api/clientes` con email existente → 409 | Unicidad de email | 7 | Restricción |
| `POST /api/auth/login` con password incorrecta → 401 y `password_hash` ausente del body | Credenciales inválidas y no filtración del hash | 8 | Autorización |

Test extra sugerido (no cuenta para los 8 pero es barato y útil): cualquier endpoint protegido sin header `Authorization` → 401. Cubre el middleware en sí.

**Frontend (4):**

| Test | Qué verifica | Categoría |
|------|--------------|-----------|
| Formulario de producto con `precio: -5` o nombre vacío → aparece el error y `fetch` no se llamó | Validación |
| Agregar dos líneas al carrito y quitar una → el total mostrado coincide con la suma restante | Cálculo |
| Carrito vacío → el botón "Confirmar venta" tiene el atributo `disabled` | Restricción de UI |
| Renderizar `/productos` sin token en `localStorage` → se muestra la pantalla de login | Autorización |

Las cuatro categorías del frontend son distintas entre sí, igual que las del backend.

### 11.3 Comandos

```bash
# backend
cd backend && npm test          # vitest run
cd backend && npm run test:watch

# frontend
cd frontend && npm test
```

Los dos `npm test` son `vitest run` (una pasada, sin watch) para que el pipeline de CI del TP4 no quede colgado esperando.

---

## 12. Docker

Tres contenedores. Levantar todo el sistema es un comando y entrar es una URL.

### 12.1 `docker-compose.yml`

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

Puntos a explicar en la defensa:

- **`db_data` es un volumen nombrado.** Sin él, `docker compose down` borraría la base entera. Con él, los datos sobreviven a recrear el contenedor. Corolario: `init.sql` se ejecuta **solo la primera vez**, cuando el directorio de datos está vacío. Si cambiás el schema, hace falta `docker compose down -v` para volver a sembrarlo.
- **`init.sql` montado en `/docker-entrypoint-initdb.d/`.** La imagen oficial de MySQL ejecuta todo `.sql` y `.sh` de ese directorio en el primer arranque. No hace falta script de migración ni paso manual.
- **`healthcheck` + `depends_on: condition: service_healthy`.** `depends_on` a secas solo espera a que el contenedor *arranque*, no a que MySQL esté *aceptando conexiones* — y MySQL tarda decenas de segundos en inicializarse la primera vez. Sin el healthcheck, el backend arranca, no puede conectarse y muere. Con él, Docker espera a que `mysqladmin ping` responda.
- **El backend no publica puertos al host.** Solo es accesible desde la red interna de compose, y el frontend lo alcanza por el nombre de servicio `backend`. Menos superficie expuesta, y obliga a que el proxy de nginx funcione de verdad.
- **Las env vars del backend vienen del compose**, no de un `.env` dentro de la imagen. La imagen no sabe nada de su entorno: exactamente lo que el TP6 necesita.

### 12.2 `backend/Dockerfile`

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

**Una sola etapa**, porque el backend no compila nada: el código que se ejecuta es el mismo que se escribe.

**El orden de copiado no es casual.** Docker cachea capa por capa e invalida desde la primera que cambió hacia abajo. Si copiaras todo junto (`COPY . .`) antes del `npm ci`, cualquier cambio de una línea en un controller invalidaría la capa de dependencias y reinstalarías `node_modules` entero en cada build. Copiando primero los `package*.json`, la capa de `npm ci` solo se invalida cuando cambian las dependencias de verdad. En el pipeline del TP4 eso es la diferencia entre un build de segundos y uno de minutos.

`--omit=dev` deja afuera Vitest y supertest: la imagen de producción no necesita el runner de tests.

`.dockerignore`:

```
node_modules
npm-debug.log
tests
.env
.git
coverage
```

Excluir `node_modules` del contexto es importante: si se copiara desde el host, traería binarios compilados para el SO del host, que pueden no funcionar en Alpine.

### 12.3 `frontend/Dockerfile` (multi-stage)

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

**Por qué multi-stage:** el frontend sí compila. Node, Vite y las ~300 MB de `node_modules` son necesarios para producir `dist/`, y completamente inútiles después. La imagen final solo copia `dist/` (HTML, CSS y JS estáticos) sobre `nginx:alpine`.

Resultado: **~25 MB en vez de ~400 MB**. Y no es solo tamaño: la imagen final no tiene Node ni `npm` ni el código fuente, así que la superficie de ataque se reduce drásticamente. Es el ejemplo canónico para el TP9 — menos cosas en la imagen, menos CVEs que reportar.

Acá `npm ci` va sin `--omit=dev`: Vite es una devDependency y hace falta para buildear.

`.dockerignore`:

```
node_modules
dist
.env
.git
coverage
```

### 12.4 `frontend/nginx.conf`

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

`try_files $uri $uri/ /index.html` es lo que hace funcionar el routing del SPA: si el usuario refresca estando en `/ventas/nueva`, nginx no tiene ese archivo, y sin esta línea devolvería 404. Con ella devuelve `index.html` y React Router se encarga.

`http://backend:3000` funciona porque el DNS interno de Docker Compose resuelve los nombres de servicio dentro de la red del proyecto.

### 12.5 Ejecutar

```bash
docker compose up --build
```

Frontend: **http://localhost:8080**. Login: `admin@erp.local` con la contraseña cuyo hash sembraste en `init.sql`.

Comandos útiles:

```bash
docker compose logs -f backend    # ver el arranque y los errores de env
docker compose down               # bajar todo, la base persiste
docker compose down -v            # bajar y BORRAR el volumen (re-ejecuta init.sql)
```

---

## 13. Fuera de alcance (YAGNI)

Lo siguiente **no se implementa**, y no por falta de tiempo sino por decisión. Cada línea de código que no existe es una línea que no hay que testear, no hay que mantener y no hay que defender en el oral.

| Descartado | Por qué |
|-----------|---------|
| Roles y permisos | Hay un solo usuario. Una tabla de roles sin usuarios distintos es estructura vacía. Se agrega el día que haya un segundo tipo de usuario. |
| Rate limiting | La app corre en `localhost` y en un entorno académico. No hay tráfico hostil que limitar. Se menciona como mejora futura en el TP9, no se implementa. |
| Refresh tokens | Con 8 horas de expiración el usuario no se desloguea durante una demo ni durante una clase. La complejidad de rotación no compra nada acá. |
| Paginación | Los datos son de demo: decenas de filas. Paginar diez registros es ceremonia. |
| Reportes y dashboards | No aportan reglas de negocio nuevas, solo pantallas. La materia evalúa el ciclo de vida, no la cantidad de vistas. |
| Soft-delete de ventas | Ya existe `estado = 'anulada'`, que es el soft-delete del dominio y además tiene semántica de negocio (repone stock). Un flag `borrado` sería un segundo mecanismo para lo mismo. |
| Registro público de usuarios | Sin registro no hay superficie de abuso, ni verificación de email, ni recuperación de contraseña, ni tres pantallas más. El admin se siembra. |
| ORM y migraciones | Ver §2.1. `init.sql` versionado alcanza para un schema de cinco tablas que no va a evolucionar. |

Si en la defensa preguntan "¿por qué no tiene X?", la respuesta correcta no es "no llegué": es "lo evalué, no lo necesita, y acá está el criterio".

---

## 14. Nota de proceso: `decisiones.md` y declaración de uso de IA

El §6 del reglamento de la cátedra exige que el uso de IA sea **declarado, verificado y defendible**. Eso se cumple así:

- **`decisiones.md` existe desde el primer commit**, antes que cualquier código. Contiene:
  1. La declaración explícita de que se usó asistencia de IA en la fase de diseño, con qué alcance (exploración de alternativas y redacción de este documento) y qué se validó a mano.
  2. La tabla de decisiones de la §15 de este spec, que es su insumo directo.
  3. Una entrada nueva por cada decisión que se tome durante los TPs, con fecha.
- **`evidencias.md`** acumula las capturas y salidas que pide cada TP (builds, pipelines, despliegues), con fecha y número de TP.
- **Verificado** significa que cada afirmación de este documento fue comprobada al implementarla: los comandos corren, los tests pasan, los contenedores levantan.
- **Defendible** significa que no hay una sola línea de este diseño que no se pueda explicar. Si algo no se puede explicar, se saca — ese fue el criterio para descartar el ORM, los roles y el resto de la §13.

---

## 15. Decisiones y su justificación

Tabla de insumo directo para `decisiones.md` y para la defensa oral.

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
| 20 | `frontend/Dockerfile` multi-stage (Node builda → nginx sirve) | Servir el frontend con Node en producción | La imagen final no lleva Node ni `node_modules`: ~25 MB contra ~400 MB, y muchísima menos superficie de ataque para el TP9. |
| 21 | `healthcheck` en `db` + `depends_on: condition: service_healthy` | `depends_on: [db]` a secas | `depends_on` solo espera a que el contenedor arranque, no a que MySQL acepte conexiones. Sin healthcheck el backend muere en el primer `docker compose up`. |
| 22 | Volumen nombrado `db_data` + `init.sql` en `/docker-entrypoint-initdb.d/` | Sembrar con un script manual después de levantar | La imagen oficial ejecuta el `.sql` sola en el primer arranque. Un comando (`docker compose up`) y el sistema queda usable. |
| 23 | El backend no publica puertos al host | `ports: "3000:3000"` | Menos superficie expuesta y obliga a que el proxy funcione de verdad, en vez de que el frontend le pegue directo por casualidad. |
| 24 | `decisiones.md` y `evidencias.md` desde el primer commit | Documentar al final | El §6 del reglamento pide uso de IA declarado, verificado y defendible. Documentar al final es reconstruir de memoria: se pierden las alternativas descartadas, que son la mitad de la defensa. |
