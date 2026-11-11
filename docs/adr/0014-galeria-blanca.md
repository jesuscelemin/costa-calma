# Galería blanca: la marca pasa a blanco y grafito, con Bodoni Moda

Sustituye a la paleta cálida y a las tipografías de la ADR 0002, y al naranja como color de acción de la ADR 0004.

Las casas de Costa Calma pasan a ser de lujo (Villa Duna Blanca, Casa Pinar y Casa Olivo, en revoco arena, travertino y nogal). Por eso Jesús decidió el 10-11-2026 dejar la paleta cálida (terracota, arena, sol) por una web blanca en Día y grafito en Noche. De tres direcciones (Galería blanca, El plano, Noche mediterránea) eligió la primera, después de ver una maqueta animada con lo que más le gustó de sus referencias: era-residence.com, stillform.homes, elyse-residence, normalisboring.es y emaratrealty.com.

- **Color.** La interfaz va en blanco, piedra fría, tinta y gris, y en Noche en grafito y hueso. El color lo ponen las fotos de las casas. El botón principal es negro en Día y blanco en Noche. Los estados de vivienda conservan su color, siempre con texto.
- **Tipografía.** Bodoni Moda, fina y grande, en los titulares, con la elegancia de las revistas de arquitectura. Hanken Grotesk para la interfaz y el texto. Se quitan las palabras de acento en cursiva de color y los rótulos en mayúsculas: el lujo aquí es la contención.
- **Movimiento.** Las imágenes se abren y se acercan despacio, hasta 1,2 s. Los titulares suben línea a línea. La frase de la portada se tiñe con el scroll, y la página de la casa usa cifras con contador y la hoja que se dibuja. El resto de transiciones sigue en 400–700 ms, y con `prefers-reduced-motion` no se anima nada de esto.

Se descartaron:

- **El plano**, una retícula de arquitecto con cotas y cajetines: es la más original, pero la más fría y la que menos vende.
- **Noche mediterránea**, pensada primero en oscuro: brilla de noche, pero de día queda sobria.

De El plano se conserva la hoja del plano dentro de la página de la casa, que ya existía (ADR 0010).

Bodoni Moda y Hanken Grotesk tienen licencia OFL y se sirven con `next/font/google`, así que este repositorio público puede distribuirlas sin problema.
