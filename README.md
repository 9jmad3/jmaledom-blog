# jmaledom

Blog personal de José, construido con [Astro](https://astro.build/). Un espacio para escribir sobre reflexiones personales, baile, gimnasio y cualquier cosa que merezca quedarse por escrito.

## Características

- Contenido gestionado con colecciones de Astro y Markdown.
- Temas claro y oscuro y diseño responsive.
- Tiempo estimado de lectura y navegación entre artículos.
- Botón para compartir mediante la API nativa del navegador.
- Imágenes sociales personalizadas con Open Graph y Twitter Cards.
- RSS y sitemap.

## Desarrollo local

Necesitas Node.js 22.12 o superior.

```bash
npm install
npm run dev
```

El proyecto estará disponible en `http://localhost:4321`.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Genera la web estática en `dist/` |
| `npm run preview` | Previsualiza la compilación localmente |

## Despliegue en Railway

Railway detecta y compila automáticamente este proyecto como un sitio estático de Astro.

1. Crea un proyecto en Railway.
2. Selecciona **Deploy from GitHub repo** y elige este repositorio.
3. En **Settings → Networking**, pulsa **Generate Domain**.
4. Añade la variable `SITE_URL` con la URL pública completa.
5. Vuelve a desplegar para generar los enlaces canónicos, el sitemap y las imágenes sociales con el dominio correcto.

No es necesario configurar manualmente los comandos de build o start.

## Añadir un artículo

Crea un Markdown en `src/content/blog/` con un encabezado como este:

```yaml
---
title: 'Título del artículo'
description: 'Descripción breve para el listado y las redes sociales.'
pubDate: '2026-07-16'
heroImage: '../../assets/imagen-del-articulo.jpg'
socialImage: '../../assets/imagen-social-del-articulo.png'
---
```

## Autor

José · [@jmaledom](https://www.instagram.com/jmaledom/)
