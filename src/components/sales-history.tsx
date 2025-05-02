

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
import type { Order, SalesHistoryItem, PaymentMethod } from '@/types/order';
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
type SortConfig = { key: SortKey; direction: SortDirection } | null; // Allow null for default sort
const DEFAULT_SORT: SortConfig = null; // Explicitly define default sort (newest first implied)

// Helper for formatting currency
const formatCurrency = (amount: number) => `${amount.toFixed(0)} ₽`;

// Helper for getting payment method icon
const PaymentMethodIcon = ({ method }: { method: PaymentMethod | undefined }) => {
  const iconSize = "h-3.5 w-3.5 md:h-4 md:w-4";
  switch (method) {
    case 'Наличные': return <Banknote className={cn(iconSize, "text-green-600")} />;
    case 'Карта': return <CreditCard className={cn(iconSize, "text-blue-600")} />;
    case 'Перевод': return <Smartphone className={cn(iconSize, "text-purple-600")} />;
    default: return null;
  }
};

// Helper for getting sort icon
const getSortIcon = (key: SortKey, currentSortConfig: SortConfig) => {
  if (!currentSortConfig || currentSortConfig.key !== key) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
  }
  return currentSortConfig.direction === 'asc'
    ? <ArrowUpDown className="ml-1 h-3 w-3 transform rotate-0 text-foreground" />
    : <ArrowUpDown className="ml-1 h-3 w-3 transform rotate-180 text-foreground" />;
};


