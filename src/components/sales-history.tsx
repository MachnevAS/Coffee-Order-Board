/**
 * @file Компонент для отображения истории продаж.
 * Позволяет фильтровать заказы по дате, сортировать их по различным полям,
 * просматривать детали заказов, удалять отдельные заказы или всю историю.
 * Также отображает итоговую статистику по отфильтрованным заказам.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { format, parse, isValid as isValidDate, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import type { Order } from '@/types/order';
import { fetchOrdersFromSheet, deleteOrderFromSheet, clearAllOrdersFromSheet } from '@/services/google-sheets-service';
import { SalesHistoryControls } from './sales-history/sales-history-controls'; // Импорт компонента управления
import { SalesHistoryTable } from './sales-history/sales-history-table'; // Импорт компонента таблицы
import { SalesSummary, type SalesSummaryData } from './sales-history/sales-summary'; // Импорт компонента статистики
import { DEFAULT_SORT_SALES, type SortConfigSales, type SortKeySales } from './sales-history/sales-history-types'; // Импорт типов и констант для сортировки
import { Loader2 } from 'lucide-react'; // Импорт Loader2

// URL Google Таблицы с историей продаж (из переменных окружения)
const GOOGLE_SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID;
const GOOGLE_HISTORY_SHEET_NAME = process.env.NEXT_PUBLIC_GOOGLE_HISTORY_SHEET_NAME || process.env.GOOGLE_HISTORY_SHEET_NAME;

/**
 * Формирует фрагмент URL для перехода к конкретному листу в Google Таблице.
 * @param sheetNameOrGid - Название листа или его GID.
 * @returns Строка с фрагментом URL (например, "gid=12345" или "gid=SheetName").
 */
const getSheetUrlFragment = (sheetNameOrGid: string | undefined) => {
  if (!sheetNameOrGid) return '';
  if (/^\d+$/.test(sheetNameOrGid)) { // Если это GID (только цифры)
    return `gid=${sheetNameOrGid}`;
  }
  return `gid=${encodeURIComponent(sheetNameOrGid)}`; // Иначе кодируем название листа
};

// Полный URL для Google Таблицы с историей
const googleSheetHistoryUrl = GOOGLE_SHEET_ID && GOOGLE_HISTORY_SHEET_NAME
  ? `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit#${getSheetUrlFragment(GOOGLE_HISTORY_SHEET_NAME)}`
  : '#'; // Резервный URL, если ID или имя листа не определены

/**
 * Форматирует число как валюту (например, "100 ₽").
 * @param amount - Сумма для форматирования.
 * @returns Отформатированная строка валюты.
 */
const formatCurrency = (amount: number): string => `${amount.toFixed(0)} ₽`;

/**
 * Парсит строку с временной меткой для сортировки.
 * Ожидает формат "dd.MM.yyyy HH:mm:ss" или ISO.
 * @param timestamp - Строка с временной меткой.
 * @returns Объект Date или null, если парсинг не удался.
 */
const parseTimestampForSort = (timestamp: string): Date | null => {
    if (typeof timestamp === 'string') {
        // Попытка парсинга формата "dd.MM.yyyy HH:mm:ss" или "dd.MM.yyyy H:m:s"
        const dateTimeParts = timestamp.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
        if (dateTimeParts) {
            const [, day, month, year, hours, minutes, seconds] = dateTimeParts.map(Number);
            // Месяцы в JavaScript 0-индексированные
            const date = new Date(year, month - 1, day, hours, minutes, seconds);
            if (isValidDate(date)) {
                return date;
            }
        }
         // Резервный вариант: если не "dd.MM.yyyy HH:mm:ss", пробуем ISO формат
         try {
            const isoDate = parseISO(timestamp);
            if (isValidDate(isoDate)) {
                return isoDate;
            }
        } catch (e) {
            // Игнорируем ошибку parseISO, попробуем следующий вариант или вернем null
        }
    }
    console.warn(`[SalesHistory Sort] Не удалось преобразовать метку времени: "${timestamp}" в корректный объект Date.`);
    return null;
};

/**
 * Основной компонент для отображения истории продаж.
 * @returns JSX элемент страницы истории продаж.
 */
