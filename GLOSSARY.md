# Costa Calma

Promotora ficticia que vende viviendas de obra nueva en una pequeña urbanización junto a una playa del Mediterráneo.

## Oferta

**Urbanización**:
Conjunto de 12 viviendas junto a la playa que vende la promotora: 4 Villa Mar en primera línea, 4 Casa Pinar (2 pareadas) y 4 Casa Duna.
_Avoid_: Residencial, complejo, promoción

**Tipología**:
Modelo de casa que ofrece la promotora (Villa Mar, Casa Pinar, Casa Duna), con sus plantas, estancias y tour.
_Código_: `HouseType`
_Avoid_: Modelo, tipo de casa, casa (cuando se habla del modelo), typology

**Vivienda**:
Unidad concreta en venta, identificada por su número, de una tipología y sobre una parcela. Tiene precio y estado.
_Código_: `Unit`
_Avoid_: Casa (cuando se habla de la unidad), inmueble, lote, home

**Parcela**:
Terreno de la urbanización sobre el que se levanta exactamente una vivienda. Cada mitad de una pareada tiene la suya.
_Código_: `Plot`
_Avoid_: Solar, lote

**Estado**:
Situación comercial de una vivienda: disponible, reservada o vendida. Lo cambia el administrador en cualquier dirección.
_Código_: `UnitStatus` (`available`, `reserved`, `sold`)
_Avoid_: Disponibilidad (como sustantivo del estado), situación

**Reservada**:
Estado de una vivienda por la que alguien ha pagado la señal. Nunca se usa para citas.
_Avoid_: Bloqueada, apartada

**Precio**:
Importe de venta de una vivienda concreta; dos viviendas de la misma tipología pueden tener precios distintos.

**Precio desde**:
El menor precio entre las viviendas disponibles de una tipología. Si no queda ninguna disponible, la tipología está agotada.
_Avoid_: Precio de la tipología, precio base

**Agotada**:
Tipología sin ninguna vivienda disponible.
_Avoid_: Sin stock, vendida (para la tipología)

## Recorrido

**Vuelo**:
Recorrido de cámara de la portada que va desde el mar hasta la urbanización, controlado por scroll, y termina en la selección de tipologías.
_Código_: `Flight`
_Avoid_: Intro (es la animación de carga), drone, fly-through

**Animación de carga**:
Superposición de la portada con el sol del logo saliendo sobre las olas mientras se precarga el primer tramo. Solo al empezar la sesión en la portada, una vez por sesión.
_Código_: `Intro`
_Avoid_: Loader, splash, pantalla de carga (es el `loading.tsx` de Next)

**Capítulo**:
Tramo del vuelo con su propio texto (el mar, la playa, la urbanización). No muestra estancias: eso es una parada.
_Código_: `Chapter`
_Avoid_: Escena, sección, parada (cuando se habla del vuelo)

**Imagen fija**:
Fotograma de un capítulo que sustituye al vídeo del vuelo cuando no hay movimiento (`prefers-reduced-motion`, ahorro de datos o el vídeo no carga). Las imágenes fijas se suceden con fundidos al ritmo del scroll, con el mismo texto.
_Código_: `still` (`FlightStills`)
_Avoid_: Póster (es el primer fotograma del vídeo), fallback, captura

**Planta**:
Sección recorrible de una tipología, con su propio tour. Incluye el exterior y la azotea (Villa Mar: Exterior, Planta baja, Primera planta, Azotea).
_Código_: `Floor`
_Avoid_: Nivel, piso

**Estancia**:
Espacio de una planta (salón, cocina, dormitorio...), con su superficie en m² y su orientación.
_Código_: `Room`
_Avoid_: Habitación (salvo dormitorios), espacio, sala

**Tour**:
Recorrido guiado de una planta, en vídeo controlado por scroll, que pasa por sus paradas.
_Avoid_: Tour virtual 360, visita virtual (choca con Visita)

**Parada**:
Punto donde se detiene el tour, que muestra exactamente una estancia y sus puntos de información. Una estancia puede tener varias paradas.
_Código_: `Stop`
_Avoid_: Escena, waypoint, punto

**Casa**:
Palabra de la interfaz para hablarle al visitante de una tipología («tu casa», la URL `/casas`). No es un término del dominio: en documentación y código se dice tipología o vivienda.

**Tour próximamente**:
Etiqueta de una tipología cuyo tour aún no está disponible. No es un estado de vivienda.

## Contacto

**Visita**:
Cita para ver la urbanización o una vivienda, que el visitante pide con una solicitud de visita. Puede ir vinculada a una vivienda, a una tipología o a ninguna.
_Código_: `Visit`
_Avoid_: Reserva de visita, reserva, cita, booking

**Solicitud de visita**:
Petición que envía el visitante para concertar una visita.
_Código_: `VisitRequest`

**Estado de la visita**:
Solicitada → confirmada → realizada, o cancelada desde solicitada o confirmada. Lo cambia el administrador.
