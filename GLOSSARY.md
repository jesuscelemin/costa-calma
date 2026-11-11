# Costa Calma

Promotora ficticia que vende viviendas de obra nueva en una pequeña urbanización junto a una playa del Mediterráneo.

## Oferta

**Urbanización**:
Conjunto de 16 viviendas en una ladera junto a la playa que vende la promotora, en tres filas escalonadas, cada una con su vial: 4 Villa Duna Blanca en primera línea, 6 Casa Olivo en medio y 6 Casa Pinar (3 pareadas) arriba. Las tres calles llegan por el este a una calle colectora que sube desde la costa; la intermedia y la superior se unen por el oeste. Alrededor, otras urbanizaciones.
_Avoid_: Residencial, complejo, promoción

**Tipología**:
Modelo de casa que ofrece la promotora (Villa Duna Blanca, Casa Pinar, Casa Olivo), con sus plantas, estancias y tour.
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

**Vista aérea**:
Render de Blender de la urbanización en su ladera, último fotograma del vuelo, sobre el que se elige zona y vivienda. Cada zona y cada vivienda tiene su máscara, sacada de la misma cámara, que se ilumina al pasar el ratón o tocarla. Tiene una lista equivalente de viviendas, navegable con teclado (ADR 0015).
_Código_: `AerialView`
_Avoid_: Mapa de la urbanización, mapa 3D (sustituidos), masterplan

**Zona**:
Parte de la urbanización con las viviendas de una tipología: la primera línea (Villa Duna Blanca, 1–4), Casa Olivo (11–16, fila del medio) y Casa Pinar (5–10, fila de arriba), cada una en su fila. Al pulsarla en la vista aérea, la cámara se acerca y se ven sus viviendas.
_Código_: `Zone`
_Avoid_: Fase, bloque, sector

**Plano de la urbanización**:
Disposición en datos de las parcelas de la urbanización, la playa y el vial, de la que Blender construye la urbanización de la vista aérea.
_Código_: `SitePlan`
_Avoid_: Plano (es el de cada tipología), masterplan

**Ficha de la vivienda**:
Lo que se abre al pasar por una vivienda en la vista aérea: número, tipología, m², dormitorios, estado y precio, y lo que se puede hacer con ella (ver la casa, pedir visita si está disponible).
_Código_: `UnitSheet`
_Avoid_: Tarjeta (es la de la tipología), popup, tooltip

## Recorrido

**Vuelo**:
Apertura de la portada: la cámara va desde el mar hasta la urbanización, controlada por scroll. Está hecho con Google Flow y su último fotograma es la vista aérea.
_Código_: `Flight`
_Avoid_: Intro (es la animación de carga), drone, fly-through

**Elegir zona** y **elegir casa**:
Tramo de la portada, justo después del vuelo, donde el visitante elige una zona en la vista aérea y, dentro de ella, la vivienda cuya casa quiere ver. Sustituye a la selección de tipologías con tarjetas.
_Código_: `ZonePicker`, `UnitPicker`
_Avoid_: Galería, catálogo, listado, selección de tipologías

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
Nivel del plano de una tipología. Incluye el exterior y la azotea (Villa Duna Blanca: Exterior, Planta baja, Primera planta, Azotea).
_Código_: `Floor`
_Avoid_: Nivel, piso

**Planta sin techo**:
Una planta de la casa en 3D en tiempo real, exportada de la escena de Blender a glTF con la luz horneada, que se ve al elegir planta junto a su plano 2D. Se gira de forma limitada; sus estancias se iluminan y llevan a su parada.
_Código_: `FloorModel`
_Avoid_: Dollhouse, maqueta (la del tour retirado), casa sin tejado (es la referencia de Llindar)

**Plano**:
Distribución de una tipología en datos: sus plantas, cada estancia como un rectángulo en metros, cada hueco declarado a mano y sus aleros y pérgolas. De él salen la casa de Blender (y con ella las paradas, los tramos y la planta sin techo), el plano 2D, las listas de estancias y las cifras (ADR 0006, ADR 0008, ADR 0015).
_Código_: `HousePlan` (`plan.ts` lo valida y lo convierte en geometría)
_Avoid_: Planta (es cada nivel del plano), layout, distribución (como nombre en código)

