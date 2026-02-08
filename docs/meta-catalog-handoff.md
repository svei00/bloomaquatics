# Bloom Aquatics — Meta Catalog Sync · Documento de Handoff

**Sesión de arquitectura:** 2026-07-11 (Fable) · **Implementación:** Sonnet 5 / Opus 4.8, en sesiones aparte.
**Formato:** solo análisis — este documento es la fuente de verdad; no depende del transcript de la sesión.
**Documentos hermanos:** `CODE_REVIEW.md` (plan de seguridad, PRERREQUISITO) y
`docs/store-and-analytics-roadmap.md` (roadmap de tienda; la Fase 1 "Reserve & Pickup" de ese
documento es dependencia directa del campo `link` del feed, ver §5).

---

## 1. Qué construye este proyecto (y qué NO)

**Objetivo:** que el inventario de Bloom Aquatics (SQLite en el DietPi) se publique y mantenga
actualizado en las superficies de Meta de forma automática y **sin riesgo de baneo** para la
cuenta de la dueña.

**Decisión de alcance tomada con Svei (2026-07-11):**

- Negocio **100% independiente de LeyOro**. No se reutiliza `leyoro_core`. Cero acoplamiento.
- Ruta elegida: **Ruta A — Catalog API / feed sync** (la dueña no quiere arriesgar su cuenta).
- **OfferUp fuera de alcance** (sin API pública; automatizarlo = bot de navegador = violación de ToS).

**La verdad de plataforma que gobierna todo el diseño (verificada contra docs vigentes, jul-2026):**

| Superficie | ¿Automatizable oficialmente? | Qué obtiene Bloom |
|---|---|---|
| Facebook Shop (en la página del negocio) | ✅ Sí — Catalog API / feed | Catálogo completo auto-sincronizado |
| WhatsApp Business catálogo | ✅ Sí — mismo catálogo | Catálogo compartible por chat |
| Instagram Shopping (tags) | ✅ Sí — mismo catálogo | Posts etiquetables con producto |
| Anuncios dinámicos (Advantage+) | ✅ Sí — mismo catálogo | Si algún día pagan ads |
| **Facebook Marketplace** | ❌ **No existe API** para vendedores regulares | Sigue siendo **manual**, desde el perfil personal |

Puntos no negociables verificados:

1. **Marketplace no tiene API de listados** para cuentas regulares. Los feeds a Marketplace son
   solo para partners aprobados (eBay, Poshmark, concesionarias). Cualquier "automatización de
   Marketplace" que se venda por ahí es browser automation → viola ToS de Meta → riesgo real de
   baneo. **Línea roja del proyecto: jamás implementar esto.**
2. **Checkout nativo de Shops fue eliminado por Meta en agosto 2025.** Un Shop hoy manda al
   comprador a *tu sitio web* a cerrar la compra. Por eso el campo `link` del feed es obligatorio
   y por eso la página pública de la Vitrina (roadmap de tienda, Fase 1) es dependencia de este
   proyecto.
3. **Animales vivos están prohibidos** por la política de comercio de Meta. Los camarones
   (`inventory.type = 'animal'`: Red Cherry, Red Rili, Blue Velvet) **se excluyen del feed
   siempre**, por código, no por configuración. Venta de camarones sigue siendo local/manual
   (consistente con la decisión previa de no enviarlos). Las plantas sí están permitidas.
4. **El botón "Renovar publicación" de Marketplace es la Ruta B legítima.** Confirmado: es
   gratis, aparece cuando el listado cumple ~7 días, se puede usar ~5 veces por listado (después
   aparece "Relist" = borrar y re-crear). Lo hace un humano con un tap; **no hay API para
   automatizarlo**. La app puede *recordar y preparar*, nunca *ejecutar* (ver Fase 5).

---

## 2. Hallazgos de Fase 0 (descubrimiento — CERRADA salvo 2 pendientes)

### 2.1 El repo ya existe y ya es la app correcta

