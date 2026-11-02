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

**Selección de tipologías**:
Tramo de la portada, justo después del vuelo, donde el visitante elige una tipología para ver su casa.
_Código_: `HouseTypePicker`
_Avoid_: Galería, catálogo, listado

**Tarjeta de tipología**:
Pieza de la selección de tipologías que presenta una tipología (imagen, nombre, cifras clave, precio desde) y lleva a su página.
_Código_: `HouseTypeCard`
_Avoid_: Panel, ficha

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

**Maqueta**:
Modelo 3D estilizado de una tipología, con sus plantas separables, que muestra su distribución vista desde arriba. Su base es la parcela.
_Código_: `HouseModel`
_Avoid_: Dollhouse, modelo 3D, plano 3D, mapa (es el de la urbanización)

**Plano**:
Distribución de una tipología en datos: sus plantas, cada estancia como un rectángulo en metros, cada hueco declarado a mano y sus aleros y pérgolas. De él salen la maqueta, el plano 2D, las listas de estancias y las cifras (ADR 0006, ADR 0008).
_Código_: `HousePlan` (`plan.ts` lo valida y lo convierte en geometría)
_Avoid_: Planta (es cada nivel del plano), layout, distribución (como nombre en código)

**Vuelo**:
Parte de una planta que sobresale de la de abajo (la primera planta de Villa Mar sobre el porche, la de Casa Pinar sobre la entrada). Cada planta toma la forma de sus estancias y solo tiene que apoyarse en parte sobre la de abajo; la azotea, entera (ADR 0008). En el plano 2D se dibuja en discontinuo.
_Avoid_: Voladizo (como nombre en código), cantilever

**Doble altura**:
Hueco en el forjado de una planta sobre una estancia de la de abajo (salón, comedor o recibidor). Se declara como una estancia sin suelo: no suma m², no lleva puertas y tiene barandilla hacia pasillos, recibidores y estudios.
_Código_: estancia de tipo `void`
_Avoid_: Vacío, altillo

**Patio**:
Espacio exterior de la parcela que la casa abraza en parte (el patio del olivo de Casa Duna, el patio de entrada de Casa Pinar).
_Código_: estancia de tipo `patio`
_Avoid_: Jardín (es el resto de la parcela)

**Alero** y **pérgola**:
Sombras en lo alto de una planta: el forjado que sigue más allá de los muros, o una pérgola de lamas. Se dibujan en discontinuo.
_Código_: `Canopy` (`eave`, `pergola`)
_Avoid_: Toldo, voladizo

**Medianera**:
Muro que una mitad de una pareada (Casa Pinar) comparte con la vivienda vecina, sobre el borde de su parcela. Es ciego: ningún hueco en ninguna planta.
_Código_: `partyWall`
_Avoid_: Pared compartida, muro vecino

**Hueco**:
Abertura declarada en un muro de una estancia: puerta, puerta de entrada, paso sin puerta, corredera o ventana (alta en los baños).
_Código_: `Opening`
_Avoid_: Apertura, vano

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
