# Vuelo: guion de planos, prompts de Google Flow y pipeline

El **vuelo** es un único plano continuo, controlado por scroll, que va del mar a la urbanización en tres **capítulos**: el mar, la playa y la urbanización. Mientras no existan los clips de Google Flow, el vuelo usa marcadores generados con `ffmpeg` que tienen la misma codificación que los reales.

## Pipeline

Necesita Node ≥ 22.18 (ejecuta el script TypeScript directamente), `ffmpeg` y `ffprobe` (`brew install ffmpeg`); las imágenes usan `sharp`, que ya instala `npm install`.

```bash
npm run media:flight                         # marcadores: degradados de la paleta con el rótulo de cada capítulo
npm run media:flight -- --from ~/flow/flight # clips reales de Google Flow
```

Con `--from`, la carpeta lleva un clip por capítulo y formato, nombrado con el id del capítulo (cualquier extensión que lea `ffmpeg`):

```text
~/flow/flight/
├── desktop/   sea.mp4  beach.mp4  development.mp4   (16:9)
└── mobile/    sea.mp4  beach.mp4  development.mp4   (9:16)
```

El comando reescribe `public/media/flight/` entero:

| Archivo                            | Qué es                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `{desktop,mobile}/flight.mp4`      | H.264, todos los fotogramas clave (`-g 1`), `faststart`, sin audio     |
| `{desktop,mobile}/flight.webm`     | VP9, todos los fotogramas clave, sin audio                             |
| `{desktop,mobile}/poster.webp`     | Primer fotograma: poster del vídeo e imagen del hero                   |
| `{desktop,mobile}/<capítulo>.webp` | Fotograma central de cada capítulo, para la alternativa sin movimiento |
| `manifest.json`                    | Manifiesto validado con `sequenceManifestSchema`                       |

Lo que hace por el camino:

1. Escala y recorta cada clip al formato (escritorio 1600×900, móvil 720×1280), a 24 fps y sin audio.
2. Los clips de Flow van encadenados (el último fotograma de uno es el primero del siguiente), así que a partir del segundo clip se descarta el primer fotograma para que no haya un fotograma repetido en la unión.
3. Une los clips; los tiempos de cada capítulo en el manifiesto salen de los fotogramas de cada clip. Escritorio y móvil deben tener la misma duración: comparten manifiesto y el comando falla si no coinciden.
4. Codifica con calidad constante y, si un archivo pasa del presupuesto (4 MB en escritorio, 2,5 MB en móvil), sube el CRF hasta que cabe. Si el CRF pasa de 31 (MP4) o 47 (WebM) avisa, porque la imagen empieza a verse en bloques; si ni con el máximo cabe, falla y pide acortar los clips.
5. Valida el manifiesto con Zod antes de escribirlo. `npm run test` comprueba además que existen todos los archivos que nombra y que cumplen los pesos.

Todos los fotogramas son clave para que mover `currentTime` sea instantáneo en cualquier punto del scrub. El precio es el peso: con clips de 8 s por capítulo el CRF sube mucho. Para el vuelo real conviene que cada capítulo dure **4–5 s** (unos 12–15 s en total) y recortar en Flow lo que sobre.

## Guion de planos

Un vuelo de dron continuo, sin cortes, siempre hacia delante y a velocidad constante (sin acelerar ni frenar en las uniones, para que el scrub no dé tirones). Cámara estable, sin giros bruscos ni personas en primer plano, sin texto ni logotipos.

Se generan cuatro imágenes clave por formato y tres clips que las unen (Flow: _Frames to video_, con fotograma inicial y final):

| Clip / capítulo         | Fotograma inicial | Fotograma final   | Qué pasa                                                                                   |
| ----------------------- | ----------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| `sea` · El mar          | K0 · Mar abierto  | K1 · Llegada      | Vuelo bajo sobre un mar en calma; la costa aparece al fondo y se acerca.                   |
| `beach` · La playa      | K1 · Llegada      | K2 · Orilla       | Cruza la orilla de una cala de arena fina y sube suavemente por encima de la playa.        |
| `development` · La urb. | K2 · Orilla       | K3 · Urbanización | Gana altura sobre el paseo y los pinos y termina en una vista aérea de las doce viviendas. |

K3 es el último fotograma del vuelo y da paso a la selección de tipologías: debe ser una vista tranquila y reconocible de la urbanización completa, con aire arriba para el texto.

Cada imagen se genera dos veces, en 16:9 y en 9:16, con el mismo prompt. En vertical, encuadrar más cerca del centro de la escena para no perder la urbanización en los laterales.

## Prompts de Google Flow

Los prompts van en inglés porque los modelos de Flow los siguen con más precisión. Todos terminan con el mismo bloque de estilo, para que la luz y el color sean coherentes en las cuatro imágenes y en los clips.

**Bloque de estilo** (se añade al final de cada prompt):

> Photorealistic aerial cinematography of the Spanish Mediterranean coast. Soft, warm early-morning light, low sun, gentle haze, long soft shadows. Muted, slightly desaturated palette: deep sea teal, pale aqua shallows, warm sand, whitewashed walls, terracotta roof tiles, olive and pine greens. Calm, airy and serene, never gloomy or dramatic. No people in focus, no text, no logos, no watermarks.

**Variante de atardecer**: para probar la luz de la tarde, sustituir _"Soft, warm early-morning light, low sun"_ por _"Soft, warm late-afternoon light just before sunset, low golden sun from the side"_. Elegir una de las dos y usarla en las cuatro imágenes y en los tres clips: mezclarlas rompe la continuidad del vuelo.

### Imágenes clave

- **K0 · Mar abierto**: _Low drone shot just above a calm, glassy Mediterranean sea at dawn, gentle small swells, the sun low and hazy on the horizon, a faint distant coastline with low hills and pines._
- **K1 · Llegada**: _Drone shot approaching a small, quiet cove from the sea, turquoise shallows over sand, a crescent of fine pale beach ahead, a gentle pine-covered slope behind it, small white houses barely visible among the pines._
- **K2 · Orilla**: _Drone shot crossing the shoreline of a small Mediterranean cove, soft foam lines on fine pale sand, a wooden boardwalk and low dunes with grasses, a low-rise development of white houses among pines just beyond the beach._
- **K3 · Urbanización**: _Elevated three-quarter aerial view of a small, calm development of twelve new-build Mediterranean houses next to the beach: whitewashed cubic villas with flat rooftop terraces and turquoise pools, two-storey semi-detached houses with gardens and single-storey houses with shaded porches, terracotta accents, olive trees and umbrella pines, quiet paths, the sea and the cove at the edge of the frame, open sky above._

### Clips

Mismo prompt en los tres, con fotograma inicial y final de la tabla:

> Smooth, continuous forward drone flight at a constant speed, steady camera, no cuts, no sudden turns, gentle natural motion of the water and trees. _(+ bloque de estilo)_

- **sea** (K0 → K1): añadir _"flying low over the calm sea towards the cove."_
- **beach** (K1 → K2): añadir _"crossing the shoreline and rising gently over the beach."_
- **development** (K2 → K3): añadir _"rising over the pines and settling into an elevated view of the development."_

Si un clip sale con cortes, cambios de luz o movimientos bruscos, regenerarlo antes que corregirlo en edición: el pipeline no corrige color ni estabiliza.

## Textos

Los textos de los capítulos (contador, etiqueta, titular y línea) no van en el manifiesto ni en los vídeos, sino en el archivo de contenido del vuelo, enlazados por el id del capítulo. Cambiar los vídeos no toca los textos ni al revés.
