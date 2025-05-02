
// We no longer extend Product here to be more explicit about saved fields
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  volume?: string; // Optional field for volume, e.g., "0,2 л", "50 мл"
}

export type PaymentMethod = 'Наличные' | 'Карта' | 'Перевод';

export interface Order {
  id: string;
  items: OrderItem[]; // Uses the updated OrderItem interface
  totalPrice: number;
  timestamp: string; // ISO string format 'YYYY-MM-DDTHH:mm:ss.sssZ'
  paymentMethod: PaymentMethod; // Added payment method
}

