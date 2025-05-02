import type { Product } from '@/types/product';

// Helper function to format volume
const formatVolume = (volume: number | string | null | undefined): string | undefined => {
  if (volume === null || volume === undefined || volume === '-' || volume === '') {
    return undefined;
  }
  if (typeof volume === 'number') {
    return `${volume.toString().replace('.', ',')} л`;
  }
   // If it's already a string, assume it's correct or needs minor cleaning
   return volume.toString().replace('.',',') + ' л';
};

// Helper function to generate dataAiHint
const generateHint = (name: string, volume?: string): string => {
    const nameLower = name.toLowerCase();
    const hints = [nameLower];
    if (volume) {
        // Extract numeric part if possible
        const numericVolume = volume.match(/[\d,]+/)?.[0];
        if (numericVolume) {
            hints.push(numericVolume);
        }
        if (volume.includes('0,2')) hints.push('small');
        else if (volume.includes('0,3')) hints.push('medium');
        else if (volume.includes('0,4')) hints.push('large');
        else if (volume.includes('0,5')) hints.push('extra large');
    }
    if (nameLower.includes('кофе')) hints.push('coffee');
    if (nameLower.includes('чай')) hints.push('tea');
    if (nameLower.includes('шоколад')) hints.push('chocolate');
    if (nameLower.includes('холодный')) hints.push('iced');
    if (nameLower.includes('латте')) hints.push('latte');
    if (nameLower.includes('капучино')) hints.push('cappuccino');
     if (nameLower.includes('американо')) hints.push('americano');
     if (nameLower.includes('эспрессо')) hints.push('espresso');
     if (nameLower.includes('раф')) hints.push('raf');

    // Return unique hints, limited to 2-3 relevant ones
    return [...new Set(hints)].slice(0, 3).join(' ');
}


