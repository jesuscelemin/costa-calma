# Casas: lista de planos y prompts de Google Flow

Cada tipología tiene una **tarjeta** (selección de tipologías, mapa y admin), un **hero** a pantalla completa en su página y un **póster por planta**, que es el primer fotograma de su tour. Mientras no existan las imágenes de Google Flow, se usan marcadores con las proporciones definitivas.

## Marcadores

```bash
npm run media:houses
```

Reescribe `public/media/houses/` entero a partir de las tipologías y plantas de `src/features/houses/data.ts`: un degradado de la paleta por tipología, con el rótulo de cada imagen. `npm run test` comprueba que existen todas las imágenes y que tienen su tamaño final.

Las imágenes reales se guardan con el **mismo nombre y tamaño** (WebP, calidad ~80), así que sustituirlas no toca el código:

| Archivo                               | Tamaño    | Proporción | Dónde se ve                                       |
| ------------------------------------- | --------- | ---------- | ------------------------------------------------- |
| `<slug>/card-portrait.webp`           | 1200×1600 | 3:4        | Paneles de la selección (escritorio), carrusel    |
| `<slug>/card-landscape.webp`          | 1600×1000 | 16:10      | Mapa y panel de administración                    |
| `<slug>/hero-desktop.webp`            | 1920×1080 | 16:9       | Hero de `/casas/<slug>` en escritorio             |
| `<slug>/hero-mobile.webp`             | 1080×1920 | 9:16       | Hero de `/casas/<slug>` en móvil                  |
| `<slug>/floors/<planta>-desktop.webp` | 1600×900  | 16:9       | Tramo de cada planta; primer fotograma de su tour |
| `<slug>/floors/<planta>-mobile.webp`  | 720×1280  | 9:16       | Ídem en móvil                                     |

Los ids de planta son `plot` (Exterior), `ground` (Planta baja), `first` (Primera planta) y `roof` (Azotea). Los pósters de planta tienen el tamaño de los clips de los tours para que el primer fotograma del vídeo los sustituya sin salto.

Composición: la tarjeta vertical y el hero llevan texto encima (el nombre decorativo arriba y, en la tarjeta, el nombre y las cifras en el 40 % inferior, sobre el scrim). Dejar cielo o fachada tranquila arriba y nada importante en el cuarto inferior.

## Lista de planos

| Tipología  | Imagen         | Plano                                                                                      |
| ---------- | -------------- | ------------------------------------------------------------------------------------------ |
| Villa Mar  | Tarjeta        | Fachada sur en tres cuartos desde el jardín, con la piscina en primer término y la azotea. |
| Villa Mar  | Hero           | Frontal desde la piscina al atardecer, el salón abierto con correderas, el mar reflejado.  |
| Villa Mar  | Exterior       | Vista alta de la parcela: jardín, piscina de 9 × 3,5 m, porche y pinos en el lindero.      |
| Villa Mar  | Planta baja    | Salón-comedor y cocina abiertos al sur, desde el recibidor, con las correderas al fondo.   |
| Villa Mar  | Primera planta | Distribuidor hacia la suite principal, con luz entrando por la ventana al mar.             |
| Villa Mar  | Azotea         | Terraza de azotea con pérgola, tumbonas y el mar en el horizonte.                          |
| Casa Pinar | Tarjeta        | Las dos mitades de la pareada entre pinos, con el jardín delantero de una de ellas.        |
| Casa Pinar | Hero           | Fachada al jardín con el porche, la mesa exterior y la sombra de los pinos.                |
| Casa Pinar | Exterior       | Jardín privado con césped, porche y el seto que separa de la vivienda vecina.              |
| Casa Pinar | Planta baja    | Salón con salida al porche y cocina abierta, desde la entrada.                             |
| Casa Pinar | Primera planta | Dormitorio principal con ventana a los pinos.                                              |
| Casa Olivo | Tarjeta        | Casa de una planta con porche corrido y jardín de plantas de duna.                         |
| Casa Olivo | Hero           | Porche al atardecer con la casa iluminada por dentro y el jardín delante.                  |
| Casa Olivo | Exterior       | Jardín con gramíneas, camino de tablones hacia la playa y el porche.                       |
| Casa Olivo | Planta baja    | Salón-cocina en una sola planta, abierto al porche, desde el recibidor.                    |

