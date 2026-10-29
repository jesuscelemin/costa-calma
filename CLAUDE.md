# Costa Calma — contexto del proyecto

Web de portfolio de Jesús (Full-Stack Developer). Promotora **ficticia** que vende casas de obra nueva en una pequeña urbanización junto a una playa del Mediterráneo. Objetivo: una experiencia **deslumbrante**, narrativa y cinematográfica (nada de layouts genéricos de inmobiliaria) **y** demostrar ingeniería full-stack real. Todo el contenido de la interfaz va en español de España.

Sistema de diseño completo (paleta, tipografía, logo, guía de marca): https://claude.ai/artifact/C3kRTx1g2TZaBenRQuGR6v

## La experiencia

Hilo narrativo: llegas a la costa, eliges tu casa y la recorres por dentro.

1. **Loading.** Animación con el sol del logo saliendo sobre las olas. Es real: dura lo que tarda en precargar los assets críticos del primer tramo (máximo 2–3 s) y no se repite en la misma sesión.
2. **Hero.** Imagen a pantalla completa de la playa con la urbanización junto a ella.
3. **Vuelo.** Al hacer scroll, la cámara vuela desde el mar hacia la playa y la urbanización (vídeo controlado por scroll).
4. **Elegir tipología.** Al terminar el vuelo aparecen las tipologías de casa. En escritorio, al pasar el ratón la casa señalada se ilumina (más luz, más clara) y las demás se oscurecen. En móvil, carrusel donde la tarjeta centrada aparece iluminada.
5. **Página de la casa** (`/casas/[slug]`). Al elegir una, su imagen se expande a pantalla completa con una transición compartida y se navega a su propia URL (compartible, con el botón "atrás" funcionando). Según el scroll se muestra la planta baja, luego la primera planta, etc. Cada planta tiene su **tour virtual guiado**.
6. **Volver.** Al terminar el recorrido de la casa, botón para volver a la landing, que restaura la posición donde estaba el visitante (justo en la selección de tipologías).
7. **Resto de la landing.** Debajo de las tipologías: ubicación, calidades, mapa 3D de la urbanización con disponibilidad, contacto y reserva de visita.

### Tours virtuales guiados

No son panorámicas 360° ni 3D en tiempo real. Son recorridos de vídeo controlados por scroll:

- Por cada estancia, una imagen generada con Google Flow, con estilo coherente en toda la casa.
- Clips de transición entre estancias generados en Flow a partir de fotograma inicial y final: el último fotograma de un clip es el primero del siguiente, así el recorrido se ve continuo, sin cortes.
- En cada parada aparecen puntos de información sincronizados con el scroll ("Salón · 38 m² · orientación sur").
- En cada parada, un arrastre ligero mueve la imagen con efecto de profundidad (parallax) para "mirar alrededor".
- Se usa el mismo motor de scrub que el vuelo de la landing.

### Detalles 3D (Three.js / React Three Fiber)

- **Mapa 3D de la urbanización** (prioridad): maqueta estilizada de la urbanización junto a la playa, con volúmenes sencillos (no casas detalladas). Cada parcela se ilumina al pasar el ratón o tocarla y muestra su tipología y estado (disponible, reservada, vendida, siempre con texto). Al pulsar una parcela disponible se abre su casa o la reserva de visita. La cámara gira y hace zoom de forma suave y limitada. Los datos de parcelas vienen de la base de datos.
- **Olas del loading con shader de agua** (opcional, en la fase de pulido): las olas bajo el sol del logo hechas con un shader ligero. Si el dispositivo es lento o hay `prefers-reduced-motion`, se usa la versión SVG.
- **Transición líquida** (opcional, en la fase de pulido): distorsión tipo agua al pasar de la tarjeta de una tipología a su página.

Reglas: el 3D nunca bloquea la carga (import dinámico sin SSR, con un poster estático mientras carga), debe ir a 60 fps en un portátil medio y tener una alternativa 2D accesible (lista de parcelas navegable con teclado y lector de pantalla).

### Tipologías (propuesta inicial, pendiente de confirmar con Jesús)

- **Villa Mar**: villa independiente de 2 plantas con terraza en azotea y piscina. Es la estrella: la primera con tour completo.
- **Casa Pinar**: pareada de 2 plantas con jardín.
- **Casa Duna**: planta baja con jardín y porche.

Fase inicial de assets: **solo Villa Mar con tour completo**. Las otras dos se muestran con imágenes fijas y la etiqueta "Tour próximamente" hasta que se generen sus clips.

## Stack

