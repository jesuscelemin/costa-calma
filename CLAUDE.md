# Costa Calma — contexto del proyecto

Web de portfolio de Jesús (Full-Stack Developer). Promotora **ficticia** que vende casas de obra nueva en una pequeña urbanización junto a una playa del Mediterráneo. Objetivo: que quien la vea **se quede asombrado**. Demuestra dominio del buen gusto y del trabajo excelente en todas las capas: lo visual, la animación, el 3D y el backend, al mismo nivel. El listón de lo que ve el visitante es fotorrealista (luz, materiales y detalles al nivel de Cycles y de las referencias), con una experiencia narrativa y cinematográfica, nada de layouts genéricos de inmobiliaria. Todo el contenido de la interfaz va en español de España.

Referencias que fijan el objetivo (11-11-2026): las grabaciones de Clos des Vignes y de Llindar (en `~/Desktop`, «Grabación de pantalla 2026-11-11»). Ver ADR 0015.

Sistema de diseño completo (paleta, tipografía, logo, guía de marca): https://claude.ai/artifact/C3kRTx1g2TZaBenRQuGR6v

## La experiencia

Hilo narrativo: llegas a la costa, eliges zona y casa, y la recorres por dentro (ADR 0015).

1. **Loading.** Animación con el sol del logo saliendo sobre las olas. Es real: dura lo que tarda en precargar los assets críticos del primer tramo (máximo 2–3 s) y no se repite en la misma sesión.
2. **Apertura.** Animación hecha con Google Flow y controlada por scroll: la cámara vuela desde el mar hasta la urbanización. Su último fotograma es la vista aérea, sin corte.
3. **Elegir zona.** Sobre la vista aérea (un render de Blender de la urbanización en su ladera: tres filas escalonadas sobre la playa, cada una con su calle, que llegan a una calle colectora que sube por el este, entre otras urbanizaciones; referencias: `~/Desktop/Costa Calma/Archivos Referencia/Duna Blanca, urbanización costera de lujo.png` y `Duna Blanca_ trama urbana costera realista.png`), una zona por tipología, cada una en su fila: primera línea (Villa Duna Blanca), Casa Pinar y Casa Olivo. La zona se ilumina al pasar el ratón o tocarla; al pulsarla, la cámara se acerca.
4. **Elegir casa.** Dentro de la zona, cada vivienda se ilumina con su ficha (tipología, m², dormitorios, precio y estado, siempre con texto). El estado viene de la base de datos. Al pulsar una, se navega a la página de su casa (`/casas/[slug]`), compartible y con el botón «atrás» funcionando.
5. **Tour de la casa.** Paradas panorámicas unidas por tramos cortos, con puntos de paso y minimapa (ver «Tour»). Después, elegir planta con la planta sin techo en 3D.
6. **Volver.** Botón para volver a la landing, que restaura la posición donde estaba el visitante (la zona que había elegido).
7. **Resto de la landing.** Ubicación, calidades, contacto y reserva de visita.

### Tour

Ni un plano secuencia largo (marea) ni la maqueta en tiempo real (se quedaba pobre): paradas y tramos renderizados en Blender (Cycles), desde el mismo plano que usa la web (ADR 0015). Referencias: Llindar (paradas, minimapa, puntos, «la casa sin tejado») y Clos des Vignes (elegir la villa iluminada, la vida de los tramos).

- **Parada:** panorámica de unos 180° de una estancia, que se arrastra a izquierda y derecha con un zoom ligero. Enseña la estancia entera, nunca una pared vacía. Lleva su cartela abajo a la izquierda («Salón · 38 m² · orientación sur» y una frase).
- **Tramo:** vídeo corto de una parada a la contigua, con vida: las puertas se abren al pasar, las cortinas se mueven, entra la luz. Empieza y acaba en los fotogramas de las paradas que une.
- **Recorrido guiado:** con el scroll se avanza tramo a tramo por la ruta de la casa (Villa Duna Blanca: entrada, recibidor, salón, porche y piscina, suite principal, azotea…).
- **Puntos de paso:** sobre la panorámica, puntos para ir a la estancia contigua, subir o bajar de planta o entrar en una estancia que no está en el recorrido guiado. Reproducen su tramo, o pasan con un fundido si no lo tiene.
- **Localizador (minimapa):** abajo a la derecha, el plano de la planta actual con la estancia iluminada y un punto donde está el visitante; sus estancias se pueden pulsar.
- **Elegir planta:** selector de las plantas. La elegida se ve como «la casa sin tejado»: a la izquierda, la planta sin techo en 3D en tiempo real; a la derecha, su plano 2D sincronizado. Al pulsar una estancia se entra en su parada. Una lista de estancias por planta lo hace accesible con teclado.
- Anterior / siguiente y flechas del teclado en todo el tour.
- **Día/Noche** (atardecer con las luces encendidas) en las paradas: en la fase de pulido.

