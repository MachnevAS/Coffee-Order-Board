
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
import { Calendar as CalendarIcon, ExternalLink, Trash2, CreditCard, Banknote, Smartphone, Trash, ArrowUpDown, RefreshCw } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isValid as isValidDate } from 'date-fns';
import { ru } from 'date-fns/locale';
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
import { fetchOrdersFromSheet, deleteOrderFromSheet, clearAllOrdersFromSheet } from '@/services/google-sheets-service'; // Import sheet service functions
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const GOOGLE_SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID;
const GOOGLE_HISTORY_SHEET_NAME = process.env.NEXT_PUBLIC_GOOGLE_HISTORY_SHEET_NAME || process.env.GOOGLE_HISTORY_SHEET_NAME;

const getSheetUrlFragment = (sheetNameOrGid: string | undefined) => {
  if (!sheetNameOrGid) return '';
  if (/^\d+$/.test(sheetNameOrGid)) {
    return `gid=${sheetNameOrGid}`;
  }
  return `gid=${encodeURIComponent(sheetNameOrGid)}`; 
};


const googleSheetHistoryUrl = GOOGLE_SHEET_ID && GOOGLE_HISTORY_SHEET_NAME
  ? `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit#${getSheetUrlFragment(GOOGLE_HISTORY_SHEET_NAME)}`
  : '#';


type SortKey = 'timestamp' | 'totalPrice' | 'paymentMethod' | 'employee';
type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection } | null;
const DEFAULT_SORT: SortConfig = { key: 'timestamp', direction: 'desc' }; 

const formatCurrency = (amount: number) => `${amount.toFixed(0)} ₽`;

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

const SortIcon = React.memo(({ sortKey, currentSortConfig }: { sortKey: SortKey; currentSortConfig: SortConfig }) => {
  if (!currentSortConfig || currentSortConfig.key !== sortKey) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
  }
  return <ArrowUpDown className={cn("ml-1 h-3 w-3 text-foreground", currentSortConfig.direction === 'desc' && 'rotate-180')} />;
});
SortIcon.displayName = 'SortIcon';

// Helper to parse timestamp for sorting
const parseTimestampForSort = (timestamp: string): Date | null => {
    if (typeof timestamp === 'string') {
        // Attempt to parse 'dd.MM.yyyy HH:mm:ss'
        if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
            const parts = timestamp.split(' ');
            const dateParts = parts[0].split('.');
            const timeParts = parts[1].split(':');
            const date = new Date(
                Number(dateParts[2]),
                Number(dateParts[1]) - 1, // Month is 0-indexed
                Number(dateParts[0]),
                Number(timeParts[0]),
                Number(timeParts[1]),
                Number(timeParts[2])
            );
            return isValidDate(date) ? date : null;
        }
        // Attempt to parse ISO string
        const isoDate = parseISO(timestamp);
        return isValidDate(isoDate) ? isoDate : null;
    }
    return null;
};