export function SalesHistory() {
  // Состояния компонента
  const [orders, setOrders] = useState<Order[]>([]); // Список всех заказов
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined); // Выбранный диапазон дат
  const [sortConfig, setSortConfig] = useState<SortConfigSales>(DEFAULT_SORT_SALES); // Текущая конфигурация сортировки
  const [isClient, setIsClient] = useState(false); // Флаг клиентской стороны
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false); // Состояние диалога очистки истории
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null); // Заказ, выбранный для удаления
  const [isLoading, setIsLoading] = useState(true); // Флаг загрузки данных
  const [isProcessingAction, setIsProcessingAction] = useState(false); // Флаг обработки действий (удаление/очистка)
  const [errorLoading, setErrorLoading] = useState<string | null>(null); // Сообщение об ошибке загрузки

  const { toast } = useToast(); // Хук для уведомлений

  /**
   * Загружает историю заказов из Google Sheets.
   * @param showLoadingIndicator - Показывать ли индикатор загрузки.
   */
  const loadOrders = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    setErrorLoading(null);
    try {
      const fetchedOrders = await fetchOrdersFromSheet();
      setOrders(fetchedOrders);
    } catch (error: any) {
      console.error("SalesHistory: Не удалось загрузить заказы из таблицы:", error);
      const errorMessage = error.message || "Не удалось загрузить историю продаж из Google Sheets.";
      setErrorLoading(errorMessage);
      toast({
        title: "Ошибка загрузки истории",
        description: errorMessage,
        variant: "destructive",
      });
      setOrders([]); // Очищаем список заказов в случае ошибки
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  }, [toast]); // Зависимость от toast

  // Эффект для начальной загрузки данных
  useEffect(() => {
    setIsClient(true); // Устанавливаем, что компонент работает на клиенте
    loadOrders();
  }, [loadOrders]); // Зависимость от loadOrders

  // Мемоизированный список отфильтрованных и отсортированных заказов
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders]; // Копируем массив заказов

    // Фильтрация по дате
    if (dateRange?.from) {
      const start = startOfDay(dateRange.from); // Начало выбранного дня/периода
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from); // Конец выбранного дня/периода
      filtered = filtered.filter((order) => {
        const orderDate = parseTimestampForSort(order.timestamp); // Парсим метку времени заказа
        return orderDate && orderDate >= start && orderDate <= end; // Проверяем, входит ли дата заказа в диапазон
      });
    }

    // Сортировка
    if (sortConfig) {
      filtered.sort((a, b) => {
        const { key, direction } = sortConfig;
        let comparison = 0;

        switch (key) {
          case 'timestamp':
            {
                const dateA = parseTimestampForSort(a.timestamp);
                const dateB = parseTimestampForSort(b.timestamp);
                if (dateA && dateB) {
                    comparison = dateA.getTime() - dateB.getTime();
                } else if (dateA) { comparison = -1; } // Если только dateA валидна, она "меньше"
                  else if (dateB) { comparison = 1; }  // Если только dateB валидна, она "меньше"
                  else { // Резервный вариант для непарсируемых меток времени
                    comparison = (a.timestamp || '').localeCompare(b.timestamp || '');
                }
            }
            break;
          case 'paymentMethod':
            comparison = (a.paymentMethod || '').localeCompare(b.paymentMethod || '', ru.code); // Сравнение строк с учетом локали
            break;
          case 'totalPrice':
            comparison = a.totalPrice - b.totalPrice;
            break;
          case 'employee':
            comparison = (a.employee || '').localeCompare(b.employee || '', ru.code);
            break;
        }
        return direction === 'asc' ? comparison : -comparison; // Применяем направление сортировки
      });
    }
    return filtered;
  }, [orders, dateRange, sortConfig]); // Зависимости

  // Мемоизированный расчет итоговой статистики продаж
  const salesSummary = useMemo(() => {
    const summary: SalesSummaryData = {
      total: 0,
      Наличные: 0,
      Карта: 0,
      Перевод: 0,
    };
    filteredAndSortedOrders.forEach(order => {
      summary.total += order.totalPrice;
      if (order.paymentMethod) {
        summary[order.paymentMethod] += order.totalPrice;
      }
    });
    return summary;
  }, [filteredAndSortedOrders]); // Зависимость от отфильтрованных заказов

  /**
   * Инициирует удаление заказа, устанавливая `orderToDelete`.
   */
  const initiateDeleteOrder = useCallback((order: Order) => {
    if (isLoading || isProcessingAction) return;
    setOrderToDelete(order);
  }, [isLoading, isProcessingAction]);

  /**
   * Подтверждает и выполняет удаление выбранного заказа.
   */
  const confirmDeleteOrder = useCallback(async () => {
    if (!orderToDelete || isLoading || isProcessingAction) return;
    const orderIdToDelete = orderToDelete.id;
    setIsProcessingAction(true); // Устанавливаем флаг обработки
    const success = await deleteOrderFromSheet(orderIdToDelete); // Вызываем API для удаления
    setOrderToDelete(null); // Сбрасываем выбранный для удаления заказ
    if (success) {
      await loadOrders(false); // Обновляем список заказов без индикатора
      toast({
        title: "Заказ удален",
        description: `Заказ ${orderIdToDelete} был успешно удален из Google Sheets.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить заказ из Google Sheets.",
        variant: "destructive"
      });
    }
    setIsProcessingAction(false); // Сбрасываем флаг обработки
  }, [orderToDelete, toast, loadOrders, isLoading, isProcessingAction]);

  /**
   * Отменяет удаление заказа.
   */
  const cancelDeleteOrder = useCallback(() => {
    setOrderToDelete(null);
  }, []);

  /**
   * Инициирует процесс очистки всей истории продаж.
   */
  const initiateClearAllOrders = useCallback(() => {
     if (isLoading || isProcessingAction || orders.length === 0) return; // Не открываем диалог, если нет заказов или идет обработка
    setIsClearHistoryDialogOpen(true);
  }, [isLoading, isProcessingAction, orders.length]);

  /**
   * Подтверждает и выполняет очистку всей истории продаж.
   */
  const confirmClearAllOrders = useCallback(async () => {
    if (isLoading || isProcessingAction) return;
    setIsClearHistoryDialogOpen(false);
    setIsProcessingAction(true);
    const success = await clearAllOrdersFromSheet();
    if (success) {
      await loadOrders(false);
      toast({
        title: "История очищена",
        description: "Вся история продаж была удалена из Google Sheets.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Ошибка очистки",
        description: "Не удалось очистить историю продаж в Google Sheets.",
        variant: "destructive"
      });
    }
    setIsProcessingAction(false);
  }, [toast, loadOrders, isLoading, isProcessingAction]);

  /**
   * Отменяет очистку всей истории продаж.
   */
  const cancelClearAllOrders = useCallback(() => {
    setIsClearHistoryDialogOpen(false);
  }, []);

  /**
   * Обработчик запроса на сортировку таблицы.
   * Изменяет ключ или направление сортировки.
   */
  const requestSort = useCallback((key: SortKeySales) => {
    setSortConfig(prevConfig => {
      if (prevConfig?.key === key) {
        // Если сортируем по тому же ключу, меняем направление или сбрасываем
        if (prevConfig.direction === 'asc') return { key, direction: 'desc' };
        if (prevConfig.direction === 'desc') return DEFAULT_SORT_SALES; // Сброс к сортировке по умолчанию
      }
      return { key, direction: 'asc' }; // Новая сортировка по возрастанию
    });
  }, []);

  /**
   * Обработчик обновления истории продаж.
   */
  const handleRefresh = useCallback(async () => {
      if (isLoading || isProcessingAction) return;
      await loadOrders(true); // Загрузка с индикатором
      if (!errorLoading) { // Уведомление только если не было ошибки
         toast({ title: "История обновлена", description: "Данные загружены из Google Sheets." });
      }
  }, [loadOrders, toast, isLoading, errorLoading, isProcessingAction]);

  /**
   * Обработчик копирования итоговой статистики в буфер обмена.
   */
  const handleCopySummary = useCallback(() => {
    const dateRangeString = dateRange?.from
      ? dateRange.to
        ? `за период с ${format(dateRange.from, 'dd.MM.yyyy', { locale: ru })} по ${format(dateRange.to, 'dd.MM.yyyy', { locale: ru })}`
        : `за ${format(dateRange.from, 'dd.MM.yyyy', { locale: ru })}`
      : 'за все время';

    const summaryText = `Статистика продаж ${dateRangeString}:\n\n` +
                       `Общая сумма: ${formatCurrency(salesSummary.total)}\n` +
                       `Наличные: ${formatCurrency(salesSummary.Наличные)}\n` +
                       `Карта: ${formatCurrency(salesSummary.Карта)}\n` +
                       `Перевод: ${formatCurrency(salesSummary.Перевод)}`;

    navigator.clipboard.writeText(summaryText).then(() => {
      toast({ title: "Статистика скопирована", description: "Данные о продажах за выбранный период скопированы в буфер обмена." });
    }).catch(err => {
      console.error("Не удалось скопировать статистику продаж:", err);
      toast({ title: "Ошибка копирования", description: "Не удалось скопировать статистику.", variant: "destructive" });
    });
  }, [dateRange, salesSummary, toast]);

  /**
   * Форматирует метку времени для отображения.
   * Напрямую возвращает строку из Google Sheets, так как она уже в нужном формате "dd.MM.yyyy HH:mm:ss".
   * @param timestamp - Строка с временной меткой.
   * @returns Отформатированная строка даты и времени или "N/A".
   */
  const formatDisplayDate = (timestamp: string): string => {
    return timestamp || 'N/A';
  };

  /**
   * Обработчик сброса выбранного диапазона дат.
   */
  const handleResetDateRange = useCallback(() => {
    setDateRange(undefined);
  }, []);

  // Рендеринг заглушки, если компонент еще не смонтирован на клиенте
  if (!isClient) {
    return (
      <Card>
        <CardHeader><CardTitle>История продаж</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground mt-2">Загрузка истории...</p>
        </CardContent>
      </Card>
    );
  }

  // --- Основная JSX разметка компонента ---
  return (
    <Card className="shadow-md">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">История продаж</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {/* Компонент элементов управления историей */}
        <SalesHistoryControls
          dateRange={dateRange}
          setDateRange={setDateRange}
          onResetDateRange={handleResetDateRange}
          onRefresh={handleRefresh}
          googleSheetHistoryUrl={googleSheetHistoryUrl}
          onInitiateClearAllOrders={initiateClearAllOrders}
          isLoading={isLoading}
          isProcessingAction={isProcessingAction}
          isClearHistoryDialogOpen={isClearHistoryDialogOpen}
          setIsClearHistoryDialogOpen={setIsClearHistoryDialogOpen}
          onConfirmClearAllOrders={confirmClearAllOrders}
          onCancelClearAllOrders={cancelClearAllOrders}
          ordersCount={orders.length}
          isSheetLinkAvailable={!!(GOOGLE_SHEET_ID && GOOGLE_HISTORY_SHEET_NAME)}
        />

        {/* Отображение ошибки загрузки */}
        {errorLoading && !isLoading && (
            <p className="text-destructive text-center py-4">Ошибка загрузки: {errorLoading}</p>
        )}

        {/* Компонент таблицы истории продаж */}
        <SalesHistoryTable
          orders={filteredAndSortedOrders}
          sortConfig={sortConfig}
          requestSort={requestSort}
          orderToDelete={orderToDelete}
          initiateDeleteOrder={initiateDeleteOrder}
          cancelDeleteOrder={cancelDeleteOrder}
          confirmDeleteOrder={confirmDeleteOrder}
          isLoading={isLoading}
          isProcessingAction={isProcessingAction}
          errorLoading={errorLoading}
          formatDisplayDate={formatDisplayDate}
          formatCurrency={formatCurrency}
        />

        {/* Компонент итоговой статистики продаж */}
        <SalesSummary
          summary={salesSummary}
          formatCurrency={formatCurrency}
          onCopySummary={handleCopySummary}
          isDisabled={isLoading || isProcessingAction}
          hasFilteredOrders={filteredAndSortedOrders.length > 0}
        />
      </CardContent>
    </Card>
  );
}
