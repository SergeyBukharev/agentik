export const kitPaths = ['ui-kit', 'brand-kit', 'press-kit'] as const;
export type KitPage = typeof kitPaths[number];

export const kitPages: Record<KitPage, readonly [string, string]> = {
  'ui-kit': ['UI-кит', 'UI kit'],
  'brand-kit': ['Бренд-кит', 'Brand kit'],
  'press-kit': ['Пресс-кит', 'Press kit'],
};
