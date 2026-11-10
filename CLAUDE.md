# Costa Calma — contexto del proyecto

Web de portfolio de Jesús (Full-Stack Developer). Promotora **ficticia** que vende casas de obra nueva en una pequeña urbanización junto a una playa del Mediterráneo. Objetivo: una experiencia **deslumbrante**, narrativa y cinematográfica (nada de layouts genéricos de inmobiliaria) **y** demostrar ingeniería full-stack real. Todo el contenido de la interfaz va en español de España.

Sistema de diseño completo (paleta, tipografía, logo, guía de marca): https://claude.ai/artifact/C3kRTx1g2TZaBenRQuGR6v

## La experiencia

Hilo narrativo: llegas a la costa, eliges tu casa y la recorres por dentro.

1. **Loading.** Animación con el sol del logo saliendo sobre las olas. Es real: dura lo que tarda en precargar los assets críticos del primer tramo (máximo 2–3 s) y no se repite en la misma sesión.
2. **Hero.** Imagen a pantalla completa de la playa con la urbanización junto a ella.
3. **Vuelo.** Al hacer scroll, la cámara vuela desde el mar hacia la playa y la urbanización (vídeo controlado por scroll).
4. **Elegir tipología.** Al terminar el vuelo aparecen las tipologías de casa. En escritorio, al pasar el ratón la casa señalada se ilumina (más luz, más clara) y las demás se oscurecen. En móvil, carrusel donde la tarjeta centrada aparece iluminada.
5. **Página de la casa** (`/casas/[slug]`). Al elegir una, su imagen se expande a pantalla completa con una transición compartida y se navega a su propia URL (compartible, con el botón "atrás" funcionando). Con el scroll, el plano de la casa visto desde arriba se levanta en su maqueta, la cámara baja hasta la puerta y entra a recorrerla en su **tour guiado**; después se puede elegir planta y entrar en cualquier estancia.
6. **Volver.** Al terminar el recorrido de la casa, botón para volver a la landing, que restaura la posición donde estaba el visitante (justo en la selección de tipologías).
7. **Resto de la landing.** Debajo de las tipologías: ubicación, calidades, mapa 3D de la urbanización con disponibilidad, contacto y reserva de visita.

### Tours guiados

