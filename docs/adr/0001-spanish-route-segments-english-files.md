# Carpetas de ruta en español, resto de archivos en inglés

Todo el código y los nombres de archivo van en inglés, salvo las carpetas de ruta del App Router (`app/(site)/casas/[slug]`, `app/(admin)/admin/visitas`) y los slugs, que van en español porque se convierten en la URL que ve y comparte el visitante. Se descartaron las URLs en inglés (`/houses/villa-mar`) porque chocan con una interfaz íntegramente en español, y las carpetas en inglés con *rewrites* porque duplican la fuente de verdad de las rutas y se rompen con facilidad.