`D:\repos\bloomaquatics` — React 18 + Vite (PWA) frontend, Express + better-sqlite3 backend,
Multer para fotos. **Desplegada y viva en el DietPi** en `https://bloomaquatics.duckdns.org`
(verificado 2026-07-11: responde por HTTPS). PM2 + nginx + certbot según `README.md`.
Este proyecto **se construye dentro de este repo**, no como app aparte.

### 2.2 Schema real de inventario (de `server.js`, con migraciones aplicadas)

```
inventory
  id             TEXT PRIMARY KEY
  type           TEXT CHECK IN ('product','plant','supply','animal')
  name           TEXT NOT NULL
  purchase_date  TEXT NOT NULL
  purchase_price REAL NOT NULL DEFAULT 0     -- NUNCA sale al feed (costo interno)
  cc_id          TEXT NOT NULL               -- cost center; NUNCA sale al feed
  qty            REAL NOT NULL DEFAULT 1
  unit           TEXT NOT NULL DEFAULT 'unidad'
  notes          TEXT                        -- interno; NUNCA sale al feed
  status         TEXT NOT NULL DEFAULT 'available'
  created_at     TEXT
  photo_path     TEXT                        -- ruta relativa dentro de ./uploads/
  selling_price  REAL                        -- puede ser NULL
  description    TEXT                        -- puede ser NULL
  is_available   INTEGER NOT NULL DEFAULT 1
```

Tablas relacionadas: `inventory_sales`, `transactions`, `cost_centers`. El roadmap de tienda
agregará `customers`, `orders`, `order_items` — este proyecto no las toca.

### 2.3 Fotos

En disco, en `./uploads/`, servidas por Express como estáticos (`app.use('/uploads', …)`,
`server.js` ~línea 204). **Ya tienen URL pública**: `https://bloomaquatics.duckdns.org/uploads/<archivo>`.
No hay paso de hosting de imágenes que construir — la Fase 3 original del prompt se disuelve.
Lo que sí falta: **validación** (Meta exige JPEG/PNG, mínimo 500×500 px, máx 8 MB; ver §5).

### 2.4 Volumen y cadencia real

~27 SKUs (~24 variedades de planta + 3 líneas de camarón que quedan fuera del feed → **~24
items publicables máximo**, menos los que no tengan foto/precio/descripción). Cambios de
inventario: pocos por día (crecimiento biológico + ventas). Conclusión de diseño: **regeneración
completa del feed en cada corrida** — a esta escala el push incremental vía Graph API es
complejidad sin retorno. La cadencia "2-3x/día" original se disuelve: el feed se re-lee 1x/día
por Meta (programable) y eso sobra; no existe "publicar 3 veces al día" en el modelo de catálogo.

### 2.5 Seguridad — PRERREQUISITO DURO

`CODE_REVIEW.md` documenta que el servidor hoy **no tiene autenticación, ni validación de
input, ni rate limiting**: cualquiera con la URL puede borrar los libros del negocio.
**Regla:** ninguna pieza de este proyecto que exponga algo nuevo al público (el endpoint del
feed) se despliega antes de que `CODE_REVIEW.md` Fase 0 (P0-1…P0-3) y Fase 1 (P1-1…P1-4)
estén terminadas. El feed en sí es de solo-lectura, pero publicar su URL invita tráfico a un
servidor que aún no está endurecido.

### 2.6 Pendientes de Fase 0 (tareas humanas, no de código)

- [ ] **Svei/esposa:** entrar a `business.facebook.com` con la cuenta de la dueña y anotar:
      ¿existe Business Manager? ¿existe Commerce Manager? (Respuesta actual: "no sé".)
- [ ] Confirmar que el certificado HTTPS del DietPi está vigente y auto-renovándose
      (`sudo certbot renew --dry-run`).

**Hecho confirmado:** ya existe página de Facebook del negocio (requisito del Shop). ✅

---

## 3. Riesgos y decisiones abiertas (resolver en Fase 2, no ignorar)

