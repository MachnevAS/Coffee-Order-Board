/**
 * @file Определяет тип для элемента заказа в конструкторе.
 * Расширяет тип Product, добавляя поле quantity.
 */
import type { Product } from "@/types/product";

/**
 * Интерфейс для элемента заказа в конструкторе.
 * Представляет продукт с указанием его количества в текущем заказе.
 */
export interface OrderItem extends Product {
  /** Количество данного товара в заказе. */
  quantity: number;
}
