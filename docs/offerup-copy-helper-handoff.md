# Bloom Aquatics — "Modo Republicar" OfferUp · Handoff de Arquitectura (v2, definitivo)

**Sesión de arquitectura:** 2026-07-15 (Fable) · **Implementación:** Sonnet 5 / Opus 4.8, en
sesión aparte. Este documento **reemplaza** el borrador que Sonnet 5 produjo el 2026-07-11;
la sección 2 audita ese borrador decisión por decisión. Es standalone: se puede implementar
sin el transcript. Documentos hermanos: `CODE_REVIEW.md`, `docs/meta-catalog-handoff.md`.

---

## 1. Qué construye esta feature (y qué NO)

Una **ayuda manual de copiar/pegar** dentro de la PWA de Bloom Aquatics para que la dueña
republique artículos en la app oficial de OfferUp usando split-screen de Android (Galaxy S26
estándar — variante base de la línea insignia, gama alta, 6.3"; la restricción de diseño es
el tamaño de pantalla partida, no la potencia del equipo). Ella sigue tocando cada campo y cada botón de publicar dentro de OfferUp, con su
cuenta, ella misma. **Cero automatización de OfferUp — línea roja permanente** (sin API
pública; bots de navegador violan ToS; ver `docs/meta-catalog-handoff.md`).

Hechos de Fase 0, verificados por Svei en el teléfono real (no re-verificar):
- El formulario de publicar de OfferUp tiene **3 campos capturables**: título, descripción,
  precio — más un dropdown de categoría (no asistible legítimamente; queda manual).
- El selector de fotos **NO acepta pegar imagen** — solo galería/cámara. No se construye nada
  para fotos: guardar-imagen del navegador a galería ya es nativo de Android.

---

## 2. Auditoría del borrador de Sonnet (2026-07-11) — qué se confirma, qué se corrige

### Confirmado (implementar tal cual)

| Decisión del borrador | Veredicto |
|---|---|
| Extender la PWA existente, no app nueva | ✅ Confirmado — ver §3 |
| Flujo de dos pantallas: selección con checkbox → lista compacta "Modo Republicar" con 3 botones de copiar por item, deslizable sin salir | ✅ Confirmado — es el diseño correcto para el caso de uso (la esposa lo validó en sesión) |
| 100% client-side, sin endpoint nuevo → **no depende de `CODE_REVIEW.md`** | ✅ Confirmado y es el punto de mayor consecuencia: esta feature puede construirse HOY, antes o en paralelo a la fase de seguridad, a diferencia del feed de Meta que sí espera el hardening |
| Feedback visual al copiar (ícono → check ~1 s) | ✅ Confirmado |
| v1 copia el texto generado tal cual; el campo editable-sin-persistir se difiere a v2 | ✅ Confirmado, con disparador concreto: si en la prueba real (Fase 4) la esposa quiere retocar el texto en más de ~1 de cada 3 copias, v2 se adelanta. Preparar el componente desde v1 (el botón copia una variable local, no la prop directa) para que v2 sea agregar un `<input>`, no re-arquitectura |
| Selección de items nunca persiste en SQLite | ✅ Confirmado |

### Corregido (el borrador estaba mal o incompleto)

1. **`sessionStorage` es OBLIGATORIO para la selección, no opcional.** El borrador decía
   "estado de React, o sessionStorage si se quiere sobrevivir un refresh". Error de peso: el
   caso de uso ES split-screen — la esposa va a cambiar a OfferUp y volver decenas de veces, y
   Android puede recargar pestañas del navegador al alternar apps sin importar la gama del
   teléfono (es ciclo de vida del sistema, no falta de RAM — el S26 es gama alta y aplica
   igual). Perder la selección a media republicación es el
   fallo central posible de esta feature. La selección (y el índice de "en qué item voy") se
   persiste en `sessionStorage` en cada cambio y se rehidrata al montar el componente.
2. **El formato del texto NO reutiliza el share de la Vitrina.** El borrador proponía reusar
   ese formato; queda superseded por la sección 5: el share de Vitrina es un bloque único
   pensado para WhatsApp; OfferUp tiene 3 campos separados y el título es el campo que decide
   la visibilidad en búsqueda. Cada botón copia texto generado por plantilla por campo.
