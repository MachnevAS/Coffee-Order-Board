
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { PaymentMethod, Order } from "@/types/order"; // Import Order and PaymentMethod types
import { MinusCircle, PlusCircle, ShoppingCart, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


interface OrderItem extends Product {
  quantity: number;
}

export function OrderBuilder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    console.log("OrderBuilder: useEffect running, isClient=true");

    let loadedProducts: Product[] = []; // Initialize as empty array

    try {
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
    } catch (lsError) {
        console.error("OrderBuilder: Error accessing localStorage. Initializing as empty.", lsError);
        // loadedProducts remains empty array
         toast({
            title: "Ошибка LocalStorage",
            description: "Не удалось загрузить товары. Список будет пустым.",
            variant: "destructive",
         });
    }

    setProducts(loadedProducts);
    console.log("OrderBuilder: setProducts called with:", loadedProducts.length, "products");

  }, [toast]); // Added toast dependency


  useEffect(() => {
    if (isClient) {
      const newTotalPrice = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
      setTotalPrice(newTotalPrice);
    }
  }, [order, isClient]);

   // Update products in state if they change in localStorage (e.g., from ProductManagement)
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
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient]); // Rerun only if isClient changes


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

      toast({
        title: "Заказ оформлен!",
        description: `Итого: ${totalPrice.toFixed(0)} ₽ (${selectedPaymentMethod}). Ваш заказ сохранен.`,
      });
      clearOrder();
    } catch (error) {
       console.error("Failed to save order:", error);
       toast({
         title: "Ошибка оформления заказа",
         description: "Не удалось сохранить заказ. Пожалуйста, попробуйте еще раз.",
         variant: "destructive",
       });
    }
  };


  if (!isClient) {
    return (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2">
                <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>
                <p className="text-muted-foreground">Загрузка товаров...</p>
             </div>
             <div className="lg:col-span-1">
                 <Card className="sticky top-8 shadow-lg">
                    <CardHeader>
                       <CardTitle className="flex items-center justify-between">
                        <span>Текущий заказ</span>
                        <ShoppingCart className="h-5 w-5 text-primary" />
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
      {/* Product List */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>
        {products.length === 0 ? (
           <p className="text-muted-foreground">Товары отсутствуют. Добавьте их вручную или загрузите начальный список во вкладке "Управление товарами".</p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col text-xs md:text-sm">
              <CardHeader className="p-0">
                <div className="relative h-20 w-full">
                   <Image
                    src={product.imageUrl || `https://picsum.photos/100/80?random=${product.id}`}
                    alt={product.name}
                    fill // Use fill instead of layout="fill"
                    style={{objectFit:"cover"}} // Use style object for objectFit
                    data-ai-hint={product.dataAiHint || 'кофе'}
                    className="bg-muted"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw"
                    onError={(e) => { e.currentTarget.src = `https://picsum.photos/100/80?random=${product.id}&error=1` }} // Fallback for broken image URLs
                    />
                </div>
              </CardHeader>
              <CardContent className="p-1.5 md:p-2 flex-grow">
                 <CardTitle className="text-xs md:text-sm font-medium mb-0.5 line-clamp-2 leading-tight">
                     {product.name} {product.volume && <span className="text-muted-foreground font-normal">({product.volume})</span>}
                 </CardTitle>
                 <p className="text-xs md:text-sm text-foreground font-semibold">{product.price.toFixed(0)} ₽</p>
              </CardContent>
              <CardFooter className="p-1.5 md:p-2 pt-0 mt-auto">
                <Button onClick={() => addToOrder(product)} className="w-full h-7 md:h-8 text-xs" variant="outline">
                  <PlusCircle className="mr-1 h-3 w-3" /> Добавить
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
         )}
      </div>

      {/* Current Order */}
      <div className="lg:col-span-1">
        <Card className="sticky top-4 md:top-8 shadow-md">
          <CardHeader className="p-3 md:p-4">
            <CardTitle className="text-base md:text-lg flex items-center justify-between">
              <span>Текущий заказ</span>
               <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[300px] md:max-h-[400px] overflow-y-auto p-3 md:p-4 pt-0">
            {order.length === 0 ? (
              <p className="text-muted-foreground text-center py-3 md:py-4 text-sm">Ваш заказ пуст.</p>
            ) : (
              <ul className="space-y-2 md:space-y-3">
                {order.map((item) => (
                  <li key={item.id} className="flex justify-between items-center text-sm gap-2">
                    <div className="flex-grow overflow-hidden"> {/* Allow name to take space */}
                      <span className="font-medium block truncate">{item.name} {item.volume && <span className="text-xs text-muted-foreground">({item.volume})</span>}</span>
                       <span className="font-mono text-xs md:text-sm whitespace-nowrap">{(item.price * item.quantity).toFixed(0)} ₽</span>
                    </div>
                    <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0"> {/* Prevent controls from shrinking */}
                       <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => removeFromOrder(item.id)}>
                         <MinusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                         <span className="sr-only">Убрать 1 {item.name}</span>
                      </Button>
                       <Badge variant="secondary" className="px-1.5 py-0 text-xs md:text-sm font-medium min-w-[24px] justify-center"> {/* Quantity display */}
                          {item.quantity}
                       </Badge>
                       <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7" onClick={() => addToOrder(item)}>
                          <PlusCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                          <span className="sr-only">Добавить 1 {item.name}</span>
                       </Button>
                       {/* Add a separate button to remove the item completely */}
                       <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10 ml-1" onClick={() => removeEntireItem(item.id)}>
                           <Trash2 className="h-3.5 w-3.5" />
                           <span className="sr-only">Удалить {item.name} из заказа</span>
                       </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-col gap-2 md:gap-3 p-3 md:p-4 pt-3">
             {order.length > 0 && (
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
                                "h-8 md:h-9 text-xs md:text-sm flex-col items-center justify-center px-1 py-1 leading-tight", // Added flex-col, adjusted padding/line-height
                                selectedPaymentMethod === method ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : ''
                            )}
                            size="sm" // Use sm size for smaller buttons
                           >
                             {method === 'Наличные' && <Banknote className="h-3 w-3 md:h-4 md:w-4 mb-0.5" />}
                             {method === 'Карта' && <CreditCard className="h-3 w-3 md:h-4 md:w-4 mb-0.5" />}
                             {method === 'Перевод' && <Smartphone className="h-3 w-3 md:h-4 md:w-4 mb-0.5" />}
                             {method}
                           </Button>
                        ))}
                    </div>
                 </div>


                 <div className="flex gap-2 w-full pt-2">
                    <Button
                        onClick={handleCheckout}
                        className="flex-1 h-8 md:h-9 text-xs md:text-sm bg-primary hover:bg-primary/90" // Changed to primary color
                        disabled={!selectedPaymentMethod} // Disable if no payment method selected
                    >
                    Оформить заказ
                    </Button>
                    <Button variant="outline" onClick={clearOrder} className="h-8 md:h-9 text-xs md:text-sm px-3">
                        <Trash2 className="mr-1 h-3 w-3" /> Очистить
                    </Button>
                 </div>

                </>
             )}
              {order.length === 0 && (
                 <p className="text-muted-foreground text-center text-xs md:text-sm w-full">Добавьте товары, чтобы увидеть итоговую сумму.</p>
              )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

