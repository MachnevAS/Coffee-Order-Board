

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
type SortConfig = { key: SortKey; direction: SortDirection } | null;
const DEFAULT_SORT: SortConfig = null; // Default sort implies newest first (handled in useMemo)

// Helper for formatting currency
const formatCurrency = (amount: number) => `${amount.toFixed(0)} ₽`;

// Helper for getting payment method icon - Memoized
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

// Helper for getting sort icon - Memoized
const SortIcon = React.memo(({ sortKey, currentSortConfig }: { sortKey: SortKey; currentSortConfig: SortConfig }) => {
  if (!currentSortConfig || currentSortConfig.key !== sortKey) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
  }
  // Use Tailwind classes for rotation for better performance than inline style transform
  return <ArrowUpDown className={cn("ml-1 h-3 w-3 text-foreground", currentSortConfig.direction === 'desc' && 'rotate-180')} />;
});
SortIcon.displayName = 'SortIcon';


export function SalesHistory() {
  // --- States ---
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);
  const [isClient, setIsClient] = useState(false);
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null); // State for confirmation dialog

  // --- Hooks ---
  const { toast } = useToast();

  // --- Effects ---

  // Load initial state from localStorage and set up listener
  useEffect(() => {
    setIsClient(true); // Indicate component has mounted client-side

    let loadedOrders: Order[] = [];
    let loadedSortConfig: SortConfig = DEFAULT_SORT;

    try {
      // Load orders
      const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (storedOrders) {
        try {
          const parsedOrders = JSON.parse(storedOrders);
          // Basic validation
          if (Array.isArray(parsedOrders) && parsedOrders.every(o => typeof o.id === 'string' && typeof o.timestamp === 'string')) {
            loadedOrders = parsedOrders;
          } else {
            console.error('SalesHistory: Parsed orders is not a valid array or structure.', parsedOrders);
            localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY); // Clear invalid data
          }
        } catch (e) {
          console.error('SalesHistory: Failed to parse orders from localStorage', e);
          localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY);
        }
      }

      // Load sort config
      const storedSortConfig = localStorage.getItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
      if (storedSortConfig) {
        try {
          const parsedSortConfig = JSON.parse(storedSortConfig);
          // Basic validation
          if (parsedSortConfig && ['timestamp', 'totalPrice', 'paymentMethod'].includes(parsedSortConfig.key) && ['asc', 'desc'].includes(parsedSortConfig.direction)) {
            loadedSortConfig = parsedSortConfig;
          } else {
            console.warn("SalesHistory: Invalid sort config found in localStorage, using default.");
            localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
          }
        } catch (e) {
          console.error("SalesHistory: Failed to parse sort config from localStorage.", e);
          localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY);
        }
      }
    } catch (lsError) {
      console.error("SalesHistory: Error accessing localStorage for initial load:", lsError);
      // Don't toast here as it might happen during SSR/initial hydration attempts
    }

    setOrders(loadedOrders);
    setSortConfig(loadedSortConfig);

    // Listener for storage changes (e.g., new order added)
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
          // Update state only if data changed
          setOrders(prevOrders => JSON.stringify(prevOrders) !== JSON.stringify(updatedOrders) ? updatedOrders : prevOrders);
        } catch (e) {
          console.error("SalesHistory: Error processing order storage event:", e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // Empty dependency array ensures this runs only once on mount


  // Persist sortConfig to localStorage whenever it changes
  useEffect(() => {
    if (isClient) { // Only run on client
      try {
        if (sortConfig) {
          localStorage.setItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY, JSON.stringify(sortConfig));
        } else {
          localStorage.removeItem(LOCAL_STORAGE_SALES_HISTORY_SORT_KEY); // Remove if default
        }
      } catch (e) {
        console.error("SalesHistory: Failed to save/remove sort config in localStorage", e);
        // Consider if a toast is appropriate here, maybe only if frequent errors
      }
    }
  }, [sortConfig, isClient]); // Depend on sortConfig and isClient


  // --- Memoized calculations ---

  // Filter and sort orders based on date range and sort config
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    // Filter by date range
    if (dateRange?.from) {
      const start = startOfDay(dateRange.from);
      // If only 'from' date is selected, filter for that single day
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      filtered = filtered.filter((order) => {
        try {
          const orderDate = parseISO(order.timestamp);
          return isValid(orderDate) && orderDate >= start && orderDate <= end;
        } catch (e) {
          console.error("SalesHistory: Error parsing order timestamp:", order.timestamp, e);
          return false; // Exclude orders with invalid timestamps
        }
      });
    }

    // Sort based on sortConfig
    if (sortConfig) {
      filtered.sort((a, b) => {
        const { key, direction } = sortConfig;
        let comparison = 0;

        // Use a switch for clarity and potential type safety
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
            default:
                // Should not happen with defined SortKey type
                console.warn(`SalesHistory: Unknown sort key "${key}"`);
                break;
        }

        return direction === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort: newest first if no sortConfig is set
      filtered.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
    }

    return filtered;
  }, [orders, dateRange, sortConfig]); // Dependencies: orders, dateRange, sortConfig


  // --- Event Handlers (useCallback) ---

  // Export filtered/sorted data to Excel
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
    // Set column widths (adjust as needed)
    worksheet['!cols'] = [ { wch: 25 }, { wch: 20 }, { wch: 60 }, { wch: 15 }, { wch: 15 } ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История Продаж');

    const fromDateStr = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'начала';
    const toDateStr = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : (dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'конца');
    const filename = `История_продаж_${fromDateStr}_${toDateStr}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }, [isClient, filteredAndSortedOrders, dateRange]); // Dependencies for export


  // Initiate deleting a single order (opens confirmation)
  const initiateDeleteOrder = useCallback((order: Order) => {
    setOrderToDelete(order);
  }, []);

  // Confirm deletion of a single order
  const confirmDeleteOrder = useCallback(() => {
    if (!orderToDelete) return;
    const orderIdToDelete = orderToDelete.id;
    // Optimistic update: Remove order from state immediately
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderIdToDelete));
    setOrderToDelete(null); // Close dialog
    toast({ title: "Заказ удален", description: `Заказ ${orderIdToDelete} был успешно удален.`, variant: "destructive" });
    // Note: No rollback here, assuming localStorage delete is reliable.
    // Could add try-catch around localStorage update if needed.
    try {
        localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders.filter(order => order.id !== orderIdToDelete)));
        // Optionally trigger storage event for other components if needed, though direct state update handles this component
        // window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_STORAGE_ORDERS_KEY, newValue: JSON.stringify(orders.filter(order => order.id !== orderIdToDelete)), storageArea: localStorage }));
    } catch (e) {
        console.error("SalesHistory: Failed to update localStorage after deleting order", e);
        toast({ title: "Ошибка сохранения", description: "Не удалось обновить историю в localStorage.", variant: "destructive" });
        // Consider reloading orders from localStorage as a fallback
    }
  }, [orderToDelete, toast, orders]); // Include orders in dependencies for localStorage update

  // Cancel deletion of a single order
  const cancelDeleteOrder = useCallback(() => {
    setOrderToDelete(null);
  }, []);


  // Clear all orders (opens confirmation)
  const initiateClearAllOrders = useCallback(() => {
      setIsClearHistoryDialogOpen(true);
  }, []);

  // Confirm clearing all orders
  const confirmClearAllOrders = useCallback(() => {
    setOrders([]); // Clear state
    setIsClearHistoryDialogOpen(false); // Close dialog
    try {
        localStorage.removeItem(LOCAL_STORAGE_ORDERS_KEY); // Clear storage
        // Optionally trigger storage event
        // window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_STORAGE_ORDERS_KEY, newValue: null, storageArea: localStorage }));
    } catch (e) {
         console.error("SalesHistory: Failed to clear localStorage", e);
         toast({ title: "Ошибка очистки хранилища", description: "Не удалось очистить localStorage.", variant: "destructive" });
    }
    toast({ title: "История очищена", description: "Вся история продаж была удалена.", variant: "destructive" });
  }, [toast]);

  // Cancel clearing all orders
  const cancelClearAllOrders = useCallback(() => {
     setIsClearHistoryDialogOpen(false);
  }, []);


  // Request sorting change
  const requestSort = useCallback((key: SortKey) => {
    setSortConfig(prevConfig => {
        let direction: SortDirection = 'asc';
        // Cycle through states: default -> asc -> desc -> default (null)
        if (prevConfig?.key === key) {
            if (prevConfig.direction === 'asc') {
                direction = 'desc';
            } else {
                return null; // Reset to default (null)
            }
        }
        return { key, direction };
    });
  }, []);


  // --- SSR Loading State ---
  if (!isClient) {
    // Render minimal skeleton or null for SSR
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
            {/* Use initiateClearAllOrders to trigger dialog */}
            <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
              <AlertDialogTrigger asChild>
                 <Button variant="destructive" size="sm" className="h-9 md:h-10 text-xs md:text-sm px-3" disabled={orders.length === 0}>
                    <Trash className="mr-1.5 h-3.5 w-3.5" /> Удалить историю
                 </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>Это действие необратимо. Вся история продаж ({orders.length} записей) будет удалена навсегда.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={cancelClearAllOrders} className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmClearAllOrders} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Очистить историю</AlertDialogAction>
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
                 {/* Use SortIcon component */}
                <TableHead className="w-[100px] md:w-[150px] hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap" onClick={() => requestSort('timestamp')}>
                  <div className="flex items-center">Дата <SortIcon sortKey="timestamp" currentSortConfig={sortConfig} /></div>
                </TableHead>
                <TableHead className="text-xs md:text-sm px-2 md:px-4 whitespace-nowrap">Товары</TableHead>
                <TableHead className="w-[90px] md:w-[110px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap" onClick={() => requestSort('paymentMethod')}>
                  <div className="flex items-center">Оплата <SortIcon sortKey="paymentMethod" currentSortConfig={sortConfig} /></div>
                </TableHead>
                <TableHead className="text-right w-[80px] md:w-[100px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50 whitespace-nowrap" onClick={() => requestSort('totalPrice')}>
                  <div className="flex items-center justify-end">Итого <SortIcon sortKey="totalPrice" currentSortConfig={sortConfig} /></div>
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
                          <div key={`${order.id}-${item.id}-${index}`} className="flex items-center text-xs md:text-sm leading-snug whitespace-nowrap"> {/* Improved key */}
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
                    <TableCell className="text-right text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap font-sans"> {/* Added font-sans */}
                      {formatCurrency(order.totalPrice)}
                    </TableCell>
                    <TableCell className="text-right px-2 md:px-4 py-2 md:py-3 align-top whitespace-nowrap">
                      {/* Use initiateDeleteOrder to trigger dialog */}
                      <AlertDialog open={orderToDelete?.id === order.id} onOpenChange={(isOpen) => !isOpen && cancelDeleteOrder()}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => initiateDeleteOrder(order)}>
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            <span className="sr-only">Удалить заказ {order.id}</span>
                          </Button>
                        </AlertDialogTrigger>
                        {/* Render content only when this specific order is selected */}
                        {orderToDelete?.id === order.id && (
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Заказ от {format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })} на сумму {formatCurrency(order.totalPrice)} ({order.paymentMethod || 'Н/У'}) будет удален.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={cancelDeleteOrder} className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                              <AlertDialogAction onClick={confirmDeleteOrder} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Удалить</AlertDialogAction>
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