- Next.js (App Router) + TypeScript estricto + React Compiler
- Tailwind CSS con los tokens de abajo como variables CSS
- shadcn/ui como base de los componentes genéricos de `components/ui/`, con sus variables mapeadas a los tokens de marca (nunca con su tema por defecto)
- Framer Motion para transiciones de interfaz y la transición compartida tarjeta → página de la casa
- GSAP (ScrollTrigger, SplitText) para las secuencias controladas por scroll
- Lenis para scroll suave
- Three.js con React Three Fiber + drei para los detalles 3D en tiempo real (ver "Detalles 3D"), cargados de forma diferida para no penalizar la carga inicial
- Motor de scrub de vídeo propio (o el `scrub-engine.js` de scroll-world, MIT) para el vuelo y los tours
- Base de datos: Postgres (Neon) con Drizzle ORM
- Autenticación para el panel de administración
- Asistente de búsqueda con IA (lenguaje natural → filtros)
- Tests unitarios de lógica pura con Vitest (`src/**/*.test.ts`) y E2E con Playwright
- Despliegue en Vercel

## Pipeline de assets (Google Flow)

1. Generar las imágenes de cada escena del vuelo y de cada estancia, con prompts que respeten la paleta y el estilo de la marca.
2. Generar los clips con fotograma inicial y final encadenados.
3. Procesar con `ffmpeg`: extraer fotogramas de unión, recodificar para scrub fluido (H.264 con keyframes frecuentes y una versión WebM), generar posters y versiones móviles.
4. Guardar en `public/media/` (o almacenamiento externo si pesa demasiado), con un manifiesto JSON por secuencia.

Mientras no haya vídeos reales, usar imágenes de marcador con las mismas proporciones para no bloquear el desarrollo.

## Fases

1. **Base del proyecto**: tokens, fuentes, layout, cabecera y pie con el logo.
2. **Loading + hero + vuelo**: animación de carga, motor de scrub y secuencia del vuelo con marcadores.
3. **Selección de tipologías y página de la casa**: hover/carrusel, transición compartida, `/casas/[slug]` con plantas y vuelta a la landing restaurando la posición.
4. **Tours virtuales guiados**: scrub por estancias, puntos de información, parallax. Primero Villa Mar.
5. **Resto de la landing y backend**: mapa 3D de la urbanización con disponibilidad en tiempo real, reserva de visitas, panel de administración, base de datos.
6. **Asistente IA, pulido, rendimiento y despliegue**: shader de olas y transición líquida si hay margen, Lighthouse ≥ 90 en móvil, accesibilidad, README con demo.

## Tokens de diseño

Tema por defecto "Día"; "Noche" con `prefers-color-scheme: dark` y `[data-theme="dark"]`.

| Token           | Día     | Noche   | Uso                                                                                   |
| --------------- | ------- | ------- | ------------------------------------------------------------------------------------- |
| surface         | #F6F1E8 | #121B1C | Fondo de página                                                                       |
| surface-raised  | #FFFDF9 | #1A2627 | Tarjetas, paneles, modales                                                            |
| surface-sunken  | #EDE4D4 | #0C1314 | Secciones alternas, pie                                                               |
| ink             | #1E2A2B | #F2ECE1 | Texto principal                                                                       |
| ink-muted       | #56605F | #A9B4B2 | Texto secundario                                                                      |
| line            | #DCD1BF | #2C3A3B | Bordes de 1px                                                                         |
| mar             | #1F5F6B | #7CC0C9 | Azul de marca (ya no indica acción)                                                   |
| on-mar          | #FFFDF9 | #0C1314 | Texto sobre mar                                                                       |
| mar-soft        | #D7E8E9 | #1C3A3E | Chips, hover                                                                          |
| terracota       | #C2683F | #E08A60 | Acento decorativo, cifras ≥ 24px                                                      |
| terracota-text  | #9C4A25 | #EBA27E | Texto de acento y color de acción: botón principal, hover de enlaces, foco (ADR 0004) |
| on-terracota    | #FFFDF9 | #0C1314 | Texto sobre el botón principal                                                        |
| terracota-soft  | #F4E2D8 | #463C34 | Fondo de controles en hover                                                           |
| arena           | #E6D6BC | #3B3429 | Bloques neutros, placeholders de imagen                                               |
| sol             | #E9B45C | #E9B45C | Brillo puntual, nunca texto                                                           |
| olivo           | #5F6E3F | #A9B97F | Estado disponible                                                                     |
| reservado       | #9A6A12 | #E2B860 | Estado reservado                                                                      |
| vendido         | #8E3B32 | #E58A7E | Estado vendido y errores                                                              |
| on-media        | #F2ECE1 | #F2ECE1 | Texto sobre imagen o vídeo (con scrim)                                                |
| on-media-accent | #EBA27E | #EBA27E | Acento en cursiva sobre imagen o vídeo                                                |