### Detalles 3D (Three.js / React Three Fiber)

- **Planta sin techo** (prioridad, ADR 0015): cada planta de la casa exportada de la escena de Blender a glTF, con la luz de Cycles horneada en las texturas. Se gira de forma suave y limitada, las estancias se iluminan con su nombre y sus m² y, al cambiar de planta, las de encima se apartan.
- **Olas del loading con shader de agua** (opcional, en la fase de pulido): las olas bajo el sol del logo hechas con un shader ligero. Si el dispositivo es lento o hay `prefers-reduced-motion`, se usa la versión SVG.
- **Transición líquida** (opcional, en la fase de pulido): distorsión tipo agua al pasar de la vista aérea a la página de la casa.

Reglas: el 3D nunca bloquea la carga (import dinámico sin SSR, con un poster estático mientras carga), debe ir a 60 fps en un portátil medio y tener una alternativa 2D accesible (la lista de estancias y el plano 2D).

### Tipologías

- **Villa Duna Blanca** (unidades 1–4, primera línea, junto a la playa): villa independiente de 2 plantas y azotea, cuatro suites, gimnasio y spa, ascensor, porche a doble altura, piscina infinity con jacuzzi y azotea con jacuzzi. Es la estrella. Su plano es el calco de los planos de Jesús (`~/Desktop/Duna_Blanca`).
- **Casa Pinar** (unidades 5–10, tres pareadas en la fila de arriba): pareada de 2 plantas y azotea, en el estilo de Duna Blanca.
- **Casa Olivo** (unidades 11–16, en la fila del medio): una planta en U alrededor de un olivo, con azotea, en el estilo de Duna Blanca.

Fase inicial de assets: **solo Villa Duna Blanca con tour completo**. Las otras dos se muestran con su ficha, renders fijos y la etiqueta "Tour próximamente" hasta que tengan sus renders, con el mismo pipeline.

## Stack

- Next.js (App Router) + TypeScript estricto + React Compiler
- Tailwind CSS con los tokens de abajo como variables CSS
- shadcn/ui como base de los componentes genéricos de `components/ui/`, con sus variables mapeadas a los tokens de marca (nunca con su tema por defecto)
- `<ViewTransition>` de React (View Transitions API) para la transición compartida tarjeta → página de la casa (ADR 0005)
- GSAP (ScrollTrigger, SplitText) para las secuencias controladas por scroll
- Lenis para scroll suave
- Three.js con React Three Fiber + drei para los detalles 3D en tiempo real (ver "Detalles 3D"), cargados de forma diferida para no penalizar la carga inicial
- Motor de scrub de vídeo propio (ADR 0003) para la apertura y los tramos del tour
- Blender (Cycles) con scripts de Python en el repositorio para la urbanización, las casas, las paradas, los tramos y los glTF; Google Flow para la apertura y retoques puntuales
- Vercel Blob para los renders, vídeos y glTF (en el repositorio solo los manifiestos)
- Base de datos: Postgres (Neon) con Drizzle ORM
- Autenticación para el panel de administración
- Asistente de búsqueda con IA (lenguaje natural → filtros)
- Tests unitarios de lógica pura con Vitest (`src/**/*.test.ts`) y E2E con Playwright
- Despliegue en Vercel

## Pipeline de assets

Una sola fuente: el plano de cada tipología, en código (ADR 0006, ADR 0008, ADR 0013).

