

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { PaymentMethod, Order, OrderItem as SalesHistoryItem } from "@/types/order"; // Import Order, OrderItem (renamed SalesHistoryItem to avoid conflict), and PaymentMethod types
import { MinusCircle, PlusCircle, Trash2, CreditCard, Banknote, Smartphone, Search, ShoppingCart, X, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, SlidersHorizontal, TrendingUp } from "lucide-react"; // Added sorting icons, TrendingUp
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input"; // Added Input
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose, // Import Sheet components
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'; // Import VisuallyHidden
import { ProductCard } from './product-card'; // Import the new component


interface OrderItem extends Product {
  quantity: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc'; // Removed 'default', name-asc is now the implicit default
const SORT_STORAGE_KEY = 'orderBuilderSortOption'; // Key for localStorage

export function OrderBuilder() {
  // --- All Hooks called unconditionally at the top ---
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(""); // State for search term
  const [sortOption, setSortOption] = useState<SortOption>('name-asc'); // State for sorting, default to 'name-asc'
  const [popularityVersion, setPopularityVersion] = useState<number>(0); // State to trigger popularity recalculation
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false); // State for mobile sheet
  const orderSheetTitleId = React.useId(); // Generate a unique ID for sheet title
  const orderCardTitleId = React.useId(); // Generate a unique ID for card title


