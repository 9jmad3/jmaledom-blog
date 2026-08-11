import { getCollection } from 'astro:content';
import { getStoredContent } from './content-store';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const recipePrefix = 'receta--';

export function recipeInteractionKey(slug: string) {
	return `${recipePrefix}${slug}`;
}

export async function interactionTargetExists(key: string) {
	if (key.startsWith(recipePrefix)) {
		const slug = key.slice(recipePrefix.length);
		if (!slugPattern.test(slug)) return false;
		if (await getStoredContent('recetas', slug)) return true;
		return (await getCollection('recetas')).some((recipe) => recipe.id === slug);
	}

	if (!slugPattern.test(key)) return false;
	return (await getCollection('blog')).some((post) => post.id === key);
}