export function SalesHistory() {
  // --- States ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);
  const [isClient, setIsClient] = useState(false);
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);

  // --- Hooks ---
  const { toast } = useToast();

  // --- Effects ---

  // Initialize client state and load data
  useEffect(() => {
    setIsClient(true);
    let loadedOrders: Order[] = [];
    let loadedSortConfig: SortConfig = DEFAULT_SORT;

    try {
      const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (storedOrders) {
        try {
          const parsedOrders = JSON.parse(storedOrders);
          if (Array.isArray(parsedOrders) && parsedOrders.every(o => typeof o.id === 'string' && typeof o.timestamp === 'string')) {
            loadedOrders = parsedOrders;
          } else {
            console.error('Parsed orders is not a valid array or structure:', parsedOrders);
            localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
          }
        } catch (e) {
          console.error('Failed to parse orders from localStorage', e);
          localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
        }
      }

      const storedSortConfig = localStorage.getItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
      if (storedSortConfig) {
        try {
          const parsedSortConfig = JSON.parse(storedSortConfig);
          if (parsedSortConfig && ['timestamp', 'totalPrice', 'paymentMethod'].includes(parsedSortConfig.key) && ['asc', 'desc'].includes(parsedSortConfig.direction)) {
            loadedSortConfig = parsedSortConfig;
          } else {
            console.warn("SalesHistory: Invalid sort config found in localStorage, using default.");
            localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY); // Remove invalid item
          }
        } catch (e) {
          console.error("SalesHistory: Failed to parse sort config from localStorage.", e);
          localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY); // Remove invalid item
        }
      }
    } catch (lsError) {
      console.error("Error accessing localStorage for initial load:", lsError);
      toast({ title: "Ошибка LocalStorage", description: "Не удалось загрузить данные.", variant: "destructive" });
    }

    setOrders(loadedOrders);
    setSortConfig(loadedSortConfig);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ORDERS_KEY) {
        let updatedOrders: Order[] = [];
        try {
          if (event.newValue) {
            const parsed = JSON.parse(event.newValue);
            if (Array.isArray(parsed) && parsed.every(o => typeof o.id === 'string' && typeof o.timestamp === 'string')) {
              updatedOrders = parsed;
            } else {
              console.warn("SalesHistory: Invalid order data received from storage event.");
            }
          }
        } catch (e) {
          console.error("SalesHistory: Error processing order storage event:", e);
        }
        setOrders(updatedOrders);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [toast]);


  // Persist orders to localStorage
  useEffect(() => {
    if (isClient) {
      try {
        const currentStoredValue = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
        const newOrdersJson = JSON.stringify(orders);
        if (currentStoredValue !== newOrdersJson) {
          localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, newOrdersJson);
          window.dispatchEvent(new StorageEvent('storage', {
            key: LOCAL_STORAGE_ORDERS_KEY,
            newValue: newOrdersJson,
            oldValue: currentStoredValue,
            storageArea: localStorage,
          }));
        }
      } catch (e) {
        console.error("SalesHistory: Failed to save orders to localStorage", e);
        toast({ title: "Ошибка сохранения", description: "Не удалось обновить историю заказов.", variant: "destructive" });
      }
    }
  }, [orders, isClient, toast]);


  // Persist sortConfig to localStorage
  useEffect(() => {
    if (isClient) {
      try {
        if (sortConfig) {
          localStorage.setItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY, JSON.stringify(sortConfig));
        } else {
          // Remove the key if sortConfig is reset to null (default)
          localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
        }
      } catch (e) {
        console.error("SalesHistory: Failed to save/remove sort config in localStorage", e);
      }
    }
  }, [sortConfig, isClient]);


  // --- Memoized calculations ---

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    if (dateRange?.from) {
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      filtered = filtered.filter((order) => {
        try {
          const orderDate = parseISO(order.timestamp);
          return isValid(orderDate) && orderDate >= start && orderDate <= end;
        } catch (e) {
          console.error("Error parsing order timestamp:", order.timestamp, e);
          return false;
        }
      });
    }

    if (sortConfig) {
      filtered.sort((a, b) => {
        const { key, direction } = sortConfig;
        let aValue: string | number = a[key];
        let bValue: string | number = b[key];
        let comparison = 0;

        if (key === 'timestamp') {
          aValue = parseISO(a.timestamp).getTime();
          bValue = parseISO(b.timestamp).getTime();
          comparison = (aValue as number) - (bValue as number);
        } else if (key === 'paymentMethod') {
          comparison = (aValue as string).localeCompare(bValue as string, ru.code);
        } else { // totalPrice
          comparison = (aValue as number) - (bValue as number);
        }

        return direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort: newest first
      filtered.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    }

    return filtered;
  }, [orders, dateRange, sortConfig]);


  // --- Event Handlers ---

  const handleExport = useCallback(() => {
    if (!isClient) return;

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
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История Продаж');
    worksheet['!cols'] = [ { wch: 25 }, { wch: 20 }, { wch: 60 }, { wch: 15 }, { wch: 15 } ];

    const fromDateStr = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'начала';
    const toDateStr = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : (dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'конца');
    const filename = `История_продаж_кофе_${fromDateStr}_${toDateStr}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }, [isClient, filteredAndSortedOrders, dateRange]);

  const handleDeleteOrder = useCallback((orderId: string) => {
    if (!isClient) return;
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    toast({ title: "Заказ удален", description: `Заказ ${orderId} был успешно удален.`, variant: "destructive" });
  }, [isClient, toast]);

  const clearAllOrders = useCallback(() => {
    if (!isClient) return;
    setOrders([]);
    setIsClearHistoryDialogOpen(false);
    setTimeout(() => {
      toast({ title: "История очищена", description: "Вся история продаж была удалена.", variant: "destructive" });
    }, 0);
  }, [isClient, toast]);

  const requestSort = useCallback((key: SortKey) => {
    let direction: SortDirection = 'asc';
    let newSortConfig: SortConfig = null;

    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
      newSortConfig = { key, direction };
    } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      newSortConfig = null; // Reset to default (null) on third click
    } else {
      newSortConfig = { key, direction }; // First click or new column
    }
    setSortConfig(newSortConfig);
  }, [sortConfig]);


  // --- SSR Loading State ---
  if (!isClient) {
    return (
      <Card>
        <CardHeader><CardTitle>История продаж</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Загрузка истории...</p></CardContent>
      </Card>
    );
  }

  // --- Main Render Logic (Client-Side) ---
  return (
    <Card className="shadow-md">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl">История продаж</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {/* Controls: Date Picker & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 md:gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={'outline'} className="w-full sm:w-auto justify-start text-left font-normal text-xs md:text-sm h-9 md:h-10 px-3">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, 'dd MMM y', { locale: ru })} - ${format(dateRange.to, 'dd MMM y', { locale: ru })}` : format(dateRange.from, 'dd MMM y', { locale: ru })) : <span>Выберите дату</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ru} />
            </PopoverContent>
          </Popover>
          <div className="flex w-full sm:w-auto justify-end gap-2">
            <Button onClick={handleExport} disabled={filteredAndSortedOrders.length === 0} size="sm" className="h-9 md:h-10 text-xs md:text-sm px-3">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Выгрузить в Excel
            </Button>
            <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-9 md:h-10 text-xs md:text-sm px-3" disabled={orders.length === 0}>
                  <Trash className="mr-1.5 h-3.5 w-3.5" /> Удалить историю
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>Это действие необратимо. Вся история продаж будет удалена навсегда.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllOrders} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Очистить историю</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Sales Table */}
        <ScrollArea className="h-[400px] md:h-[500px] w-full border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background shadow-sm z-10">
              <TableRow>
                <TableHead className="w-[100px] md:w-[150px] hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap" onClick={() => requestSort('timestamp')}>
                  <div className="flex items-center">Дата {getSortIcon('timestamp', sortConfig)}</div>
                </TableHead>
                <TableHead className="text-xs md:text-sm px-2 md:px-4 whitespace-nowrap">Товары</TableHead>
                <TableHead className="w-[90px] md:w-[110px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap" onClick={() => requestSort('paymentMethod')}>
                  <div className="flex items-center">Оплата {getSortIcon('paymentMethod', sortConfig)}</div>
                </TableHead>
                <TableHead className="text-right w-[80px] md:w-[100px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap" onClick={() => requestSort('totalPrice')}>
                  <div className="flex items-center justify-end">Итого {getSortIcon('totalPrice', sortConfig)}</div>
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
                          <div key={index} className="flex items-center text-xs md:text-sm leading-snug whitespace-nowrap">
                            {item.name}
                            {item.volume && <span className="text-muted-foreground ml-1">({item.volume})</span>}
                            <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[9px] md:text-[10px] h-4">{item.quantity}</Badge>
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
                    <TableCell className="text-right text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                      {formatCurrency(order.totalPrice)}
                    </TableCell>
                    <TableCell className="text-right px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            <span className="sr-only">Удалить заказ {order.id}</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Заказ от {format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })} на сумму {formatCurrency(order.totalPrice)} ({order.paymentMethod || 'Н/У'}) будет удален.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Удалить</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
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