**Vuelo**:
Parte de una planta que sobresale de la de abajo (las terrazas de la primera planta de Villa Duna Blanca sobre la tarima, la de Casa Pinar sobre la entrada). Cada planta toma la forma de sus estancias y solo tiene que apoyarse en parte sobre la de abajo; la azotea, entera (ADR 0008). En el plano 2D se dibuja en discontinuo.
_Avoid_: Voladizo (como nombre en código), cantilever

**Doble altura**:
Hueco en el forjado de una planta sobre una estancia de la de abajo (salón, comedor o recibidor). Se declara como una estancia sin suelo: no suma m², no lleva puertas y tiene barandilla hacia pasillos, recibidores y estudios.
_Código_: estancia de tipo `void`
_Avoid_: Vacío, altillo

**Patio**:
Espacio exterior de la parcela que la casa abraza en parte (el patio del olivo de Casa Olivo, el patio de entrada de Casa Pinar).
_Código_: estancia de tipo `patio`; su árbol (el olivo, el pino del patio de entrada), `tree`
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
Pieza de mobiliario de una estancia en la escena de Blender: un asset gratuito (Poly Haven, ambientCG, CC0) o, donde ya estaba, un modelo de IKEA solo para la demostración (ADR 0007, ADR 0012).
_Código_: `Furniture` (la colocación), `piece`, `PlacedPiece`
_Avoid_: Asset, prop, mobiliario

**Tour**:
Recorrido por dentro de la casa de una tipología: paradas panorámicas unidas por tramos, renderizados en Blender desde su plano (ADR 0015). Se avanza con el scroll por el recorrido guiado o con los puntos de paso.
_Avoid_: Tour virtual 360, visita virtual (choca con Visita), película

**Parada**:
Panorámica de unos 180° de una estancia, renderizada en Cycles, que se arrastra a izquierda y derecha con un zoom ligero. Lleva su cartela y sus puntos de paso. Una estancia puede tener varias paradas.
_Código_: `Stop`
_Avoid_: Escena, waypoint, 360

**Tramo**:
Vídeo corto de una parada a una contigua, renderizado en Cycles, con las puertas, las cortinas y la luz animadas. Su primer y su último fotograma son los de las paradas que une. Con el scroll se recorre; desde un punto de paso se reproduce solo.
_Código_: `Segment`
_Avoid_: Clip, transición, plano secuencia

**Recorrido guiado**:
Ruta de paradas y tramos de una casa que se sigue con el scroll, de la entrada a la azotea.
_Código_: `GuidedRoute`
_Avoid_: Plano secuencia, película

**Punto de paso**:
Punto sobre la panorámica de una parada que lleva a otra parada: la estancia contigua, otra planta o una estancia que no está en el recorrido guiado. Reproduce su tramo o, si no lo tiene, pasa con un fundido.
_Código_: `PassPoint`
_Avoid_: Hotspot, cartela (es el rótulo), punto de información

**Localizador**:
Plano de la planta en la que está el visitante, abajo a la derecha del tour, con la estancia iluminada y un punto donde está. Sus estancias se pueden pulsar para ir a su parada. En conversación, «minimapa». En móvil va plegado en un botón «Plano».
_Código_: `Locator`
_Avoid_: Mapa (es la vista aérea)

**Cartela**:
Rótulo de una estancia con su nombre, sus m², su orientación, la frase de su parada y, si lo tiene, un dato propio («6,4 m de altura»). La lleva cada parada y cada estancia de la planta sin techo.
_Código_: `Caption`
_Avoid_: Punto de información, hotspot, tooltip

**Casa**:
Palabra de la interfaz para hablarle al visitante de una tipología («tu casa», la URL `/casas`). No es un término del dominio: en documentación y código se dice tipología o vivienda.

**Tour próximamente**:
Etiqueta de una tipología cuyo tour aún no está renderizado (Casa Pinar y Casa Olivo al principio). No es un estado de vivienda.

