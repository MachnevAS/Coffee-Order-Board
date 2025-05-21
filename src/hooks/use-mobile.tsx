/**
 * @file Кастомный хук useIsMobile.
 * Определяет, соответствует ли текущая ширина окна мобильному разрешению.
 */
import * as React from "react"

/** Точка останова для определения мобильного устройства (в пикселях). */
const MOBILE_BREAKPOINT = 768

/**
 * Хук для определения, является ли текущее устройство мобильным.
 * Возвращает true, если ширина окна меньше MOBILE_BREAKPOINT, иначе false.
 * Изначально может вернуть undefined до первого определения размера окна.
 * @returns {boolean} - True, если устройство мобильное, иначе false.
 */
export function useIsMobile() {
  // Состояние для хранения флага мобильного устройства
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Создаем объект MediaQueryList для отслеживания изменений размера окна
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    /** Обработчик изменения состояния MediaQueryList. */
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Добавляем слушатель событий изменения
    mql.addEventListener("change", onChange)
    // Устанавливаем начальное значение
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    // Очистка: удаляем слушатель при размонтировании компонента
    return () => mql.removeEventListener("change", onChange)
  }, []) // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании

  // Возвращаем булево значение (!!undefined будет false)
  return !!isMobile
}
