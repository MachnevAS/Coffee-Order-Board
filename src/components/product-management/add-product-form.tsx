/**
 * @file Компонент формы для добавления нового товара.
 * Использует react-hook-form для управления состоянием формы и валидации.
 */
"use client";

import React from 'react';
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { ProductFormData } from './product-management-types'; // Импорт типов
import { Loader2 } from 'lucide-react'; // Импорт Loader2

/**
 * Свойства компонента AddProductForm.
 */
interface AddProductFormProps {
  /** Экземпляр формы react-hook-form. */
  form: UseFormReturn<ProductFormData>;
  /** Функция обратного вызова при отправке формы. */
  onSubmit: (data: ProductFormData) => void;
  /** Флаг, указывающий, идет ли процесс отправки формы. */
  isSubmitting: boolean;
}

/**
 * Компонент формы для добавления нового товара.
 * Использует React.memo для оптимизации производительности.
 * @param props - Свойства компонента.
 * @returns JSX элемент формы добавления товара.
 */
export const AddProductForm: React.FC<AddProductFormProps> = React.memo(({ form, onSubmit, isSubmitting }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      {/* Основная часть формы с полями ввода */}
      <div className="space-y-4 flex-grow">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input placeholder="например, Латте" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage /> {/* Сообщение об ошибке валидации для этого поля */}
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="volume"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Объём (необязательно)</FormLabel>
              <FormControl>
                <Input placeholder="например, 0,3 л" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field: { onChange, ...restField } }) => ( // Деструктурируем для кастомного onChange
            <FormItem>
              <FormLabel>Цена (₽)</FormLabel>
              <FormControl>
                <Input
                  type="number" // Тип для числового ввода
                  inputMode="decimal" // Подсказка для мобильной клавиатуры
                  step="any" // Разрешает ввод дробных чисел
                  placeholder="например, 165"
                  onChange={(e) => onChange(e.target.value)} // Передаем только значение
                  value={restField.value !== undefined ? String(restField.value) : ''} // Управляем значением
                  disabled={isSubmitting}
                  {...restField}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL изображения (необязательно)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dataAiHint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Подсказка изображения (необязательно)</FormLabel>
              <FormControl>
                <Input placeholder="например, латте арт" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {/* Кнопка отправки формы */}
      <Button type="submit" className="w-full mt-4 bg-accent hover:bg-accent/90 text-sm px-3" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isSubmitting ? 'Добавление...' : 'Добавить товар'}
      </Button>
    </form>
  </Form>
));

AddProductForm.displayName = 'AddProductForm';
