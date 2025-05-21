/**
 * @file Компонент таблицы истории продаж.
 * Отображает данные о заказах в табличном виде с возможностью сортировки и удаления отдельных заказов.
 */
"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { Order, PaymentMethod } from '@/types/order';
import { Badge } from '@/components/ui/badge';
import { Trash2, CreditCard, Banknote, Smartphone, ArrowUpDown, Loader2 } from 'lucide-react'; // Added Loader2
import { cn } from '@/lib/utils';
import type { SortConfigSales, SortKeySales } from './sales-history-types';

/**
 * Вспомогательный компонент для отображения иконки способа оплаты.
 * @param props - Свойства компонента.
 * @returns JSX элемент иконки.
 */
const PaymentMethodIcon: React.FC<{ method: PaymentMethod | undefined }> = React.memo(({ method }) => {
  const iconSize = "h-3.5 w-3.5 md:h-4 md:w-4";
  switch (method) {
    case 'Наличные': return <Banknote className={cn(iconSize, "text-green-600")} />;
    case 'Карта': return <CreditCard className={cn(iconSize, "text-blue-600")} />;
    case 'Перевод': return <Smartphone className={cn(iconSize, "text-purple-600")} />;
    default: return null;
  }
});
PaymentMethodIcon.displayName = 'PaymentMethodIcon';

/**
 * Вспомогательный компонент для отображения иконки сортировки.
 * @param props - Свойства компонента.
 * @returns JSX элемент иконки сортировки.
 */
const SortIcon: React.FC<{ sortKey: SortKeySales; currentSortConfig: SortConfigSales }> = React.memo(({ sortKey, currentSortConfig }) => {
  if (!currentSortConfig || currentSortConfig.key !== sortKey) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
  }
  return <ArrowUpDown className={cn("ml-1 h-3 w-3 text-foreground", currentSortConfig.direction === 'desc' && 'rotate-180')} />;
});
SortIcon.displayName = 'SortIcon';

/**
 * Свойства компонента SalesHistoryTable.
 */
interface SalesHistoryTableProps {
  /** Отфильтрованные и отсортированные заказы для отображения. */
  orders: Order[];
  /** Текущая конфигурация сортировки. */
  sortConfig: SortConfigSales;
  /** Функция для запроса сортировки по ключу. */
  requestSort: (key: SortKeySales) => void;
  /** ID заказа, выбранного для удаления, или null. */
  orderToDelete: Order | null;
  /** Функция для инициации удаления заказа. */
  initiateDeleteOrder: (order: Order) => void;
  /** Функция для отмены удаления заказа. */
  cancelDeleteOrder: () => void;
  /** Функция для подтверждения удаления заказа. */
  confirmDeleteOrder: () => Promise<void>;
  /** Флаг, указывающий, идет ли загрузка данных. */
  isLoading: boolean;
  /** Флаг, указывающий, идет ли обработка действия (удаление). */
  isProcessingAction: boolean;
  /** Сообщение об ошибке загрузки. */
  errorLoading: string | null;
  /** Функция для форматирования отображаемой даты. */
  formatDisplayDate: (timestamp: string) => string;
  /** Функция для форматирования валюты. */
  formatCurrency: (amount: number) => string;
}

/**
 * Компонент таблицы истории продаж.
 * @param props - Свойства компонента.
 * @returns JSX элемент таблицы.
 */
