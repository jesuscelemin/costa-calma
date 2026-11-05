# Muebles de IKEA, solo para la demostración, servidos fuera del repositorio

Los muebles de las tres casas son los modelos 3D que IKEA publica en su web para cada producto, descargados con el add-on IKEA Browser de Blender (su misma API, desde el script de muebles). Sustituyen a las piezas de Poly Haven y a los muebles sueltos que el plano dibujaba por tipo de estancia (camas, sofás, comedores, escritorios, tumbonas); lo empotrado (cocinas, sanitarios, armarios, vestidores) sigue en código. Jesús los eligió porque los CC0 no tenían camas, sanitarios ni escritorios contemporáneos y la casa debía leerse como un interior de lujo.

IKEA conserva los derechos de esos modelos y no da licencia para redistribuirlos, lo que se aparta de la ADR 0007. Jesús acepta el riesgo: es una pieza de portfolio que no vende nada. Para acotarlo, ni los originales (`assets-src/ikea/`) ni los procesados (`public/media/furniture/*.glb`) entran en git; en local se sirven desde `public/` y en un despliegue desde el almacenamiento que nombra `NEXT_PUBLIC_FURNITURE_URL`, que se vacía si IKEA pide retirarlos. La interfaz nunca nombra sus productos ni su marca, y `docs/credits.md` dice de dónde viene cada pieza, «© IKEA, demostración sin licencia», sin afiliación.

Las camas de IKEA vienen sin colchón; el script les añade colchón, edredón, almohadas, cojines y una manta en terracota apagada. Solo se simplifican las piezas de ratán, cuerda o lamas, porque al resto la simplificación les rompe las curvas y las texturas: los modelos de IKEA ya vienen preparados para la web.

## Considered Options

- **Seguir solo con piezas CC0 o con licencia** (ADR 0007): sin riesgo, pero sin camas, sanitarios ni escritorios a la altura.
- **IKEA solo como referencia de medidas**, con piezas con licencia en la web: no daba el aspecto que Jesús quería.
