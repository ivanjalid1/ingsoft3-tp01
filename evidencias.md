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

# Evidencias — App del semestre (ERP mínimo)

**Fecha:** 2026-08-13

Las 15 imágenes de esta sección **todavía no están sacadas**: son capturas de un
recorrido manual contra la app corriendo (`docker compose up -d --build`,
`http://localhost:8080`), y las tiene que sacar quien defiende, no un agente. Cada
entrada de abajo deja el link tal como va a quedar (`img/NN-nombre.png`) más una
nota **PENDIENTE** con el paso y el comando exactos que producen esa pantalla —
así ninguna es un link que apunta a la nada sin explicación. La fuente de esta
lista es la verificación end-to-end real que sí se ejecutó contra los tres
contenedores (Tarea 11): los datos de las capturas (`Mouse` a `9500.50`/`30`,
`210000.00` de total, Teclado 20→18, Monitor 5→4) tienen que coincidir con lo que
el alumno repita a mano.

## 5. Login y credenciales inválidas

![login exitoso](img/05-login.png)

> **PENDIENTE.** Abrir `http://localhost:8080`, loguearse con `admin@erp.local` /
> `Admin123!` y capturar la pantalla ya redirigida a `/productos`.

Login con `admin@erp.local`. El token se guarda en `localStorage` y la app
redirige a `/productos`.

![credenciales inválidas](img/06-login-invalido.png)

> **PENDIENTE.** En `/login`, escribir la contraseña mal y capturar el mensaje
> "Email o contraseña incorrectos".

Con la contraseña incorrecta la API devuelve `401 CREDENCIALES_INVALIDAS` y el
mismo mensaje que para un email inexistente, para no revelar qué emails están
registrados. El `password_hash` no aparece en ninguna respuesta.

## 6. ABM de productos y validación del formulario

![alta de producto](img/07-alta-producto.png)

> **PENDIENTE.** En `/productos`, cargar `Mouse` con precio `9500.50` y stock
> `30`, guardar y capturar la tabla con la fila nueva.

![validación de precio](img/08-validacion-precio.png)

> **PENDIENTE.** En el mismo formulario, intentar guardar con precio `-5` y
> capturar el mensaje de error sin que se agregue nada a la tabla.

Con `precio = -5` el formulario muestra el error y **no llama a la API**: no
hay una segunda request en la pestaña Network. La misma regla la valida el
backend, que es la frontera confiable.

## 7. Email duplicado de cliente

![email duplicado](img/09-email-duplicado.png)

> **PENDIENTE.** En `/clientes`, crear un cliente con el email `demo@cliente.local`
> (ya existe en la semilla) y capturar "Ya existe un cliente con el email
> demo@cliente.local".

`409 EMAIL_DUPLICADO`. La garantía real es la restricción `UNIQUE` de la base;
la consulta previa del service solo da un mensaje más claro.

## 8. Carrito: total en vivo y botón deshabilitado

![carrito con total](img/10-carrito-total.png)

> **PENDIENTE.** En `/ventas/nueva`, elegir `Cliente Demo`, agregar 2 Teclado y 1
> Monitor (total `210000.00`), quitar el Monitor (baja a `30000.00`) y volver a
> agregarlo antes de capturar.

Dos teclados a $15.000 más un monitor a $180.000 dan $210.000. Al quitar el
monitor, el total baja a $30.000 sin recargar: el total se deriva del carrito,
no se guarda en estado. Con el carrito vacío, "Confirmar venta" está
deshabilitado.

## 9. Venta creada y descuento de stock

![venta creada](img/11-venta-creada.png)

> **PENDIENTE.** Confirmar la venta del punto anterior y capturar `/ventas` con
> la venta en `pendiente` y total `210000.00`.

![stock descontado](img/12-stock-descontado.png)

> **PENDIENTE.** Volver a `/productos` y capturar el stock ya descontado
> (Teclado 20→18, Monitor 5→4).

Después de confirmar, el stock del Teclado bajó de 20 a 18 y el del Monitor de
5 a 4. El descuento ocurre dentro de la misma transacción que crea la venta.

## 10. Anulación y reposición de stock

![venta anulada](img/13-venta-anulada.png)

> **PENDIENTE.** En `/ventas`, apretar "Anular" sobre la venta creada y capturar
> el estado ya en `anulada`.

![stock repuesto](img/14-stock-repuesto.png)

> **PENDIENTE.** Volver a `/productos` y capturar el stock ya repuesto (Teclado
> y Monitor de vuelta a 20 y 5).

La venta pasa a `anulada` (no se borra) y el stock vuelve a 20 y a 5.

![doble anulación rechazada](img/15-doble-anulacion.png)

> **PENDIENTE.** Capturar la **terminal**, no el navegador: el botón "Anular" ya
> deshabilitado no prueba el 409. Loguearse y anular de nuevo con `curl.exe` desde
> el host (no `wget` de busybox desde dentro del contenedor: no muestra el body
> del error) —
> ```
> curl.exe -s -i -X POST -H "Content-Type: application/json" --data-binary "@login.json" http://localhost:8080/api/auth/login
> curl.exe -s -i -X POST -H "Authorization: Bearer <token>" -H "Content-Length: 0" http://localhost:8080/api/ventas/<id>/anular
> ```
> y capturar el `HTTP/1.1 409 Conflict` con el body `{"error":{"code":"VENTA_YA_ANULADA",...}}`.

Anular una venta ya anulada devuelve `409 VENTA_YA_ANULADA`. `anulada` es un
estado terminal.

## 11. Los tests de backend y frontend en verde

![tests de backend](img/16-tests-backend.png)

> **PENDIENTE.** Correr `cd backend` y `npm test`, capturar la terminal en verde
> (52 tests).

![tests de frontend](img/17-tests-frontend.png)

> **PENDIENTE.** Correr `cd frontend` y `npm test`, capturar la terminal en verde
> (13 tests).

Los tests de backend corren **sin MySQL levantado**: la capa `models/` está
mockeada con `vi.mock`. Son 52 casos en total (13 en frontend); el TP5 exige un
subconjunto de 8 backend + 4 frontend — el detalle de cuáles está en
`README.md` y en `decisiones.md`.

## 12. Los tres contenedores corriendo

![docker compose ps](img/18-docker-compose.png)

> **PENDIENTE.** Con los contenedores arriba (`docker compose up -d --build`),
> correr `docker compose ps` y capturar la terminal. En la corrida real de la
> Tarea 11 la salida fue `db` `(healthy)`, `backend` `Up`, `frontend` `Up`.

`db`, `backend` y `frontend`. El backend no publica puertos al host: solo se
llega a él por la red interna de compose, a través del proxy inverso de nginx.

![refresh en una ruta del SPA](img/19-spa-refresh.png)

> **PENDIENTE.** Estando en `http://localhost:8080/ventas/nueva`, apretar F5 y
> capturar que la pantalla sigue ahí sin pedir el login de nuevo.

F5 estando en `/ventas/nueva` sigue mostrando la pantalla (`try_files` de
nginx) y no pide el login de nuevo (el token se lee de `localStorage` al
montar el `AuthContext`).
