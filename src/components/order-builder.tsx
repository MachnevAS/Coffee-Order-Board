
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import { MinusCircle, PlusCircle, ShoppingCart, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDefaultProducts } from "@/lib/product-defaults"; // Import defaults

interface OrderItem extends Product {
  quantity: number;
}

export function OrderBuilder() {
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only once on the client after hydration
    setIsClient(true);
    console.log("OrderBuilder: useEffect running, isClient=true");

    let loadedProducts: Product[] | null = null; // Temp variable

    try { // Wrap localStorage access
      const storedProducts = localStorage.getItem("coffeeProducts");
      console.log("OrderBuilder: storedProducts from localStorage:", storedProducts ? storedProducts.substring(0, 100) + '...' : null);

      if (storedProducts) {
        try {
          const parsedProducts: any = JSON.parse(storedProducts);
          // More robust validation
          if (Array.isArray(parsedProducts) && parsedProducts.length > 0 && parsedProducts.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number')) {
            console.log("OrderBuilder: Parsed valid products from localStorage.", parsedProducts.length);
            loadedProducts = parsedProducts as Product[];
          } else {
            console.warn("OrderBuilder: Stored products invalid structure or empty, falling back to defaults.");
             localStorage.removeItem("coffeeProducts"); // Clear invalid data
          }
        } catch (e) {
          console.error("OrderBuilder: Failed to parse products from localStorage, falling back to defaults.", e);
           localStorage.removeItem("coffeeProducts"); // Clear invalid data
        }
      } else {
        console.log("OrderBuilder: No products found in localStorage, using defaults.");
      }

      // If loadedProducts is still null, use defaults
      if (loadedProducts === null) {
        const defaultProds = getDefaultProducts();
        console.log("OrderBuilder: Setting default products.", defaultProds.length);
        loadedProducts = defaultProds;
        try {
            localStorage.setItem("coffeeProducts", JSON.stringify(defaultProds));
            console.log("OrderBuilder: Saved default products to localStorage.");
        } catch (lsError) {
            console.error("OrderBuilder: Failed to save default products to localStorage.", lsError);
             toast({
                title: "Ошибка LocalStorage",
                description: "Не удалось сохранить начальные товары.",
                variant: "destructive",
             });
        }
      }
    } catch (lsError) {
        console.error("OrderBuilder: Error accessing localStorage. Using defaults.", lsError);
        const defaultProds = getDefaultProducts();
        console.log("OrderBuilder: Setting default products due to localStorage access error.");
        loadedProducts = defaultProds;
         toast({
            title: "Ошибка LocalStorage",
            description: "Не удалось загрузить или сохранить товары. Используются значения по умолчанию.",
            variant: "destructive",
         });
    }

    // Set state *once*
    setProducts(loadedProducts);
    console.log("OrderBuilder: setProducts called with:", loadedProducts.length, "products");

  }, []); // Run only once on mount


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
      if (event.key === "coffeeProducts" && event.newValue) {
         console.log("OrderBuilder: Detected storage change for coffeeProducts.");
        try {
          const updatedProducts = JSON.parse(event.newValue);
           // Validate the updated products
          if (Array.isArray(updatedProducts) && updatedProducts.every(p => p && typeof p.id === 'string')) {
             console.log("OrderBuilder: Applying updated products from storage event.", updatedProducts.length);
            setProducts(updatedProducts);
            // Also update items in the current order if their info changed
            setOrder(prevOrder => {
                const updatedOrder = prevOrder.map(orderItem => {
                    const updatedProduct = updatedProducts.find(p => p.id === orderItem.id);
                    // Keep quantity, update the rest if product exists
                    return updatedProduct ? { ...updatedProduct, quantity: orderItem.quantity } : null; // Mark for removal if product deleted
                }).filter(item => item !== null) as OrderItem[]; // Filter out removed items

                 console.log("OrderBuilder: Order updated based on storage change.", updatedOrder.length);
                 return updatedOrder;
            });
          } else {
             console.warn("OrderBuilder: Invalid data received from storage event. Ignoring.");
          }
        } catch (e) {
          console.error("OrderBuilder: Error processing storage event:", e);
        }
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
        return prevOrder.filter((item) => item.id !== productId);
      }
    });
  };

  const clearOrder = () => {
    setOrder([]);
  };

  const handleCheckout = () => {
    if (!isClient) return; // Don't run on server

    if (order.length === 0) {
        toast({
            title: "Заказ пуст",
            description: "Пожалуйста, добавьте товары в заказ перед оформлением.",
            variant: "destructive",
        });
        return;
    }

    const orderData = {
        id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Add unique ID
        // Include volume in saved items if it exists
        items: order.map(item => ({ name: item.name, volume: item.volume, quantity: item.quantity, price: item.price })),
        totalPrice: totalPrice,
        timestamp: new Date().toISOString(),
    };

    // Simulate saving to a database (using local storage for demo)
    try {
      const pastOrders = JSON.parse(localStorage.getItem("coffeeOrders") || "[]");
      pastOrders.push(orderData);
      localStorage.setItem("coffeeOrders", JSON.stringify(pastOrders));

      toast({
        title: "Заказ оформлен!",
        description: `Итого: ${totalPrice.toFixed(2)} ₽. Ваш заказ сохранен.`,
      });
      clearOrder(); // Clear the order after successful checkout
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
    // Simple text loader for server-side rendering or before hydration
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8"> {/* Reduced gap */}
      {/* Product List */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>
        {products.length === 0 ? (
           <p className="text-muted-foreground">Товары отсутствуют. Добавьте их во вкладке "Управление товарами".</p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3"> {/* More cols on larger screens, smaller gap */}
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col text-xs md:text-sm"> {/* Reduced shadow, faster transition, smaller base text */}
              <CardHeader className="p-0">
                <div className="relative h-20 w-full"> {/* Smaller image */}
                   <Image
                    src={product.imageUrl || `https://picsum.photos/100/80?random=${product.id}`} // Smaller placeholder
                    alt={product.name}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint={product.dataAiHint || 'кофе'}
                    className="bg-muted"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw" // Optimize image loading
                    />
                </div>
              </CardHeader>
              <CardContent className="p-1.5 md:p-2 flex-grow"> {/* Reduced padding */}
                 <CardTitle className="text-xs md:text-sm font-medium mb-0.5 line-clamp-2 leading-tight"> {/* Reduced font-size, weight, margin, leading */}
                     {product.name} {product.volume && <span className="text-muted-foreground font-normal">({product.volume})</span>}
                 </CardTitle>
                 <p className="text-xs md:text-sm text-foreground font-semibold">{product.price.toFixed(0)} ₽</p> {/* Removed decimals */}
              </CardContent>
              <CardFooter className="p-1.5 md:p-2 pt-0 mt-auto"> {/* Reduced padding */}
                <Button onClick={() => addToOrder(product)} className="w-full h-7 md:h-8 text-xs" variant="outline"> {/* Smaller button */}
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
        <Card className="sticky top-4 md:top-8 shadow-md"> {/* Reduced shadow */}
          <CardHeader className="p-3 md:p-4"> {/* Reduced padding */}
            <CardTitle className="text-base md:text-lg flex items-center justify-between"> {/* Smaller title */}
              <span>Текущий заказ</span>
               <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[300px] md:max-h-[400px] overflow-y-auto p-3 md:p-4 pt-0"> {/* Reduced padding */}
            {order.length === 0 ? (
              <p className="text-muted-foreground text-center py-3 md:py-4 text-sm">Ваш заказ пуст.</p>
            ) : (
              <ul className="space-y-2 md:space-y-3">
                {order.map((item) => (
                  <li key={item.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{item.name} {item.volume && <span className="text-xs text-muted-foreground">({item.volume})</span>}</span>
                      <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px] md:text-xs">{item.quantity}</Badge> {/* Smaller badge */}
                    </div>
                    <div className="flex items-center gap-1 md:gap-1.5"> {/* Reduced gap */}
                       <span className="font-mono text-xs md:text-sm whitespace-nowrap">{(item.price * item.quantity).toFixed(0)} ₽</span> {/* Smaller price text, removed decimals */}
                      <Button variant="ghost" size="icon" className="h-5 w-5 md:h-6 md:w-6" onClick={() => removeFromOrder(item.id)}> {/* Smaller button */}
                         <MinusCircle className="h-3 w-3 text-destructive" /> {/* Smaller icon */}
                         <span className="sr-only">Убрать 1 {item.name}</span>
                      </Button>
                    </div>

                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-col gap-2 md:gap-3 p-3 md:p-4 pt-3"> {/* Reduced gap and padding */}
             {order.length > 0 && (
                <>
                 <div className="flex justify-between w-full font-semibold text-sm md:text-base"> {/* Slightly smaller total */}
                    <span>Итого:</span>
                    <span>{totalPrice.toFixed(0)} ₽</span> {/* Removed decimals */}
                 </div>
                 <div className="flex gap-2 w-full">
                    <Button onClick={handleCheckout} className="flex-1 h-8 md:h-9 text-xs md:text-sm bg-accent hover:bg-accent/90"> {/* Smaller button */}
                    Оформить заказ
                    </Button>
                    <Button variant="outline" onClick={clearOrder} className="h-8 md:h-9 text-xs md:text-sm px-3"> {/* Smaller button */}
                        <Trash2 className="mr-1 h-3 w-3" /> Очистить {/* Smaller icon */}
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

