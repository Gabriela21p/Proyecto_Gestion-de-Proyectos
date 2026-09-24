import { MeiliSearch } from 'meilisearch';
import { config } from '../config.js';

// Meilisearch acelera el descubrimiento, pero PostgreSQL sigue siendo la fuente de
// verdad. Por eso el índice siempre puede reconstruirse a partir de los sitios.
export const meili = new MeiliSearch({
  host: config.meiliHost,
  apiKey: config.meiliMasterKey
});

export const sitesIndex = meili.index('sites');

export async function initSearch() {
  await sitesIndex.updateSearchableAttributes(['name', 'category', 'description', 'address', 'locality', 'activities']);
  await sitesIndex.updateFilterableAttributes(['category', 'locality', 'city', 'activities', 'hasEvents']);
  await sitesIndex.updateSortableAttributes(['rating_average', 'trust_score', 'review_count', 'active_event_count']);
}

export async function indexSites(documents) {
  if (!documents.length) return;
  await sitesIndex.addDocuments(documents);
}

export async function searchSites(term, filters = {}) {
  const filter = [];
  if (filters.locality) filter.push(`locality = "${filters.locality}"`);
  if (filters.category) filter.push(`category = "${filters.category}"`);
  if (filters.hasEvents) filter.push('hasEvents = true');

  return sitesIndex.search(term || '', {
    filter,
    limit: filters.limit || 40,
    sort: ['trust_score:desc', 'rating_average:desc']
  });
}
