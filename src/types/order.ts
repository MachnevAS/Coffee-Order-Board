import type { Product } from './product';

export interface OrderItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  totalPrice: number;
  timestamp: string; // ISO string format 'YYYY-MM-DDTHH:mm:ss.sssZ'
}
