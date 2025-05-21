/**
 * @file Компонент списка существующих товаров.
 * Отображает товары в виде списка с возможностью редактирования и удаления каждого элемента.
 */
"use client";

import React from 'react';
import type { UseFormReturn } from "react-hook-form";
import type { Product } from "@/types/product";
import type { ProductFormData } from './product-management-types'; // Импорт типов
import { ProductListItem } from '@/components/product-list-item'; // Импорт компонента элемента списка
import { Loader2 } from 'lucide-react'; // Импорт Loader2

/**
 * Свойства компонента ProductList.
 */
interface ProductListProps {
  /** Массив продуктов для отображения. */
  products: Product[];
  /** Экземпляр формы react-hook-form для редактирования. */
  editForm: UseFormReturn<ProductFormData>;
  /** ID продукта, который в данный момент редактируется, или null. */
  editingProductId: string | null;
  /** Карта с рангами популярности продуктов (productId: rank). */
  topProductsRanking: Map<string, number>;
  /** Функция для начала редактирования продукта. */
  onStartEditing: (product: Product) => void;
  /** Функция для отмены редактирования. */
  onCancelEditing: () => void;
  /** Функция для отправки отредактированных данных. */
  onEditSubmit: (data: ProductFormData) => void;
  /** Функция для удаления продукта. */
  onRemoveProduct: (product: Product) => void;
  /** Флаг, указывающий, идет ли загрузка списка товаров. */
  isLoading: boolean;
  /** Флаг, указывающий, идет ли процесс сохранения (редактирования/добавления) товара. */
  isEditingLoading: boolean; // Переименовано для ясности, ранее isSubmitting
}

/**
 * Компонент для отображения списка существующих товаров.
 * Использует React.memo для оптимизации производительности.
 * @param props - Свойства компонента.
 * @returns JSX элемент списка товаров.
 */
export const ProductList: React.FC<ProductListProps> = React.memo(({
  products,
  editForm,
  editingProductId,
  topProductsRanking,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  isLoading,
  // isEditingLoading, // Не используется напрямую в ProductList, но может быть прокинут в ProductListItem
}) => {
  // Отображение состояния загрузки, если список пуст
  if (isLoading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-2">Загрузка товаров...</p>
      </div>
    );
  }

  // Отображение сообщения, если товары не найдены (и загрузка завершена)
  if (products.length === 0 && !isLoading) {
    return <p className="text-muted-foreground text-center py-4">Товары по вашему запросу не найдены.</p>;
  }

  // Рендеринг списка товаров
  return (
    <ul className="space-y-3">
      {products.map((product) => (
        <ProductListItem
          key={product.id}
          product={product}
          isEditing={editingProductId === product.id} // Передаем флаг редактирования
          editForm={editForm} // Передаем форму для редактирования
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onEditSubmit={onEditSubmit}
          onRemoveProduct={() => onRemoveProduct(product)} // Передаем функцию удаления
          popularityRank={topProductsRanking.get(product.id)} // Передаем ранг популярности
        />
      ))}
    </ul>
  );
});

ProductList.displayName = 'ProductList';