1. **Plano → Blender.** Un script exporta el plano a JSON y Blender construye la casa (y la urbanización) desde él, con muebles y materiales de assets gratuitos (Poly Haven, ambientCG, CC0).
2. **Renders (Cycles).** Vista aérea con una máscara por zona y por vivienda; panorámica de cada parada; tramos entre paradas contiguas (puertas, cortinas y luz animadas); glTF de cada planta con la luz horneada; imágenes fijas.
3. **Flow.** La apertura, con su último fotograma igual a la vista aérea. Si un tramo queda sin vida, un retoque partiendo de sus fotogramas inicial y final de Blender, que se conservan.
4. **`ffmpeg`.** Recodificar para scrub fluido (H.264 con keyframes frecuentes y una versión WebM), posters, imágenes fijas y versiones móviles.
5. **Publicar.** Subir a Vercel Blob, con un manifiesto JSON por secuencia (apertura, tour) en el repositorio.

Todo el pipeline es reproducible con scripts en `scripts/`. Mientras no haya renders definitivos, usar marcadores con las mismas proporciones para no bloquear el desarrollo.

## Hoja de ruta

Hecho antes del replanteamiento del 11-11-2026: base del proyecto, loading, vuelo con el motor de scrub, página de la casa, marca «Galería blanca» y el tour en tiempo real (que se retira cuando el nuevo esté listo).

0. **Poner orden**: ADR 0015, este CLAUDE.md, glosario y tracker alineados; prototipos fuera del repositorio.
1. **Escena maestra en Blender y despliegue**: la urbanización en su ladera y Villa Duna Blanca desde el plano; render aéreo con máscaras. Publicar en Vercel ya, para tener siempre una URL viva.
2. **Apertura con Flow**: del mar a la vista aérea, con el motor de scrub.
3. **Elegir zona y elegir casa**: zonas y viviendas iluminadas sobre la vista aérea, con el estado leído de Neon.
4. **Prueba del tour**: recibidor → salón (dos paradas, un tramo con la puerta abriéndose), panorámica arrastrable, minimapa y puntos de paso. Jesús la valida antes de seguir.
5. **Tour completo de Villa Duna Blanca**: todas las plantas, puntos de paso entre estancias y plantas.
6. **Elegir planta**: la planta sin techo en 3D con su plano 2D.
7. **Backend**: solicitud de visita, antispam, autenticación, panel de viviendas y visitas, cuenta demo.
8. **Pulido**: Día/Noche en las paradas, asistente IA, shader de olas y transición líquida si hay margen, Lighthouse ≥ 90 en móvil, accesibilidad, README con demo. Después, los tours de Casa Pinar y Casa Olivo.

## Tokens de diseño

Dirección «Galería blanca» (ADR 0014): blanco y piedra de día, grafito de noche; el color lo ponen las fotos de las casas. Tema por defecto "Día"; "Noche" con `prefers-color-scheme: dark` y `[data-theme="dark"]`.

| Token          | Día     | Noche   | Uso                                                                           |
| -------------- | ------- | ------- | ----------------------------------------------------------------------------- |
| surface        | #FFFFFF | #141516 | Fondo de página                                                               |
| surface-raised | #FFFFFF | #1C1D1F | Tarjetas, paneles, modales                                                    |
| surface-sunken | #F0EFEC | #0F1011 | Secciones alternas, pie                                                       |
| ink            | #1C1C1C | #EEEDEA | Texto principal                                                               |
| ink-muted      | #626467 | #A3A5A8 | Texto secundario                                                              |
| line           | #E1E1DF | #2C2E31 | Bordes de 1px                                                                 |
| accion         | #1C1C1C | #EEEDEA | Color de acción: botón principal, hover de enlaces, foco                      |
| on-accion      | #FFFFFF | #141516 | Texto sobre el botón principal                                                |
| accion-soft    | #F0EFEC | #26282B | Fondo de controles en hover                                                   |
| piedra         | #E7E5E0 | #2A2B2D | Bloques neutros, placeholders de imagen                                       |
| mar            | #3F5F69 | #9DB6BE | Agua en planos y en la planta sin techo, detalles de marca (no indica acción) |
| on-mar         | #FFFFFF | #141516 | Texto sobre mar                                                               |
| mar-soft       | #E1E8EA | #22303A | Relleno del agua, chips                                                       |
| olivo          | #5F6E3F | #A9B97F | Estado disponible                                                             |
| reservado      | #8A5E10 | #E2B860 | Estado reservado                                                              |
| vendido        | #8E3B32 | #E58A7E | Estado vendido y errores                                                      |
| on-media       | #F7F6F3 | #F7F6F3 | Texto sobre imagen o vídeo (con scrim)                                        |