// Define raw product data
const rawProducts = [
  { name: 'Капучино', volume: 0.2, price: 150, imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5' },
  { name: 'Капучино', volume: 0.3, price: 185, imageUrl: 'https://images.pexels.com/photos/2396220/pexels-photo-2396220.jpeg' },
  { name: 'Капучино', volume: 0.4, price: 195, imageUrl: 'https://images.unsplash.com/photo-1587496679742-bad502958fbf' },
  { name: 'Капучино', volume: 0.5, price: 250, imageUrl: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg' },
  { name: 'Латте', volume: 0.2, price: 140, imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d' },
  { name: 'Латте', volume: 0.3, price: 165, imageUrl: 'https://images.pexels.com/photos/685527/pexels-photo-685527.jpeg' },
  { name: 'Американо', volume: 0.2, price: 115, imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772' },
  { name: 'Американо', volume: 0.3, price: 135, imageUrl: 'https://images.pexels.com/photos/4195566/pexels-photo-4195566.jpeg' },
  { name: 'Эспрессо', volume: null, price: 100, imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04' },
  { name: 'Доппио', volume: null, price: 135, imageUrl: 'https://images.pexels.com/photos/3741470/pexels-photo-3741470.jpeg' },
  { name: 'Раф', volume: 0.2, price: 195, imageUrl: 'https://images.unsplash.com/photo-1615657203690-d7d2478b250a' },
  { name: 'Раф', volume: 0.3, price: 245, imageUrl: 'https://images.pexels.com/photos/8515553/pexels-photo-8515553.jpeg' },
  { name: 'Раф', volume: 0.4, price: 310, imageUrl: 'https://images.unsplash.com/photo-1612203985729-70726954388c' },
  { name: 'Раф халва', volume: null, price: 285, imageUrl: 'https://images.pexels.com/photos/808941/pexels-photo-808941.jpeg' }, // Hint: halva coffee
  { name: 'Горячий шоколад', volume: 0.3, price: 205, imageUrl: 'https://images.unsplash.com/photo-1575380585122-4b1ade5d4f72' },
  { name: 'Горячий шоколад', volume: 0.5, price: 275, imageUrl: 'https://images.pexels.com/photos/6605313/pexels-photo-6605313.jpeg' },
  { name: 'Флэт Уайт', volume: null, price: 205, imageUrl: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a8' },
  { name: 'Моккачино', volume: null, price: 315, imageUrl: 'https://images.pexels.com/photos/4790100/pexels-photo-4790100.jpeg' },
  { name: 'Чай', volume: 0.3, price: 110, imageUrl: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a8' }, // Reusing flat white img for tea 0.3? Might need update.
  { name: 'Чай', volume: 0.5, price: 190, imageUrl: 'https://images.pexels.com/photos/691114/pexels-photo-691114.jpeg' },
  { name: 'Кофейный глинтвейн', volume: null, price: 195, imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587' }, // Hint: coffee mulled wine non-alcoholic
  { name: 'Холодный кофе', volume: 0.3, price: 195, imageUrl: 'https://images.pexels.com/photos/302896/pexels-photo-302896.jpeg' },
  { name: 'Холодный кофе', volume: 0.5, price: 225, imageUrl: 'https://images.unsplash.com/photo-1551030173-122a2d6da306' },
  { name: 'Холодный американо', volume: null, price: 150, imageUrl: 'https://images.pexels.com/photos/8515555/pexels-photo-8515555.jpeg' },
  { name: 'Кофе/тоник', volume: 0.3, price: 185, imageUrl: 'https://images.unsplash.com/photo-1580651210345-c640471c9a7e' }, // Hint: espresso tonic
  { name: 'Кофе/тоник', volume: 0.5, price: 225, imageUrl: 'https://images.pexels.com/photos/8515559/pexels-photo-8515559.jpeg' }, // Hint: espresso tonic large
  { name: 'Бамбл', volume: 0.3, price: 195, imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d' }, // Reusing latte img for bumble 0.3? Might need update. Hint: bumble coffee orange
  { name: 'Бамбл', volume: 0.5, price: 235, imageUrl: 'https://images.pexels.com/photos/8515557/pexels-photo-8515557.jpeg' }, // Hint: bumble coffee orange large
  { name: 'Сироп', volume: null, price: 50, imageUrl: 'https://images.pexels.com/photos/4706133/pexels-photo-4706133.jpeg' }, // Hint: coffee syrup bottle
  { name: 'Молоко миндаль', volume: null, price: 60, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150' }, // Hint: almond milk carton
  { name: 'Молоко кокос', volume: null, price: 60, imageUrl: 'https://images.unsplash.com/photo-1622921491195-9b833a3e1f6a' }, // Hint: coconut milk carton
  { name: 'Молоко банан', volume: null, price: 60, imageUrl: 'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg' }, // Hint: banana milk carton
  { name: 'Жвачка', volume: null, price: 60, imageUrl: 'https://images.unsplash.com/photo-1587135991058-88132bea1d5c' }, // Hint: chewing gum pack
  { name: 'Кола', volume: null, price: 95, imageUrl: 'https://images.pexels.com/photos/50593/coca-cola-cold-drink-soft-drink-coke-50593.jpeg' }, // Hint: cola can bottle
  { name: 'Батончик', volume: null, price: 145, imageUrl: 'https://images.unsplash.com/photo-1600956054489-a23507c64a10' }, // Hint: chocolate snack bar
  { name: 'Мороженое', volume: null, price: 165, imageUrl: 'https://images.unsplash.com/photo-1576506295286-5cda18df43e7' }, // Hint: ice cream cone scoop
];


export const getDefaultProducts = (): Product[] => rawProducts.map((p, index) => {
  const formattedVolume = formatVolume(p.volume);
   // Simple unique ID generation (consider more robust methods for production)
   const idSuffix = p.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 5) + (formattedVolume ? formattedVolume.replace(/[^0-9]/g, '') : '') + index;
   const id = `prod_${idSuffix}`;

   return {
    id: id,
    name: p.name,
    volume: formattedVolume,
    price: p.price,
    // Use provided imageUrl, fallback to picsum only if it's missing/invalid
    imageUrl: p.imageUrl && p.imageUrl.startsWith('http') ? p.imageUrl : `https://picsum.photos/100/80?random=${id}`, // Use smaller placeholder
    dataAiHint: generateHint(p.name, formattedVolume),
   };
});