No son panorámicas 360° ni clips de vídeo: el tour es la cámara recorriendo la maqueta 3D en tiempo real, controlada por scroll (ADR 0009, ADR 0010). Referencia: Casa Larga (https://sam1983aing.github.io/casa-larga/).

- Arranca como la hoja: la planta baja vista desde arriba con una lente de 2°, que se lee como un plano de arquitecto en papel (ejes con burbujas, cotas, rótulos con m² y medidas, muebles en planta, puertas con su barrido, cajetín con escala y norte). Sube la altura de corte y crecen los muros; la cámara se inclina, la lente se abre y baja, sin saltos, hasta la altura de los ojos delante de la puerta de entrada.
- Entra andando por la puerta, que se abre, y recorre en un solo plano secuencia las paradas de todas las plantas (Villa Duna Blanca: recibidor, escalera, salón, porche y piscina, suite principal y azotea), por rutas calculadas desde el plano, y al final se eleva sobre la casa entera en color. La cámara solo gira estando parada, anda recta y siempre por los huecos, a paso constante.
- El barrido convierte la tinta en materiales y luz mediterránea (mediodía en Día, atardecer con las luces encendidas en Noche) estancia a estancia, al cruzar su umbral; lo que aún no se ha pisado sigue en tinta.
- En cada parada, una cartela abajo a la izquierda ("Salón · 38 m² · orientación sur" y una frase) y un localizador con la planta en miniatura (la estancia iluminada y un punto por parada). Arriba a la derecha, el HUD de la cámara: «Lente · Altura · Corte». Anterior / siguiente, flechas del teclado e «Ir a las plantas».
- Al final, elegir planta: las de encima se apartan, la planta aparece como plano dibujado (ejes, cotas, nombre, m² y medidas de cada estancia) y el barrido la convierte en 3D. Pulsar una estancia lleva dentro, a la altura de los ojos; una lista de estancias por planta lo hace accesible con teclado.
- Las estancias de Villa Duna Blanca van amuebladas. La arquitectura, con materiales en código, sin texturas fotográficas; los muebles, los modelos de IKEA con sus propias texturas PBR, camas vestidas por el script (ADR 0011, ADR 0012), cargados por planta.

### Detalles 3D (Three.js / React Three Fiber)

- **Maqueta de cada tipología** (ADR 0006, ADR 0009, ADR 0010): la casa 3D que nace de su hoja y se recorre en el tour (ver «Tours guiados»). Se genera desde los datos del plano (estancias, puertas y ventanas declaradas a mano); los muebles son los modelos glTF de IKEA con sus texturas, solo para la demostración y servidos fuera del repositorio (ADR 0007, ADR 0011, ADR 0012).

- **Mapa 3D de la urbanización** (prioridad): maqueta estilizada de la urbanización junto a la playa, con volúmenes sencillos (no casas detalladas). Cada parcela se ilumina al pasar el ratón o tocarla y muestra su tipología y estado (disponible, reservada, vendida, siempre con texto). Al pulsar una parcela disponible se abre su casa o la reserva de visita. La cámara gira y hace zoom de forma suave y limitada. Los datos de parcelas vienen de la base de datos.
- **Olas del loading con shader de agua** (opcional, en la fase de pulido): las olas bajo el sol del logo hechas con un shader ligero. Si el dispositivo es lento o hay `prefers-reduced-motion`, se usa la versión SVG.
- **Transición líquida** (opcional, en la fase de pulido): distorsión tipo agua al pasar de la tarjeta de una tipología a su página.

Reglas: el 3D nunca bloquea la carga (import dinámico sin SSR, con un poster estático mientras carga), debe ir a 60 fps en un portátil medio y tener una alternativa 2D accesible (lista de parcelas navegable con teclado y lector de pantalla).

### Tipologías

- **Villa Duna Blanca** (unidades 1–4, primera línea): villa independiente de 2 plantas y azotea, cuatro suites, gimnasio y spa, ascensor, porche a doble altura, piscina infinity con jacuzzi y azotea con jacuzzi. Es la estrella. Su plano es el calco de los planos de Jesús (`~/Desktop/Duna_Blanca`).
- **Casa Pinar** (unidades 5–8, segunda línea): pareada de 2 plantas y azotea, en el estilo de Duna Blanca.
- **Casa Olivo** (unidades 9–12, segunda línea): una planta en U alrededor de un olivo, con azotea, en el estilo de Duna Blanca.

Fase inicial de assets: **solo Villa Duna Blanca con tour completo**. Las otras dos se muestran con imágenes fijas y la etiqueta "Tour próximamente" hasta que tengan su maqueta.

## Stack

- Next.js (App Router) + TypeScript estricto + React Compiler
- Tailwind CSS con los tokens de abajo como variables CSS
- shadcn/ui como base de los componentes genéricos de `components/ui/`, con sus variables mapeadas a los tokens de marca (nunca con su tema por defecto)
- `<ViewTransition>` de React (View Transitions API) para la transición compartida tarjeta → página de la casa (ADR 0005)
- GSAP (ScrollTrigger, SplitText) para las secuencias controladas por scroll
- Lenis para scroll suave
- Three.js con React Three Fiber + drei para los detalles 3D en tiempo real (ver "Detalles 3D"), cargados de forma diferida para no penalizar la carga inicial
- Motor de scrub de vídeo propio (o el `scrub-engine.js` de scroll-world, MIT) para el vuelo
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
4. **Tours guiados**: hoja, descenso, puerta, barrido por estancia, tour por paradas con cartelas, elegir planta y entrar en cada estancia. Primero Villa Duna Blanca.
5. **Resto de la landing y backend**: mapa 3D de la urbanización con disponibilidad en tiempo real, reserva de visitas, panel de administración, base de datos.
6. **Asistente IA, pulido, rendimiento y despliegue**: shader de olas y transición líquida si hay margen, Lighthouse ≥ 90 en móvil, accesibilidad, README con demo.

## Tokens de diseño

Dirección «Galería blanca» (ADR 0014): blanco y piedra de día, grafito de noche; el color lo ponen las fotos de las casas. Tema por defecto "Día"; "Noche" con `prefers-color-scheme: dark` y `[data-theme="dark"]`.

| Token          | Día     | Noche   | Uso                                                            |
| -------------- | ------- | ------- | -------------------------------------------------------------- |
| surface        | #FFFFFF | #141516 | Fondo de página                                                |
| surface-raised | #FFFFFF | #1C1D1F | Tarjetas, paneles, modales                                     |
| surface-sunken | #F0EFEC | #0F1011 | Secciones alternas, pie                                        |
| ink            | #1C1C1C | #EEEDEA | Texto principal                                                |
| ink-muted      | #626467 | #A3A5A8 | Texto secundario                                               |
| line           | #E1E1DF | #2C2E31 | Bordes de 1px                                                  |
| accion         | #1C1C1C | #EEEDEA | Color de acción: botón principal, hover de enlaces, foco       |
| on-accion      | #FFFFFF | #141516 | Texto sobre el botón principal                                 |
| accion-soft    | #F0EFEC | #26282B | Fondo de controles en hover                                    |
| piedra         | #E7E5E0 | #2A2B2D | Bloques neutros, placeholders de imagen                        |
| mar            | #3F5F69 | #9DB6BE | Agua en planos y maqueta, detalles de marca (no indica acción) |
| on-mar         | #FFFFFF | #141516 | Texto sobre mar                                                |
| mar-soft       | #E1E8EA | #22303A | Relleno del agua, chips                                        |
| olivo          | #5F6E3F | #A9B97F | Estado disponible                                              |
| reservado      | #8A5E10 | #E2B860 | Estado reservado                                               |
| vendido        | #8E3B32 | #E58A7E | Estado vendido y errores                                       |
| on-media       | #F7F6F3 | #F7F6F3 | Texto sobre imagen o vídeo (con scrim)                         |

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
- `prefers-reduced-motion`: sin scrub ni parallax; el vuelo pasa a imágenes fijas con fundidos, y el tour va de la hoja a cada parada con fundidos, sin descenso, vuelo de cámara ni barrido.
- Todo debe funcionar en móvil (táctil, sin hover) y con teclado.
- Contraste de texto ≥ 4.5:1 en ambos temas.
- Logo: sol de línea poniéndose tras tres olas, de trazo fino y un solo color (`ink`), con "Costa Calma" en Bodoni Moda (trazado como SVG).

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
