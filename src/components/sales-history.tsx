

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
import { Calendar as CalendarIcon, Download, Trash2, CreditCard, Banknote, Smartphone, Trash, SlidersHorizontal, ArrowUpDown } from 'lucide-react'; // Added payment icons, Trash, and sorting icons
import { format, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import type { DateRange } from 'react-day-picker';
import type { Order, SalesHistoryItem, PaymentMethod } from '@/types/order'; // Import Order, SalesHistoryItem, PaymentMethod
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from "@/components/ui/alert-dialog"; // Added AlertDialog
import { useToast } from "@/hooks/use-toast"; // Added useToast
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components


type SortKey = 'timestamp' | 'totalPrice';
type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection }; // Explicit type
const SORT_STORAGE_KEY = 'salesHistorySortConfig'; // Key for localStorage

export function SalesHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null); // Use SortConfig type
  const [isClient, setIsClient] = useState(false);
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false); // State for clear history dialog
  const { toast } = useToast(); // Initialize toast

  useEffect(() => {
    setIsClient(true);
    try {
        // Load orders
        const storedOrders = localStorage.getItem('coffeeOrders');
        if (storedOrders) {
            try {
                const parsedOrders: Order[] = JSON.parse(storedOrders);
                 if (Array.isArray(parsedOrders) && parsedOrders.every(o => typeof o.id === 'string' && typeof o.timestamp === 'string')) { // Basic validation
                    setOrders(parsedOrders); // Don't sort initially, let sortConfig handle it
                 } else {
                     console.error('Parsed orders is not a valid array or structure:', parsedOrders);
                     setOrders([]);
                     localStorage.removeItem('coffeeOrders'); // Clear invalid data
                 }

            } catch (e) {
                console.error('Failed to parse orders from localStorage', e);
                setOrders([]);
                 localStorage.removeItem('coffeeOrders'); // Clear invalid data
            }
        } else {
            setOrders([]); // Set to empty array if no orders found
        }

         // Load sort config
         const storedSortConfig = localStorage.getItem(SORT_STORAGE_KEY);
         if (storedSortConfig) {
            try {
                const parsedSortConfig: SortConfig = JSON.parse(storedSortConfig);
                // Validate parsed config
                if (parsedSortConfig && (parsedSortConfig.key === 'timestamp' || parsedSortConfig.key === 'totalPrice') && (parsedSortConfig.direction === 'asc' || parsedSortConfig.direction === 'desc')) {
                    setSortConfig(parsedSortConfig);
                    console.log("SalesHistory: Loaded sort config from localStorage:", parsedSortConfig);
                } else {
                    console.warn("SalesHistory: Invalid sort config found in localStorage, using default.");
                    setSortConfig(null); // Default to null (newest first)
                }
            } catch (e) {
                 console.error("SalesHistory: Failed to parse sort config from localStorage.", e);
                 setSortConfig(null); // Default to null on error
            }
         } else {
              console.log("SalesHistory: No sort config found in localStorage, using default.");
              setSortConfig(null); // Default to null (newest first)
         }

    } catch (lsError) {
         console.error("Error accessing localStorage for initial load:", lsError);
         setOrders([]); // Initialize as empty on localStorage access error
         setSortConfig(null); // Default sort config
         toast({
            title: "Ошибка LocalStorage",
            description: "Не удалось загрузить данные. Настройки могут быть сброшены.",
            variant: "destructive",
         });
    }

    // Listener for storage changes (specifically coffeeOrders)
     const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'coffeeOrders') {
            console.log("SalesHistory: Detected storage change for coffeeOrders.");
            let updatedOrders: Order[] = [];
            try {
                 if (event.newValue) {
                     const parsed = JSON.parse(event.newValue);
                     if (Array.isArray(parsed) && parsed.every(o => typeof o.id === 'string' && typeof o.timestamp === 'string')) {
                         updatedOrders = parsed;
                         console.log("SalesHistory: Applying updated orders from storage event.", updatedOrders.length);
                     } else {
                         console.warn("SalesHistory: Invalid order data received from storage event.");
                     }
                 } else {
                      console.log("SalesHistory: coffeeOrders cleared in storage.");
                 }
            } catch (e) {
                console.error("SalesHistory: Error processing order storage event:", e);
            }
            setOrders(updatedOrders); // Always update state, even if empty
        }
     };

     window.addEventListener('storage', handleStorageChange);
     return () => {
         window.removeEventListener('storage', handleStorageChange);
     };

  }, [toast]); // Added toast dependency


   // Persist orders to localStorage whenever they change (including deletions)
   useEffect(() => {
       if (isClient) {
           // console.log("SalesHistory: Persisting orders to localStorage", orders.length); // Less verbose logging
           try {
               const currentStoredValue = localStorage.getItem("coffeeOrders");
               const newOrdersJson = JSON.stringify(orders); // Stringify current state (could be empty)

               if (currentStoredValue !== newOrdersJson) {
                   localStorage.setItem("coffeeOrders", newOrdersJson);
                   // Dispatch event only if value actually changed
                   window.dispatchEvent(new StorageEvent('storage', {
                       key: 'coffeeOrders',
                       newValue: newOrdersJson,
                       oldValue: currentStoredValue,
                       storageArea: localStorage,
                   }));
               }
           } catch (e) {
               console.error("SalesHistory: Failed to save orders to localStorage", e);
               toast({
                   title: "Ошибка сохранения",
                   description: "Не удалось обновить историю заказов.",
                   variant: "destructive",
               });
           }
       }
   }, [orders, isClient, toast]); // Add toast dependency


    // Persist sortConfig to localStorage whenever it changes
    useEffect(() => {
        if (isClient && sortConfig) {
             console.log("SalesHistory: Saving sort config to localStorage", sortConfig);
             try {
                 localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sortConfig));
             } catch (e) {
                 console.error("SalesHistory: Failed to save sort config to localStorage", e);
             }
        } else if (isClient && sortConfig === null) {
             // Optionally remove the key if sortConfig is reset to null
             try {
                  localStorage.removeItem(SORT_STORAGE_KEY);
                  console.log("SalesHistory: Removed sort config from localStorage.");
             } catch (e) {
                  console.error("SalesHistory: Failed to remove sort config from localStorage", e);
             }
        }
    }, [sortConfig, isClient]);


   const filteredAndSortedOrders = useMemo(() => {
      let filtered = [...orders]; // Start with a copy

      // 1. Filter by date range
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

      // 2. Sort based on sortConfig
      if (sortConfig) {
          filtered.sort((a, b) => {
              let aValue: string | number = a[sortConfig.key];
              let bValue: string | number = b[sortConfig.key];

              // Handle date sorting
              if (sortConfig.key === 'timestamp') {
                  aValue = parseISO(a.timestamp).getTime();
                  bValue = parseISO(b.timestamp).getTime();
              }

              if (aValue < bValue) {
                  return sortConfig.direction === 'asc' ? -1 : 1;
              }
              if (aValue > bValue) {
                  return sortConfig.direction === 'asc' ? 1 : -1;
              }
              return 0;
          });
      } else {
           // Default sort: newest first if no sort config is set
           filtered.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
      }

      return filtered;
    }, [orders, dateRange, sortConfig]);

  const handleExport = () => {
    if (!isClient) return;

    const dataToExport = filteredAndSortedOrders.map((order) => ({ // Use filteredAndSortedOrders
      'ID Заказа': order.id,
      'Дата и время': format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: ru }),
      'Товары': order.items
        .map((item) => `${item.name}${item.volume ? ` (${item.volume})` : ''} (x${item.quantity})`) // Include volume in export
        .join(', '),
      'Способ оплаты': order.paymentMethod || 'Не указан', // Add payment method column
      'Итого (₽)': order.totalPrice.toFixed(0), // Format without decimals
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История Продаж');

    // Set column widths (optional, adjust as needed)
    worksheet['!cols'] = [
      { wch: 25 }, // Order ID
      { wch: 20 }, // Timestamp
      { wch: 60 }, // Items (increased width for volume)
      { wch: 15 }, // Payment Method
      { wch: 15 }, // Total Price
    ];


    const fromDateStr = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'начала';
    const toDateStr = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : (dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'конца');
    const filename = `История_продаж_кофе_${fromDateStr}_${toDateStr}.xlsx`;


    XLSX.writeFile(workbook, filename);
  };

   const handleDeleteOrder = (orderId: string) => {
      if (!isClient) return;

      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));

      toast({
          title: "Заказ удален",
          description: `Заказ ${orderId} был успешно удален из истории.`,
          variant: "destructive" // Use destructive variant for deletion confirmation
      });
   };

   // Function to clear all orders
   const clearAllOrders = () => {
     if (!isClient) return;
     setOrders([]); // Set state to empty array
     setIsClearHistoryDialogOpen(false); // Close the dialog
     // Use setTimeout for toast to ensure it runs after state update cycle
     setTimeout(() => {
        toast({
            title: "История очищена",
            description: "Вся история продаж была удалена.",
            variant: "destructive",
        });
     }, 0);
   };

   const requestSort = (key: SortKey) => {
       let direction: SortDirection = 'asc';
       let newSortConfig: SortConfig | null = null; // Initialize as null

       if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
           direction = 'desc';
           newSortConfig = { key, direction };
       } else if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            // Third click resets sorting to null (default: newest first)
            newSortConfig = null;
       } else {
            // First click on a new column or first click ever
            newSortConfig = { key, direction };
       }
       setSortConfig(newSortConfig); // Update state with the new config (or null)
   };

   const getSortIcon = (key: SortKey) => {
       if (!sortConfig || sortConfig.key !== key) {
           return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
       }
       return sortConfig.direction === 'asc' ?
           <ArrowUpDown className="ml-1 h-3 w-3 transform rotate-0 text-foreground" /> :
           <ArrowUpDown className="ml-1 h-3 w-3 transform rotate-180 text-foreground" />;
   };


  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(0)} ₽`; // Format without decimals
  };

   const PaymentMethodIcon = ({ method }: { method: PaymentMethod | undefined }) => {
      const iconSize = "h-3.5 w-3.5 md:h-4 md:w-4";
      switch (method) {
        case 'Наличные': return <Banknote className={cn(iconSize, "text-green-600")} />;
        case 'Карта': return <CreditCard className={cn(iconSize, "text-blue-600")} />;
        case 'Перевод': return <Smartphone className={cn(iconSize, "text-purple-600")} />;
        default: return null;
      }
   };

  if (!isClient) {
    return <Card><CardHeader><CardTitle>История продаж</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Загрузка истории...</p></CardContent></Card>;
  }

  return (
    <Card className="shadow-md"> {/* Reduced shadow */}
        <CardHeader className="p-4 md:p-6"> {/* Adjusted padding */}
             <CardTitle className="text-lg md:text-xl">История продаж</CardTitle> {/* Adjusted size */}
        </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0"> {/* Adjusted padding */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 md:gap-4">
           {/* Left side: Date Picker */}
           <Popover>
             <PopoverTrigger asChild>
               <Button
                 variant={'outline'}
                 className="w-full sm:w-auto justify-start text-left font-normal text-xs md:text-sm h-9 md:h-10 px-3" // Adjusted size/height and padding
               >
                 <CalendarIcon className="mr-1.5 h-3.5 w-3.5" /> {/* Adjusted margin/size */}
                 {dateRange?.from ? (
                   dateRange.to ? (
                     <>
                       {format(dateRange.from, 'dd MMM y', { locale: ru })} -{' '}
                       {format(dateRange.to, 'dd MMM y', { locale: ru })}
                     </>
                   ) : (
                     format(dateRange.from, 'dd MMM y', { locale: ru })
                   )
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
                 numberOfMonths={1} // Show only 1 month on mobile initially
                  className="sm:hidden" // Hide on larger screens initially
                 locale={ru}
               />
                <Calendar
                 initialFocus
                 mode="range"
                 defaultMonth={dateRange?.from}
                 selected={dateRange}
                 onSelect={setDateRange}
                 numberOfMonths={2} // Show 2 months on larger screens
                 className="hidden sm:block" // Hide on smaller screens
                 locale={ru}
               />
             </PopoverContent>
           </Popover>

           {/* Right side: Action Buttons */}
           <div className="flex w-full sm:w-auto justify-end gap-2">
               <Button onClick={handleExport} disabled={filteredAndSortedOrders.length === 0} size="sm" className="h-9 md:h-10 text-xs md:text-sm px-3"> {/* Adjusted size/height and padding */}
                 <Download className="mr-1.5 h-3.5 w-3.5" /> {/* Adjusted margin/size */}
                 Выгрузить в Excel
               </Button>

               {/* Clear All History Button */}
               <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
                   <TooltipProvider>
                       <Tooltip>
                           <TooltipTrigger asChild>
                               <AlertDialogTrigger asChild>
                                   <Button variant="destructive" size="icon" className="h-9 w-9 md:h-10 md:w-10" disabled={orders.length === 0}>
                                       <Trash className="h-4 w-4" />
                                       <span className="sr-only">Очистить всю историю</span>
                                   </Button>
                               </AlertDialogTrigger>
                           </TooltipTrigger>
                           <TooltipContent>
                               <p>Очистить всю историю</p>
                           </TooltipContent>
                       </Tooltip>
                   </TooltipProvider>
                   <AlertDialogContent>
                       <AlertDialogHeader>
                           <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                           <AlertDialogDescription>
                               Это действие необратимо. Вся история продаж будет удалена навсегда.
                           </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                           <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                           <AlertDialogAction onClick={clearAllOrders} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>
                               Очистить историю
                           </AlertDialogAction>
                       </AlertDialogFooter>
                   </AlertDialogContent>
               </AlertDialog>
           </div>
        </div>

        <ScrollArea className="h-[400px] md:h-[500px] w-full border rounded-md"> {/* Adjusted height */}
          <Table>
            <TableHeader className="sticky top-0 bg-background shadow-sm z-10">
              <TableRow>
                 <TableHead className="w-[100px] md:w-[150px] hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50" onClick={() => requestSort('timestamp')}>
                    <div className="flex items-center">
                      Дата {getSortIcon('timestamp')}
                    </div>
                 </TableHead>
                 <TableHead className="text-xs md:text-sm px-2 md:px-4">Товары</TableHead>
                 <TableHead className="w-[90px] md:w-[110px] text-xs md:text-sm px-2 md:px-4">Оплата</TableHead> {/* Added Payment Method Header */}
                 <TableHead className="text-right w-[80px] md:w-[100px] text-xs md:text-sm px-2 md:px-4 cursor-pointer hover:bg-muted/50" onClick={() => requestSort('totalPrice')}>
                    <div className="flex items-center justify-end">
                      Итого {getSortIcon('totalPrice')}
                    </div>
                 </TableHead>
                 <TableHead className="text-right w-[40px] md:w-[60px] px-2 md:px-4"></TableHead> {/* Header for delete button */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedOrders.length === 0 ? ( // Use filteredAndSortedOrders
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6 md:py-8 text-sm"> {/* Increased colspan */}
                    {orders.length === 0 ? "История продаж пуста." : "Нет заказов за выбранный период."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedOrders.map((order) => ( // Use filteredAndSortedOrders
                  <TableRow key={order.id}>
                    <TableCell className="font-medium hidden sm:table-cell text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top"> {/* Adjusted padding */}
                      {format(parseISO(order.timestamp), 'dd.MM.yy HH:mm', { // Shorter date format
                        locale: ru,
                      })}
                    </TableCell>
                    <TableCell className="px-2 md:px-4 py-2 md:py-3 align-top"> {/* Adjusted padding */}
                      <div className="flex flex-col gap-0.5">
                        <div className="sm:hidden text-[10px] text-muted-foreground mb-1"> {/* Show date on mobile */}
                            {format(parseISO(order.timestamp), 'dd.MM.yy HH:mm', { locale: ru })}
                        </div>
                        {order.items.map((item, index) => (
                         <div key={index} className="flex items-center text-xs md:text-sm leading-snug"> {/* Adjusted line height */}
                            {item.name}
                            {item.volume && <span className="text-muted-foreground ml-1">({item.volume})</span>}
                            <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[9px] md:text-[10px] h-4">{item.quantity}</Badge> {/* Adjusted badge */}
                         </div>
                        ))}
                      </div>
                    </TableCell>
                     <TableCell className="text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top"> {/* Added Payment Method Cell */}
                        <div className="flex items-center gap-1 md:gap-1.5">
                            <PaymentMethodIcon method={order.paymentMethod} />
                            <span className="hidden md:inline">{order.paymentMethod || 'Н/У'}</span>
                            <span className="md:hidden text-muted-foreground">{/* Empty on mobile to save space, icon is enough */}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top"> {/* Adjusted padding */}
                      {formatCurrency(order.totalPrice)}
                    </TableCell>
                    <TableCell className="text-right px-2 md:px-4 py-2 md:py-3 align-top"> {/* Cell for delete button */}
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
                                       Это действие необратимо. Заказ от {format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm', { locale: ru })} на сумму {formatCurrency(order.totalPrice)} ({order.paymentMethod}) будет удален навсегда.
                                   </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                   <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel> {/* Adjusted size */}
                                   <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}> {/* Adjusted size */}
                                       Удалить
                                   </AlertDialogAction>
                               </AlertDialogFooter>
                           </AlertDialogContent>
                       </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