- Scrim (`--scrim`, utilidad `bg-scrim`): degradado desde abajo con el `surface-sunken` de Noche al 80 % en el 40 % inferior, que se desvanece hacia arriba. El texto sobre imagen va solo en ese 40 % inferior, con la utilidad `on-media`: así llega a 4,5:1 incluso sobre una imagen blanca (lo comprueba `src/styles/tokens.test.ts`).
- En Día, `olivo` y `reservado` no llegan a 4,5:1 sobre `surface` ni `surface-sunken`: los estados se muestran sobre `surface-raised` (tarjetas).
- Tipografía (ADR 0002), con `next/font/google`: **Darker Grotesque** (300/400/500) para titulares, frases destacadas y cifras, siempre sin mayúsculas, **Manrope** (interfaz, 400/600/700) y **Fraunces** cursiva solo para las palabras de acento (el logo va trazado en SVG).
- Escala (referencia: Vesper): display-xl 240/0,85 300 (marca decorativa), display-l 80/0,98 400 (titulares de sección), statement 56/1,08 400 (frase destacada a dos tonos: arranque en `ink-muted`, resto en `ink`), figure 52/1 500 (cifras con una línea de texto pequeño debajo), heading 30/1,02 500 (títulos de tarjeta), en Darker Grotesque; title 20/28 600, body 16/26, small 14/22, eyebrow 12/16 700 mayúsculas +1.5px, price 24/30 600 (Manrope). display-xl, display-l, statement y figure son fluidos desde 390 px (64, 48, 32 y 40 px) y alcanzan su tamaño en escritorio (≥ 1120 px). Las mayúsculas solo van en `eyebrow`.
- Acento: componente `Accent` (`components/ui/accent.tsx`, utilidad `type-accent`) para la palabra clave de un titular: Fraunces cursiva al 0,8 em, en `terracota-text` (4,5:1 a cualquier tamaño), o en `on-media-accent` dentro de `on-media`.
- Espaciado: 4, 8, 16, 24, 40, 64, 112 px. Secciones separadas 112px en escritorio y 64px en móvil.
- Radios: 6px (campos), 14px (tarjetas), 32px (imágenes hero), pill (botones y chips).
- Sombra única: `0 12px 32px -12px rgba(30,42,43,.18)`, solo en hover o sobre el vídeo.

## Reglas de marca y experiencia

- Deslumbrante pero calmada: mucho aire, tipografía grande, movimiento lento y fluido. Nada de dorados ni negro brillante.
- Un solo botón principal (naranja, `terracota-text`) por vista.
- Los estados de vivienda llevan siempre texto además del color.
- Cifras en formato español: `180 m²`, `685.000 €`.
- Movimiento: 400–700 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, sin rebotes.
- `prefers-reduced-motion`: sin scrub ni parallax; el vuelo y los tours pasan a imágenes fijas con fundidos.
- Todo debe funcionar en móvil (táctil, sin hover) y con teclado.
- Contraste de texto ≥ 4.5:1 en ambos temas.
- Logo: sol de línea poniéndose tras tres olas, todo de un solo color (`ink`), con "Costa Calma" en Fraunces (trazado como SVG).

## Buenas prácticas

### Estructura

El código vive en `src/`:

```text
src/
├── app/                 rutas (App Router): page.tsx, layout.tsx, loading.tsx, error.tsx por ruta
├── features/            una carpeta por funcionalidad: flight, houses, tours, site-map, visits, admin, assistant
│   └── <feature>/       components/, hooks/, actions.ts, schema.ts, types.ts
├── components/ui/       componentes genéricos reutilizables (Button, Chip, Logo...)
├── lib/                 utilidades compartidas (formato de cifras, motion, cliente de BD)
├── db/                  esquema y migraciones de Drizzle
└── styles/              tokens y estilos globales
```

Alias `@/*` → `src/*`. Assets estáticos en `public/` (fuera de `src/`).

Regla de ubicación: cada cosa vive lo más cerca posible de donde se usa.

- **Solo la usa una ruta** → junto a esa ruta, en carpetas privadas (`_components/`, `_hooks/`, `_lib/`), que no generan URLs. Ejemplo: `src/app/(admin)/admin/visitas/_components/VisitsTable.tsx`.
- **La usan varias rutas del mismo dominio** → `src/features/<dominio>/`. Ejemplo: la tarjeta de tipología, usada en la landing, en `/casas/[slug]`, en el mapa y en el admin, va en `features/houses/components/`.
- **Genérica, sin lógica de negocio** → `src/components/ui/`. Ahí los archivos van en kebab-case (`button.tsx`), como los genera shadcn, para que `shadcn add` siga funcionando; en el resto del código, componentes en PascalCase.
- Si algo de una ruta pasa a usarse en otra, se mueve a `features/` en ese momento; nunca se importa desde la carpeta privada de otra ruta.
- Sin carpeta global de `actions/`: las Server Actions van en `features/<dominio>/actions.ts` o en el `_lib/` de la ruta que las usa.
- Grupos de rutas para separar zonas con layouts distintos: `(site)` para la web pública y `(admin)` para el panel.