export const SalesHistoryTable: React.FC<SalesHistoryTableProps> = ({
  orders,
  sortConfig,
  requestSort,
  orderToDelete,
  initiateDeleteOrder,
  cancelDeleteOrder,
  confirmDeleteOrder,
  isLoading,
  isProcessingAction,
  errorLoading,
  formatDisplayDate,
  formatCurrency,
}) => {
  return (
    <ScrollArea className="h-[400px] md:h-[500px] w-full border rounded-md">
      <Table>
        <TableHeader className="sticky top-0 bg-background shadow-sm z-10">
          <TableRow>
            {/* Заголовки столбцов с возможностью сортировки */}
            <TableHead
              className="w-[100px] md:w-[150px] hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap"
              onClick={() => requestSort('timestamp')}
            >
              <div className="flex items-center">
                Дата <SortIcon sortKey="timestamp" currentSortConfig={sortConfig} />
              </div>
            </TableHead>
            <TableHead className="text-xs md:text-sm px-2 md:px-4 whitespace-nowrap">
              Товары
            </TableHead>
            <TableHead
              className="w-[120px] md:w-[180px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap"
              onClick={() => requestSort('employee')}
            >
              <div className="flex items-center">
                Сотрудник <SortIcon sortKey="employee" currentSortConfig={sortConfig} />
              </div>
            </TableHead>
            <TableHead
              className="w-[90px] md:w-[110px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap"
              onClick={() => requestSort('paymentMethod')}
            >
              <div className="flex items-center">
                Оплата <SortIcon sortKey="paymentMethod" currentSortConfig={sortConfig} />
              </div>
            </TableHead>
            <TableHead
              className="text-right w-[80px] md:w-[100px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap"
              onClick={() => requestSort('totalPrice')}
            >
              <div className="flex items-center justify-end">
                Итого <SortIcon sortKey="totalPrice" currentSortConfig={sortConfig} />
              </div>
            </TableHead>
            <TableHead className="text-right w-[40px] md:w-[60px] px-2 md:px-4 whitespace-nowrap"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Отображение состояния загрузки, ошибки или отсутствия данных */}
          {(isLoading && !isProcessingAction) && orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="mt-2">Загрузка истории...</p>
                </div>
              </TableCell>
            </TableRow>
          ) : !isLoading && errorLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-destructive py-6 md:py-8 text-sm">
                Ошибка загрузки истории. Попробуйте обновить.
              </TableCell>
            </TableRow>
          ) : orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                {errorLoading ? "Ошибка загрузки." : (orders.length === 0 && !isLoading ? "История продаж пуста." : "Нет заказов за выбранный период.")}
              </TableCell>
            </TableRow>
          ) : (
            // Рендеринг строк таблицы с данными заказов
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                  {formatDisplayDate(order.timestamp)}
                </TableCell>
                <TableCell className="px-2 md:px-4 py-2 md:py-3 align-top min-w-[150px]">
                  <div className="flex flex-col gap-0.5">
                    {/* Отображение даты для мобильных устройств */}
                    <div className="sm:hidden text-[10px] text-muted-foreground mb-1 whitespace-nowrap">
                      {formatDisplayDate(order.timestamp)}
                    </div>
                    {/* Список товаров в заказе */}
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${item.id}-${index}`} className="flex items-center text-xs md:text-sm leading-snug whitespace-nowrap">
                        {item.name}
                        {item.volume && <span className="text-muted-foreground ml-1">({item.volume})</span>}
                        <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[9px] md:text-[10px] h-4">
                          x{item.quantity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-normal break-words max-w-[180px]">
                  {order.employee || 'Н/У'}
                </TableCell>
                <TableCell className="text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                  <div className="flex items-center gap-1 md:gap-1.5">
                    <PaymentMethodIcon method={order.paymentMethod} />
                    <span className="hidden md:inline">{order.paymentMethod || 'Н/У'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap font-sans">
                  {formatCurrency(order.totalPrice)}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                  {/* Диалог подтверждения удаления заказа */}
                  <AlertDialog
                    open={orderToDelete?.id === order.id}
                    onOpenChange={(isOpen) => !isOpen && cancelDeleteOrder()}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 md:h-8 md:w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => initiateDeleteOrder(order)}
                        disabled={isLoading || isProcessingAction}
                      >
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span className="sr-only">Удалить заказ {order.id}</span>
                      </Button>
                    </AlertDialogTrigger>
                    {orderToDelete?.id === order.id && (
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Заказ от {formatDisplayDate(order.timestamp)} на сумму {formatCurrency(order.totalPrice)} ({order.paymentMethod || 'Н/У'}) будет удален.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={cancelDeleteOrder} className="text-xs px-3 h-9" disabled={isProcessingAction}>
                            Отмена
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={confirmDeleteOrder}
                            className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}
                            disabled={isProcessingAction}
                          >
                             {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isProcessingAction ? "Удаление..." : "Удалить"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    )}
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" /> {/* Горизонтальная прокрутка для таблицы */}
    </ScrollArea>
  );
};