1. **Dominio duckdns.org.** Para la verificación de negocio y la revisión del Shop, un
   subdominio gratuito puede restar credibilidad o complicar la aprobación. Decisión diferida:
   si Meta rechaza o la verificación se atora, comprar dominio propio (~USD $12/año) y
   apuntarlo al DietPi es la salida. No bloquear el arranque por esto.
2. **Campo `link` (obligatorio).** Cada producto necesita URL propia visitable. Hoy la Vitrina
   vive dentro de la PWA (misma app, posiblemente detrás del login cuando aterrice P1-1).
   Decisión de diseño para el implementador: crear ruta pública de solo-lectura
   (ej. `/tienda/:itemId` o `/vitrina?item=<id>`) que muestre el producto sin exponer costos
   ni pedir login — es exactamente la "Reserve & Pickup page" de la Fase 1 del roadmap de
   tienda. Interim aceptable para arrancar: todas las `link` apuntan a la página raíz pública
   de la vitrina; mejorarlo después a URL por producto.
3. **Moneda:** USD (negocio en SoCal). Formato Meta: `"12.99 USD"`.
4. **`brand` (obligatorio):** usar `"Bloom Aquatics"` fijo para todo.
5. **Verificación de negocio en Meta:** gratuita pero puede pedir documentos. Tarea manual de
   la dueña con guía; no se automatiza nada de esto.

---

## 4. Arquitectura elegida (Ruta A)

```
┌────────────── DietPi (ya existe) ──────────────┐
│  bloom.db (SQLite)                              │
│      │                                          │
│      ▼                                          │
│  Generador de feed (módulo nuevo en server.js   │
│  o archivo aparte feed.js)                      │
│      │   lee inventory, aplica reglas §5        │
│      ▼                                          │
│  GET /catalog/<token-secreto>/feed.csv          │
│  (endpoint público de SOLO lectura)             │
└────────────────┬────────────────────────────────┘
                 │  Meta lo descarga en horario programado (1x/día)
                 ▼
        Commerce Manager · Catálogo
                 │
   ┌─────────────┼──────────────┐
   ▼             ▼              ▼
Facebook Shop  WhatsApp      Instagram
(en la página) catálogo      Shopping
```

- **Feed por URL programada** (Meta "Scheduled feed"), no push por Graph API: cero tokens de
  API que custodiar, cero jobs; Meta jala el CSV solo. A 24 items es la solución correcta.
- El **token secreto en la ruta** evita que el catálogo (con precios de venta) sea indexable
  por adivinación; no es seguridad fuerte ni la necesita — el contenido es público por diseño.
- La PWA no habla con Meta: habla con su propio backend, que es quien sabe qué se exportó
  y por qué se excluyó cada item (§ Fase 4).

**Marketplace queda como flujo manual asistido** (Fase 5): la dueña publica/renueva a mano
desde su teléfono; la app le prepara el material y le recuerda cuándo tocar el botón.

---

## 5. Schema del feed — confirmado contra documentación vigente de Meta (jul-2026)

Fuente: Catalog Fields, Commerce Platform (developers.facebook.com). Formatos soportados:
CSV, TSV, XML (Atom), XLSX, Google Sheets. **Elegido: CSV** (trivial de generar, fácil de
inspeccionar a mano).

### 5.1 Campos obligatorios y su mapeo

| Campo Meta | Obligatorio | Fuente en Bloom | Regla |
|---|---|---|---|
| `id` | ✅ | `inventory.id` | Tal cual; estable de por vida del item |
| `title` | ✅ | `inventory.name` | Máx 200 chars (recomendado ≤65); truncar con elipsis |
| `description` | ✅ | `inventory.description` | Texto plano, máx 9,999 chars. **Sin description → item excluido** |
| `availability` | ✅ | `is_available` + `status` + `qty` | `in stock` si `is_available=1 AND status='available' AND qty>0`; si no, `out of stock` |
| `condition` | ✅ | `inventory.type` | `plant` → `new`; `product` (segunda mano) → `used` |
| `price` | ✅ | `selling_price` | Formato `"9.99 USD"`. **Sin selling_price → item excluido** |
| `link` | ✅ | URL pública de vitrina | Ver §3.2; https obligatorio |
| `image_link` | ✅ | `photo_path` | URL absoluta `https://bloomaquatics.duckdns.org/uploads/…`. JPEG/PNG ≥500×500 px, ≤8 MB. **Sin foto o foto chica → item excluido** |
| `brand` | ✅ | constante | `"Bloom Aquatics"` |

