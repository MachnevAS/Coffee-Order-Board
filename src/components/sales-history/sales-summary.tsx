/**
 * @file Компонент для отображения итоговой статистики продаж.
 * Показывает общую сумму продаж и суммы по каждому способу оплаты за выбранный период.
 * Предоставляет кнопку для копирования этой статистики в буфер обмена.
 */
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, CreditCard, Banknote, Smartphone } from 'lucide-react';
import type { PaymentMethod } from '@/types/order';
import { cn } from '@/lib/utils';

/**
 * Тип для объекта итоговой статистики продаж.
 */
export interface SalesSummaryData {
  total: number;
  Наличные: number;
  Карта: number;
  Перевод: number;
}

/**
 * Свойства компонента SalesSummary.
 */
interface SalesSummaryProps {
  /** Данные итоговой статистики. */
  summary: SalesSummaryData;
  /** Функция для форматирования валюты. */
  formatCurrency: (amount: number) => string;
  /** Функция для копирования статистики в буфер обмена. */
  onCopySummary: () => void;
  /** Флаг, указывающий, идет ли загрузка данных или обработка действия. */
  isDisabled: boolean;
  /** Флаг, есть ли отфильтрованные заказы для отображения статистики. */
  hasFilteredOrders: boolean;
}

/**
 * Вспомогательный компонент для отображения иконки способа оплаты.
 * @param props - Свойства компонента.
 * @returns JSX элемент иконки.
 */
const PaymentMethodIcon: React.FC<{ method: PaymentMethod | undefined }> = React.memo(({ method }) => {
  const iconSize = "h-3.5 w-3.5 md:h-4 md:w-4"; // Размер иконки
  switch (method) {
    case 'Наличные': return <Banknote className={cn(iconSize, "text-green-600")} />;
    case 'Карта': return <CreditCard className={cn(iconSize, "text-blue-600")} />;
    case 'Перевод': return <Smartphone className={cn(iconSize, "text-purple-600")} />;
    default: return null;
  }
});
PaymentMethodIcon.displayName = 'PaymentMethodIcon'; // Для удобства отладки

/**
 * Компонент для отображения итоговой статистики продаж.
 * @param props - Свойства компонента.
 * @returns JSX элемент статистики продаж или null, если нет отфильтрованных заказов.
 */
export const SalesSummary: React.FC<SalesSummaryProps> = ({
  summary,
  formatCurrency,
  onCopySummary,
  isDisabled,
  hasFilteredOrders,
}) => {
  // Не отображаем компонент, если нет отфильтрованных заказов
  if (!hasFilteredOrders) {
    return null;
  }

  return (
    <div className="mt-6 p-4 border-t bg-muted/20 rounded-b-md flex flex-col sm:flex-row justify-between items-center gap-4 text-sm md:text-base">
      {/* Общая сумма продаж */}
      <div className="font-semibold text-center sm:text-left">
        Общая сумма: <span className="text-primary font-sans">{formatCurrency(summary.total)}</span>
      </div>
      {/* Суммы по способам оплаты */}
      <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
        <div className="flex items-center gap-1">
          <PaymentMethodIcon method="Наличные" />
          <span>Наличные:</span>
          <span className="font-medium font-sans">{formatCurrency(summary.Наличные)}</span>
        </div>
        <div className="flex items-center gap-1">
          <PaymentMethodIcon method="Карта" />
          <span>Карта:</span>
          <span className="font-medium font-sans">{formatCurrency(summary.Карта)}</span>
        </div>
        <div className="flex items-center gap-1">
          <PaymentMethodIcon method="Перевод" />
          <span>Перевод:</span>
          <span className="font-medium font-sans">{formatCurrency(summary.Перевод)}</span>
        </div>
      </div>
      {/* Кнопка копирования статистики */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 md:h-10 text-xs md:text-sm px-3"
        onClick={onCopySummary}
        disabled={isDisabled || !hasFilteredOrders} // Кнопка неактивна во время загрузки или если нет данных
      >
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Скопировать статистику
      </Button>
    </div>
  );
};
