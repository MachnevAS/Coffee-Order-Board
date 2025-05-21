/**
 * @file Кастомный хук useToast для управления всплывающими уведомлениями.
 * Реализация вдохновлена библиотекой react-hot-toast.
 */
"use client"

import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast" // Типы для компонентов Toast

/** Максимальное количество одновременно отображаемых уведомлений. */
const TOAST_LIMIT = 1
/** Задержка перед удалением уведомления из DOM после его закрытия (для анимаций). */
const TOAST_REMOVE_DELAY = 1000000 // Достаточно большое значение, чтобы анимация успела завершиться

/**
 * Тип для объекта уведомления, используемого внутри хука.
 * Расширяет ToastProps и добавляет обязательные поля id, title, description, action.
 */
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

/** Типы действий для reducer. */
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0 // Счетчик для генерации уникальных ID уведомлений

/**
 * Генерирует уникальный ID для уведомления.
 * @returns {string} Уникальный ID.
 */
function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

/** Тип для объекта действия в reducer. */
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast> // Для обновления могут приходить частичные данные
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"] // toastId опционален для закрытия всех уведомлений
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"] // toastId опционален для удаления всех уведомлений
    }

/** Интерфейс состояния хука. */
interface State {
  toasts: ToasterToast[]
}

/** Карта для хранения таймаутов на удаление уведомлений. */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Добавляет ID уведомления в очередь на удаление.
 * Если для данного ID уже существует таймаут, ничего не делает.
 * @param {string} toastId - ID уведомления.
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId) // Удаляем ID из карты таймаутов
    // Отправляем действие на удаление уведомления из состояния
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout) // Сохраняем таймаут
}

/**
 * Reducer для управления состоянием уведомлений.
 * @param {State} state - Текущее состояние.
 * @param {Action} action - Действие для обновления состояния.
 * @returns {State} Новое состояние.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        // Добавляем новое уведомление в начало массива и обрезаем до TOAST_LIMIT
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        // Обновляем существующее уведомление по ID
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Побочный эффект: добавляем уведомление(я) в очередь на удаление из DOM
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        // Если ID не указан, закрываем все уведомления
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        // Устанавливаем флаг open = false для закрываемого уведомления (или всех)
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false, // Помечаем уведомление как закрытое
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        // Если ID не указан, удаляем все уведомления
        return {
          ...state,
          toasts: [],
        }
      }
      // Удаляем уведомление с указанным ID из массива
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

/** Массив слушателей изменения состояния. */
const listeners: Array<(state: State) => void> = []

/** Глобальное состояние уведомлений, хранящееся в памяти. */
let memoryState: State = { toasts: [] }

/**
 * Функция для отправки действий в reducer и оповещения слушателей.
 * @param {Action} action - Действие для reducer.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action) // Обновляем глобальное состояние
  // Оповещаем всех слушателей об изменении состояния
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

/** Тип для параметров функции toast (без ID, так как он генерируется автоматически). */
type Toast = Omit<ToasterToast, "id">

/**
 * Функция для отображения нового уведомления.
 * @param {Toast} props - Свойства уведомления.
 * @returns {{ id: string, dismiss: () => void, update: (props: ToasterToast) => void }} Объект с ID уведомления и функциями для его обновления и закрытия.
 */
function toast({ ...props }: Toast) {
  const id = genId() // Генерируем уникальный ID

  // Функция для обновления существующего уведомления
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  // Функция для закрытия уведомления
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  // Отправляем действие на добавление нового уведомления
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true, // По умолчанию уведомление открыто
      onOpenChange: (open) => { // Обработчик закрытия уведомления (например, по свайпу)
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * Кастомный хук для использования системы уведомлений.
 * @returns {{ toasts: ToasterToast[], toast: ({ ...props }: Toast) => { id: string, dismiss: () => void, update: (props: ToasterToast) => void }, dismiss: (toastId?: string) => void }}
 *  Объект с текущим списком уведомлений, функцией для создания нового уведомления и функцией для закрытия уведомления.
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState) // Локальное состояние компонента, синхронизированное с memoryState

  React.useEffect(() => {
    // Подписываемся на изменения глобального состояния при монтировании
    listeners.push(setState)
    return () => {
      // Отписываемся при размонтировании
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state]) // Зависимость от state для корректной подписки/отписки

  return {
    ...state,
    toast, // Функция для создания уведомлений
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }), // Функция для закрытия уведомления по ID или всех сразу
  }
}

export { useToast, toast }
