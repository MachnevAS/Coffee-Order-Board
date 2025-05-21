/**
 * @file Компонент сетки продуктов.
 * Отображает список продуктов в виде карточек.
 */
"use client";

import React from 'react';
import type { Product } from "@/types/product";
import { ProductCard } from '@/components/product-card';
import { Loader2 } from 'lucide-react'; // Импорт Loader2

/**
 * Свойства компонента ProductGrid.
 */
interface ProductGridProps {
  /** Массив продуктов для отображения. */
  products: Product[];
  /** Объект с количеством каждого товара в заказе (productId: quantity). */
  orderQuantities: { [productId: string]: number };
  /** Карта с рангами популярности продуктов (productId: rank). */
  topProductsRanking: Map<string, number>;
  /** Функция для добавления товара в заказ. */
  onAddToOrder: (product: Product) => void;
  /** Функция для удаления одной единицы товара из заказа. */
  onRemoveFromOrder: (productId: string) => void;
  /** Флаг, указывающий, идет ли загрузка продуктов. */
  isLoading?: boolean;
}

/**
 * Компонент для отображения сетки продуктов.
 * Использует React.memo для оптимизации, предотвращая ненужные перерисовки,
 * если свойства не изменились.
 * @param props - Свойства компонента.
 * @returns JSX элемент сетки продуктов.
 */
export const ProductGrid: React.FC<ProductGridProps> = React.memo(({
  products,
  orderQuantities,
  topProductsRanking,
  onAddToOrder,
  onRemoveFromOrder,
  isLoading
}) => {
  // Отображение состояния загрузки
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-2">Загрузка товаров...</p>
      </div>
    );
  }
  // Отображение сообщения, если товары не найдены
  if (products.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Товары по вашему запросу не найдены.</p>;
  }

  // Рендеринг сетки продуктов
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToOrder={onAddToOrder}
          onRemoveFromOrder={onRemoveFromOrder}
          orderQuantity={orderQuantities[product.id]}
          popularityRank={topProductsRanking.get(product.id)}
        />
      ))}
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';
