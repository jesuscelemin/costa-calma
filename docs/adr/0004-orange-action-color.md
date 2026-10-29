# El color de acción es el naranja, no el azul

El botón principal ("Pedir visita"), el hover de los enlaces y el foco visible usan el naranja de la marca (`terracota-text`) en lugar del azul (`mar`), por decisión de Jesús del 29-10-2026, a la vez que el logo nuevo de un solo color. El naranja es el acento que ya llevan las palabras en cursiva y el brillo del pie, así que la acción y el énfasis comparten color.

En Día, `terracota` (#C2683F) con texto claro se queda en 3,96:1, por debajo del 4,5:1 exigido, así que el botón usa `terracota-text` (#9C4A25) con `on-terracota` (6,5:1). En Noche, `terracota-text` (#EBA27E) lleva texto oscuro. Detrás de los controles en hover va `terracota-soft`. Los contrastes los comprueba `src/styles/tokens.test.ts`.

`mar` se queda en la paleta para usos de marca futuros (el mapa, ilustraciones), pero ya no indica acción.