## Contacto

**Visita**:
Cita para ver la urbanización o una vivienda, que el visitante pide con una solicitud de visita. Puede ir vinculada a una vivienda, a una tipología o a ninguna.
_Código_: `Visit`
_Avoid_: Reserva de visita, reserva, cita, booking

**Solicitud de visita**:
Petición que envía el visitante para concertar una visita.
_Código_: `VisitRequest`

**Estado de la visita**:
Solicitada → confirmada → realizada, o cancelada desde solicitada o confirmada. Lo cambia el administrador. Al confirmarla fija la fecha y la hora acordadas; la visita guarda aparte el día y la franja (mañana o tarde) que pidió el visitante.

**Visita de demostración**:
Visita inventada que crea la semilla para la cuenta demo. Es lo único que la cuenta demo ve y gestiona; las visitas reales solo las ve el administrador.
_Avoid_: Visita falsa, visita de prueba

## Administración

**Panel**:
Zona privada donde el administrador cambia el precio y el estado de las viviendas y gestiona las visitas.
_Código_: ruta `/admin`
_Avoid_: Backoffice, dashboard (es solo su resumen), CMS

**Administrador**:
Persona de la promotora que entra en el panel con su cuenta.
_Código_: rol `admin`
_Avoid_: Usuario (choca con el visitante), gestor

**Cuenta demo**:
Cuenta pública del panel, con sus credenciales en el README, para que quien revise el portfolio pruebe el panel por dentro. Puede escribir; lo que cambia se deshace al restaurar la demo.
_Código_: rol `demo`
_Avoid_: Invitado, cuenta de prueba

**Restaurar la demo**:
Volver las viviendas y las visitas de demostración a como las deja la semilla.
_Avoid_: Reset, reiniciar la base de datos

## Retirados (ADR 0015)

Términos del tour en tiempo real (ADR 0009, ADR 0010). Se conservan mientras su código exista; se borran con él.

**Corte**:
Dibujo de una tipología cortada por un plano vertical, con sus niveles, cotas y estancias. Es la maqueta sin WebGL (ADR 0010).
_Código_: `section`
_Avoid_: Sección (choca con las secciones de la página), alzado

**Hoja**:
Primer paso de la maqueta: la planta baja vista desde arriba con una lente de 2°, cortada a +1,20 m, que se lee como un plano en tinta sobre papel, con el nombre y los m² de cada estancia en el suelo (ADR 0010). Mientras la maqueta carga, la misma hoja se ve en SVG, encuadrada donde la dibujará la escena, y se funde con ella cuando ha dibujado.
_Código_: `sheet` (fase de la coreografía de la maqueta); en SVG, `SheetPoster`, servido en `/casas/[slug]/hoja/[version]`
_Avoid_: Plano (es el de datos), planta (es cada nivel)

**Titular de la hoja**:
Titular de la hoja, con su palabra de acento («De la puerta al _mar_»), y su frase: lo que recorre el paseo desde la puerta. Es un dato de cada tipología.
_Código_: `sheetHeading`
_Avoid_: Título de la maqueta

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

**Punto de vista**:
Dónde se pone la cámara en una estancia y hacia dónde mira. Cada estancia tiene uno calculado desde su plano (desde su puerta principal, a la altura de los ojos, hacia su ventana o corredera principal), que el plano o la parada pueden corregir a mano. Al entrar en una estancia del tour se ve desde el punto de vista de su parada.
_Código_: `Viewpoint`
_Avoid_: Cámara (es la de la escena), vista (choca con Visita)

**Entrar en una estancia**:
Desde una planta elegida, la cámara baja a la altura de los ojos dentro de una estancia, desde su punto de vista, con su cartela y «← Volver a la planta», que deja la planta como estaba. Se entra en todas salvo el jardín, que es la parcela alrededor de la casa, y el hueco de una doble altura.
_Código_: `enterAt`, `RoomEntry`, `canEnter`
_Avoid_: Visitar una estancia (choca con Visita), abrir