- Scrim (`--scrim`, utilidad `bg-scrim`): degradado desde abajo con el grafito de Noche al 78 % en el 40 % inferior, que se desvanece hacia arriba. El texto sobre imagen va solo en ese 40 % inferior, con la utilidad `on-media`: así llega a 4,5:1 incluso sobre una imagen blanca (lo comprueba `src/styles/tokens.test.ts`).
- Los estados de vivienda se muestran sobre `surface-raised` (tarjetas).
- Tipografía (ADR 0014), con `next/font/google`: **Bodoni Moda** (variable, con tamaño óptico) para titulares, frases destacadas y cifras, y **Hanken Grotesk** para la interfaz y el texto. Sin mayúsculas en ningún sitio y sin palabras de acento en cursiva o en color: el lujo es la contención.
- Escala: display-xl 200/0,88 (marca y nombres gigantes), display-l 76/0,96 (titulares de sección), statement 52/1,12 (frase destacada; puede ir a dos tonos, `ink-muted` y `ink`), figure 64/0,95 (cifras con una línea de texto pequeño debajo), heading 30/1,05 (títulos de tarjeta), en Bodoni Moda 400; title 20/28 600, body 16/26, small 14/22, eyebrow 13/20 500 (en minúsculas), price 24/30 600 (Hanken Grotesk). display-xl, display-l, statement y figure son fluidos desde 390 px (64, 44, 30 y 40 px) y alcanzan su tamaño en escritorio (≥ 1120 px).
- Espaciado: 4, 8, 16, 24, 40, 64, 112 px. Secciones separadas 112px en escritorio y 64px en móvil.
- Radios: 6px (campos), 14px (tarjetas), pill (botones y chips). Las fotos de las casas van sin redondear.
- Sombra única: `0 12px 32px -12px rgba(20,21,22,.16)`, solo en hover o sobre el vídeo.

## Reglas de marca y experiencia

- Deslumbrante pero calmada, como una galería: mucho blanco, tipografía grande, fotos grandes y movimiento lento y fluido. Nada de dorados ni colores cálidos en la interfaz.
- Un solo botón principal (píldora negra, blanca en Noche: `accion`) por vista.
- Los estados de vivienda llevan siempre texto además del color.
- Cifras en formato español: `180 m²`, `685.000 €`.
- Movimiento: 400–700 ms en la interfaz y hasta 1,2 s en las imágenes (se abren de abajo arriba y se acercan despacio), `cubic-bezier(0.22, 1, 0.36, 1)`, sin rebotes. Los titulares suben línea a línea.
- `prefers-reduced-motion`: sin scrub ni parallax; la apertura pasa a imágenes fijas con fundidos, los tramos del tour a fundidos entre paradas, y la panorámica se mueve sin inercia.
- Todo debe funcionar en móvil (táctil, sin hover) y con teclado.
- Contraste de texto ≥ 4.5:1 en ambos temas.
- Logo: sol de línea poniéndose tras tres olas, de trazo fino y un solo color (`ink`), con "Costa Calma" en Bodoni Moda (trazado como SVG).

## Buenas prácticas

### Estructura

El código vive en `src/`:

```text
src/
├── app/                 rutas (App Router): page.tsx, layout.tsx, loading.tsx, error.tsx por ruta
├── features/            una carpeta por funcionalidad: flight, houses, tours, site, visits, admin, assistant
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
- Tests E2E con Playwright de los flujos clave: loading, elegir zona y casa, recorrer el tour (puntos de paso y minimapa), elegir planta, volver a la landing restaurando la posición y reservar visita.
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
