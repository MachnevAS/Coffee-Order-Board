

// Renamed to avoid conflict in OrderBuilder component
export interface SalesHistoryItem {
  id: string; // This was product ID, now it should be unique item ID within an order if needed, or just use product name/volume
  name: string;
  price: number;
  quantity: number;
  volume?: string; // Optional field for volume, e.g., "0,2 л", "50 мл"
}

export type PaymentMethod = 'Наличные' | 'Карта' | 'Перевод';

export interface Order {
  id: string; // Unique order ID
  items: SalesHistoryItem[]; 
  totalPrice: number;
  timestamp: string; // ISO string format 'YYYY-MM-DDTHH:mm:ss.sssZ'
  paymentMethod: PaymentMethod;
  employee?: string; // Added employee field (e.g., "Должность - Фамилия И.О. (логин)")
}