3. **Precio: copiar número plano, sin símbolo.** El borrador dejaba "$X.XX, confirmar
   visualmente". Se cierra aquí: el campo de precio de OfferUp es numérico; el botón copia
   `"8"` o `"8.50"` (sin `$`, sin `USD`, sin espacios). Pegar `"$8.00 USD"` en un campo
   numérico falla o ensucia.
4. **El borrador omitió las políticas de OfferUp sobre animales — y aplican.** Verificado
   contra la guía oficial de items prohibidos de OfferUp: **los animales vivos están
   prohibidos, explícitamente incluyendo peces y acuáticos.** Consecuencias:
   - `type = 'animal'` (camarones) **se excluye del Modo Republicar por código**, regla dura
     sin override — misma política que el feed de Meta (`docs/meta-catalog-handoff.md` §5.2).
   - `type = 'supply'` también se excluye (insumo interno, no producto).
   - **Aviso a la dueña (fuera del código, tarea humana):** si hoy tiene listados de camarones
     activos en OfferUp, están en riesgo de remoción/strike independientemente de esta app.
     Los camarones se venden por los canales que no lo prohíben (local, WhatsApp, Vitrina).
5. **Emojis: fuera del título, opcionales en descripción.** El título es el campo que el
   buscador de OfferUp matchea primero; un emoji no aporta match y consume caracteres. La
   descripción puede cerrar con 1-2 emojis si la dueña quiere (constante de config, default
   sin emojis) — OfferUp no los prohíbe, solo prohíbe exceso de símbolos manipulativo.

---

## 3. Decisión: extender la PWA existente (no app nueva)

Confirmada la hipótesis del prompt, sin refutación posible seria:
- El split-screen ya requiere Bloom Aquatics + OfferUp en pantalla; una tercera app no cabe
  en el flujo ni aporta nada.
- App nueva = segundo cliente del mismo inventario + segunda superficie de auth cuando
  aterrice `CODE_REVIEW.md` P1-1 = bugs de sincronización comprados sin necesidad.
- La PWA ya está instalada en el teléfono de la dueña; fricción de adopción cero.

El componente vive en `src/bloomaquatics.jsx` como componente aislado y autocontenible
(si P3-2 del code review ya partió el monolito cuando esto se implemente, va en su propio
archivo; si no, se escribe listo para extraerse).

---

## 4. "Buscabilidad" en OfferUp — hallazgos verificados y decisión

### 4.1 Cómo funciona la visibilidad en OfferUp (fuentes al pie)

- **El título es el driver #1 de búsqueda.** El buscador matchea términos del título ante
  todo; los guías de vendedores coinciden: título específico y descriptivo > título bonito
  ("West Elm Andes Sectional Gray" vence a "Nice Couch").
- **El buscador también extrae señales de las fotos** (OfferUp usa búsqueda multimodal —
  documentado por el equipo de OfferUp en AWS). Foto clara y bien iluminada no es cosmética:
  alimenta el matching. Ya está resuelto: las fotos de Bloom son las mismas que usa la app.
- **La recencia pesa** — listados recientes rankean arriba. Esto valida la premisa entera del
  Modo Republicar: republicar/renovar ES la táctica de visibilidad, y esta feature la hace
  de 30 segundos por item.
- **Perfil del vendedor completo** (foto, teléfono verificado, reseñas) mejora ranking y
  conversión — tarea humana de la dueña, gratis, una sola vez. Va al checklist de Fase 4.
- **Límite duro:** las reglas de publicación de OfferUp prohíben "keywords para manipular
  resultados de búsqueda". Las plantillas usan 2-4 términos naturales y relevantes, nunca
  listas de palabras. Esto no es solo cumplimiento: el stuffing además espanta compradores.

### 4.2 Decisión de mecanismo: plantillas fijas (opción 1). IA on-device descartada por ahora.

