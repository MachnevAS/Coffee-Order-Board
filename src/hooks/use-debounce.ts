/**
 * @file Кастомный хук useDebounce.
 * Позволяет отложить обновление значения до тех пор, пока не пройдет указанная задержка
 * с момента последнего изменения исходного значения.
 */
import { useState, useEffect } from 'react';

/**
 * Хук для получения "отложенного" значения (debounced value).
 * Обновляет возвращаемое значение только после того, как `value` не изменялось
 * в течение указанного `delay`.
 *
 * @template T - Тип значения.
 * @param {T} value - Значение, которое нужно "отложить".
 * @param {number} delay - Задержка в миллисекундах.
 * @returns {T} "Отложенное" значение.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // Состояние для хранения "отложенного" значения
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(
    () => {
      // Устанавливаем таймер для обновления "отложенного" значения
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      // Очищаем таймер, если `value` или `delay` изменились до истечения задержки,
      // или если компонент размонтируется.
      // Это предотвращает обновление `debouncedValue`, если `value` изменилось
      // в течение периода задержки (таймер сбрасывается и перезапускается).
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // Перезапускаем эффект только если `value` или `delay` изменились
  );

  return debouncedValue;
}
