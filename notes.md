# Notas de desarrollo — Bloom Aquatics

Bitácora paso a paso de cambios hechos con Claude Code. Un registro nuevo por sesión de trabajo, más reciente arriba. Úsalo para recordar el "por qué" sin tener que releer el diff completo.

---

## 2026-08-17 — Categorías de gasto + edición de transacciones

**Pregunta que lo disparó:** "Registro" solo tenía Artículo/Planta/Animal/Insumo como tipos de *inventario*. No había dónde meter un gasto del negocio que no es para revender (rack, totes, luces de cultivo) sin forzarlo dentro de esas 4 categorías o inventarlo como Insumo cuando no lo es.

**Decisión:** no hacía falta Opus para esto — era un cambio de esquema chico y bien acotado (una columna + un endpoint + un selector), así que lo hice directo con Claude Code (Sonnet) en vez de escribir un handoff para otra sesión.

**Qué se hizo:**
1. `server.js` — columna nueva `transactions.category` (TEXT, nullable). Migración seguro con `ALTER TABLE ADD COLUMN` (mismo patrón que `photo_path`, `selling_price`, etc. — nunca toca filas existentes).
2. `server.js` — endpoint nuevo `PATCH /api/transactions/:id`. Antes las transacciones solo se podían crear o borrar; no había forma de corregir una mal clasificada sin borrar y re-crear.
3. `src/bloomaquatics.jsx` — al registrar un **Gasto** ahora se elige una de 3 categorías:
   - 📦 **Inventario** — ligado a Artículo/Planta/Animal/Insumo (comportamiento de siempre, default).
   - 🔧 **Equipo** — racks, totes, luces de cultivo, herramientas. No es para revender.
   - 🏠 **Operación** — renta, servicios, transporte, marketing, otros gastos fijos.
4. Botón ✏️ nuevo en cada transacción del Registro → abre modal de edición (`EditTxnModal`) para corregir cualquier campo, incluida la categoría. Reclasificar es solo un `UPDATE` en `transactions`; nunca toca `inventory` ni `inventory_sales`.
5. Filtro por categoría en la pestaña Registro cuando ves "Gastos", para poder ver de un vistazo cuánto se fue en equipo vs operación vs inventario.

**Por qué así y no como tipo nuevo de Inventario ("Equipo" como 5to tipo):** un ítem de Inventario carga qty/unidad/venta/cosecha — cosas que no aplican a un rack o unas luces. Meterlo ahí habría sido forzar el modelo. Un gasto categorizado es más simple y es exactamente lo que es: un gasto, con una etiqueta.

**Qué NO se tocó:** Vitrina, Inventario, Reportes, cálculo de Gastos totales en Dashboard (los gastos de Equipo/Operación ya sumaban al total de Gastos antes de este cambio, porque siempre fueron `type='expense'` — la categoría es solo una etiqueta adicional, no cambia montos).

**Pendiente / no verificado:** no se pudo levantar `node server.js` en esta máquina Windows para probar en el navegador — `better-sqlite3` está compilado para otra versión de Node y `npm rebuild` falló por un error de MSBuild/toolchain en Windows (no relacionado a este cambio). El build de frontend (`npm run build`) sí corrió limpio. Falta probar en el Pi o en un entorno donde el server levante.

**Archivos tocados:** `server.js`, `src/bloomaquatics.jsx`.
