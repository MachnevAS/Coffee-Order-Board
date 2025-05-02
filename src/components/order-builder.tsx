

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { PaymentMethod, Order, SalesHistoryItem as SalesHistoryItemType } from "@/types/order"; // Renamed SalesHistoryItem to avoid conflict
import { MinusCircle, PlusCircle, Trash2, CreditCard, Banknote, Smartphone, Search, ShoppingCart, X, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, SlidersHorizontal, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'; // Import VisuallyHidden
import { ProductCard } from './product-card';
import { LOCAL_STORAGE_PRODUCTS_KEY, LOCAL_STORAGE_ORDERS_KEY, LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY } from '@/lib/constants';

interface OrderItem extends Product {
  quantity: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc';

// Helper function to calculate product popularity
const calculatePopularity = (): Map<string, number> => {
  const popularityMap = new Map<string, number>();
  try {
    const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (storedOrders) {
      const pastOrders: Order[] = JSON.parse(storedOrders);
      if (Array.isArray(pastOrders)) {
        pastOrders.forEach(ord => {
          ord.items.forEach(item => {
            popularityMap.set(item.id, (popularityMap.get(item.id) || 0) + item.quantity);
          });
        });
        // console.log("Popularity map calculated:", Object.fromEntries(popularityMap));
      } else {
         console.warn("Invalid order data found in localStorage for popularity.");
      }
    }
  } catch (e) {
    console.error("Error reading or parsing sales history for popularity:", e);
  }
  return popularityMap;
};

// Extracted Product Grid Component
const ProductGrid: React.FC<{
  products: Product[];
  orderQuantities: { [productId: string]: number };
  topProductsRanking: Map<string, number>;
  onAddToOrder: (product: Product) => void;
  onRemoveFromOrder: (productId: string) => void;
}> = ({ products, orderQuantities, topProductsRanking, onAddToOrder, onRemoveFromOrder }) => {
  if (products.length === 0) {
    return <p className="text-muted-foreground">Товары по вашему запросу не найдены.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToOrder={onAddToOrder}
          onRemoveFromOrder={onRemoveFromOrder}
          orderQuantity={orderQuantities[product.id]}
          popularityRank={topProductsRanking.get(product.id)}
        />
      ))}
    </div>
  );
};

