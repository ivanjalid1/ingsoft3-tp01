# demo-fullstack

Sample full-stack de la cátedra **Ingeniería del Software 3 — UCC**. Es la app de referencia que se usa en las demos en vivo de las clases: chica a propósito, con la misma estructura que las guías de TP asumen para tu app del semestre.

**Stack**: backend **.NET 8** (minimal API) · frontend **React + Vite** · base de datos **PostgreSQL**.

## Qué hace

Una lista de tareas mínima. La API expone tres endpoints CRUD:

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tareas` | Lista todas las tareas |
| `POST` | `/api/tareas` | Crea una tarea (`{ "titulo": "..." }`) |
| `DELETE` | `/api/tareas/{id}` | Borra una tarea |

Además: `GET /health` para chequeos de disponibilidad.

## Estructura

```
├── backend/    # Solución .NET: DemoApi (API) + DemoApi.Tests (xUnit)
└── frontend/   # SPA React con Vite (tests con vitest)
```

## Correr en local

Necesitás un **PostgreSQL local** escuchando en `localhost:5432` con una database `app` (usuario `postgres` / password `postgres` — o ajustá `backend/DemoApi/appsettings.json`).

```bash
# Backend (crea el schema al arrancar) → http://localhost:8080
cd backend
dotnet run --project DemoApi

# Frontend (en otra terminal) → http://localhost:5173
cd frontend
npm install
npm run dev     # las llamadas a /api las proxea Vite al backend (vite.config.js)
```

## Tests

```bash
# Backend: 4 unit tests xUnit sobre la lógica de validación
cd backend && dotnet test Backend.sln

# Frontend: 4 unit tests vitest sobre lógica pura (sin DOM)
cd frontend && npm test -- --run
```
