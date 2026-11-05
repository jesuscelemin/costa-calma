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
Nivel del plano de una tipología. Incluye el exterior y la azotea (Villa Mar: Exterior, Planta baja, Primera planta, Azotea).
_Código_: `Floor`
_Avoid_: Nivel, piso

**Corte**:
Dibujo de una tipología cortada por un plano vertical, con sus niveles, cotas y estancias. Es la maqueta sin WebGL y el localizador del tour (ADR 0010).
_Código_: `section`
_Avoid_: Sección (choca con las secciones de la página), alzado

**Hoja**:
Primer paso de la maqueta: la planta baja vista desde arriba con una lente de 2°, cortada a +1,20 m, que se lee como un plano en tinta sobre papel, con el nombre y los m² de cada estancia en el suelo (ADR 0010).
_Código_: `sheet` (fase de la coreografía de la maqueta)
_Avoid_: Plano (es el de datos), planta (es cada nivel)

**Altura de corte**:
Altura sobre la planta baja a la que la maqueta está cortada por un plano horizontal: +1,20 m en la hoja; sube con el scroll y los muros crecen desde el dibujo, luego las plantas de arriba, hasta que la casa queda entera.
_Código_: `cut`

**Subida** y **descenso**:
Pasos de la hoja a la puerta: en la subida crecen los muros y la cámara se inclina hacia atrás; en el descenso la lente se abre, la cámara baja y aterriza a la altura de los ojos delante de la puerta de entrada.
_Código_: `lift`, `descent`
_Avoid_: Vuelo (es el de la landing y el de una planta), zoom

**Lente**:
Ángulo de visión de la cámara de la maqueta: 2° en la hoja, para que se lea plana, y 50° dentro de la casa. Se abre en el descenso a la vez que la distancia se acorta, sin saltos.
_Código_: `fov`
_Avoid_: Zoom, órbita

**Barrido**:
Paso de la tinta sobre papel a materiales y luz (mediodía en Día, atardecer con las luces encendidas en Noche), estancia a estancia: empieza cuando la cámara cruza su umbral y avanza en el sentido en que entra. Lo que aún no se ha pisado sigue en tinta. Se deshace al volver con el scroll.
_Código_: `reveal` (avance por estancia, que leen todos los materiales)
_Avoid_: Revelado, transición

**Maqueta**:
Casa 3D de una tipología, generada desde su plano, que nace de su hoja y se recorre por dentro en el tour.
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

**Aseo**:
Estancia con inodoro y lavabo, sin ducha. Se cuenta aparte de los baños: «2 baños y 1 aseo».
_Código_: estancia de tipo `toilet`
_Avoid_: Baño de cortesía, medio baño

**Hueco**:
Abertura declarada en un muro de una estancia: puerta, puerta de entrada, paso sin puerta, corredera o ventana (alta en los baños).
_Código_: `Opening`
_Avoid_: Apertura, vano

**Estancia**:
Espacio de una planta (salón, cocina, dormitorio...), con su superficie en m² y su orientación.
_Código_: `Room`
_Avoid_: Habitación (salvo dormitorios), espacio, sala

**Mueble**:
Pieza de mobiliario colocada a mano en una estancia del plano, con su posición, su altura y hacia dónde mira: un modelo glTF de terceros con sus propias texturas, procesado por el script de muebles (ADR 0007, ADR 0011). Donde una estancia no tiene muebles colocados, la maqueta lleva los que el plano dibuja para su tipo.
_Código_: `Furniture` (la colocación), `piece` (el modelo del manifiesto), `PlacedPiece`
_Avoid_: Asset, prop, mobiliario

**Tour**:
Recorrido guiado por dentro de la maqueta de una tipología, controlado por scroll: un solo plano secuencia que baja desde su hoja, entra por la puerta, pasa por sus paradas de todas las plantas y vuelve a salir (ADR 0009, ADR 0010).
_Avoid_: Tour virtual 360, visita virtual (choca con Visita)

**Parada**:
Punto donde se detiene el tour, que muestra exactamente una estancia con su cartela. Una estancia puede tener varias paradas.
_Código_: `Stop`
_Avoid_: Escena, waypoint, punto

**Punto de vista**:
Dónde se pone la cámara en una estancia y hacia dónde mira. Cada estancia tiene uno calculado desde su plano (desde su puerta principal, a la altura de los ojos, hacia su ventana o corredera principal), que el plano o la parada pueden corregir a mano. Al entrar en una estancia del tour se ve desde el punto de vista de su parada.
_Código_: `Viewpoint`
_Avoid_: Cámara (es la de la escena), vista (choca con Visita)

**Entrar en una estancia**:
Desde una planta elegida, la cámara baja a la altura de los ojos dentro de una estancia, desde su punto de vista, con su cartela y «← Volver a la planta», que deja la planta como estaba. Se entra en todas salvo el jardín, que es la parcela alrededor de la casa, y el hueco de una doble altura.
_Código_: `enterAt`, `RoomEntry`, `canEnter`
_Avoid_: Visitar una estancia (choca con Visita), abrir

**Localizador**:
Corte en miniatura que acompaña al tour, con un punto por parada: marca la de la pantalla y lleva a cualquier otra al pulsarlo.
_Código_: `Locator`
_Avoid_: Minimapa, mapa (es el de la urbanización)

**Cartela**:
Rótulo de una estancia con su nombre, sus m², su orientación, la frase de su parada si el tour se detiene en ella y, si lo tiene, un dato propio («6,4 m de altura»). La lleva cada parada y cada estancia de una planta elegida.
_Código_: `Caption`
_Avoid_: Punto de información, hotspot, tooltip

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
