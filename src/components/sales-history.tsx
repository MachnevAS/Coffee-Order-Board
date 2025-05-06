'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, Download, Trash2, CreditCard, Banknote, Smartphone, Trash, ArrowUpDown } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import type { DateRange } from 'react-day-picker';
import type { Order, PaymentMethod } from '@/types/order';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { LOCAL_STORAGE_ORDERS_KEY, LOCAL_STORAGE_SALES_HISTORY_SORT_KEY } from '@/lib/constants';

type SortKey = 'timestamp' | 'totalPrice' | 'paymentMethod';
type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection } | null;
const DEFAULT_SORT: SortConfig = null;

// Форматирование валюты
const formatCurrency = (amount: number) => `${amount.toFixed(0)} ₽`;

// Иконка способа оплаты
const PaymentMethodIcon = React.memo(({ method }: { method: PaymentMethod | undefined }) => {
  const iconSize = "h-3.5 w-3.5 md:h-4 md:w-4";
  switch (method) {
    case 'Наличные': return <Banknote className={cn(iconSize, "text-green-600")} />;
    case 'Карта': return <CreditCard className={cn(iconSize, "text-blue-600")} />;
    case 'Перевод': return <Smartphone className={cn(iconSize, "text-purple-600")} />;
    default: return null;
  }
});
PaymentMethodIcon.displayName = 'PaymentMethodIcon';

// Иконка сортировки
const SortIcon = React.memo(({ sortKey, currentSortConfig }: { sortKey: SortKey; currentSortConfig: SortConfig }) => {
  if (!currentSortConfig || currentSortConfig.key !== sortKey) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
  }
  return <ArrowUpDown className={cn("ml-1 h-3 w-3 text-foreground", currentSortConfig.direction === 'desc' && 'rotate-180')} />;
});
SortIcon.displayName = 'SortIcon';

