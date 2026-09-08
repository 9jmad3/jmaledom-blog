import { defineMiddleware } from 'astro:middleware';

// The public site is now a book of stories. Keep the other collections and
// their stored content intact, while removing them from the reading experience.
export const onRequest = defineMiddleware((context, next) => {
  if (/^\/(recetas|entrenos|estilo)(\/|$)/.test(context.url.pathname)) {
    return context.redirect('/blog/', 302);
  }
  return next();
});
