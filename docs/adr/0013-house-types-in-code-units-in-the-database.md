# Tipologías y planos en código; viviendas y visitas en la base de datos

La base de datos (Postgres en Neon, con Drizzle) solo guarda lo que cambia el administrador o envía el visitante: las viviendas (número, tipología, precio y estado), el registro de sus cambios de estado, las visitas y las cuentas del panel. Las tipologías (textos, titulares, cifras) y sus planos siguen en código, igual que el plano de la urbanización con la geometría de cada parcela. Se enlazan por el `slug` de la tipología y por el número de la vivienda; la parcela no tiene tabla porque es 1:1 con su vivienda.

El plano de una tipología es la fuente de su maqueta, su hoja, su corte, sus listas de estancias y sus cifras (ADR 0006, ADR 0008), y lo validan los tests que la maqueta necesita. Llevarlo a la base de datos haría depender del contenido de una tabla la geometría que la maqueta construye, sin que esos tests la vieran, y obligaría a un editor de planos que nadie va a usar. Lo que cambia con el negocio (precios, estados, visitas) es justo lo que no toca la geometría.

Una semilla, que sale de los datos que hasta la Fase 5 vivían en código, crea las viviendas (16 desde el replanteamiento de la ADR 0015), y valida al arrancar que cada vivienda apunta a una tipología que existe.

## Considered Options

- **Todo el catálogo en la base de datos**, con los planos como JSON: un único origen, pero la geometría de la maqueta pasaría a depender de datos que no validan sus tests, y añadir una tipología seguiría exigiendo código (su maqueta, sus muebles, su tour).
- **Todo en código**, sin base de datos: no habría panel, ni disponibilidad real, ni solicitudes de visita.
