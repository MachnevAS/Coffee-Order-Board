import type { Product } from './product';

export interface OrderItem extends Product {
  quantity: number;
}

export type PaymentMethod = 'Наличные' | 'Карта' | 'Перевод';

export interface Order {
  id: string;
  items: OrderItem[];
  totalPrice: number;
  timestamp: string; // ISO string format 'YYYY-MM-DDTHH:mm:ss.sssZ'
  paymentMethod: PaymentMethod; // Added payment method
}
