/**
 * @file Компонент отображения деталей текущего заказа.
 * Показывает список заказанных товаров, их количество, общую стоимость,
 * опции выбора способа оплаты и кнопки для оформления или очистки заказа.
 */
"use client";

import React from 'react';
// import { SheetHeaderWithTitle } from '@/components/shared/sheet-header-with-title'; // Удален импорт
import type { Product } from '@/types/product';
import type { PaymentMethod } from '@/types/order';
import type { OrderItem } from './order-item-type'; // Импорт локального типа OrderItem
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MinusCircle, PlusCircle, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Свойства компонента OrderDetails.
 */
interface OrderDetailsProps {
  /** Массив товаров в текущем заказе. */
  order: OrderItem[];
  /** Общая стоимость заказа. */
  totalPrice: number;
  /** Выбранный способ оплаты. */
  selectedPaymentMethod: PaymentMethod | null;
  /** Функция для удаления одной единицы товара из заказа. */
  onRemoveFromOrder: (productId: string) => void;
  /** Функция для добавления товара в заказ (или увеличения количества). */
  onAddToOrder: (product: Product) => void;
  /** Функция для удаления всей позиции товара из заказа. */
  onRemoveEntireItem: (productId: string) => void;
  /** Функция для выбора способа оплаты. */
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  /** Функция для оформления заказа. */
  onCheckout: () => void;
  /** Функция для очистки заказа. */
  onClearOrder: () => void;
  /** Флаг, указывающий, отображается ли компонент внутри Sheet (шторки). */
  isSheet?: boolean;
  /** ID для заголовка карточки заказа (для доступности). */
  orderCardTitleId: string;
  /** ID для заголовка шторки заказа (для доступности). */
  orderSheetTitleId: string;
  /** Флаг, указывающий, идет ли процесс оформления заказа. */
  isCheckoutProcessing: boolean;
}

/**
 * Компонент для отображения деталей текущего заказа.
 * Использует React.memo для оптимизации производительности.
 * @param props - Свойства компонента.
 * @returns JSX элемент деталей заказа.
 */
export const OrderDetails: React.FC<OrderDetailsProps> = React.memo(({
  order,
  totalPrice,
  selectedPaymentMethod,
  onRemoveFromOrder,
  onAddToOrder,
  onRemoveEntireItem,
  onSelectPaymentMethod,
  onCheckout,
  onClearOrder,
  isSheet = false,
  isCheckoutProcessing,
  // orderSheetTitleId, // orderSheetTitleId больше не нужен здесь для рендеринга заголовка
  // orderCardTitleId, // orderCardTitleId используется только для десктопной карточки
}) => (
  <>
    {/* SheetHeaderWithTitle был удален отсюда. Он теперь рендерится в OrderBuilder */}
    {/* Содержимое карточки/шторки заказа */}
    <CardContent className={cn(
      "p-0 flex-grow overflow-hidden min-h-0",
      isSheet ? "px-3 md:px-4" : "px-4 pt-0"
    )}>
       <ScrollArea id="list_ul"
         className={cn(
           "h-full pr-2 overflow-y-auto",
           isSheet ? "" : "lg:max-h-[calc(100vh-20rem)]"
          )}
         type="auto"
       >
         {order.length === 0 ? (
           <p className="text-muted-foreground text-center py-3 md:py-4 text-sm">Ваш заказ пуст.</p>
         ) : (
           <ul className="space-y-1 md:space-y-1.5 pt-1 pb-2 md:pb-3">
             {order.map((item, index) => (
               <li
                 key={item.id}
                 className={cn(
                   "flex justify-between items-center text-sm gap-2 py-1 px-1 rounded-sm",
                   (index % 2 !== 0 ? 'bg-muted/50' : 'bg-card')
                 )}
               >
                 <div className="flex-grow overflow-hidden mr-1">
                   <span className="font-medium block truncate">{item.name} {item.volume && <span className="text-xs text-muted-foreground">({item.volume})</span>}</span>
                   <span className="text-xs md:text-sm whitespace-nowrap font-sans">{((item.price ?? 0) * item.quantity).toFixed(0)} ₽</span>
                 </div>
                 <div className="flex items-center gap-1 md:gap-1 flex-shrink-0">
                   <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => onRemoveFromOrder(item.id)} disabled={isCheckoutProcessing}>
                     <MinusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                     <span className="sr-only">Убрать 1 {item.name}</span>
                   </Button>
                   <Badge variant="secondary" className="px-1.5 py-0.5 text-xs md:text-sm font-medium min-w-[24px] justify-center font-sans">
                     {item.quantity}
                   </Badge>
                   <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => onAddToOrder(item)} disabled={isCheckoutProcessing}>
                     <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                     <span className="sr-only">Добавить 1 {item.name}</span>
                   </Button>
                   <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10 ml-1" onClick={() => onRemoveEntireItem(item.id)} disabled={isCheckoutProcessing}>
                     <Trash2 className="h-3.5 w-3.5" />
                     <span className="sr-only">Удалить {item.name} из заказа</span>
                   </Button>
                 </div>
               </li>
             ))}
           </ul>
         )}
       </ScrollArea>
    </CardContent>

    {/* Подвал карточки/шторки заказа */}
    <CardFooter className={cn(
      "flex flex-col gap-2 md:gap-3 p-3 md:p-4 pt-0 flex-shrink-0",
      isSheet ? "border-t pt-3" : "pt-2"
    )}>
      {!isSheet && order.length > 0 && <Separator className="mb-3" />}

      {order.length > 0 ? (
        <>
          <div className="flex justify-between w-full font-semibold text-sm md:text-base">
            <span>Итого:</span>
            <span className="font-sans">{totalPrice.toFixed(0)} ₽</span>
          </div>

          <div className="w-full pt-1">
            <p className="text-xs text-muted-foreground mb-1.5">Способ оплаты:</p>
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {(['Наличные', 'Карта', 'Перевод'] as PaymentMethod[]).map((method) => (
                <Button
                  key={method}
                  variant={selectedPaymentMethod === method ? "default" : "outline"}
                  onClick={() => onSelectPaymentMethod(method)}
                  className={cn(
                    "h-auto min-h-[48px] text-xs flex-col items-center justify-center px-1 py-1 leading-tight",
                    selectedPaymentMethod === method ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''
                  )}
                  size="sm"
                  disabled={isCheckoutProcessing}
                >
                  {method === 'Наличные' && <Banknote className="h-3.5 w-3.5 md:h-4 md:w-4 mb-0.5" />}
                  {method === 'Карта' && <CreditCard className="h-3.5 w-3.5 md:h-4 md:w-4 mb-0.5" />}
                  {method === 'Перевод' && <Smartphone className="h-3.5 w-3.5 md:h-4 md:w-4 mb-0.5" />}
                  <span className="text-center block">{method}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 w-full pt-2">
            <Button
              onClick={onCheckout}
              className="flex-1 h-8 md:h-9 text-xs md:text-sm bg-primary hover:bg-primary/90 px-2"
              disabled={!selectedPaymentMethod || isCheckoutProcessing}
            >
              {isCheckoutProcessing ? 'Обработка...' : 'Оформить заказ'}
            </Button>
            <Button variant="outline" onClick={onClearOrder} className="h-8 md:h-9 text-xs md:text-sm px-2" disabled={isCheckoutProcessing}>
              <Trash2 className="mr-1 h-3 w-3" /> Очистить
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-center text-xs md:text-sm w-full">Добавьте товары, чтобы увидеть итоговую сумму.</p>
      )}
    </CardFooter>
  </>
));

OrderDetails.displayName = 'OrderDetails';
