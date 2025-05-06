
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { PaymentMethod, Order, SalesHistoryItem as SalesHistoryItemType } from "@/types/order";
import { MinusCircle, PlusCircle, Trash2, CreditCard, Banknote, Smartphone, Search, ShoppingCart, X, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, SlidersHorizontal, TrendingUp, RefreshCw } from "lucide-react";
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
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ProductCard } from './product-card';
import { LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY } from '@/lib/constants';
import { fetchProductsFromSheet, addOrderToSheet, fetchOrdersFromSheet as fetchAllOrdersForPopularity } from '@/services/google-sheets-service';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from "@/context/auth-context";


interface OrderItem extends Product {
  quantity: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc';

// Helper function to calculate product popularity using Name|Volume key from Google Sheets history
const calculatePopularityNameVolumeMapFromSheet = async (): Promise<Map<string, number>> => {
  const popularityMap = new Map<string, number>();
  try {
    const pastOrders: Order[] = await fetchAllOrdersForPopularity(); // Fetch orders from Google Sheets
    if (Array.isArray(pastOrders)) {
      pastOrders.forEach(ord => {
        ord.items.forEach(item => {
          const key = `${item.name}|${item.volume ?? ''}`;
          popularityMap.set(key, (popularityMap.get(key) || 0) + item.quantity);
        });
      });
    } else {
       console.warn("Invalid order data fetched from Google Sheets for popularity.");
    }
  } catch (e) {
    console.error("Error fetching or parsing sales history from Google Sheets for popularity:", e);
  }
  return popularityMap;
};

// Helper to map popularity from Name|Volume key back to local product ID
const mapPopularityToProductId = (products: Product[], popularityMap: Map<string, number>): Map<string, number> => {
    const productIdPopularityMap = new Map<string, number>();
    products.forEach(product => {
        const key = `${product.name}|${product.volume ?? ''}`;
        if (popularityMap.has(key)) {
            productIdPopularityMap.set(product.id, popularityMap.get(key)!);
        }
    });
    return productIdPopularityMap;
};


// Extracted Product Grid Component
const ProductGrid: React.FC<{
  products: Product[];
  orderQuantities: { [productId: string]: number };
  topProductsRanking: Map<string, number>;
  onAddToOrder: (product: Product) => void;
  onRemoveFromOrder: (productId: string) => void;
  isLoading?: boolean;
}> = React.memo(({ products, orderQuantities, topProductsRanking, onAddToOrder, onRemoveFromOrder, isLoading }) => {
  if (isLoading) {
    return <p className="text-muted-foreground">Загрузка товаров...</p>;
  }
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
});
ProductGrid.displayName = 'ProductGrid';


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
  isCheckoutProcessing: boolean;
}> = React.memo(({
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
  isCheckoutProcessing,
}) => (
  <>
    <CardContent className={cn(
      "p-0 flex-grow overflow-hidden min-h-0",
      isSheet ? "px-3 md:px-4" : "px-4 pt-0"
    )}>
       <ScrollArea className={cn("h-full pr-2 overflow-y-auto", isSheet ? "" : "lg:max-h-[calc(100vh-20rem)]")} type="auto">
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
                   <span className=" text-xs md:text-sm whitespace-nowrap font-sans">{((item.price ?? 0) * item.quantity).toFixed(0)} ₽</span>
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


export function OrderBuilder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [resolvedPopularityMap, setResolvedPopularityMap] = useState<Map<string, number>>(new Map());
  const [isPopularityLoading, setIsPopularityLoading] = useState(false);

  const { user: currentUser } = useAuth(); // Get current user for employee details
  const { toast } = useToast();
  const orderSheetTitleId = React.useId();
  const orderCardTitleId = React.useId();

  const loadProducts = useCallback(async (showLoadingIndicator = true) => {
      if (showLoadingIndicator) setIsLoading(true);
      setErrorLoading(null);
      try {
          const fetchedProducts = await fetchProductsFromSheet();
          setProducts(fetchedProducts);
          setOrder(prevOrder => prevOrder.map(orderItem => {
              const updatedProduct = fetchedProducts.find(p => p.id === orderItem.id);
              return updatedProduct ? { ...updatedProduct, quantity: orderItem.quantity } : null;
          }).filter((item): item is OrderItem => item !== null));
      } catch (error: any) {
          console.error("Failed to load products:", error);
          const errorMessage = error.message || "Не удалось получить список товаров из Google Sheets.";
          setErrorLoading(errorMessage);
          toast({
              title: "Ошибка загрузки товаров",
              description: errorMessage,
              variant: "destructive",
          });
          setProducts([]);
          setOrder([]);
      } finally {
          if (showLoadingIndicator) setIsLoading(false);
      }
  }, [toast]);


  useEffect(() => {
    setIsClient(true);
    try {
        const storedSortOption = localStorage.getItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY);
        if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
            setSortOption(storedSortOption as SortOption);
        } else {
            localStorage.setItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY, 'name-asc');
            setSortOption('name-asc');
        }
    } catch (lsError) { console.error("OrderBuilder: Error accessing localStorage for sort option.", lsError); }

    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (isClient) {
      try { localStorage.setItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY, sortOption); }
      catch (e) { console.error("OrderBuilder: Failed to save sort option to localStorage.", e); }
    }
  }, [sortOption, isClient]);


  const totalPrice = useMemo(() => {
    return order.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  }, [order]);


  useEffect(() => {
    const fetchPopularity = async () => {
      if (!isClient) return; // Ensure this runs only on the client
      setIsPopularityLoading(true);
      console.log("OrderBuilder: Fetching popularity map from sheet, version:", popularityVersion);
      try {
        const map = await calculatePopularityNameVolumeMapFromSheet();
        setResolvedPopularityMap(map);
      } catch (error) {
        console.error("OrderBuilder: Error fetching popularity map", error);
        toast({
          title: "Ошибка популярности",
          description: "Не удалось загрузить данные о популярности товаров.",
          variant: "destructive",
        });
      } finally {
        setIsPopularityLoading(false);
      }
    };

    fetchPopularity();
  }, [popularityVersion, isClient, toast]);


  // Map popularity to local product IDs and get ranking
  const topProductsRanking = useMemo(() => {
    const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
    const sortedByPopularity = Array.from(productIdPopularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    console.log("OrderBuilder: Calculated top product rankings:", ranking);
    return ranking;
  }, [products, resolvedPopularityMap]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    if (debouncedSearchTerm) {
      const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.volume?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    switch (sortOption) {
       case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
       case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
       case 'price-asc': result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
       case 'price-desc': result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
       case 'popularity-desc': {
         const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
         result.sort((a, b) => {
           const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
           if (popDiff !== 0) return popDiff;
           return a.name.localeCompare(b.name);
         });
         break;
       }
    }
    return result;
  }, [products, debouncedSearchTerm, sortOption, resolvedPopularityMap]);

  const orderQuantities = useMemo(() => {
    return order.reduce((quantities, item) => {
      quantities[item.id] = item.quantity;
      return quantities;
    }, {} as { [productId: string]: number });
  }, [order]);


  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  const addToOrder = useCallback((product: Product) => {
    setOrder((prevOrder) => {
      const existingItemIndex = prevOrder.findIndex((item) => item.id === product.id);
      if (existingItemIndex > -1) {
        const updatedOrder = [...prevOrder];
        updatedOrder[existingItemIndex] = {
          ...updatedOrder[existingItemIndex],
          quantity: updatedOrder[existingItemIndex].quantity + 1
        };
        return updatedOrder;
      } else {
        const price = product.price ?? 0;
        return [...prevOrder, { ...product, price, quantity: 1 }];
      }
    });
  }, []);

  const removeFromOrder = useCallback((productId: string) => {
    setOrder((prevOrder) => {
      const existingItemIndex = prevOrder.findIndex((item) => item.id === productId);
      if (existingItemIndex > -1) {
        const currentQuantity = prevOrder[existingItemIndex].quantity;
        if (currentQuantity > 1) {
          const updatedOrder = [...prevOrder];
          updatedOrder[existingItemIndex] = { ...updatedOrder[existingItemIndex], quantity: currentQuantity - 1 };
          return updatedOrder;
        } else {
          return prevOrder.filter((item) => item.id !== productId);
        }
      }
      return prevOrder;
    });
  }, []);

  const removeEntireItem = useCallback((productId: string) => {
    setOrder((prevOrder) => prevOrder.filter((item) => item.id !== productId));
  }, []);

  const clearOrder = useCallback(() => {
    setOrder([]);
    setSelectedPaymentMethod(null);
  }, []);

  const handleSelectPaymentMethod = useCallback((method: PaymentMethod) => {
      setSelectedPaymentMethod(method);
  }, []);

  const handleCheckout = useCallback(async () => {
    if (order.length === 0) {
      toast({ title: "Заказ пуст", description: "Пожалуйста, добавьте товары в заказ.", variant: "destructive" });
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ title: "Выберите способ оплаты", description: "Пожалуйста, укажите способ оплаты заказа.", variant: "destructive" });
      return;
    }

    setIsCheckoutProcessing(true);

    let employeeString = 'Неизвестный сотрудник';
    if (currentUser) {
      const initials = `${currentUser.lastName || ''} ${currentUser.firstName ? currentUser.firstName[0] + '.' : ''}${currentUser.middleName ? currentUser.middleName[0] + '.' : ''}`.trim();
      employeeString = `${currentUser.position || 'Сотрудник'} - ${initials} (${currentUser.login})`;
    }


    const orderData: Order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      items: order.map(item => ({
        id: item.id,
        name: item.name,
        volume: item.volume,
        price: item.price ?? 0,
        quantity: item.quantity,
      })),
      totalPrice: totalPrice,
      timestamp: new Date().toISOString(),
      paymentMethod: selectedPaymentMethod,
      employee: employeeString,
    };

    try {
      const success = await addOrderToSheet(orderData); // Save to Google Sheet

      if (success) {
        setPopularityVersion(v => v + 1); // Trigger popularity recalculation
        toast({ title: "Заказ оформлен!", description: `Итого: ${totalPrice.toFixed(0)} ₽ (${selectedPaymentMethod}). Ваш заказ сохранен в Google Sheets.` });
        clearOrder();
        setIsSheetOpen(false);
      } else {
        toast({ title: "Ошибка оформления заказа", description: "Не удалось сохранить заказ в Google Sheets.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to save order to Google Sheet:", error);
      toast({ title: "Ошибка оформления заказа", description: "Не удалось сохранить заказ в Google Sheets.", variant: "destructive" });
    } finally {
      setIsCheckoutProcessing(false);
    }
  }, [order, selectedPaymentMethod, totalPrice, toast, clearOrder, currentUser]);


  const handleRefresh = useCallback(async () => {
      await loadProducts(true);
      setPopularityVersion(v => v + 1); // Also refresh popularity
      if (!errorLoading) {
         toast({ title: "Список обновлен", description: "Данные товаров загружены из Google Sheets." });
      }
  }, [loadProducts, toast, errorLoading]);


   if (!isClient) {
     return (
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2"><p>Загрузка конструктора...</p></div>
         <div className="lg:col-span-1">
           <Card className="shadow-lg lg:sticky lg:top-8"><CardHeader><CardTitle>Текущий заказ</CardTitle></CardHeader><CardContent><p>Загрузка...</p></CardContent></Card>
         </div>
       </div>
     );
   }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 pb-16 lg:pb-0">
      <div className="lg:col-span-2">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-primary">Доступные товары</h2>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleRefresh} className={cn("h-8 w-8 text-muted-foreground", (isLoading || isPopularityLoading) && "animate-spin")} disabled={isLoading || isCheckoutProcessing || isPopularityLoading}>
                            <RefreshCw className="h-4 w-4" />
                            <span className="sr-only">Обновить список</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Обновить список товаров из Google Sheets</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
         </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 h-9"
              disabled={isLoading || isCheckoutProcessing || isPopularityLoading}
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")} disabled={isLoading || isCheckoutProcessing || isPopularityLoading}>
                <X className="h-4 w-4" /> <span className="sr-only">Очистить поиск</span>
              </Button>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs sm:text-sm" disabled={isLoading || isCheckoutProcessing || isPopularityLoading}>
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Сортировать
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleSetSortOption('name-asc')} className={cn(sortOption === 'name-asc' && 'bg-accent text-accent-foreground')}> <ArrowDownAZ className="mr-2 h-4 w-4" /> <span>Названию (А-Я)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}> <ArrowDownZA className="mr-2 h-4 w-4" /> <span>Названию (Я-А)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}> <ArrowDown01 className="mr-2 h-4 w-4" /> <span>Цене (возрастание)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}> <ArrowDown10 className="mr-2 h-4 w-4" /> <span>Цене (убывание)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}> <TrendingUp className="mr-2 h-4 w-4" /> <span>Популярности (сначала топ)</span> </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {errorLoading && !isLoading && (
          <p className="text-destructive text-center py-4">Ошибка загрузки: {errorLoading}</p>
        )}

        {!errorLoading && (
            <ProductGrid
            products={filteredAndSortedProducts}
            orderQuantities={orderQuantities}
            topProductsRanking={topProductsRanking}
            onAddToOrder={addToOrder}
            onRemoveFromOrder={removeFromOrder}
            isLoading={isLoading || isPopularityLoading}
            />
        )}
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-2 bg-background border-t">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-12 shadow-lg text-base flex items-center justify-between" disabled={isCheckoutProcessing}>
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
                <span className="font-semibold font-sans">{totalPrice.toFixed(0)} ₽</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-lg h-[75vh] flex flex-col p-0"
            aria-labelledby={orderSheetTitleId}
            aria-describedby={undefined} // No specific description needed if title is clear
          >
            <VisuallyHidden><SheetTitle id={orderSheetTitleId}>Текущий заказ</SheetTitle></VisuallyHidden>
            <SheetHeader className="p-3 md:p-4 border-b text-left">
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
              onSelectPaymentMethod={handleSelectPaymentMethod}
              onCheckout={handleCheckout}
              onClearOrder={clearOrder}
              orderCardTitleId={orderCardTitleId} // This ID is for the desktop card title
              orderSheetTitleId={orderSheetTitleId} // This ID is for the sheet title (now visually hidden)
              isCheckoutProcessing={isCheckoutProcessing}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden lg:block lg:col-span-1">
         <Card className="shadow-md lg:sticky lg:top-4 md:top-8 max-h-[calc(100vh-4rem)] flex flex-col">
          <CardHeader className="p-3 md:p-4 pb-3 flex-shrink-0" aria-labelledby={orderCardTitleId}>
            <CardTitle id={orderCardTitleId} className="text-xl">Текущий заказ</CardTitle>
          </CardHeader>
          <OrderDetails
            order={order}
            totalPrice={totalPrice}
            selectedPaymentMethod={selectedPaymentMethod}
            onRemoveFromOrder={removeFromOrder}
            onAddToOrder={addToOrder}
            onRemoveEntireItem={removeEntireItem}
            onSelectPaymentMethod={handleSelectPaymentMethod}
            onCheckout={handleCheckout}
            onClearOrder={clearOrder}
            orderCardTitleId={orderCardTitleId}
            orderSheetTitleId={orderSheetTitleId} // Pass sheet title ID though not directly used here
            isCheckoutProcessing={isCheckoutProcessing}
          />
        </Card>
      </div>
    </div>
  );
}