## Prompts de Google Flow

En inglés, como los del vuelo, y con el mismo **bloque de estilo** al final para que casas y vuelo compartan luz y color:

> Photorealistic architectural photography of a new-build house on the Spanish Mediterranean coast. Soft, warm early-morning light, low sun, gentle haze, long soft shadows. Muted, slightly desaturated palette: deep sea teal, pale aqua, warm sand, whitewashed walls, light oak, natural linen, terracotta accents, olive and pine greens. Calm, airy and serene, never gloomy or dramatic. No people, no text, no logos, no watermarks.

Para interiores, sustituir la primera frase por _"Photorealistic interior architectural photography of a new-build Mediterranean house"_ y añadir _"wide-angle 24 mm lens at eye level, straight verticals"_. Usar la misma variante de luz que el vuelo (mañana o atardecer) en todas las imágenes de una tipología.

Cada imagen se genera en 16:9 y en 9:16 (las tarjetas en 3:4 y 16:10), con el mismo prompt; en vertical, encuadrar más cerca del centro.

### Villa Mar

- **Tarjeta**: _Three-quarter view of a whitewashed cubic two-storey villa with a flat rooftop terrace and a slim pergola, a turquoise 9 by 3.5 metre pool in front, large sliding glass doors facing south, olive trees and umbrella pines, open sky above._
- **Hero**: _Frontal view from the pool edge of a whitewashed cubic villa, the living room wide open through floor-to-ceiling sliding doors, the still pool reflecting the house, the sea faintly visible at the edge of the frame._
- **Exterior**: _High elevated view of the plot of a cubic villa: lawn, a turquoise pool, a covered porch with outdoor sofa, gravel paths and pines along the boundary wall._
- **Planta baja**: _Open-plan living and dining room with a kitchen island in light oak and white marble, sliding glass doors to the garden and pool, linen sofa, seen from the entrance hall._
- **Primera planta**: _Upstairs landing leading to a master suite, white plaster walls, oak floor, soft light from a window framing the sea._
- **Azotea**: _Rooftop terrace with a slim white pergola, linen loungers and potted olive trees, the calm sea on the horizon._

### Casa Pinar

- **Tarjeta**: _Two-storey semi-detached Mediterranean house among umbrella pines, white walls with light oak shutters, a private front garden with a low hedge._
- **Hero**: _Garden facade of a semi-detached house with a shaded porch, an outdoor table set for lunch, dappled pine shade on the lawn._
- **Exterior**: _Private garden of a semi-detached house: lawn, porch, a tall hedge separating it from the neighbouring half, pines behind._
- **Planta baja**: _Living room opening onto a porch, open kitchen in light oak, terracotta floor tiles, seen from the front door._
- **Primera planta**: _Main bedroom with a linen bed and a window onto the pines, white plaster walls, oak floor._

### Casa Olivo

- **Tarjeta**: _Single-storey whitewashed Mediterranean house with a long timber porch and a garden of dune grasses, a boardwalk path leading towards the beach._
- **Hero**: _Long timber porch at golden hour, the house softly lit from inside, dune grasses in the garden in front._
- **Exterior**: _Garden of dune grasses and lavender, a timber boardwalk path towards the beach, the porch at one side._
- **Planta baja**: _Single-storey open living room and kitchen opening onto a timber porch, light oak and linen, seen from the entrance._

## Textos

Los textos (nombre, frase destacada, cifras, precios y estados) no van en las imágenes: viven en `src/features/houses/data.ts`, el único sitio que se edita, y se leen con el catálogo (`src/features/houses/catalog.ts`).
