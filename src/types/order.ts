

// Renamed to avoid conflict in OrderBuilder component
export interface SalesHistoryItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  volume?: string; // Optional field for volume, e.g., "0,2 л", "50 мл"
}

export type PaymentMethod = 'Наличные' | 'Карта' | 'Перевод';

export interface Order {
  id: string;
  items: SalesHistoryItem[]; // Uses the updated SalesHistoryItem interface
  totalPrice: number;
  timestamp: string; // ISO string format 'YYYY-MM-DDTHH:mm:ss.sssZ'
  paymentMethod: PaymentMethod; // Added payment method
}