// Extracted Order Details Component
const OrderDetails: React.FC<{
  order: OrderItem[];
  totalPrice: number;
  selectedPaymentMethod: PaymentMethod | null;
  onRemoveFromOrder: (productId: string) => void;
  onAddToOrder: (product: Product) => void;
  onRemoveEntireItem: (productId: string) => void;
  onSelectPaymentMethod: (method: PaymentMethod) => void;
  onCheckout: () => void;
  onClearOrder: () => void;
  isSheet?: boolean;
  orderCardTitleId: string;
  orderSheetTitleId: string;
}> = ({
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
  orderCardTitleId,
  orderSheetTitleId,
}) => (
  <>
    {/* Content Area with Scroll */}
    <CardContent className={cn(
      "p-0 flex-grow overflow-hidden min-h-0", // Added min-h-0
      isSheet ? "px-3 md:px-4" : "px-4 pt-0" // No pt-0 for card view, use CardHeader padding
    )}>
       <ScrollArea className={cn("h-full pr-2", isSheet ? "overflow-y-auto" : "lg:max-h-[calc(100vh-20rem)]")} type="auto"> {/* Added conditional max-height for desktop */}
         {order.length === 0 ? (
           <p className="text-muted-foreground text-center py-3 md:py-4 text-sm">Ваш заказ пуст.</p>
         ) : (
           <ul className="space-y-1 md:space-y-1.5 pt-1 pb-2 md:pb-3"> {/* Adjusted padding */}
             {order.map((item, index) => (
               <li
                 key={item.id}
                 className={cn(
                   "flex justify-between items-center text-sm gap-2 py-1 px-1 rounded-sm",
                   (index % 2 !== 0 ? 'bg-muted/50' : 'bg-card') // Add zebra striping
                 )}
               >
                 <div className="flex-grow overflow-hidden mr-1">
                   <span className="font-medium block truncate">{item.name} {item.volume && <span className="text-xs text-muted-foreground">({item.volume})</span>}</span>
                   {/* Use font-sans for currency */}
                   <span className=" text-xs md:text-sm whitespace-nowrap font-sans">{(item.price * item.quantity).toFixed(0)} ₽</span>
                 </div>
                 <div className="flex items-center gap-1 md:gap-1 flex-shrink-0">
                   <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => onRemoveFromOrder(item.id)}>
                     <MinusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                     <span className="sr-only">Убрать 1 {item.name}</span>
                   </Button>
                   {/* Use font-sans for quantity */}
                   <Badge variant="secondary" className="px-1.5 py-0.5 text-xs md:text-sm font-medium min-w-[24px] justify-center font-sans">
                     {item.quantity}
                   </Badge>
                   <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => onAddToOrder(item)}>
                     <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                     <span className="sr-only">Добавить 1 {item.name}</span>
                   </Button>
                   <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10 ml-1" onClick={() => onRemoveEntireItem(item.id)}>
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

    {/* Footer */}
    <CardFooter className={cn(
      "flex flex-col gap-2 md:gap-3 p-3 md:p-4 pt-0 flex-shrink-0",
      isSheet ? "border-t pt-3" : "pt-2" // Add pt-2 for card view
    )}>
      {!isSheet && order.length > 0 && <Separator className="mb-3" />}

      {order.length > 0 ? (
        <>
          <div className="flex justify-between w-full font-semibold text-sm md:text-base">
            <span>Итого:</span>
            {/* Use font-sans for currency */}
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
              disabled={!selectedPaymentMethod}
            >
              Оформить заказ
            </Button>
            <Button variant="outline" onClick={onClearOrder} className="h-8 md:h-9 text-xs md:text-sm px-2">
              <Trash2 className="mr-1 h-3 w-3" /> Очистить
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-center text-xs md:text-sm w-full">Добавьте товары, чтобы увидеть итоговую сумму.</p>
      )}
    </CardFooter>
  </>
);


export function OrderBuilder() {
  // --- States ---
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // --- Hooks ---
  const { toast } = useToast();
  const orderSheetTitleId = React.useId();
  const orderCardTitleId = React.useId();

  // --- Effects ---

  // Initialize client state and load data
  useEffect(() => {
    setIsClient(true);
    let loadedProducts: Product[] = [];

    try {
      const storedProducts = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
      if (storedProducts) {
        try {
          const parsedProducts = JSON.parse(storedProducts);
          if (Array.isArray(parsedProducts) && parsedProducts.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number')) {
            loadedProducts = parsedProducts as Product[];
          } else {
            console.warn("OrderBuilder: Stored products invalid structure or empty, initializing as empty.");
            localStorage.removeItem(LOCAL_STORAGE_PRODUCTS_KEY);
          }
        } catch (e) {
          console.error("OrderBuilder: Failed to parse products from localStorage.", e);
          localStorage.removeItem(LOCAL_STORAGE_PRODUCTS_KEY);
        }
      }

      const storedSortOption = localStorage.getItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY);
      if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
        setSortOption(storedSortOption as SortOption);
      } else {
        localStorage.setItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY, 'name-asc');
      }

    } catch (lsError) {
      console.error("OrderBuilder: Error accessing localStorage.", lsError);
      toast({
        title: "Ошибка LocalStorage",
        description: "Не удалось загрузить данные. Настройки могут быть сброшены.",
        variant: "destructive",
      });
    }

    setProducts(loadedProducts);
  }, [toast]);


  // Update total price whenever order changes
  const totalPrice = useMemo(() => {
    if (!isClient) return 0;
    return order.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [order, isClient]);


  // Handle storage changes for products and orders
  useEffect(() => {
    if (!isClient) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_PRODUCTS_KEY) {
        let updatedProducts: Product[] = [];
        try {
          if (event.newValue) {
            const parsed = JSON.parse(event.newValue);
            if (Array.isArray(parsed) && parsed.every(p => p && typeof p.id === 'string')) {
              updatedProducts = parsed;
            } else {
              console.warn("OrderBuilder: Invalid data received from storage event for products.");
            }
          }
        } catch (e) {
          console.error("OrderBuilder: Error processing product storage event:", e);
        }
        setProducts(updatedProducts);
        setOrder(prevOrder => {
          const updatedOrder = prevOrder.map(orderItem => {
            const updatedProduct = updatedProducts.find(p => p.id === orderItem.id);
            return updatedProduct ? { ...updatedProduct, quantity: orderItem.quantity } : null;
          }).filter(item => item !== null) as OrderItem[];
          return updatedOrder;
        });
      }

      if (event.key === LOCAL_STORAGE_ORDERS_KEY) {
        setPopularityVersion(v => v + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient]);


  // --- Memoized calculations ---

  const topProductsRanking = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    const popularityMap = calculatePopularity();
    const sortedByPopularity = Array.from(popularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    return ranking;
  }, [isClient, popularityVersion]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return [];
    let result = [...products];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    switch (sortOption) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'popularity-desc': {
        const popularityMap = calculatePopularity();
        result.sort((a, b) => {
          const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
          if (popDiff !== 0) return popDiff;
          return a.name.localeCompare(b.name);
        });
        break;
      }
    }
    return result;
  }, [products, searchTerm, sortOption, isClient, popularityVersion]); // Removed calculatePopularity from deps

  const orderQuantities = useMemo(() => {
    const quantities: { [productId: string]: number } = {};
    order.forEach(item => {
      quantities[item.id] = item.quantity;
    });
    return quantities;
  }, [order]);


  // --- Event Handlers ---

  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
    if (isClient) {
      try {
        localStorage.setItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY, newSortOption);
      } catch (e) {
        console.error("OrderBuilder: Failed to save sort option to localStorage.", e);
      }
    }
  }, [isClient]);

  const addToOrder = useCallback((product: Product) => {
    setOrder((prevOrder) => {
      const existingItem = prevOrder.find((item) => item.id === product.id);
      if (existingItem) {
        return prevOrder.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevOrder, { ...product, quantity: 1 }];
      }
    });
  }, []);

  const removeFromOrder = useCallback((productId: string) => {
    setOrder((prevOrder) => {
      const existingItem = prevOrder.find((item) => item.id === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prevOrder.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        return prevOrder.filter((item) => item.id !== productId);
      }
    });
  }, []);

  const removeEntireItem = useCallback((productId: string) => {
    setOrder((prevOrder) => prevOrder.filter((item) => item.id !== productId));
  }, []);

  const clearOrder = useCallback(() => {
    setOrder([]);
    setSelectedPaymentMethod(null);
  }, []);

  const handleCheckout = useCallback(() => {
    if (!isClient) return;

    if (order.length === 0) {
      toast({ title: "Заказ пуст", description: "Пожалуйста, добавьте товары в заказ.", variant: "destructive" });
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ title: "Выберите способ оплаты", description: "Пожалуйста, укажите способ оплаты заказа.", variant: "destructive" });
      return;
    }

    const orderData: Order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      items: order.map(item => ({
        id: item.id,
        name: item.name,
        volume: item.volume,
        price: item.price,
        quantity: item.quantity,
      })),
      totalPrice: totalPrice,
      timestamp: new Date().toISOString(),
      paymentMethod: selectedPaymentMethod,
    };

    try {
      let pastOrders: Order[] = [];
      const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (storedOrders) {
        try {
          const parsed = JSON.parse(storedOrders);
          if (Array.isArray(parsed)) pastOrders = parsed;
        } catch (parseError) {
          console.error("Failed to parse past orders, starting fresh.", parseError);
        }
      }
      pastOrders.push(orderData);
      const newOrdersJson = JSON.stringify(pastOrders);
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, newOrdersJson);

      window.dispatchEvent(new StorageEvent('storage', {
        key: LOCAL_STORAGE_ORDERS_KEY,
        newValue: newOrdersJson,
        storageArea: localStorage,
      }));

      toast({ title: "Заказ оформлен!", description: `Итого: ${totalPrice.toFixed(0)} ₽ (${selectedPaymentMethod}). Ваш заказ сохранен.` });
      clearOrder();
      setIsSheetOpen(false);
    } catch (error) {
      console.error("Failed to save order:", error);
      toast({ title: "Ошибка оформления заказа", description: "Не удалось сохранить заказ.", variant: "destructive" });
    }
  }, [isClient, order, selectedPaymentMethod, totalPrice, toast, clearOrder]);


  // --- SSR Loading State ---
  if (!isClient) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Поиск товаров..." value="" className="pl-8 pr-8 h-9" disabled /> {/* Pass empty value */}
            </div>
            <Button variant="outline" size="sm" className="h-9 px-3" disabled>
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Сортировать
            </Button>
          </div>
          <p className="text-muted-foreground">Загрузка товаров...</p>
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-lg lg:sticky lg:top-8 max-h-[calc(100vh-4rem)] flex flex-col">
            <CardHeader aria-labelledby={orderCardTitleId}>
              <CardTitle id={orderCardTitleId} className="flex items-center justify-between text-xl">
                <span>Текущий заказ</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-4">Загрузка...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- Main Render Logic (Client-Side) ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 pb-16 lg:pb-0"> {/* Increased pb for floating button */}
      {/* Product List */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>

        {/* Search and Sort Controls */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 h-9"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Очистить поиск</span>
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs sm:text-sm">
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Сортировать
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleSetSortOption('name-asc')} className={cn(sortOption === 'name-asc' && 'bg-accent text-accent-foreground')}>
                <ArrowDownAZ className="mr-2 h-4 w-4" /> <span>Названию (А-Я)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}>
                <ArrowDownZA className="mr-2 h-4 w-4" /> <span>Названию (Я-А)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}>
                <ArrowDown01 className="mr-2 h-4 w-4" /> <span>Цене (возрастание)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}>
                <ArrowDown10 className="mr-2 h-4 w-4" /> <span>Цене (убывание)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}>
                <TrendingUp className="mr-2 h-4 w-4" /> <span>Популярности (сначала топ)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {products.length === 0 ? (
          <p className="text-muted-foreground">Товары отсутствуют. Добавьте их вручную или загрузите начальный список во вкладке "Управление товарами".</p>
        ) : (
          <ProductGrid
            products={filteredAndSortedProducts}
            orderQuantities={orderQuantities}
            topProductsRanking={topProductsRanking}
            onAddToOrder={addToOrder}
            onRemoveFromOrder={removeFromOrder}
          />
        )}
      </div>

      {/* Mobile Order Sheet Trigger */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-2 bg-background border-t">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-12 shadow-lg text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {order.length > 0 && (
                  <Badge variant="secondary" className="h-5 w-auto px-1.5 justify-center text-xs font-medium">
                    {order.reduce((sum, item) => sum + item.quantity, 0)} поз.
                  </Badge>
                )}
                <span>Корзина</span>
              </div>
              {totalPrice > 0 && (
                // Use font-sans for currency
                <span className="font-semibold font-sans">{totalPrice.toFixed(0)} ₽</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-lg h-[75vh] flex flex-col p-0"
            aria-labelledby={orderSheetTitleId}
          >
            <SheetHeader className="p-3 md:p-4 border-b text-left">
              {/* Use visually hidden title for accessibility */}
               <VisuallyHidden><SheetTitle id={orderSheetTitleId}>Текущий заказ</SheetTitle></VisuallyHidden>
               <p className="text-lg font-semibold text-foreground" aria-hidden="true">Текущий заказ</p>
            </SheetHeader>
            <OrderDetails
              isSheet={true}
              order={order}
              totalPrice={totalPrice}
              selectedPaymentMethod={selectedPaymentMethod}
              onRemoveFromOrder={removeFromOrder}
              onAddToOrder={addToOrder}
              onRemoveEntireItem={removeEntireItem}
              onSelectPaymentMethod={setSelectedPaymentMethod}
              onCheckout={handleCheckout}
              onClearOrder={clearOrder}
              orderCardTitleId={orderCardTitleId}
              orderSheetTitleId={orderSheetTitleId}
            />
            <SheetClose asChild>
              <VisuallyHidden><button>Закрыть</button></VisuallyHidden>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Current Order */}
      <div className="hidden lg:block lg:col-span-1">
         <Card className="shadow-md lg:sticky lg:top-4 md:top-8 max-h-[calc(100vh-4rem)] flex flex-col"> {/* Keep max height */}
          <CardHeader className="p-3 md:p-4 pb-3 flex-shrink-0" aria-labelledby={orderCardTitleId}> {/* Ensure header shrinks */}
            <CardTitle id={orderCardTitleId} className="text-xl">Текущий заказ</CardTitle>
          </CardHeader>
          <OrderDetails
            order={order}
            totalPrice={totalPrice}
            selectedPaymentMethod={selectedPaymentMethod}
            onRemoveFromOrder={removeFromOrder}
            onAddToOrder={addToOrder}
            onRemoveEntireItem={removeEntireItem}
            onSelectPaymentMethod={setSelectedPaymentMethod}
            onCheckout={handleCheckout}
            onClearOrder={clearOrder}
            orderCardTitleId={orderCardTitleId}
            orderSheetTitleId={orderSheetTitleId}
          />
        </Card>
      </div>
    </div>
  );
}
