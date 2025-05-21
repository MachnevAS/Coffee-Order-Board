/**
 * @file Содержит данные о товарах по умолчанию и вспомогательные функции для их обработки.
 * Используется для первоначального заполнения Google Таблицы примерами товаров.
 */
import type { Product } from '@/types/product';

/**
 * Форматирует значение объема.
 * Преобразует число или строку в строку формата "X,X л" или возвращает undefined.
 * @param volume - Значение объема (число, строка, null или undefined).
 * @returns Отформатированная строка объема или undefined.
 */
const formatVolume = (volume: number | string | null | undefined): string | undefined => {
  if (volume === null || volume === undefined || volume === '-' || volume === '') {
    return undefined; // Если объем не указан или указан как '-', возвращаем undefined
  }
  // Позволяем строкам типа "0,2 л" проходить без изменений, если они уже отформатированы
  if (typeof volume === 'string' && volume.includes('л')) {
    return volume;
  }
  if (typeof volume === 'number') {
    return `${volume.toString().replace('.', ',')} л`; // Преобразуем число в строку и заменяем точку на запятую
  }
   // Обрабатываем простые строки, к которым нужно добавить "л"
   if (typeof volume === 'string' && !volume.includes('л')) {
      return volume.replace('.',',') + ' л';
   }
   // Резервный вариант для неожиданных типов
   return undefined;
};

/**
 * Генерирует подсказку для ИИ на основе названия и объема товара.
 * @param name - Название товара.
 * @param volume - Отформатированный объем товара (опционально).
 * @returns Строка с подсказками, разделенными пробелами.
 */
const generateHint = (name: string, volume?: string): string => {
    const nameLower = name.toLowerCase(); // Приводим название к нижнему регистру
    const hints: string[] = [nameLower]; // Начальная подсказка - название товара

    // Добавляем подсказки на основе объема
    if (volume) {
        const numericVolume = volume.match(/[\d,]+/)?.[0]; // Пытаемся извлечь числовую часть объема
        if (numericVolume) {
            hints.push(numericVolume.replace(',', '.')); // Используем точку для числовых значений в подсказках
        }
        // Добавляем качественные описания объема
        if (volume.includes('0,2')) hints.push('small');
        else if (volume.includes('0,3')) hints.push('medium');
        else if (volume.includes('0,4')) hints.push('large');
        else if (volume.includes('0,5')) hints.push('extra large');
    }

    // Добавляем подсказки на основе ключевых слов в названии
    if (nameLower.includes('кофе')) hints.push('coffee');
    if (nameLower.includes('чай')) hints.push('tea');
    if (nameLower.includes('шоколад')) hints.push('chocolate');
    if (nameLower.includes('холодный')) hints.push('iced');
    if (nameLower.includes('латте')) hints.push('latte');
    if (nameLower.includes('капучино')) hints.push('cappuccino');
    if (nameLower.includes('американо')) hints.push('americano');
    if (nameLower.includes('эспрессо')) hints.push('espresso');
    if (nameLower.includes('раф')) hints.push('raf');
    if (nameLower.includes('халва')) hints.push('halva');
    if (nameLower.includes('глинтвейн')) hints.push('mulled');
    if (nameLower.includes('тоник')) hints.push('tonic');
    if (nameLower.includes('бамбл')) hints.push('bumble');
    if (nameLower.includes('сироп')) hints.push('syrup');
    if (nameLower.includes('молоко')) hints.push('milk');
    if (nameLower.includes('миндаль')) hints.push('almond');
    if (nameLower.includes('кокос')) hints.push('coconut');
    if (nameLower.includes('банан')) hints.push('banana');
    if (nameLower.includes('жвачка')) hints.push('gum');
    if (nameLower.includes('кола')) hints.push('cola');
    if (nameLower.includes('батончик')) hints.push('bar');
    if (nameLower.includes('мороженое')) hints.push('ice cream');

    // Возвращаем уникальные подсказки (до 2-3 наиболее релевантных), разделенные пробелом
    return [...new Set(hints)].slice(0, 2).join(' ').trim();
}

/**
 * Массив сырых данных о товарах.
 * Используется для первоначального заполнения.
 * Поле 'volume' со значением '-' или null интерпретируется как отсутствие объема.
 */
