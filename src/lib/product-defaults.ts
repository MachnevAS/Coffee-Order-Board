import type { Product } from '@/types/product';

export const getDefaultProducts = (): Product[] => [
  // Coffee
  { id: 'prod_cap_200', name: 'Капучино', volume: '0,2 л', price: 150, dataAiHint: 'cappuccino coffee small' },
  { id: 'prod_cap_300', name: 'Капучино', volume: '0,3 л', price: 185, dataAiHint: 'cappuccino coffee medium' },
  { id: 'prod_cap_400', name: 'Капучино', volume: '0,4 л', price: 195, dataAiHint: 'cappuccino coffee large' },
  { id: 'prod_cap_500', name: 'Капучино', volume: '0,5 л', price: 250, dataAiHint: 'cappuccino coffee extra large' },
  { id: 'prod_lat_200', name: 'Латте', volume: '0,2 л', price: 140, dataAiHint: 'latte coffee art small' },
  { id: 'prod_lat_300', name: 'Латте', volume: '0,3 л', price: 165, dataAiHint: 'latte coffee art medium' },
  { id: 'prod_ame_200', name: 'Американо', volume: '0,2 л', price: 115, dataAiHint: 'americano black coffee small' },
  { id: 'prod_ame_300', name: 'Американо', volume: '0,3 л', price: 135, dataAiHint: 'americano black coffee medium' },
  { id: 'prod_esp', name: 'Эспрессо', price: 100, dataAiHint: 'espresso shot' },
  { id: 'prod_dop', name: 'Доппио', price: 135, dataAiHint: 'double espresso' },
  { id: 'prod_raf_200', name: 'Раф', volume: '0,2 л', price: 195, dataAiHint: 'raf coffee small' },
  { id: 'prod_raf_300', name: 'Раф', volume: '0,3 л', price: 245, dataAiHint: 'raf coffee medium' },
  { id: 'prod_raf_400', name: 'Раф', volume: '0,4 л', price: 310, dataAiHint: 'raf coffee large' },
  { id: 'prod_raf_halva', name: 'Раф халва', price: 285, dataAiHint: 'halva raf coffee' },
  { id: 'prod_flat', name: 'Флэт Уайт', price: 205, dataAiHint: 'flat white coffee' },
  { id: 'prod_moc', name: 'Моккачино', price: 315, dataAiHint: 'mochaccino chocolate coffee' },
  { id: 'prod_glint', name: 'Кофейный глинтвейн', price: 195, dataAiHint: 'coffee mulled wine non-alcoholic' },
  { id: 'prod_cold_300', name: 'Холодный кофе', volume: '0,3 л', price: 195, dataAiHint: 'iced coffee medium' },
  { id: 'prod_cold_500', name: 'Холодный кофе', volume: '0,5 л', price: 225, dataAiHint: 'iced coffee large' },
  { id: 'prod_cold_ame', name: 'Холодный американо', price: 150, dataAiHint: 'iced americano black coffee' },
  { id: 'prod_tonic_300', name: 'Кофе/тоник', volume: '0,3 л', price: 185, dataAiHint: 'espresso tonic medium' },
  { id: 'prod_tonic_500', name: 'Кофе/тоник', volume: '0,5 л', price: 225, dataAiHint: 'espresso tonic large' },
  { id: 'prod_bumble_300', name: 'Бамбл', volume: '0,3 л', price: 195, dataAiHint: 'bumble coffee orange juice medium' },
  { id: 'prod_bumble_500', name: 'Бамбл', volume: '0,5 л', price: 235, dataAiHint: 'bumble coffee orange juice large' },

  // Other Drinks
  { id: 'prod_hotchoc_300', name: 'Горячий шоколад', volume: '0,3 л', price: 205, dataAiHint: 'hot chocolate medium mug' },
  { id: 'prod_hotchoc_500', name: 'Горячий шоколад', volume: '0,5 л', price: 275, dataAiHint: 'hot chocolate large mug marshmallows' },
  { id: 'prod_tea_300', name: 'Чай', volume: '0,3 л', price: 110, dataAiHint: 'tea cup steam' },
  { id: 'prod_tea_500', name: 'Чай', volume: '0,5 л', price: 190, dataAiHint: 'large tea mug pot' },

  // Additives
  { id: 'prod_syrup', name: 'Сироп', price: 50, dataAiHint: 'coffee syrup bottle pour' },
  { id: 'prod_milk_almond', name: 'Молоко миндаль', price: 60, dataAiHint: 'almond milk carton splash' },
  { id: 'prod_milk_coconut', name: 'Молоко кокос', price: 60, dataAiHint: 'coconut milk carton tropical' },
  { id: 'prod_milk_banana', name: 'Молоко банан', price: 60, dataAiHint: 'banana milk carton yellow' },

  // Snacks & Other
  { id: 'prod_gum', name: 'Жвачка', price: 60, dataAiHint: 'chewing gum pack mint' },
  { id: 'prod_cola', name: 'Кола', price: 95, dataAiHint: 'cola can bottle fizz' },
  { id: 'prod_bar', name: 'Батончик', price: 145, dataAiHint: 'chocolate snack bar wrapper' },
  { id: 'prod_icecream', name: 'Мороженое', price: 165, dataAiHint: 'ice cream scoop cone' },
].map(p => ({
    ...p,
    // Assign default image URL if not provided
    imageUrl: p.imageUrl || `https://picsum.photos/200/150?random=${p.id.replace('prod_', '')}`
}));