Opcionales que valen la pena desde el día 1: `quantity_to_sell_on_facebook` (= `qty` entera),
`additional_image_link` (cuando exista tabla `photos`, hoy no), `custom_label_0` (= `type`,
útil para filtrar en Commerce Manager). Ignorar el resto (tallas, género, GTIN — no aplican).

### 5.2 Reglas de exclusión (en código, con razón registrada)

Un item **no entra al feed** si cualquiera de estas aplica, y el generador guarda la razón
(la Fase 4 se la muestra a la dueña en el teléfono):

1. `type = 'animal'` → razón: `"Meta prohíbe animales vivos"` (regla dura, sin override).
2. `type = 'supply'` → razón: `"insumo interno, no se vende"` (los insumos son gasto, no producto).
3. `selling_price` NULL o ≤ 0 → `"falta precio de venta"`.
4. `description` NULL o vacía → `"falta descripción"`.
5. `photo_path` NULL, archivo inexistente, o imagen < 500×500 px → `"falta foto utilizable"`.
6. `is_available = 0` o `status ≠ 'available'` con `qty = 0` → opción de diseño: en vez de
   excluir, publicar como `out of stock` (mantiene el historial del item en el catálogo).
   **Recomendado: out of stock, no exclusión** — así el item no pierde reviews/posición al volver.

### 5.3 Lo que NUNCA sale al feed

`purchase_price`, `cc_id` / cost centers, `notes`, historial de cosechas, ventas, todo lo
contable. Misma regla de portabilidad del roadmap de tienda: *los costos nunca salen de casa*.

---

## 6. Roadmap por fases con criterios de salida

**Fase actual al escribir esto: Fase 0, 90% cerrada** (faltan los 2 checkboxes de §2.6).
Regla git: **rama por fase** (`fase-1-seguridad`, `fase-3-feed`, …), probar local, merge a
main, deploy solo desde main.

### Fase 0 — Descubrimiento ✅ (salvo §2.6)
Salida: este documento + los 2 pendientes humanos marcados.

### Fase 1 — Seguridad (prerrequisito, ya especificada en otro doc)
Ejecutar `CODE_REVIEW.md` Fases 0 y 1 completas (P0-1 crash, P0-2 casing, P0-3 gitignore,
P1-1 login de sesión, P1-2 hardening de uploads, P1-3 validación, P1-4 rate limit + headers).
**Salida:** ningún endpoint mutador sin auth; uploads endurecidos; app re-desplegada al DietPi.

### Fase 2 — Setup de Meta (manual, con guía; cero código)
Checklist para la dueña/Svei, que el implementador debe redactar paso a paso con capturas:
crear/confirmar Business Manager → vincular la página de Facebook existente → abrir Commerce
Manager → crear catálogo vacío tipo "E-commerce" → (si Meta lo pide) verificación de negocio →
localizar la opción "Data feed programado por URL".
**Salida:** existe catálogo vacío en Commerce Manager, con permiso de agregar feed por URL,
y sabemos si la verificación de negocio fue requerida o no.

### Fase 3 — Motor de feed (el corazón; primer código nuevo)
Módulo `feed.js` (archivo propio, no inflar `server.js`): función que lee `inventory` y
devuelve `{ rows, excluded }` según §5; endpoint `GET /catalog/<token>/feed.csv`; validador
de dimensiones de imagen (leer cabecera del archivo, no cargar la imagen entera); el token
vive en un archivo de config no versionado. Registrar la URL en Commerce Manager con fetch
diario. Probar con 2-3 productos primero, revisar que pasen la revisión de items de Meta,
luego abrir el resto.
**Salida:** los ~20+ items publicables aparecen aprobados en el catálogo; el Shop de la
página los muestra; una edición de precio en la PWA se refleja en el Shop tras el fetch
del día siguiente sin tocar nada.

