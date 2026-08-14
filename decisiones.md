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

## Declaración de uso de IA (§6 del reglamento)

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

**Defendible.** Puedo explicar cada decisión de diseño e implementación de esta
app, documentadas en `docs/superpowers/specs/2026-08-13-erp-minimo-design.md`,
incluidos los dos bugs de concurrencia que encontró el revisor: por qué existían,
por qué el mock no los detectaba, y por qué el arreglo es mover la validación bajo
el lock y no agregar una capa nueva. Si en la mesa preguntan por una decisión que
tomó la IA y no la puedo explicar, ese punto no se aprueba — es la regla del §6, y
la aplico contra mí mismo antes de que la aplique el tribunal.
