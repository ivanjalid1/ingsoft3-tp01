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
contenedores.

Los productos, precios y cantidades que aparecen en las notas de abajo son un
**recorrido de ejemplo**, no un guion a copiar al pie de la letra: sirven para
tener un camino concreto que seguir, pero la captura no vale por los números que
muestre. Cada entrada dice, debajo del link, **qué relación tiene que probar** esa
captura — que el stock bajó exactamente en la cantidad vendida, que el total es la
suma de los subtotales, que la anulación devuelve el stock a su valor previo. Esas
afirmaciones son verdaderas con cualquier producto y cualquier cantidad, así que
la evidencia sigue valiendo si el recorrido se repite con otros datos (por ejemplo
al rehacerlo en el TP6). Lo que sí es literal y no se cambia: los `code` de error,
los status HTTP, los comandos, las credenciales de la semilla y la cantidad de
tests.

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

> **PENDIENTE.** En `/productos`, dar de alta un producto (en el recorrido de
> ejemplo, `Mouse` con precio `9500.50` y stock `30`), guardar y capturar la
> tabla con la fila nueva.

El producto aparece en la tabla con el precio y el stock que se cargaron. Conviene
usar un precio **con centavos**: así la captura muestra de paso que los montos se
guardan y se muestran con dos decimales exactos.

![validación de precio](img/08-validacion-precio.png)

> **PENDIENTE.** En el mismo formulario, intentar guardar con un precio `≤ 0`
> (por ejemplo `-5`, o `0`) y capturar el mensaje de error sin que se agregue
> nada a la tabla.

Con un precio menor o igual a cero el formulario muestra el error y **no llama a
la API**: no hay una segunda request en la pestaña Network. La misma regla la
valida el backend, que es la frontera confiable.

## 7. Email duplicado de cliente

![email duplicado](img/09-email-duplicado.png)

> **PENDIENTE.** En `/clientes`, crear un cliente con el email `demo@cliente.local`
> (ya existe en la semilla) y capturar "Ya existe un cliente con el email
> demo@cliente.local".

`409 EMAIL_DUPLICADO`. La garantía real es la restricción `UNIQUE` de la base;
la consulta previa del service solo da un mensaje más claro.

## 8. Carrito: total en vivo y botón deshabilitado

![carrito con total](img/10-carrito-total.png)

> **PENDIENTE.** En `/ventas/nueva`, elegir un cliente y armar un carrito con al
> menos **dos productos distintos** (en el recorrido de ejemplo, 2 Teclado y 1
> Monitor). Antes de capturar, quitar una de las líneas y volver a agregarla, para
> ver el total recalcularse en las dos direcciones.

El total mostrado es **exactamente la suma de los subtotales de las líneas del
carrito**, y cada subtotal es la cantidad por el precio unitario. Al quitar una
línea, el total baja **exactamente en el subtotal de esa línea**, y al volver a
agregarla vuelve al valor anterior — todo sin recargar la página, porque el total
se deriva del carrito en cada render y no se guarda en estado. Con el carrito
vacío, "Confirmar venta" está deshabilitado.

## 9. Venta creada y descuento de stock

![venta creada](img/11-venta-creada.png)

> **PENDIENTE.** Confirmar la venta del punto anterior y capturar `/ventas` con
> la venta listada en estado `pendiente`. **Anotar el stock de cada producto
> ANTES de confirmar**: es contra esos valores que se lee la captura siguiente.

La venta queda en estado `pendiente` y con el mismo total que mostraba el carrito:
el frontend y el backend calculan el total con la misma regla de redondeo, así que
coinciden centavo a centavo.

![stock descontado](img/12-stock-descontado.png)

> **PENDIENTE.** Volver a `/productos` y capturar la tabla con el stock ya
> descontado.

El stock de cada producto vendido **disminuyó exactamente en la cantidad que
llevaba la venta**, y el de los productos que no participaron quedó igual. El
descuento ocurre dentro de la misma transacción que crea la venta: o se guardan la
venta y los descuentos de todos los ítems, o no se guarda ninguno.

## 10. Anulación y reposición de stock

![venta anulada](img/13-venta-anulada.png)

> **PENDIENTE.** En `/ventas`, apretar "Anular" sobre la venta creada y capturar
> el estado ya en `anulada`.

![stock repuesto](img/14-stock-repuesto.png)

> **PENDIENTE.** Volver a `/productos` y capturar la tabla con el stock ya
> repuesto.

La venta pasa a `anulada` y **no se borra**: el histórico queda. El stock de cada
producto vuelve **exactamente al valor que tenía antes de la venta** — la
reposición es el descuento del punto 9 al revés, ítem por ítem y con la misma
cantidad, dentro de una sola transacción. Comparar esta captura con la del punto 9
alcanza para verlo: los dos números tienen que volver a coincidir.

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
> (56 tests).

![tests de frontend](img/17-tests-frontend.png)

> **PENDIENTE.** Correr `cd frontend` y `npm test`, capturar la terminal en verde
> (15 tests).

Los tests de backend corren **sin MySQL levantado**: la capa `models/` está
mockeada con `vi.mock`. Son **71 casos en total: 56 de backend y 15 de
frontend**. Los 12 que exige el TP5 (8 de backend, uno por regla de negocio, y
4 de frontend) son un **subconjunto** de esos 71, identificado con un comentario
en el código de cada test; el detalle de cuál es cuál está en `README.md` y en
`decisiones.md`. Los otros 59 son cobertura adicional: casos límite, validación
de entorno, formato de error, ABM de clientes.

## 12. Los tres contenedores corriendo

![docker compose ps](img/18-docker-compose.png)

> **PENDIENTE.** Con los contenedores arriba (`docker compose up -d --build`),
> correr `docker compose ps` y capturar la terminal. Los tres estados que la
> captura tiene que mostrar son `db` `(healthy)`, `backend` `Up` y `frontend`
> `Up` — es lo que dio la verificación end-to-end, y `db` **tiene** que figurar
> `healthy` y no solo `Up`, porque es la condición que espera el `depends_on`
> del backend.

`db`, `backend` y `frontend`. El backend no publica puertos al host: solo se
llega a él por la red interna de compose, a través del proxy inverso de nginx.

![refresh en una ruta del SPA](img/19-spa-refresh.png)

> **PENDIENTE.** Estando en `http://localhost:8080/ventas/nueva`, apretar F5 y
> capturar que la pantalla sigue ahí sin pedir el login de nuevo.

F5 estando en `/ventas/nueva` sigue mostrando la pantalla (`try_files` de
nginx) y no pide el login de nuevo (el token se lee de `localStorage` al
montar el `AuthContext`).