Se investigó el estado 2026 de IA local en navegador (Prompt API / Gemini Nano, estabilizada
para páginas web en Chrome 148, Q2 2026). Veredicto honesto: **no para esto, no ahora.**
- Requiere Chrome específicamente — la PWA en un Samsung puede estar corriendo en Samsung
  Internet, donde no existe. Una feature central no puede depender del navegador.
- El hardware no es el problema (el S26 es gama alta y correría el modelo sin dificultad) —
  el problema es proporción y confiabilidad: una descarga de ~4 GB para generar dos líneas de
  texto que una plantilla de 40 líneas produce igual, gratis, instantáneo y — más importante
  para una usuaria no técnica — **idéntico cada vez**. La salida variable de un LLM en cada
  copia genera desconfianza, no valor, en este caso de uso.
- Re-evaluable a fines de 2026+ si la dueña pide redacción variada Y la Prompt API llega
  estable a los navegadores que ella usa. Anotado, no planeado.

### 4.3 Reglas de plantilla por tipo (spec para el implementador — sin ambigüedad)

Constantes de configuración en un solo objeto (editable en un solo lugar):
`CITY_FOR_LISTINGS` (ciudad para la línea de pickup — **pedírsela a Svei al implementar**),
`EMOJI_FOOTER_ENABLED` (default `false`).

**`type = 'plant'`:**
- **Título** (objetivo ≤ 60 caracteres): `{name} – Live Aquarium Plant`.
  Si existe nombre científico en el diccionario (abajo) y cabe: `{name} ({científico}) – Live Aquarium Plant`.
  Si no cabe, se omite primero el científico, nunca el sufijo "Live Aquarium Plant" (es el
  término de búsqueda que teclean los compradores).
- **Descripción**: la `description` de la dueña tal cual (su voz, su idioma), más pie fijo:
  `Live freshwater aquarium plant. {científico si existe}. Pickup in {CITY_FOR_LISTINGS}.`
- **Diccionario de nombres científicos**: mapa estático en código (case-insensitive, match
  por inclusión sobre `name`) sembrado con las ~24 variedades conocidas del inventario
  (Vallisneria, Cryptocoryne wendtii green/brownie/tropical, C. retrospiralis, Anubias nana,
  Anubias panda, Limnophila, Sagittaria, musgos Java/weeping/Christmas, Ludwigia super red,
  tiger lotus / Nymphaea zenkeri, Amazon sword / Echinodorus, Ozelot, Red Ruby, Red Flame,
  water lettuce / Pistia stratiotes, duckweed / Lemna, frogbit, pino de agua, etc. — el
  implementador completa el mapa leyendo los nombres reales en la base). Sin match → se
  omite, sin error. **Nunca una columna nueva en SQLite** — eso requeriría tocar el servidor
  y rompería la propiedad "100% client-side" de §2.