### Fase 4 — Estado de publicación en la PWA (lo que pidió Svei: "sí se puede")
Nueva vista (o sección en Inventario): por cada item, badge con estado local —
`Publicado en catálogo` / `Excluido: <razón de §5.2>` / `Out of stock`. Fuente: el propio
generador de feed (persistir el resultado de la última corrida en una tabla
`feed_log(item_id, included, reason, run_at)`). **No** consumir Graph API para diagnósticos
en v1 — el 95% del valor es local y gratis; el pull de diagnósticos de Meta queda anotado
como mejora futura si algún item aprobado es rechazado por Meta y no se ve por qué.
**Salida:** la dueña abre la PWA en el teléfono y ve qué está publicado y qué falta
corregir (foto, precio, descripción) para que un item entre al catálogo.

### Fase 5 — Cadencia + asistente de Marketplace (manual asistido)
- Cadencia del catálogo: el fetch diario de Meta ya quedó en Fase 3; nada más que hacer.
- **Asistente de Marketplace** (lo nuevo): tabla `marketplace_listings(item_id, listed_at,
  last_renewed_at, renew_count, delisted_at)` que la dueña alimenta con dos taps
  ("lo publiqué" / "lo renové"); la PWA muestra una lista "hoy puedes renovar estos" (items
  con ≥7 días desde el último renew y `renew_count < 5`) y "estos ya agotaron renovaciones —
  toca re-crearlos" (botón que copia al portapapeles título+descripción+precio listos para
  pegar, reutilizando el share de la Vitrina).
- **Prohibido explícitamente:** cualquier automatización que toque Marketplace directo
  (Playwright, Selenium, apps de "auto-renew" de terceros — esas también violan ToS).
**Salida:** el ciclo semanal de la dueña en Marketplace toma minutos: abrir PWA → ver lista
→ tap renovar en la app de Facebook → marcar hecho. El catálogo/Shop se mantiene solo.

---

## 7. Estilo de código (obligatorio para el implementador)

- Funciones pequeñas de propósito único.
- Comentarios explicativos estilo "profesor de salón de clases" — el código debe poder
  debuggearse en una sesión fresca de IA sin contexto previo.
- Nombres en lenguaje natural, descriptivos. Prohibidos los patrones ingeniosos-pero-crípticos.
- Archivos chicos, arquitectura modular, SRP. `feed.js` aparte; no inflar `server.js`.
- Carpetas lowercase kebab-case; sin espacios, acentos ni caracteres especiales en nombres
  de archivo.
- Coherencia con el repo: nada de librerías nuevas si lo existente alcanza (regla ya
  establecida en el roadmap de tienda: la app no tiene ni una librería de UI de terceros).

## 8. Fuentes verificadas en esta sesión (2026-07-11)

- Catalog Fields (campos obligatorios y formatos): developers.facebook.com/docs/commerce-platform/catalog/fields/
- Política de comercio — animales prohibidos: facebook.com/policies_center/commerce/animals
- Fin del checkout nativo de Shops (ago-2025) y modelo link-out: godatafeed.com/blog/meta-is-dropping-native-checkout-on-facebook-and-instagram · feedonomics.com/blog/meta-removing-native-checkout/
- Marketplace sin API para vendedores regulares; partners con feed (eBay/Poshmark): about.fb.com/news/2025/11/facebook-marketplace-gets-a-glow-up/
- Renew de Marketplace (gratis, ~7 días, ~5 veces, luego relist): mbial.com/how-many-times-can-you-renew-a-facebook-marketplace-listing/ · crosslist.com/blog/how-to-relist-on-facebook-marketplace

*La API de Meta cambia; si la implementación ocurre meses después de esta fecha, re-verificar
§5 contra la documentación vigente antes de escribir el generador.*
