# CLAUDE.md — Ignitia Landing Page

## Contexto del proyecto

Ignitia Studio es una microconsultoría boutique B2B de performance digital.
Tagline: "Ignite clarity. Elevate performance."
URL: getignitia.com

**Posicionamiento:** No es una agencia, no es un freelancer técnico.
Es la capa estratégica entre las campañas y las decisiones de negocio.
Especialidad: medición confiable (GA4), estructura de campañas, automatización
y dashboards — sin comprar medios ni crear contenido.

**ICP (3 segmentos):**
- Startups / scale-ups CDMX con tracción (5–30 personas)
- Agencias de marketing 10–40 personas (modelo white-label)
- Marcas DTC / ecommerce mexicanas en crecimiento

**Owner:** Juan Manuel Sirtori — opera desde CDMX, transición a Toronto en agosto 2026.

---

## Stack técnico

- HTML puro + CSS inline + JavaScript vanilla
- Sin frameworks, sin bundlers, sin dependencias externas
- Un solo archivo `index.html` en el root del repo
- Deploy: Netlify — auto-deploy desde `main` branch
- Dominio: `getignitia.com` con Netlify DNS, HTTPS forzado vía `_redirects`

---

## Integraciones activas

| Integración | Detalle |
|---|---|
| Google Analytics 4 | ID: `G-WK0T1JZZPT` — tracking de eventos en todos los CTAs |
| Netlify Forms | Captura submissions del formulario de contacto |
| Netlify Functions | `analyze.js` (audit engine) y `save-lead.js` (leads → Notion) |
| Anthropic API | Claude Haiku en `/audit` para diagnósticos digitales |
| Notion API | Base de datos de leads: `332676f6042380b8a2fbee08e20506f8` |
| WhatsApp Business | `+523349440999` — aparece en hero y unlock bar del audit |

**Variables de entorno activas en Netlify:**
- `ANTHROPIC_API_KEY`
- `NOTION_TOKEN`

⚠️ Nunca hardcodear estas variables en el código. Siempre via Netlify env.

---

## Estructura del sitio

Archivo único `index.html`. Secciones en orden:

1. **Hero** — headline principal + CTA primario (→ /audit) + CTA secundario (contacto)
2. **Audit tool preview** — demo visual del reporte con friction score de ejemplo
3. **Problem statement** — 4 pain points del ICP (datos no confiables, campañas sin estructura, ciclo roto, decisiones a ciegas)
4. **Servicios** — Core service (Google Ads + Performance) y Entry point (Auditoría)
5. **The Ignitia Protocol** — metodología en 3 pasos: Measurement First → Campaign Structure → Data Optimization
6. **Pricing** — 3 planes: Setup ($3,000 MXN), Retainer ($7,000 MXN/mes), Audit (à la carte)
7. **CTA final** — diagnóstico sin costo + formulario de contacto con Netlify Forms

**Jerarquía de CTAs:**
- CTA primario: `EJECUTAR_DIAGNÓSTICO →` → `/audit`
- CTA secundario: formulario de contacto inline
- CTA de respaldo: WhatsApp `+523349440999`

---

## Decisiones de diseño — NO modificar sin justificación

- **Aesthetic:** terminal/tech — dark background, monospace font, sintaxis estilo CLI
- **Paleta:** fondo `#0a0a0a`, acento `#ff4d00`, texto `#e8e8e8`
- **Copy:** todo en mayúsculas con guiones bajos estilo variable (`EXECUTE_DIAGNÓSTICO`, `MEASUREMENT_FIRST`). Mantener esta convención en cualquier texto nuevo.
- **Tono:** directo, sin fluff, sin emojis decorativos, sin frases motivacionales genéricas
- **Idioma:** español por defecto. Hay una opción EN en el nav — no está implementada aún.

---

## Pendientes conocidos (backlog)

- [ ] Agregar precio ancla al plan Audit (actualmente dice "à la carte" sin número)
- [ ] Agregar resultado numérico real en el hero o sub-hero (caso anónimo sirve)
- [ ] Agregar sección de social proof / caso de cliente una vez cerrado el primero
- [ ] Implementar versión EN de la landing (nav toggle ya existe, contenido pendiente)
- [ ] Automatizar entrega del reporte completo por email (hoy es manual)

---

## Reglas para modificaciones

- No agregar dependencias externas ni frameworks — el repo debe seguir siendo un solo `index.html`
- No modificar el ID de GA4 ni los nombres de los eventos trackeados sin documentarlo
- No cambiar los nombres de las Netlify Functions (`analyze.js`, `save-lead.js`) sin actualizar las referencias en el HTML
- No tocar las variables de entorno — cualquier nueva variable debe agregarse en Netlify dashboard y documentarse aquí
- Cualquier nuevo CTA debe seguir la convención de naming: `ACCION_DESCRIPCION →`
- Mantener el `_redirects` intacto — fuerza HTTPS y maneja el routing de `/audit`