- Keywords en **inglés** (los compradores de OfferUp US buscan "aquarium plant", no "planta
  de acuario"); la descripción de la dueña queda en el idioma en que ella la escribió.

**`type = 'product'` (segunda mano):**
- **Título**: `{name}` tal cual — los artículos son heterogéneos; una plantilla genérica no
  puede inventar marca/medida/condición, y meter palabras que no aplican viola la regla
  anti-stuffing. La mejora de título en artículos usados es responsabilidad del `name` bien
  escrito (guía de una línea en la UI: "incluye marca, tamaño y color en el nombre").
- **Descripción**: la de la dueña + pie: `Pickup in {CITY_FOR_LISTINGS}.`

**`type = 'animal'` y `type = 'supply'`: excluidos del Modo Republicar por código** (§2,
corrección 4). En la pantalla de selección ni siquiera aparecen; si se filtra "todos", se
muestran deshabilitados con la razón en texto corto ("OfferUp prohíbe animales vivos" /
"insumo interno").

**Precio**: número plano sin símbolo (§2, corrección 3).

---

## 5. Diseño final de "Modo Republicar"

**Pantalla 1 — Selección:** lista del inventario publicable (solo `plant` y `product`,
`is_available = 1`) con checkbox por item. Botón fijo "Republicar seleccionados (N)".

**Pantalla 2 — Lista compacta deslizable**, un card por item seleccionado:

```
┌──────────────────────────────────────────┐
│ [foto]  Anubias Nana                      │
│                                            │
│  Título      Anubias Nana (Anubias…  [📋] │
│  Descripción Planta resistente, ide… [📋] │
│  Precio      8.50                     [📋] │
│                                            │
│  Categoría y foto: manuales en OfferUp    │
└──────────────────────────────────────────┘
```

- Cada `[📋]` copia SOLO su campo (`navigator.clipboard.writeText`; requiere HTTPS — ya lo
  hay — y gesto de usuario — el tap lo es). Feedback: ícono → ✓ por ~1 segundo.
- Selección + posición se persisten en `sessionStorage` en cada cambio (§2, corrección 1).
- Botones de tamaño táctil generoso (mínimo ~44 px) y texto truncado con elipsis — la vista
  debe ser usable a **media pantalla** de 6.3", que es su hábitat real. Nada de scroll
  horizontal.

---

## 6. Roadmap con criterios de salida

**Fase actual: lista para Fase 2 (la 0 cerró en el teléfono real; la 1 es este documento).**
Git: rama `fase-2-modo-republicar`, probar local, merge a main, deploy solo desde main.

- **Fase 2 — Implementación client-side.** Componente aislado + generador de plantillas
  (funciones puras: `buildTitle(item)`, `buildDescription(item)`, `buildPrice(item)` — cada
  una testeable a mano en consola) + clipboard + sessionStorage + exclusiones por tipo.
  **Salida:** ciclo completo copiar-pegar-copiar-pegar en split-screen real contra OfferUp,
  ejecutado por Svei, sin pérdida de estado al alternar apps.
- **Fase 3 — Ajuste UX de pantalla partida.** Prueba en el S26 real a media pantalla:
  tamaños, truncados, alcanzabilidad del pulgar. **Salida:** cero fricción reportada por la
  dueña en un recorrido de 3 items.
- **Fase 4 — Prueba real + checklist humano.** La dueña republica 2-3 items reales de punta
  a punta. Checklist paralelo (humano, no código): completar perfil de OfferUp (foto,
  teléfono verificado), retirar listados de camarones si existen (§2, corrección 4), decidir
  `CITY_FOR_LISTINGS` y si quiere `EMOJI_FOOTER_ENABLED`. **Salida:** ella lo usa sola una
  semana; se recogen los ajustes (y se evalúa el disparador de v2, §2).
- **v2 (fecha abierta, disparador definido en §2):** campo editable precargado junto a cada
  botón, copia lo editado, nunca persiste a SQLite.

---

## 7. Estilo de código (obligatorio)

- Funciones pequeñas de propósito único.
- Comentarios explicativos estilo "profesor de salón de clases" — el código debe poder
  debuggearse en una sesión fresca de IA sin contexto previo.
- Nombres en lenguaje natural, descriptivos. Prohibidos los patrones ingeniosos-pero-crípticos.
- Archivos chicos, modular, SRP. Carpetas lowercase kebab-case; sin espacios, acentos ni
  caracteres especiales en nombres de archivo.
- Cero librerías nuevas — clipboard, sessionStorage y plantillas son vanilla.

## 8. Fuentes verificadas (2026-07-15)

- OfferUp prohíbe animales vivos (incluye peces/acuáticos): help.offerup.com — Prohibited
  Items Guidelines · ask.offerup.com/Prohibited-Items — Animals & Animal Products
- Reglas de publicación (anti keyword-stuffing): help.offerup.com — Posting Rules
- Título como driver de búsqueda + recencia + perfil: topbubbleindex.com "How to Sell More on
  OfferUp" · savingsgrove.com "Complete Guide to Selling on OfferUp 2026"
- Búsqueda multimodal de OfferUp (señales desde fotos): aws.amazon.com/blogs/machine-learning —
  caso OfferUp con Amazon Bedrock/OpenSearch
- Prompt API / Gemini Nano en Chrome 148 (contexto del descarte de IA on-device):
  developer.chrome.com/docs/ai/prompt-api · computeleap.com (mayo 2026)
