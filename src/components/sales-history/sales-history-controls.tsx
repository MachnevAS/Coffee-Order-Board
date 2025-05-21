/**
 * @file Компонент элементов управления для истории продаж.
 * Включает выбор диапазона дат, кнопку обновления, ссылку на Google Таблицу
 * и кнопку для очистки всей истории продаж.
 */
"use client";

import React from 'react';
import type { DateRange } from 'react-day-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar as CalendarIcon, ExternalLink, Trash, RefreshCw, XCircle, Loader2 } from 'lucide-react'; // Added Loader2
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

/**
 * Свойства компонента SalesHistoryControls.
 */
interface SalesHistoryControlsProps {
  /** Выбранный диапазон дат. */
  dateRange: DateRange | undefined;
  /** Функция для установки диапазона дат. */
  setDateRange: (dateRange: DateRange | undefined) => void;
  /** Функция для сброса выбранного диапазона дат. */
  onResetDateRange: () => void;
  /** Функция для обновления истории продаж. */
  onRefresh: () => void;
  /** URL для перехода к Google Таблице с историей. */
  googleSheetHistoryUrl: string;
  /** Функция для инициации очистки всей истории продаж. */
  onInitiateClearAllOrders: () => void;
  /** Флаг, указывающий, идет ли загрузка данных. */
  isLoading: boolean;
  /** Флаг, указывающий, идет ли обработка действия (удаление/очистка). */
  isProcessingAction: boolean;
  /** Флаг, открыт ли диалог подтверждения очистки истории. */
  isClearHistoryDialogOpen: boolean;
  /** Функция для установки состояния открытия диалога очистки истории. */
  setIsClearHistoryDialogOpen: (isOpen: boolean) => void;
  /** Функция для подтверждения очистки всей истории. */
  onConfirmClearAllOrders: () => void;
  /** Функция для отмены очистки всей истории. */
  onCancelClearAllOrders: () => void;
  /** Количество заказов (для отображения в диалоге подтверждения). */
  ordersCount: number;
  /** Доступна ли ссылка на Google Sheet. */
  isSheetLinkAvailable: boolean;
}

/**
 * Компонент элементов управления для истории продаж.
 * @param props - Свойства компонента.
 * @returns JSX элемент.
 */
export const SalesHistoryControls: React.FC<SalesHistoryControlsProps> = ({
  dateRange,
  setDateRange,
  onResetDateRange,
  onRefresh,
  googleSheetHistoryUrl,
  onInitiateClearAllOrders,
  isLoading,
  isProcessingAction,
  isClearHistoryDialogOpen,
  setIsClearHistoryDialogOpen,
  onConfirmClearAllOrders,
  onCancelClearAllOrders,
  ordersCount,
  isSheetLinkAvailable,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 md:gap-4">
      {/* Выбор диапазона дат */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto justify-start text-left font-normal text-xs md:text-sm h-9 md:h-10 px-3"
              disabled={isLoading || isProcessingAction}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {dateRange?.from ? (
                dateRange.to ?
                  `${format(dateRange.from, 'dd MMM y', { locale: ru })} - ${format(dateRange.to, 'dd MMM y', { locale: ru })}` :
                  format(dateRange.from, 'dd MMM y', { locale: ru })
              ) : (
                <span>Выберите дату</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={ru}
            />
          </PopoverContent>
        </Popover>
        {/* Кнопка сброса диапазона дат */}
        {dateRange?.from && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onResetDateRange}
                  className="h-9 w-9 md:h-10 md:w-10 text-muted-foreground"
                  disabled={isLoading || isProcessingAction}
                  aria-label="Сбросить фильтр по дате"
                >
                  <XCircle className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Сбросить фильтр по дате</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Кнопки действий */}
      <div className="flex w-full sm:w-auto justify-end gap-2">
        {/* Кнопка обновления */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onRefresh} className={cn("h-9 w-9 md:h-10 md:w-10 text-muted-foreground", (isLoading || isProcessingAction) && "animate-spin")} disabled={isLoading || isProcessingAction}>
                <RefreshCw className="h-4 w-4 md:h-5 md:w-5" />
                <span className="sr-only">Обновить историю</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Обновить историю из Google Sheets</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* Кнопка перехода к Google Таблице */}
        <Button
          asChild
          size="sm"
          className="h-9 md:h-10 text-xs md:text-sm px-3"
          disabled={isLoading || isProcessingAction || !isSheetLinkAvailable}
        >
          <a href={googleSheetHistoryUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Открыть таблицу
          </a>
        </Button>
        {/* Кнопка и диалог очистки истории */}
        <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 md:h-10 text-xs md:text-sm px-3"
              disabled={ordersCount === 0 || isLoading || isProcessingAction}
              onClick={onInitiateClearAllOrders}
            >
              <Trash className="mr-1.5 h-3.5 w-3.5" /> Удалить историю
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие необратимо. Вся история продаж ({ordersCount} записей) будет удалена навсегда из Google Sheets (кроме заголовка).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancelClearAllOrders} className="text-xs px-3 h-9" disabled={isProcessingAction}>
                Отмена
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirmClearAllOrders}
                className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}
                disabled={isProcessingAction}
              >
                {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isProcessingAction ? "Удаление..." : "Очистить историю"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
