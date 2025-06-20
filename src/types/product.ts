/**
 * @file Определяет структуру данных для продукта.
 */

/**
 * Интерфейс, описывающий объект продукта.
 */
export interface Product {
  /**
   * Уникальный идентификатор продукта.
   * Генерируется локально при чтении данных из Google Таблицы или при создании нового продукта.
   */
  id: string;
  /** Название продукта. */
  name: string;
  /**
   * Цена продукта.
   * Может быть undefined для представления состояния формы или если цена не указана.
   */
  price: number | undefined;
  /** URL-адрес изображения продукта (опционально). */
  imageUrl?: string;
  /**
   * Подсказка для ИИ, связанная с изображением продукта (опционально).
   * Может использоваться для генерации или поиска изображений.
   */
  dataAiHint?: string;
  /**
   * Объем продукта (например, "0,2 л", "50 мл") (опционально).
   */
  volume?: string;
}
