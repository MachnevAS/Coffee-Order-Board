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
import { Button } from '@/components/ui/button';
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
        .map((item) => `${item.name} (x${item.quantity})`)
        .join(', '),
      'Итого (₽)': order.totalPrice.toFixed(2),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'История Продаж');

    // Set column widths (optional, adjust as needed)
    worksheet['!cols'] = [
      { wch: 25 }, // Order ID
      { wch: 20 }, // Timestamp
      { wch: 50 }, // Items
      { wch: 15 }, // Total Price
    ];


    const fromDateStr = dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'начала';
    const toDateStr = dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : (dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : 'конца');
    const filename = `История_продаж_кофе_${fromDateStr}_${toDateStr}.xlsx`;


    XLSX.writeFile(workbook, filename);
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} ₽`;
  };

  if (!isClient) {
    return <Card><CardHeader><CardTitle>История продаж</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Загрузка истории...</p></CardContent></Card>;
  }

  return (
    <Card className="shadow-lg">
        <CardHeader>
             <CardTitle>История продаж</CardTitle>
        </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className="w-full sm:w-[280px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
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
                  <span>Выберите диапазон дат</span>
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

          <Button onClick={handleExport} disabled={filteredOrders.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Выгрузить в Excel
          </Button>
        </div>

        <ScrollArea className="h-[500px] w-full border rounded-md"> {/* Added ScrollArea */}
          <Table>
            <TableHeader className="sticky top-0 bg-background shadow-sm">
              <TableRow>
                <TableHead className="w-[150px] hidden sm:table-cell">Дата</TableHead>
                <TableHead>Товары</TableHead>
                <TableHead className="text-right w-[100px]">Итого</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Нет заказов за выбранный период.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium hidden sm:table-cell">
                      {format(parseISO(order.timestamp), 'dd.MM.yyyy HH:mm', {
                        locale: ru,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="sm:hidden text-xs text-muted-foreground"> {/* Show date on mobile */}
                            {format(parseISO(order.timestamp), 'dd.MM.yy HH:mm', { locale: ru })}
                        </div>
                        {order.items.map((item, index) => (
                         <div key={index} className="flex items-center text-sm">
                            {item.name} <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-xs">{item.quantity}</Badge>
                         </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
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