const rawProducts = [
  { name: 'Капучино', volume: 0.2, price: 150, imageUrl: 'https://img.freepik.com/free-photo/coffee-shop-cafe-latte-cappuccino-newspaper-concept_53876-42953.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Капучино', volume: 0.3, price: 185, imageUrl: 'https://img.freepik.com/free-photo/coffee-shop-cafe-latte-cappuccino-newspaper-concept_53876-42953.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Капучино', volume: 0.4, price: 195, imageUrl: 'https://img.freepik.com/free-photo/coffee-shop-cafe-latte-cappuccino-newspaper-concept_53876-42953.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Капучино', volume: 0.5, price: 250, imageUrl: 'https://img.freepik.com/free-photo/coffee-shop-cafe-latte-cappuccino-newspaper-concept_53876-42953.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Латте', volume: 0.2, price: 140, imageUrl: 'https://img.freepik.com/free-photo/top-view-tasty-coffee-glass-with-latte-art-water-drop-background_23-2148209238.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Латте', volume: 0.3, price: 165, imageUrl: 'https://img.freepik.com/free-photo/top-view-tasty-coffee-glass-with-latte-art-water-drop-background_23-2148209238.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Американо', volume: 0.2, price: 115, imageUrl: 'https://img.freepik.com/free-photo/flat-lay-coffee-mug-wiiden-board_23-2148453619.jpg?t=st=1747859237~exp=1747862837~hmac=fd7e761d01425c213fe87f5555fbfba52c4ca5d6e0131d681fdebf84743f24a2&w=740' },
  { name: 'Американо', volume: 0.3, price: 135, imageUrl: 'https://img.freepik.com/free-photo/flat-lay-coffee-mug-wiiden-board_23-2148453619.jpg?t=st=1747859237~exp=1747862837~hmac=fd7e761d01425c213fe87f5555fbfba52c4ca5d6e0131d681fdebf84743f24a2&w=740' },
  { name: 'Эспрессо', volume: null, price: 100, imageUrl: 'https://img.freepik.com/free-photo/close-up-coffee-cup-wooden-table-caf_23-2148209320.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Доппио', volume: null, price: 135, imageUrl: 'https://img.freepik.com/free-photo/barista-making-classic-cappuccino_1220-4568.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Раф', volume: 0.2, price: 195, imageUrl: 'https://img.freepik.com/free-photo/disposable-cup-with-delicious-coffee_23-2148892889.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Раф', volume: 0.3, price: 245, imageUrl: 'https://img.freepik.com/free-photo/disposable-cup-with-delicious-coffee_23-2148892889.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Раф', volume: 0.4, price: 310, imageUrl: 'https://img.freepik.com/free-photo/disposable-cup-with-delicious-coffee_23-2148892889.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Раф халва', volume: null, price: 285, imageUrl: 'https://img.freepik.com/free-photo/disposable-cup-with-delicious-coffee_23-2148892889.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' }, // Note: Image URL is same as generic Raf, specific might be better
  { name: 'Горячий шоколад', volume: 0.3, price: 205, imageUrl: 'https://img.freepik.com/free-photo/top-view-sweet-chocolate-assortment_23-2148549369.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Горячий шоколад', volume: 0.5, price: 275, imageUrl: 'https://img.freepik.com/free-photo/top-view-sweet-chocolate-assortment_23-2148549369.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Флэт Уайт', volume: null, price: 205, imageUrl: 'https://img.freepik.com/free-photo/cup-coffee-near-heart-shaped-cookie_23-2147744656.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Моккачино', volume: null, price: 315, imageUrl: 'https://img.freepik.com/free-photo/cup-coffee-with-milk-foam-cocoa-powder-gray-background_23-2147898351.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Чай', volume: 0.3, price: 110, imageUrl: 'https://img.freepik.com/free-photo/dried-lemon-tea-with-sugar-mint-honey-concrete-backdrop_23-2148186351.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Чай', volume: 0.5, price: 190, imageUrl: 'https://img.freepik.com/free-photo/dried-lemon-tea-with-sugar-mint-honey-concrete-backdrop_23-2148186351.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Кофейный глинтвейн', volume: null, price: 195, imageUrl: 'https://img.freepik.com/free-photo/delicious-mulled-wine-drink-concept_23-2148799105.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Холодный кофе', volume: 0.3, price: 195, imageUrl: 'https://img.freepik.com/free-photo/top-view-fresh-frappe-arrangement-white-table_23-2148623243.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Холодный кофе', volume: 0.5, price: 225, imageUrl: 'https://img.freepik.com/free-photo/top-view-fresh-frappe-arrangement-white-table_23-2148623243.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Холодный американо', volume: null, price: 150, imageUrl: 'https://img.freepik.com/free-photo/cold-coffee-drink-with-ice-wooden-background_23-2147876640.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Кофе/тоник', volume: 0.3, price: 185, imageUrl: 'https://img.freepik.com/free-photo/top-view-coffee-drink_53876-14861.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Кофе/тоник', volume: 0.5, price: 225, imageUrl: 'https://img.freepik.com/free-photo/top-view-coffee-drink_53876-14861.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Бамбл', volume: 0.3, price: 195, imageUrl: 'https://img.freepik.com/free-photo/close-up-person-holding-mug-with-hot-drink_23-2148325696.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Бамбл', volume: 0.5, price: 235, imageUrl: 'https://img.freepik.com/free-photo/close-up-person-holding-mug-with-hot-drink_23-2148325696.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Сироп', volume: null, price: 50, imageUrl: 'https://img.freepik.com/free-photo/stains-coffee-oil-flat-lay_23-2148231636.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Молоко миндаль', volume: null, price: 60, imageUrl: 'https://img.freepik.com/free-photo/bottle-milk-nuts_23-2147987722.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Молоко кокос', volume: null, price: 60, imageUrl: 'https://img.freepik.com/free-photo/glass-cracked-coconut-with-bright-blue-drink_23-2148145326.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Молоко банан', volume: null, price: 60, imageUrl: 'https://img.freepik.com/free-photo/top-view-smoothie-jar-with-bananas-orange_23-2148526556.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Жвачка', volume: null, price: 60, imageUrl: 'https://img.freepik.com/free-photo/close-up-woman-inflates-pink-balloon_23-2148255216.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Кола', volume: null, price: 95, imageUrl: 'https://img.freepik.com/free-photo/top-view-soft-drink-glass-with-ice-cubes-straw_23-2148691224.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
  { name: 'Батончик', volume: null, price: 145, imageUrl: 'https://img.freepik.com/free-vector/tasty-snack-set_23-2147921397.jpg?t=st=1747859008~exp=1747862608~hmac=9145dfd15ea8cd6219b74dc6401c24f3a291b4c51b66e10adb0ca0bcdcd5f815&w=740' },
  { name: 'Мороженое', volume: null, price: 165, imageUrl: 'https://img.freepik.com/free-photo/top-view-tasty-ice-cream-with-spoon-table_23-2148513909.jpg?ga=GA1.1.1735656609.1746904076&semt=ais_hybrid&w=740' },
];

/**
 * Возвращает обработанный список сырых данных о товарах.
 * Форматирует объем и генерирует подсказки для ИИ. ID не генерируется здесь,
 * так как он теперь создается локально в сервисе при чтении из Google Таблицы.
 * @returns Массив объектов товаров (без ID).
 */
export const getRawProductData = (): Omit<Product, 'id'>[] => rawProducts.map((p) => {
  const formattedVolume = formatVolume(p.volume);
  return {
    // Поле ID удалено, так как ID теперь генерируется на основе строки в Google Sheets
    name: p.name,
    volume: formattedVolume,
    price: p.price,
    // Используем предоставленный imageUrl, если он действителен, иначе undefined
    imageUrl: p.imageUrl && p.imageUrl.startsWith('http') ? p.imageUrl : undefined,
    dataAiHint: generateHint(p.name, formattedVolume),
   };
});


/**
 * Возвращает пустой массив по умолчанию, так как данные теперь поступают из Google Таблиц.
 * Эта функция может быть использована как заглушка или удалена, если не нужна.
 * @returns Пустой массив продуктов.
 */
export const getDefaultProducts = (): Product[] => {
    console.log("getDefaultProducts вызвана, возвращается пустой массив, так как источник данных - Google Sheets.");
    return [];
};


    