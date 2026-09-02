# Ingeniería de Software III — UCC 2026

[![CI](https://github.com/ivanjalid1/ingsoft3-tp01/actions/workflows/ci.yml/badge.svg)](https://github.com/ivanjalid1/ingsoft3-tp01/actions/workflows/ci.yml)

Repositorio único de la cursada: todos los prácticos se hacen acá, cada uno
sumando una capa sobre el anterior. El badge de arriba es el estado del último
build de `main` — al hacerle clic se abre el historial de corridas.

## La app del semestre

Un **ERP mínimo** (clientes, productos y ventas) en `tp2/`: React + Vite al
frente, Node + Express detrás, MySQL 8 abajo, los tres en contenedores.

```bash
cd tp2
docker compose up -d --build     # después: http://localhost:8080
```

El detalle —stack, variables de entorno, tests, cómo levantarla sin Docker— está
en **[`tp2/README.md`](tp2/README.md)**.

## Los prácticos

| TP | Qué agrega | Dónde mirarlo | Tag |
|----|-----------|---------------|-----|
| **TP1** | Flujo de trabajo con Git: ramas, Pull Requests, un conflicto resuelto a mano y la protección de `main` | [`img/`](img/) · secciones TP1 de los documentos | `v1.0.0` |
| **TP2** | La app contenerizada: un Dockerfile por servicio, `docker compose`, imágenes publicadas en `ghcr.io` | [`tp2/`](tp2/) | `v2.0.0` |
| **TP3** | Planificación y trazabilidad: épica → historia → tareas, sprint de una semana, límite de WIP, PRs que cierran tareas | [Project público](https://github.com/users/ivanjalid1/projects/1) | `v3.0.0` |
| **TP4** | Integración continua: build de las dos imágenes en paralelo, cache de capas, y el pipeline como requisito de merge | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) · pestaña [Actions](https://github.com/ivanjalid1/ingsoft3-tp01/actions) | `v4.0.0` |

## Documentos

Los dos son **acumulativos**: cada práctico agrega su sección al final, no se
rehacen.

- **[`decisiones.md`](decisiones.md)** — qué se decidió y por qué, los problemas
  que aparecieron y cómo se resolvieron, y la declaración de uso de IA de cada TP.
- **[`evidencias.md`](evidencias.md)** — el recorrido paso a paso de cada
  entrega, con las salidas reales de los comandos.

## Cómo entra un cambio a `main`

`main` está protegida y exige **dos** condiciones para aceptar un merge:

1. Que el cambio venga por **Pull Request** (TP1) — nadie pushea directo, ni el
   dueño del repo: `enforce_admins` está activo.
2. Que el **pipeline esté en verde** (TP4) — `build-backend` y `build-frontend`
   son *required status checks*, y con `strict: true` la rama además tiene que
   estar actualizada con `main` antes de mergear.

## Sobre los tags

`v1.0.0`, `v2.0.0` y `v3.0.0` apuntan **los tres al mismo commit**. No es un
error de tagueo: es la consecuencia de una reescritura de historial que se hizo
durante el TP3 y que está explicada, con lo que se perdió y lo que no, en la
sección *[Nota sobre el historial del repositorio y los
tags](decisiones.md#nota-sobre-el-historial-del-repositorio-y-los-tags)* de
`decisiones.md`. Las ramas `backup/*` conservan el estado previo. `v4.0.0` es el
primer tag que vuelve a congelar un estado propio.