  // Effect to set isClient and load initial data (products, sort option)
  useEffect(() => {
    setIsClient(true);
    console.log("OrderBuilder: useEffect running, isClient=true");

    let loadedProducts: Product[] = []; // Initialize as empty array

    try {
      // Load products
      const storedProducts = localStorage.getItem("coffeeProducts");
      console.log("OrderBuilder: storedProducts from localStorage:", storedProducts ? storedProducts.substring(0, 100) + '...' : null);

      if (storedProducts) {
        try {
          const parsedProducts: any = JSON.parse(storedProducts);
          if (Array.isArray(parsedProducts) && parsedProducts.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number')) {
            console.log("OrderBuilder: Parsed valid products from localStorage.", parsedProducts.length);
            loadedProducts = parsedProducts as Product[];
          } else {
            console.warn("OrderBuilder: Stored products invalid structure or empty, initializing as empty.");
             localStorage.removeItem("coffeeProducts"); // Clear invalid data
             // loadedProducts remains empty array
          }
        } catch (e) {
          console.error("OrderBuilder: Failed to parse products from localStorage, initializing as empty.", e);
           localStorage.removeItem("coffeeProducts"); // Clear invalid data
           // loadedProducts remains empty array
        }
      } else {
        console.log("OrderBuilder: No products found in localStorage, initializing as empty.");
        // loadedProducts remains empty array
      }

      // Load sort option
      const storedSortOption = localStorage.getItem(SORT_STORAGE_KEY);
      if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
        setSortOption(storedSortOption as SortOption);
        console.log("OrderBuilder: Loaded sort option from localStorage:", storedSortOption);
      } else {
         console.log("OrderBuilder: No valid sort option found in localStorage, using default.");
         // Keep default 'name-asc'
      }

    } catch (lsError) {
        console.error("OrderBuilder: Error accessing localStorage. Initializing as empty.", lsError);
        // loadedProducts remains empty array
         toast({
            title: "Ошибка LocalStorage",
            description: "Не удалось загрузить данные. Настройки могут быть сброшены.",
            variant: "destructive",
         });
    }

    setProducts(loadedProducts);
    console.log("OrderBuilder: setProducts called with:", loadedProducts.length, "products");

  }, [toast]); // Added toast dependency


  // Effect to update total price
  useEffect(() => {
    if (isClient) {
      const newTotalPrice = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
      setTotalPrice(newTotalPrice);
    }
  }, [order, isClient]);

   // Effect to handle storage changes for products
   useEffect(() => {
    if (!isClient) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "coffeeProducts") { // Check even if newValue is null (meaning cleared)
         console.log("OrderBuilder: Detected storage change for coffeeProducts.");
         let updatedProducts: Product[] = []; // Default to empty if cleared or invalid
        try {
           if (event.newValue) { // Only parse if there's a new value
               const parsed = JSON.parse(event.newValue);
               // Validate the updated products
               if (Array.isArray(parsed) && parsed.every(p => p && typeof p.id === 'string')) {
                  console.log("OrderBuilder: Applying updated products from storage event.", parsed.length);
                  updatedProducts = parsed;
               } else {
                  console.warn("OrderBuilder: Invalid data received from storage event. Clearing products.");
                  // Keep updatedProducts as empty array
               }
           } else {
               console.log("OrderBuilder: coffeeProducts cleared in storage. Clearing products.");
               // Keep updatedProducts as empty array
           }
        } catch (e) {
          console.error("OrderBuilder: Error processing storage event:", e);
          // Keep updatedProducts as empty array on error
        }

        // Always update state, even if it's to an empty array
        setProducts(updatedProducts);
        // Also update items in the current order if their info changed or they were deleted
        setOrder(prevOrder => {
            const updatedOrder = prevOrder.map(orderItem => {
                const updatedProduct = updatedProducts.find(p => p.id === orderItem.id);
                return updatedProduct ? { ...updatedProduct, quantity: orderItem.quantity } : null;
            }).filter(item => item !== null) as OrderItem[];

             console.log("OrderBuilder: Order updated based on storage change.", updatedOrder.length);
             return updatedOrder;
        });
      }
      // Listen for order changes to potentially refresh popularity
      if (event.key === "coffeeOrders" && sortOption === 'popularity-desc') {
         console.log("OrderBuilder: Detected order change, refreshing popularity sort.");
         setPopularityVersion(v => v + 1); // Trigger recalculation
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient, sortOption]); // Rerun if isClient or sortOption changes


  // Function to update sort option and save to localStorage
  const handleSetSortOption = (newSortOption: SortOption) => {
    setSortOption(newSortOption);
    if (isClient) {
      try {
        localStorage.setItem(SORT_STORAGE_KEY, newSortOption);
        console.log("OrderBuilder: Saved sort option to localStorage:", newSortOption);
      } catch (e) {
        console.error("OrderBuilder: Failed to save sort option to localStorage.", e);
      }
    }
  };


  // Memoize filtered and sorted products
  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return []; // Return empty array on server

    console.log("OrderBuilder: Recalculating filtered/sorted products. PopularityVersion:", popularityVersion); // Log recalculation
    let result = [...products]; // Create a copy to avoid mutating original state

    // 1. Filter by search term
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // 2. Sort based on selected option
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
        console.log("OrderBuilder: Sorting by popularity.");
        const popularityMap = new Map<string, number>();
        try {
          const storedOrders = localStorage.getItem('coffeeOrders');
          if (storedOrders) {
            const pastOrders: Order[] = JSON.parse(storedOrders);
            if (Array.isArray(pastOrders)) {
              pastOrders.forEach(ord => {
                ord.items.forEach(item => {
                  popularityMap.set(item.id, (popularityMap.get(item.id) || 0) + item.quantity);
                });
              });
               console.log("OrderBuilder: Popularity map calculated:", Object.fromEntries(popularityMap));
            }
          }
        } catch (e) {
          console.error("Error reading or parsing sales history for sorting:", e);
          // Proceed without popularity data if error occurs
        }
        result.sort((a, b) => (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0));
        break;
      }
      default: // Should technically not happen with the new SortOption type, but good practice
         // Fallback to name-asc if something goes wrong or state is invalid
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [products, searchTerm, sortOption, isClient, popularityVersion]); // Added popularityVersion dependency


  // Memoize order quantities for quick lookup in ProductCard
  const orderQuantities = useMemo(() => {
    const quantities: { [productId: string]: number } = {};
    order.forEach(item => {
      quantities[item.id] = item.quantity;
    });
    return quantities;
  }, [order]);

  // --- End of Hooks ---

  // --- Functions ---
  const addToOrder = (product: Product) => {
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
  };

  const removeFromOrder = (productId: string) => {
    setOrder((prevOrder) => {
      const existingItem = prevOrder.find((item) => item.id === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prevOrder.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        // Completely remove the item if quantity is 1 or less
        return prevOrder.filter((item) => item.id !== productId);
      }
    });
  };

  // New function to completely remove an item regardless of quantity
  const removeEntireItem = (productId: string) => {
     setOrder((prevOrder) => prevOrder.filter((item) => item.id !== productId));
  };


  const clearOrder = () => {
    setOrder([]);
    setSelectedPaymentMethod(null); // Reset payment method on clear
  };

  const handleCheckout = () => {
    if (!isClient) return;

    if (order.length === 0) {
        toast({
            title: "Заказ пуст",
            description: "Пожалуйста, добавьте товары в заказ.",
            variant: "destructive",
        });
        return;
    }

    if (!selectedPaymentMethod) {
        toast({
            title: "Выберите способ оплаты",
            description: "Пожалуйста, укажите способ оплаты заказа.",
            variant: "destructive",
        });
        return;
    }

    const orderData: Order = { // Use the Order type
        id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        items: order.map(item => ({
            // Keep only necessary fields for the saved order item
            id: item.id,
            name: item.name,
            volume: item.volume,
            price: item.price,
            quantity: item.quantity,
            // Explicitly exclude imageUrl and dataAiHint from the saved order item
        })),
        totalPrice: totalPrice,
        timestamp: new Date().toISOString(),
        paymentMethod: selectedPaymentMethod, // Add selected payment method
    };


    try {
      // Ensure the loaded data is treated as Order[]
      const pastOrders: Order[] = JSON.parse(localStorage.getItem("coffeeOrders") || "[]");
      pastOrders.push(orderData);
      localStorage.setItem("coffeeOrders", JSON.stringify(pastOrders));

      // Dispatch storage event to notify other components (like SalesHistory and itself for popularity update)
      window.dispatchEvent(new StorageEvent('storage', {
          key: 'coffeeOrders',
          newValue: JSON.stringify(pastOrders),
          storageArea: localStorage,
      }));

      // If sorting by popularity, trigger a recalculation
      if (sortOption === 'popularity-desc') {
          setPopularityVersion(v => v + 1);
      }


      toast({
        title: "Заказ оформлен!",
        description: `Итого: ${totalPrice.toFixed(0)} ₽ (${selectedPaymentMethod}). Ваш заказ сохранен.`,
      });
      clearOrder();
      setIsSheetOpen(false); // Close sheet on successful checkout
    } catch (error) {
       console.error("Failed to save order:", error);
       toast({
         title: "Ошибка оформления заказа",
         description: "Не удалось сохранить заказ. Пожалуйста, попробуйте еще раз.",
         variant: "destructive",
       });
    }
  };

  // --- Sub-component for Order Details ---
  const OrderDetails = ({ isSheet = false }: { isSheet?: boolean }) => (
    <>
       {/* Header with Title (conditionally rendered inside SheetContent or Card) */}
       {isSheet && (
          <SheetHeader className="p-3 md:p-4 border-b text-left">
              <SheetTitle id={orderSheetTitleId}>Текущий заказ</SheetTitle>
          </SheetHeader>
       )}
       {!isSheet && (
          <CardHeader
              className="p-3 md:p-4 pb-3"
              aria-labelledby={orderCardTitleId}
          >
              <CardTitle id={orderCardTitleId} className="text-xl">Текущий заказ</CardTitle>
          </CardHeader>
        )}

      {/* Content Area with Scroll */}
       <CardContent className={cn(
          "p-0 flex-grow overflow-hidden min-h-0",
          isSheet ? "px-3 md:px-4" : "px-4 pt-0"
      )}>
          <ScrollArea className="h-full pr-2">
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
                        <span className="font-mono text-xs md:text-sm whitespace-nowrap">{(item.price * item.quantity).toFixed(0)} ₽</span>
                     </div>
                     <div className="flex items-center gap-1 md:gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => removeFromOrder(item.id)}>
                          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          <span className="sr-only">Убрать 1 {item.name}</span>
                       </Button>
                        <Badge variant="secondary" className="px-1.5 py-0.5 text-xs md:text-sm font-medium min-w-[24px] justify-center">
                           {item.quantity}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => addToOrder(item)}>
                           <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                           <span className="sr-only">Добавить 1 {item.name}</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10 ml-1" onClick={() => removeEntireItem(item.id)}>
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
           isSheet ? "border-t pt-3" : "pt-2"
           )}>
           {!isSheet && order.length > 0 && <Separator className="mb-3" />}

          {order.length > 0 ? (
             <>
              <div className="flex justify-between w-full font-semibold text-sm md:text-base">
                 <span>Итого:</span>
                 <span>{totalPrice.toFixed(0)} ₽</span>
              </div>

              {/* Payment Method Selection */}
              <div className="w-full pt-1">
                 <p className="text-xs text-muted-foreground mb-1.5">Способ оплаты:</p>
                 <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                     {(['Наличные', 'Карта', 'Перевод'] as PaymentMethod[]).map((method) => (
                        <Button
                         key={method}
                         variant={selectedPaymentMethod === method ? "default" : "outline"}
                         onClick={() => setSelectedPaymentMethod(method)}
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
                     onClick={handleCheckout}
                     className="flex-1 h-8 md:h-9 text-xs md:text-sm bg-primary hover:bg-primary/90 px-2"
                     disabled={!selectedPaymentMethod}
                 >
                 Оформить заказ
                 </Button>
                 <Button variant="outline" onClick={clearOrder} className="h-8 md:h-9 text-xs md:text-sm px-2">
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

  // --- Conditional Return for SSR Loading State ---
  if (!isClient) {
    return (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2">
                <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>
                 <div className="flex gap-2 mb-4">
                    <div className="relative flex-grow">
                       <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                       <Input
                           placeholder="Поиск товаров..."
                           className="pl-8 pr-8 h-9" // Add pr-8 for clear button
                           disabled // Disable while loading
                       />
                       {/* Placeholder for clear button */}
                    </div>
                     <Button variant="outline" size="sm" className="h-9 px-3" disabled>
                        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                        Сортировать
                     </Button>
                 </div>
                <p className="text-muted-foreground">Загрузка товаров...</p>
             </div>
             <div className="lg:col-span-1">
                 {/* Placeholder for the order card during SSR */}
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
           {/* Search Input */}
           <div className="relative flex-grow">
             <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
             <Input
               placeholder="Поиск товаров..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-8 pr-8 h-9" // Adjusted height and padding (added pr-8 for clear button)
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

           {/* Sort Dropdown */}
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
                    <ArrowDownAZ className="mr-2 h-4 w-4" />
                    <span>Названию (А-Я)</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}>
                     <ArrowDownZA className="mr-2 h-4 w-4" />
                     <span>Названию (Я-А)</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}>
                     <ArrowDown01 className="mr-2 h-4 w-4" />
                     <span>Цене (возрастание)</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}>
                     <ArrowDown10 className="mr-2 h-4 w-4" />
                     <span>Цене (убывание)</span>
                 </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      <span>Популярности (сначала топ)</span>
                  </DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
         </div>


        {products.length === 0 ? (
           <p className="text-muted-foreground">Товары отсутствуют. Добавьте их вручную или загрузите начальный список во вкладке "Управление товарами".</p>
        ) : filteredAndSortedProducts.length === 0 ? (
           <p className="text-muted-foreground">Товары по вашему запросу не найдены.</p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
          {filteredAndSortedProducts.map((product) => (
             <ProductCard
                 key={product.id}
                 product={product}
                 onAddToOrder={addToOrder}
                 onRemoveFromOrder={removeFromOrder} // Pass the remove function
                 orderQuantity={orderQuantities[product.id]} // Pass the quantity from memoized map
             />
          ))}
        </div>
         )}
      </div>

       {/* Mobile Order Sheet Trigger - Full Width Button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-2 bg-background border-t">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                   <Button className="w-full h-12 shadow-lg text-base flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" /> {/* Keep icon on mobile trigger */}
                        {order.length > 0 && (
                            <Badge
                              variant="secondary" // Use secondary for less distraction
                              className="h-5 w-auto px-1.5 justify-center text-xs font-medium"
                            >
                              {order.reduce((sum, item) => sum + item.quantity, 0)} поз.
                            </Badge>
                          )}
                        <span>Корзина</span> {/* Changed label back to "Корзина" */}
                     </div>
                     {totalPrice > 0 && (
                        <span className="font-semibold">{totalPrice.toFixed(0)} ₽</span>
                     )}
                   </Button>
              </SheetTrigger>
              <SheetContent
                 side="bottom"
                 className="rounded-t-lg h-[75vh] flex flex-col p-0"
                 aria-labelledby={orderSheetTitleId} // Use the unique ID for aria-labelledby
              >
                  {/* OrderDetails now renders its own header and title */}
                  <OrderDetails isSheet={true} />
              </SheetContent>
            </Sheet>
        </div>


       {/* Desktop Current Order - Adjusted Layout for Scrolling */}
       <div className="hidden lg:block lg:col-span-1">
         {/* Made Card sticky and flex column, set max-height */}
         <Card className="shadow-md lg:sticky lg:top-4 md:top-8 max-h-[calc(100vh-4rem)] flex flex-col">
            <VisuallyHidden>
                 {/* Title is now rendered inside OrderDetails for better accessibility structure */}
                 <SheetTitle id={orderCardTitleId}>Текущий заказ (Десктоп)</SheetTitle> {/* Added hidden title for accessibility */}
            </VisuallyHidden>
           <OrderDetails />
         </Card>
       </div>

    </div>
  );
}


