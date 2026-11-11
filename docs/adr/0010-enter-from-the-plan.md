# El tour entra desde el plano visto desde arriba y por la puerta, no por el corte

> Sustituida por ADR 0015 (11-11-2026): el tour son tramos y paradas renderizados en Blender.

Sustituye la entrada del ADR 0009 (el corte de frente, la lente y la cámara que entra por el plano de corte). La maqueta sigue siendo lo que se recorre, pero ahora arranca como la **hoja**: la planta baja vista desde arriba con una lente de 2°, cortada a +1,20 m, que se lee como un plano en tinta. Con el scroll, la **altura de corte** sube y los muros crecen desde la hoja. La cámara se inclina hacia atrás y **desciende**: la lente se abre y la distancia se acorta a la vez, en escala logarítmica, así que el encuadre nunca salta. Suben las plantas de arriba y la cámara aterriza a la altura de los ojos delante de la puerta de entrada. Entra andando por el eje, la puerta se abre, y el **barrido** colorea cada estancia cuando la cámara cruza su umbral. Lo que aún no se ha pisado sigue en tinta.

Jesús descartó la coreografía de #38 porque «marea mucho, entra por las paredes y no sigue una lógica». La referencia es Casa Larga (https://sam1983aing.github.io/casa-larga/).

Reglas de movimiento del tour:

- Una sola cámara de perspectiva, sin cortes.
- Dentro de la casa la lente es fija, de 50° (más alta en un móvil en vertical).
- La cámara solo gira estando parada; anda en línea recta, siempre por los huecos.
- El paso es constante, por metro andado, y el giro por ángulo girado.

## Considered Options

- **Mantener el corte y corregir las rutas**: elimina las paredes atravesadas, pero el corte visto de frente y el giro de la lente siguen mareando y no cuentan cómo se llega a una casa.
- **Barrido de toda la casa de golpe**: más sencillo, pero se pierde la lógica de «se colorea lo que pisas».

## Consequences

- El corte en SVG se queda como alternativa sin WebGL. (El localizador del tour era el corte en miniatura; ahora es la planta en miniatura de la parada, porque el corte no pasa por todas las estancias del tour.)
- La entrada al tour ya no necesita hoja CSS 3D: la hoja es la propia maqueta.
- Los materiales leen el avance del barrido por estancia, no una sola franja.
- La longitud del tramo sale de los metros andados.
