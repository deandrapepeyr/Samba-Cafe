export interface CategoryGroupConfig {
  id: string;
  name: string;
  categoryNames: string[];
  fallbackIds?: string[];
}

export const CATEGORY_GROUPS: CategoryGroupConfig[] = [
  {
    id: 'makanan',
    name: 'Makanan',
    categoryNames: ['food', 'snack', 'pop mie', 'ciki snack', 'roti'],
    fallbackIds: ['cat_food', 'cat_snack', 'yea8kgefo', '897p3xwtf', '5v2cqlisz'],
  },
  {
    id: 'minuman',
    name: 'Minuman',
    categoryNames: ['coffee', 'es teh & other', 'minuman'],
    fallbackIds: ['dj8dix8v4', '8fe2l22ge', 'cat_minuman'],
  },
];

/**
 * Memetakan kategori produk ke salah satu grup: 'makanan' | 'minuman' | 'lainnya'
 * Menggunakan pencocokan nama kategori (case-insensitive & trim) dengan fallback ID.
 */
export function matchCategoryToGroup(
  category: { id?: string; name?: string } | undefined,
  groups: CategoryGroupConfig[] = CATEGORY_GROUPS
): string {
  if (!category) return 'lainnya';

  const nameTrimmed = (category.name || '').trim().toLowerCase();
  const idLower = (category.id || '').toLowerCase();

  for (const group of groups) {
    // 1. Cocokkan nama kategori (case-insensitive, trim)
    const matchesName = group.categoryNames.some(
      target => nameTrimmed === target.trim().toLowerCase()
    );
    if (matchesName) return group.id;

    // 2. Fallback pencocokan berdasarkan category id
    if (group.fallbackIds && group.fallbackIds.some(fid => idLower === fid.toLowerCase())) {
      return group.id;
    }
  }

  return 'lainnya';
}
