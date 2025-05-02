
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
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import type { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderItem {
  name: string;
  volume?: string; // Optional volume
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  items: OrderItem[];
  totalPrice: number;
  timestamp: string; // ISO string format
}

export function SalesHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedOrders = localStorage.getItem('coffeeOrders');
    if (storedOrders) {
      try {
        const parsedOrders: Order[] = JSON.parse(storedOrders);
        // Ensure orders are sorted by timestamp descending initially
        setOrders(
          parsedOrders.sort(
            (a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()
          )
        );
      } catch (e) {
        console.error('Failed to parse orders from localStorage', e);
        setOrders([]);
      }
    }
  }, []);

  const filteredOrders = useMemo(() => {
    if (!dateRange?.from) {
      return orders; // Return all orders if no start date
    }

    const start = startOfDay(dateRange.from);
    // If only 'from' is selected, filter for that single day
    const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    return orders.filter((order) => {
        try {
            const orderDate = parseISO(order.timestamp);
            return isValid(orderDate) && orderDate >= start && orderDate <= end;
        } catch (e) {
            console.error("Error parsing order timestamp:", order.timestamp, e);
            return false; // Exclude orders with invalid timestamps
        }
    });
  }, [orders, dateRange]);

  const handleExport = () => {
    if (!isClient) return;

    const dataToExport = filteredOrders.map((order) => ({
      'ID Заказа': order.id,
      'Дата и время': format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm:ss', { locale: ru }),
      'Товары': order.items
        .map((item) => `${item.name}${item.volume ? ` (${item.volume})` : ''} (x${item.quantity})`) // Include volume in export
        .join(', '),
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
      { wch: 15 }, // Total Price
    ];


    const fromDateStr = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'начала';
    const toDateStr = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : (dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'конца');
    const filename = `История_продаж_кофе_${fromDateStr}_${toDateStr}.xlsx`;


    XLSX.writeFile(workbook, filename);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(0)} ₽`; // Format without decimals
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
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3 md:gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className="w-full sm:w-auto justify-start text-left font-normal text-xs md:text-sm h-9 md:h-10" // Adjusted size/height
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
                  <span>Выберите дату или диапазон</span>
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

          <Button onClick={handleExport} disabled={filteredOrders.length === 0} size="sm" className="h-9 md:h-10 text-xs md:text-sm"> {/* Adjusted size/height */}
            <Download className="mr-1.5 h-3.5 w-3.5" /> {/* Adjusted margin/size */}
            Выгрузить в Excel
          </Button>
        </div>

        <ScrollArea className="h-[400px] md:h-[500px] w-full border rounded-md"> {/* Adjusted height */}
          <Table>
            <TableHeader className="sticky top-0 bg-background shadow-sm z-10">
              <TableRow>
                <TableHead className="w-[100px] md:w-[150px] hidden sm:table-cell text-xs md:text-sm px-2 md:px-4">Дата</TableHead>
                <TableHead className="text-xs md:text-sm px-2 md:px-4">Товары</TableHead>
                <TableHead className="text-right w-[80px] md:w-[100px] text-xs md:text-sm px-2 md:px-4">Итого</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6 md:py-8 text-sm">
                    Нет заказов за выбранный период.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
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
                    <TableCell className="text-right font-mono text-xs md:text-sm px-2 md:px-4 py-2 md:py-3 align-top"> {/* Adjusted padding */}
                      {formatCurrency(order.totalPrice)}
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

