# Darker Grotesque para los titulares, Manrope para la interfaz y Fraunces solo en cursiva

Los titulares y los textos grandes pasan de Fraunces a Darker Grotesque, una grotesca fina, siguiendo las referencias de Jesús (macnaagroup.com). Manrope sigue en la interfaz porque Darker Grotesque, con su altura de x muy baja, se lee peor a 14–16 px. Fraunces queda para el logo y para las palabras de acento en cursiva. Se descartó Cabinet Grotesk, la fuente de la referencia, porque su licencia (ITF Free Font License) prohíbe distribuir los archivos desde repositorios o servidores públicos, y este repo es público. Cargarla desde el CDN de Fontshare la sacaría de `next/font` y añadiría una dependencia externa. Hanken Grotesk y Bricolage Grotesque (OFL) se probaron como alternativas y se prefirió el carácter más editorial de Darker Grotesque, a cambio de tamaños de display mayores.

## Al implementarla (#11)

- El logo no carga Fraunces: su nombre va trazado en SVG. Por eso Fraunces se carga solo en cursiva, para las palabras de acento.
- El acento va en `terracota-text` y no en `terracota`, porque es texto y debe llegar a 4,5:1 a cualquier tamaño. Sobre imagen usa `on-media-accent` (el `terracota-text` de Noche, igual en los dos temas), ya que el de Día no se lee sobre el scrim oscuro.
