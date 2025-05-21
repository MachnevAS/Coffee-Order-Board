/**
 * @file Вспомогательные утилиты общего назначения.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Утилита для условного объединения CSS-классов.
 * Использует clsx для обработки различных форматов входных данных (строки, объекты, массивы)
 * и twMerge для разрешения конфликтов классов Tailwind CSS.
 * @param {...ClassValue[]} inputs - Список классов или условий для их применения.
 * @returns {string} Строка с объединенными и оптимизированными CSS-классами.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Вспомогательная функция для получения инициалов из имени и фамилии.
 * @param {string} [firstName] - Имя пользователя (опционально).
 * @param {string} [lastName] - Фамилия пользователя (опционально).
 * @returns {string} Строка с инициалами (например, "ИФ") или "??", если имя и фамилия не предоставлены.
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const firstInitial = firstName ? firstName[0] : ''; // Первая буква имени
  const lastInitial = lastName ? lastName[0] : '';   // Первая буква фамилии
  // Объединяем инициалы и приводим к верхнему регистру. Если нет ни имени, ни фамилии, возвращаем "??".
  return `${firstInitial}${lastInitial}`.toUpperCase() || '??';
}
