/**
 * @file Компонент элемента списка продуктов для управления.
 * Отображает информацию о продукте и предоставляет элементы управления для редактирования и удаления.
 * В режиме редактирования отображает форму для изменения данных продукта.
 */
"use client";

import React, { useState, memo } from 'react';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Product } from "@/types/product";
import { Edit, Trash2, Save, X, Coffee } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import * as z from "zod";

// Схема валидации для формы редактирования/добавления продукта
const productFormSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(),
  price: z.string()
        .refine((val) => /^\d*([.,]\d+)?$/.test(val.trim()) || val.trim() === '', "Цена должна быть числом")
        .transform((val) => val.trim() === '' ? undefined : parseFloat(val.replace(',', '.')))
        .refine((val) => val === undefined || val >= 0, "Цена должна быть 0 или больше")
        .optional(),
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
});

// Тип данных формы продукта
type ProductFormData = z.infer<typeof productFormSchema>;

/**
 * Свойства компонента ProductListItem.
 */
interface ProductListItemProps {
  /** Объект продукта. */
  product: Product;
  /** Флаг, указывающий, находится ли элемент в режиме редактирования. */
  isEditing: boolean;
  /** Экземпляр формы react-hook-form для редактирования. */
  editForm: UseFormReturn<ProductFormData>;
  /** Функция для начала редактирования продукта. */
  onStartEditing: (product: Product) => void;
  /** Функция для отмены редактирования. */
  onCancelEditing: () => void;
  /** Функция для отправки отредактированных данных. */
  onEditSubmit: (data: ProductFormData) => void;
  /** Функция для удаления продукта. */
  onRemoveProduct: (product: Product) => void;
  /** Ранг популярности продукта (опционально). */
  popularityRank?: number; // Не используется в текущей реализации ProductListItem, но может быть добавлен
}

/**
 * Компонент для отображения элемента списка продуктов с возможностью редактирования и удаления.
 * Использует React.memo для оптимизации производительности, предотвращая ненужные перерисовки.
 */
export const ProductListItem = memo(function ProductListItem({
  product,
  isEditing,
  editForm,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
}: ProductListItemProps) {
  // Состояние для отслеживания ошибки загрузки изображения
  const [imgError, setImgError] = useState(false);
  // Источник изображения: URL из продукта или заглушка
  const imgSrc = !imgError && product.imageUrl ? product.imageUrl : `https://picsum.photos/100/80?random=${product.id}`;
  // Флаг для использования иконки-заглушки
  const useFallbackIcon = imgError || !product.imageUrl;

  /**
   * Рендерит форму редактирования продукта.
   * @returns JSX элемент формы редактирования.
   */
  const renderEditForm = () => (
    <Form {...editForm}>
      <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
        <FormField
          control={editForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Название</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={editForm.control}
          name="volume"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Объём</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={editForm.control}
          name="price"
          render={({ field: { onChange, ...restField } }) => ( // Деструктурируем onChange, чтобы использовать кастомный обработчик
            <FormItem>
              <FormLabel className="text-xs">Цена (₽)</FormLabel>
              <FormControl>
                <Input
                  type="number" // Используем type="number" для валидации ввода браузером
                  inputMode="decimal" // Помогает мобильным устройствам показывать клавиатуру с цифрами и точкой/запятой
                  step="any" // Разрешает ввод дробных чисел
                  className="h-8 text-sm"
                  onChange={(e) => onChange(e.target.value)} // Передаем только значение в react-hook-form
                  value={restField.value !== undefined ? String(restField.value) : ''} // Преобразуем число в строку для input
                  {...restField} // Передаем остальные свойства поля
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={editForm.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">URL изображения</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={editForm.control}
          name="dataAiHint"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Подсказка ИИ</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} className="h-8 text-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelEditing}
            className="text-xs px-2 h-8"
          >
            <X className="h-4 w-4 mr-1" /> Отмена
          </Button>
          <Button
            type="submit"
            size="sm"
            className="text-xs px-2 h-8"
          >
            <Save className="h-4 w-4 mr-1" /> Сохранить
          </Button>
        </div>
      </form>
    </Form>
  );

  /**
   * Рендерит отображение информации о продукте (не в режиме редактирования).
   * @returns JSX элемент отображения продукта.
   */
  const renderProductDisplay = () => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-grow">
        {/* Изображение продукта или заглушка */}
        <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-md overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
          {useFallbackIcon ? (
            <Coffee className="h-6 w-6 text-muted-foreground/50" />
          ) : (
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              style={{objectFit:"cover"}}
              data-ai-hint={product.dataAiHint || 'кофе'}
              sizes="40px md:48px" // Оптимизация размеров для разных экранов
              onError={() => setImgError(true)} // Обработка ошибки загрузки изображения
              unoptimized={imgSrc.includes('picsum.photos')} // Отключение оптимизации для заглушек
            />
          )}
        </div>

        {/* Название, объем и цена продукта */}
        <div className="overflow-hidden flex-grow">
          <p className="font-medium truncate text-sm md:text-base">{product.name}</p>
          {(product.volume || product.price !== undefined) && (
            <p className="text-xs md:text-sm text-muted-foreground font-sans">
              {product.volume && <span>{product.volume} / </span>}
              {(product.price !== undefined ? product.price.toFixed(0) : 'N/A')} ₽
            </p>
          )}
        </div>
      </div>

      {/* Кнопки управления: редактировать и удалить */}
      <div className="flex gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onStartEditing(product)}
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Редактировать {product.name}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onRemoveProduct(product)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Удалить {product.name}</span>
        </Button>
      </div>
    </div>
  );

  // Основной рендер компонента: либо форма редактирования, либо отображение продукта
  return (
    <li className="flex flex-col p-3 border rounded-md bg-card transition-colors duration-150">
      {isEditing ? renderEditForm() : renderProductDisplay()}
    </li>
  );
});
