# Maqueta generada desde los datos del plano, con muebles como assets

La maqueta 3D de cada tipología se genera en tiempo real con React Three Fiber a partir de los datos del plano: cada estancia es un rectángulo en metros y cada puerta, ventana y corredera se declara a mano con su muro, posición y ancho. De esos mismos datos salen los muros con sus huecos, las cifras de m² de la interfaz, el plano 2D en SVG (la alternativa accesible) y, en la Fase 4, las paradas del tour, así que nunca se desincronizan. Los muebles son modelos glTF (CC0 de Poly Haven y, donde no haya, Poliigon o BlendKit) colocados uno a uno en los datos, con posición y giro.

## Considered Options

- **Clips de vídeo prerrenderizados** (como la referencia de Nomad): más fotorrealistas, pero elegir una planta exigiría un clip por combinación y Google Flow no mantiene la misma casa coherente entre clips.
- **Casas completas modeladas en Blender**: más detalle en la arquitectura, pero tres modelos que mantener a mano, con los m² y las puertas duplicados fuera de los datos.
- **Huecos colocados por reglas** (una puerta en el centro de cada tabique, fachadas enteras de cristal): lo probó el prototipo y daba planos incoherentes.
