/**
 * @file Определяет типы данных, используемые в компоненте управления товарами.
 */
import * as z from "zod";

/**
 * Схема валидации Zod для данных формы товара.
 * Используется как для добавления, так и для редактирования товаров.
 */
export const productSchema = z.object({
  /** Название товара. Должно содержать не менее 2 символов. */
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  /** Объем товара (например, "0,3 л"). Опционально. */
  volume: z.string().optional(),
  /**
   * Цена товара.
   * Должна быть числом (допускаются точка или запятая как разделитель).
   * Если строка пустая, преобразуется в undefined.
   * Цена должна быть 0 или больше. Опционально.
   */
  price: z.string()
        .refine((val) => /^\d*([.,]\d+)?$/.test(val.trim()) || val.trim() === '', { message: "Цена должна быть числом" })
        .transform((val) => val.trim() === '' ? undefined : parseFloat(val.replace(',', '.')))
        .refine((val) => val === undefined || val >= 0, { message: "Цена должна быть 0 или больше" })
        .optional(),
  /** URL изображения товара. Должен быть действительным URL. Опционально или пустая строка. */
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  /** Подсказка для AI-генерации изображения. Опционально. */
  dataAiHint: z.string().optional(),
});

/**
 * Тип данных для формы товара, выведенный из схемы Zod.
 */
export type ProductFormData = z.infer<typeof productSchema>;

/**
 * Тип для опций сортировки списка товаров.
 * - 'name-asc': по названию (А-Я)
 * - 'name-desc': по названию (Я-А)
 * - 'price-asc': по цене (возрастание)
 * - 'price-desc': по цене (убывание)
 * - 'popularity-desc': по популярности (сначала самые популярные)
 */
export type SortOptionProductMgmt = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc';
