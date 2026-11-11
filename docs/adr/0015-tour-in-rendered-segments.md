# El tour son tramos cortos renderizados en Blender, con paradas panorámicas y la planta sin techo en 3D

Sustituye a ADR 0009 y ADR 0010, y en parte a ADR 0006, ADR 0011 y ADR 0012 (la maqueta en tiempo real deja de ser el tour). Lo decidió Jesús el 11-11-2026, al parar el proyecto para replantearlo, después de ver dos referencias grabadas: Clos des Vignes (vuelo, elegir la villa iluminada sobre la foto y recorrerla en vídeo) y Llindar (paradas con «arrastra para mirar», minimapa, puntos para ir a otra estancia y «la casa sin tejado» con su plano al lado).

El objetivo de Costa Calma es que quien la vea se quede asombrado: gusto, fotorrealismo, animación, 3D y backend al mismo nivel. El listón de todo lo que ve el visitante es el de Cycles y las referencias (luz, materiales, detalles). La maqueta en tiempo real del primer tour se quedaba pobre a su lado.

## El recorrido

1. **Apertura.** Animación hecha con Google Flow, controlada por scroll con el motor de scrub (ADR 0003): desde el mar hasta la urbanización. Su último fotograma es la vista aérea, así que el paso del vídeo a la interfaz no tiene corte.
2. **Elegir zona.** La vista aérea es un render de Blender de la urbanización en su ladera. Las casas van en tres filas escalonadas, cada una con su vial, y hay una zona por tipología, cada una en su fila: la primera línea (Villa Duna Blanca, viviendas 1–4), Casa Olivo en medio (11–16) y Casa Pinar arriba (5–10). Al pasar el ratón o tocar, la zona se ilumina; al pulsarla, la cámara se acerca.
3. **Elegir casa.** Dentro de la zona, cada vivienda se ilumina con su ficha (tipología, m², dormitorios, precio y estado, siempre con texto). Las máscaras salen de la misma cámara de Blender, así que encajan al píxel. El estado viene de la base de datos (ADR 0013). Una lista de viviendas navegable con teclado y lector de pantalla es la alternativa accesible.
4. **Tour.** Una serie de **paradas** unidas por **tramos**:
   - **Parada:** una panorámica de unos 180° renderizada en Cycles, que se arrastra a izquierda y derecha, con un zoom ligero. Enseña la estancia entera: nunca se queda mirando una pared vacía. Lleva su cartela.
   - **Tramo:** un vídeo corto (unos segundos) de una parada a la contigua, renderizado en Cycles, con vida: las puertas se abren al pasar, las cortinas se mueven, entra la luz. Su primer y su último fotograma son los de las paradas que une.
   - **Recorrido guiado:** con el scroll se avanza tramo a tramo por la ruta de la casa. Nunca hay un plano secuencia largo, que marea.
   - **Puntos de paso:** sobre la panorámica, puntos para ir a la estancia contigua, subir o bajar de planta o entrar en una estancia que no está en el recorrido guiado. Al pulsarlos se reproduce su tramo; si no lo tiene, se pasa con un fundido.
   - **Localizador (minimapa):** abajo a la derecha, el plano de la planta en la que se está, con la estancia iluminada y un punto donde está el visitante. Sus estancias se pueden pulsar.
5. **Elegir planta.** Selector de las plantas de la casa. La planta elegida se ve como «la casa sin tejado» de Llindar: a la izquierda, la planta sin techo en 3D en tiempo real (React Three Fiber), exportada de la misma escena de Blender a glTF con la luz de Cycles horneada en las texturas; a la derecha, su plano 2D sincronizado. Se gira de forma suave y limitada, las estancias se iluminan con su nombre y sus m², y al pulsar una se entra en su parada. Al cambiar de planta, las de encima se apartan.

Villa Duna Blanca sale con su tour completo. Casa Pinar y Casa Olivo muestran su ficha, renders fijos y «Tour próximamente» hasta que tengan los suyos, con el mismo pipeline. El interruptor Día/Noche de las paradas (atardecer con las luces encendidas) queda para la fase de pulido, porque dobla los renders.

## Una sola fuente: el plano

El plano de cada tipología sigue en código (ADR 0006, ADR 0008, ADR 0013) y es la fuente de todo: un script lo exporta a JSON y Blender construye la casa desde él, con sus muros, huecos y estancias. De esa escena salen la vista aérea y sus máscaras, las panorámicas, los tramos, los glTF de cada planta y las imágenes fijas. Así el tour coincide con el plano al centímetro y los m² de la interfaz no se desincronizan.

**Google Flow** entra en dos sitios: la apertura y, si un tramo de Blender queda sin vida, un retoque partiendo de sus fotogramas inicial y final, que se conservan para que la casa no cambie.

## Considered Options

- **Un solo plano secuencia de la puerta al final** (primer borrador de esta ADR): fiel a la referencia de Horyx, pero marea, y obliga a ver toda la casa para llegar a una estancia.
- **Tramos solo de Flow, sin Blender** (como Clos des Vignes): muy fotográficos, pero la casa cambia de un tramo a otro, no coincide con el plano y se ven borrones en las transiciones.
- **Seguir con la maqueta en tiempo real como tour** (ADR 0009/0010): coherente y ligera, pero no llega al fotorrealismo; Jesús la descartó tras verla.
- **Panorámicas de 360° completas**: más inmersivas, pero es fácil perderse y piden más resolución. Con unos 180° se ve la estancia entera sin dar la espalda a nada.
- **Mapa 3D de la urbanización en tiempo real** (Fase 5 anterior): con volúmenes sencillos no está al nivel de la vista aérea renderizada.

## Consequences

- El pipeline tiene que ser reproducible y vivir en el repositorio: plano → JSON → Blender (scripts en `scripts/`) → renders → `ffmpeg` (vídeo para scrub, imágenes fijas, versiones móviles) → manifiesto por tour, como el del vuelo.
- Los renders, vídeos y glTF pesan demasiado para git: se sirven desde Vercel Blob, y en el repositorio solo quedan los manifiestos. Los originales de terceros siguen fuera (ADR 0007).
- Las horas de render son el coste principal. Antes de hacer toda la casa, se valida una prueba con dos paradas y un tramo (recibidor → salón, con la puerta abriéndose).
- `prefers-reduced-motion`: los tramos pasan a fundidos entre paradas y la panorámica se mueve sin inercia. El vuelo pasa a imágenes fijas con fundidos, como ya hace.
- La maqueta en tiempo real y su coreografía (hoja, subida, descenso, barrido) dejan de usarse en la página de la casa y se retiran cuando el tour nuevo esté listo. El código del plano y sus tests se quedan.
- Los muebles de la escena de Blender salen de assets gratuitos (Poly Haven, ambientCG, CC0). Los modelos de IKEA (ADR 0012) solo siguen donde ya estaban, para la demostración.
- La Fase 5 cambia: el mapa 3D (#58) se sustituye por la vista aérea con zonas y viviendas iluminadas.
