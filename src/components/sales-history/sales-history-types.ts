/**
 * @file Определяет типы данных, используемые в компоненте истории продаж.
 */

/**
 * Ключи, по которым возможна сортировка таблицы истории продаж.
 */
export type SortKeySales = 'timestamp' | 'totalPrice' | 'paymentMethod' | 'employee';

/**
 * Направления сортировки.
 */
export type SortDirectionSales = 'asc' | 'desc';

/**
 * Конфигурация сортировки.
 * Содержит ключ и направление сортировки.
 * Если null, сортировка не применяется или используется сортировка по умолчанию.
 */
export type SortConfigSales = { key: SortKeySales; direction: SortDirectionSales } | null;

/**
 * Конфигурация сортировки по умолчанию для истории продаж.
 * Сортировка по времени (timestamp) в убывающем порядке (сначала новые).
 */
export const DEFAULT_SORT_SALES: SortConfigSales = { key: 'timestamp', direction: 'desc' };
