# Muebles realistas con sus propias texturas; la arquitectura sigue en código

La arquitectura de la maqueta (muros, suelos, carpinterías, agua, terreno) sigue con materiales hechos en código, sin texturas fotográficas, porque nace del plano y se dibuja en tinta. Los muebles, en cambio, conservan sus texturas PBR (color, normal y rugosidad/metal): pintados con los colores lisos de la paleta parecían de juguete, y Jesús quiere que se lean como mobiliario contemporáneo real. Siguen el barrido: son papel hasta que su estancia se cruza y entonces aparecen con su textura. El script de muebles reduce las texturas a WebP de 1024 px en escritorio y 512 px en móvil, con un `.glb` para cada uno, y la carga es por planta para no pesar en la primera pintura. Para que no desentonen, se eligen piezas en los tonos de la marca (lino, roble, piedra, blanco cal) y el script puede corregir el color de un material con un factor.

## Considered Options

- **Solo geometría, pintada con los materiales de la casa** (lo que hacía el script al principio): ligero y coherente con el dibujo, pero sin tela, veta ni piedra; nunca parece real.
- **KTX2 (Basis) en lugar de WebP**: menos memoria de GPU, pero exige el transcodificador y `toktx` en el pipeline; se puede añadir si la memoria en móvil lo pide.