export function SalesHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);
  const [isClient, setIsClient] = useState(false);
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);


  const { toast } = useToast();

  const loadOrders = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    setErrorLoading(null);
    try {
      const fetchedOrders = await fetchOrdersFromSheet();
      setOrders(fetchedOrders);
    } catch (error: any) {
      console.error("SalesHistory: Failed to load orders from sheet:", error);
      const errorMessage = error.message || "Не удалось загрузить историю продаж из Google Sheets.";
      setErrorLoading(errorMessage);
      toast({
        title: "Ошибка загрузки истории",
        description: errorMessage,
        variant: "destructive",
      });
      setOrders([]);
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setIsClient(true);
    loadOrders();
  }, [loadOrders]);

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    if (dateRange?.from) {
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      filtered = filtered.filter((order) => {
        const orderDate = parseTimestampForSort(order.timestamp);
        return orderDate && orderDate >= start && orderDate <= end;
      });
    }

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
                } else if (dateA) {
                    comparison = -1; // a comes first if b is invalid
                } else if (dateB) {
                    comparison = 1;  // b comes first if a is invalid
                }
            }
            break;
          case 'paymentMethod':
            comparison = (a.paymentMethod || '').localeCompare(b.paymentMethod || '', ru.code);
            break;
          case 'totalPrice':
            comparison = a.totalPrice - b.totalPrice;
            break;
          case 'employee':
            comparison = (a.employee || '').localeCompare(b.employee || '', ru.code);
            break;
        }
        return direction === 'asc' ? comparison : -comparison;
      });
    }
    return filtered;
  }, [orders, dateRange, sortConfig]);


  const initiateDeleteOrder = useCallback((order: Order) => {
    if (isLoading) return;
    setOrderToDelete(order);
  }, [isLoading]);

  const confirmDeleteOrder = useCallback(async () => {
    if (!orderToDelete || isLoading) return;
    
    const orderIdToDelete = orderToDelete.id;
    setIsLoading(true); 
    const success = await deleteOrderFromSheet(orderIdToDelete);
    setOrderToDelete(null);
    
    if (success) {
      await loadOrders(false); 
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
    setIsLoading(false);
  }, [orderToDelete, toast, loadOrders, isLoading]);

  const cancelDeleteOrder = useCallback(() => {
    setOrderToDelete(null);
  }, []);

  const initiateClearAllOrders = useCallback(() => {
     if (isLoading) return;
    setIsClearHistoryDialogOpen(true);
  }, [isLoading]);

  const confirmClearAllOrders = useCallback(async () => {
    if (isLoading) return;
    setIsClearHistoryDialogOpen(false);
    setIsLoading(true);
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
    setIsLoading(false);
  }, [toast, loadOrders, isLoading]);

  const cancelClearAllOrders = useCallback(() => {
    setIsClearHistoryDialogOpen(false);
  }, []);

  const requestSort = useCallback((key: SortKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig?.key === key) {
        if (prevConfig.direction === 'asc') return { key, direction: 'desc' };
        if (prevConfig.direction === 'desc') return DEFAULT_SORT; 
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const handleRefresh = useCallback(async () => {
      if (isLoading) return;
      await loadOrders(true);
      if (!errorLoading) {
         toast({ title: "История обновлена", description: "Данные загружены из Google Sheets." });
      }
  }, [loadOrders, toast, isLoading, errorLoading]);


  if (!isClient) {
    return (
      <Card>
        <CardHeader><CardTitle>История продаж</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Загрузка истории...</p></CardContent>
      </Card>
    );
  }
  
  const formatDisplayDate = (timestamp: string) => {
    // If it's already in 'dd.MM.yyyy HH:mm:ss', just return it
    if (typeof timestamp === 'string' && /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
      return timestamp;
    }
    // Otherwise, try to parse as ISO and format
    try {
      const date = parseISO(timestamp);
      if (isValidDate(date)) {
        return format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru });
      }
    } catch (e) {
      // Fallback for other string formats or invalid dates
    }
    console.warn("Failed to format date for display, returning original:", timestamp);
    return timestamp;
  };


  return (
    <Card className="shadow-md">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">История продаж</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 md:gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal text-xs md:text-sm h-9 md:h-10 px-3" disabled={isLoading}>
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
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleRefresh} className={cn("h-9 w-9 md:h-10 md:w-10 text-muted-foreground", isLoading && "animate-spin")} disabled={isLoading}>
                            <RefreshCw className="h-4 w-4 md:h-5 md:w-5" />
                            <span className="sr-only">Обновить историю</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Обновить историю из Google Sheets</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button 
              asChild
              size="sm" 
              className="h-9 md:h-10 text-xs md:text-sm px-3"
              disabled={isLoading || !GOOGLE_SHEET_ID || !GOOGLE_HISTORY_SHEET_NAME}
            >
              <a href={googleSheetHistoryUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Открыть таблицу
              </a>
            </Button>
            
            <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-9 md:h-10 text-xs md:text-sm px-3" 
                  disabled={orders.length === 0 || isLoading}
                >
                  <Trash className="mr-1.5 h-3.5 w-3.5" /> Удалить историю
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие необратимо. Вся история продаж ({orders.length} записей) будет удалена навсегда из Google Sheets.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={cancelClearAllOrders} className="text-xs px-3 h-9" disabled={isLoading}>
                    Отмена
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={confirmClearAllOrders} 
                    className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}
                    disabled={isLoading}
                  >
                    {isLoading ? "Удаление..." : "Очистить историю"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {errorLoading && !isLoading && (
            <p className="text-destructive text-center py-4">Ошибка загрузки: {errorLoading}</p>
        )}

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
             {isLoading && filteredAndSortedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                    Загрузка истории...
                  </TableCell>
                </TableRow>
              ) : !isLoading && errorLoading ? (
                 <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive py-6 md:py-8 text-sm">
                    Ошибка загрузки истории. Попробуйте обновить.
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                    {orders.length === 0 ? "История продаж пуста." : "Нет заказов за выбранный период."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                       {formatDisplayDate(order.timestamp)}
                    </TableCell>
                    <TableCell className="px-2 md:px-4 py-2 md:py-3 align-top min-w-[150px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="sm:hidden text-[10px] text-muted-foreground mb-1 whitespace-nowrap">
                          {formatDisplayDate(order.timestamp)}
                        </div>
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
                            disabled={isLoading}
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
                              <AlertDialogCancel onClick={cancelDeleteOrder} className="text-xs px-3 h-9" disabled={isLoading}>
                                Отмена
                              </AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={confirmDeleteOrder} 
                                className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}
                                disabled={isLoading}
                              >
                                {isLoading ? "Удаление..." : "Удалить"}
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