### Next.js

- Server Components por defecto. `"use client"` solo donde hace falta (animación, scroll, 3D, formularios), lo más abajo posible en el árbol.
- Datos en el servidor. Mutaciones con Server Actions, validadas con Zod.
- `next/image` y `next/font`. Metadatos y Open Graph en cada página. `loading.tsx` y `error.tsx` en cada ruta.
- Import dinámico (`next/dynamic`, sin SSR cuando toque) para Three.js, GSAP y reproductores de vídeo.

### React

- Componentes pequeños con una sola responsabilidad. Lógica reutilizable en hooks propios (`useScrub`, `usePrefersReducedMotion`...).
- No usar `useEffect` para derivar estado ni para pedir datos que pueden venir del servidor.
- Limpiar al desmontar: listeners, timelines y ScrollTriggers de GSAP (`gsap.context` / `useGSAP`), instancias de Lenis y recursos de Three.js.
- Accesibilidad: HTML semántico, foco visible, navegación por teclado, textos alternativos.

### TypeScript

- `strict` activado. Prohibido `any`; si un tipo es desconocido, `unknown` y estrechar.
- Tipos derivados del esquema de Drizzle y de Zod (`z.infer`), no duplicados a mano.
- Tipos explícitos en las fronteras: props, Server Actions, manifiestos de vídeo.

### Calidad

- ESLint + Prettier, con hook de pre-commit que pase lint, formato y `tsc --noEmit`.
- Tests E2E con Playwright de los flujos clave: loading, elegir casa, volver a la landing restaurando la posición, mapa 3D y reservar visita.
- Nada se da por terminado sin pasar lint, tipos y tests.

## Herramientas de diseño y conectores

Usar estas herramientas activamente; no diseñar "de memoria". El orden de prioridad ante conflictos es: **este CLAUDE.md y el sistema de diseño > las referencias que aporte Jesús > lo que sugiera cualquier skill o conector**.

- **frontend-design** (skill): dirección de arte y decisiones visuales. Usarla al empezar cada pantalla o sección importante para proponer 2–3 direcciones antes de construir.
- **ui-ux-pro-max** (skill): revisión de usabilidad, jerarquía, accesibilidad y patrones de interacción. Usarla para validar cada pantalla antes de darla por terminada.
- **motionsites-web-builder** (plugin): técnicas cinematográficas (scroll stories, vídeo, transiciones, Three.js) y su ciclo de captura → revisión → corrección. Usar sus recetas y referencias como inspiración, **nunca sus vídeos ni imágenes alojados en sus servidores**: los assets de Costa Calma salen de Google Flow. Su estética no sustituye a la de la marca.
- **21st.dev** (conector y skill): buscar componentes e inspiración (navbar, carruseles, formularios, tablas del admin). Todo componente que se traiga se adapta a los tokens, tipografías y radios de este archivo; nunca se deja con su estilo original.
- **Mobbin** (conector): referencias de patrones reales de apps y webs (fichas de vivienda, filtros, reserva de cita, paneles de administración). Consultarlo antes de diseñar flujos con formularios o datos.
- **Neon** (conector): crear y gestionar la base de datos Postgres del proyecto. Las operaciones destructivas siempre se confirman antes con Jesús.
- **Playwright**: capturas en escritorio (1440×900) y móvil (390×844) de cada pantalla terminada, revisando consola, imágenes rotas y desbordamientos.

Al terminar una pantalla, indicar brevemente qué herramientas se usaron y qué referencias inspiraron el resultado, para documentarlo después en el README.

## Forma de trabajar

- Flujo de skills de Matt Pocock por fase: grill-with-docs → to-spec → to-tickets → implement. Una fase cada vez, no todo el proyecto de golpe.
- Commits pequeños y descriptivos.
- Idiomas: código, nombres de archivo, comentarios y commits en inglés; carpetas de ruta y slugs en español (ver `docs/adr/0001`); glosario, ADRs e issues en español; README en inglés; interfaz siempre en español de España.
- Vocabulario del dominio y su nombre en código: `GLOSSARY.md`.
- Antes de cada fase, proponer el plan y esperar el visto bueno de Jesús.
- Revisar visualmente con Playwright (capturas en escritorio y móvil) antes de dar algo por terminado.
- README del repo con capturas, demo en vídeo y explicación técnica: es una pieza de portfolio.

## Agent skills

### Issue tracker

Los issues y specs viven en GitHub Issues (`jesuscelemin/costa-calma`), vía `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Etiquetas por defecto: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` y `docs/adr/` en la raíz. See `docs/agents/domain.md`.