export function SalesHistory() {
  // Состояния
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);
  const [isClient, setIsClient] = useState(false);
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const { toast } = useToast();

  // Загрузка данных из localStorage
  useEffect(() => {
    setIsClient(true);

    const loadFromLocalStorage = () => {
      try {
        // Загрузка заказов
        const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
        if (storedOrders) {
          try {
            const parsedOrders = JSON.parse(storedOrders);
            if (Array.isArray(parsedOrders) && parsedOrders.every(o => typeof o.id === 'string' && typeof o.timestamp === 'string')) {
              setOrders(parsedOrders);
            } else {
              console.error('SalesHistory: Parsed orders is not valid.', parsedOrders);
              localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
            }
          } catch (e) {
            console.error('SalesHistory: Failed to parse orders', e);
            localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
          }
        }

        // Загрузка конфигурации сортировки
        const storedSortConfig = localStorage.getItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
        if (storedSortConfig) {
          try {
            const parsedSortConfig = JSON.parse(storedSortConfig);
            if (parsedSortConfig && 
                ['timestamp', 'totalPrice', 'paymentMethod'].includes(parsedSortConfig.key) && 
                ['asc', 'desc'].includes(parsedSortConfig.direction)) {
              setSortConfig(parsedSortConfig);
            } else {
              localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
            }
          } catch (e) {
            console.error("SalesHistory: Failed to parse sort config", e);
            localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
          }
        }
      } catch (error) {
        console.error("SalesHistory: Error accessing localStorage:", error);
      }
    };

    loadFromLocalStorage();

    // Слушатель изменений в localStorage
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ORDERS_KEY && event.newValue !== null) {
        try {
          const updatedOrders = JSON.parse(event.newValue);
          if (Array.isArray(updatedOrders)) {
            setOrders(updatedOrders);
          }
        } catch (e) {
          console.error("Error processing storage event:", e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Сохранение конфигурации сортировки
  useEffect(() => {
    if (isClient) {
      try {
        if (sortConfig) {
          localStorage.setItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY, JSON.stringify(sortConfig));
        } else {
          localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
        }
      } catch (e) {
        console.error("Failed to save sort config:", e);
      }
    }
  }, [sortConfig, isClient]);

  // Фильтрация и сортировка заказов
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    // Фильтрация по диапазону дат
    if (dateRange?.from) {
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      filtered = filtered.filter((order) => {
        try {
          const orderDate = parseISO(order.timestamp);
          return isValid(orderDate) && orderDate >= start && orderDate <= end;
        } catch (e) {
          return false;
        }
      });
    }

    // Сортировка
    if (sortConfig) {
      filtered.sort((a, b) => {
        const { key, direction } = sortConfig;
        let comparison = 0;

        switch (key) {
          case 'timestamp':
            comparison = parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime();
            break;
          case 'paymentMethod':
            comparison = (a.paymentMethod || '').localeCompare(b.paymentMethod || '', ru.code);
            break;
          case 'totalPrice':
            comparison = a.totalPrice - b.totalPrice;
            break;
        }

        return direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // По умолчанию - сначала новые
      filtered.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    }

    return filtered;
  }, [orders, dateRange, sortConfig]);

  // Экспорт в Excel
  const handleExport = useCallback(() => {
    if (!isClient || filteredAndSortedOrders.length === 0) return;

    const dataToExport = filteredAndSortedOrders.map((order) => ({
      'ID Заказа': order.id,
      'Дата и время': format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: ru }),
      'Товары': order.items
        .map((item) => `${item.name}${item.volume ? ` (${item.volume})` : ''} (x${item.quantity})`)
        .join(', '),
      'Способ оплаты': order.paymentMethod || 'Не указан',
      'Итого (₽)': order.totalPrice.toFixed(0),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 60 }, { wch: 15 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История Продаж');

    const fromDateStr = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'начала';
    const toDateStr = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : (dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'конца');
    const filename = `История_продаж_${fromDateStr}_${toDateStr}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  }, [isClient, filteredAndSortedOrders, dateRange]);

  // Обработчики удаления заказа
  const initiateDeleteOrder = useCallback((order: Order) => {
    setOrderToDelete(order);
  }, []);

  const confirmDeleteOrder = useCallback(() => {
    if (!orderToDelete) return;
    
    const orderIdToDelete = orderToDelete.id;
    const updatedOrders = orders.filter(order => order.id !== orderIdToDelete);
    
    setOrders(updatedOrders);
    setOrderToDelete(null);
    
    try {
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(updatedOrders));
      toast({ 
        title: "Заказ удален", 
        description: `Заказ ${orderIdToDelete} был успешно удален.`, 
        variant: "destructive" 
      });
    } catch (e) {
      console.error("Failed to update localStorage after delete:", e);
      toast({ 
        title: "Ошибка сохранения", 
        description: "Не удалось обновить историю в localStorage.", 
        variant: "destructive" 
      });
    }
  }, [orderToDelete, orders, toast]);

  const cancelDeleteOrder = useCallback(() => {
    setOrderToDelete(null);
  }, []);

  // Обработчики очистки истории
  const initiateClearAllOrders = useCallback(() => {
    setIsClearHistoryDialogOpen(true);
  }, []);

  const confirmClearAllOrders = useCallback(() => {
    setOrders([]);
    setIsClearHistoryDialogOpen(false);
    
    try {
      localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
      toast({ 
        title: "История очищена", 
        description: "Вся история продаж была удалена.", 
        variant: "destructive" 
      });
    } catch (e) {
      console.error("Failed to clear localStorage:", e);
      toast({ 
        title: "Ошибка очистки хранилища", 
        description: "Не удалось очистить localStorage.", 
        variant: "destructive" 
      });
    }
  }, [toast]);

  const cancelClearAllOrders = useCallback(() => {
    setIsClearHistoryDialogOpen(false);
  }, []);

  // Обработчик изменения сортировки
  const requestSort = useCallback((key: SortKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig?.key === key) {
        if (prevConfig.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        return null; // Сброс сортировки
      }
      return { key, direction: 'asc' };
    });
  }, []);

  // Состояние загрузки при SSR
  if (!isClient) {
    return (
      <Card>
        <CardHeader><CardTitle>История продаж</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Загрузка истории...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">История продаж</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {/* Элементы управления */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 md:gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal text-xs md:text-sm h-9 md:h-10 px-3">
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
          
          <div className="flex w-full sm:w-auto justify-end gap-2">
            <Button 
              onClick={handleExport} 
              disabled={filteredAndSortedOrders.length === 0} 
              size="sm" 
              className="h-9 md:h-10 text-xs md:text-sm px-3"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Выгрузить в Excel
            </Button>
            
            <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-9 md:h-10 text-xs md:text-sm px-3" 
                  disabled={orders.length === 0}
                >
                  <Trash className="mr-1.5 h-3.5 w-3.5" /> Удалить историю
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие необратимо. Вся история продаж ({orders.length} записей) будет удалена навсегда.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={cancelClearAllOrders} className="text-xs px-3 h-9">
                    Отмена
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={confirmClearAllOrders} 
                    className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}
                  >
                    Очистить историю
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Таблица продаж */}
        <ScrollArea className="h-[400px] md:h-[500px] w-full border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background shadow-sm z-10">
              <TableRow>
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
              {filteredAndSortedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                    {orders.length === 0 ? "История продаж пуста." : "Нет заказов за выбранный период."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                      {format(parseISO(order.timestamp), 'dd.MM.yy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell className="px-2 md:px-4 py-2 md:py-3 align-top min-w-[150px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="sm:hidden text-[10px] text-muted-foreground mb-1 whitespace-nowrap">
                          {format(parseISO(order.timestamp), 'dd.MM.yy HH:mm', { locale: ru })}
                        </div>
                        {order.items.map((item, index) => (
                          <div key={`${order.id}-${item.id}-${index}`} className="flex items-center text-xs md:text-sm leading-snug whitespace-nowrap">
                            {item.name}
                            {item.volume && <span className="text-muted-foreground ml-1">({item.volume})</span>}
                            <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[9px] md:text-[10px] h-4">
                              {item.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
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
                                Заказ от {format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })} на сумму {formatCurrency(order.totalPrice)} ({order.paymentMethod || 'Н/У'}) будет удален.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={cancelDeleteOrder} className="text-xs px-3 h-9">
                                Отмена
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={confirmDeleteOrder} 
                                className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}
                              >
                                Удалить
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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
