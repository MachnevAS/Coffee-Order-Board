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
    setIsClient(true);
    const storedProducts = localStorage.getItem("coffeeProducts");
    if (storedProducts) {
      try {
        setProducts(JSON.parse(storedProducts));
      } catch (e) {
        console.error("Failed to parse products from localStorage", e);
        setProducts(getDefaultProducts());
        localStorage.setItem("coffeeProducts", JSON.stringify(getDefaultProducts()));
      }
    } else {
       // Add some default products if none are found in local storage
       setProducts(getDefaultProducts());
       localStorage.setItem("coffeeProducts", JSON.stringify(getDefaultProducts()));
    }
  }, []);

  const getDefaultProducts = (): Product[] => [
      { id: '1', name: 'Эспрессо', price: 150, imageUrl: 'https://picsum.photos/200/150?random=1', dataAiHint: 'espresso coffee' },
      { id: '2', name: 'Латте', price: 250, imageUrl: 'https://picsum.photos/200/150?random=2', dataAiHint: 'latte coffee art' },
      { id: '3', name: 'Капучино', price: 200, imageUrl: 'https://picsum.photos/200/150?random=3', dataAiHint: 'cappuccino froth' },
      { id: '4', name: 'Американо', price: 180, imageUrl: 'https://picsum.photos/200/150?random=4', dataAiHint: 'americano black coffee' },
  ];


  useEffect(() => {
    if (isClient) {
      const newTotalPrice = order.reduce((sum, item) => sum + item.price * item.quantity, 0);
      setTotalPrice(newTotalPrice);
    }
  }, [order, isClient]);

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
        items: order.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Product List */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Доступные товары</h2>
        {products.length === 0 ? (
           <p className="text-muted-foreground">Товары отсутствуют. Добавьте их во вкладке "Управление товарами".</p>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-3"> {/* More columns for smaller screens, reduced gap */}
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
              <CardHeader className="p-0">
                <div className="relative h-24 w-full"> {/* Reduced image height */}
                   <Image
                    src={product.imageUrl || `https://picsum.photos/150/100?random=${product.id}`} // Smaller placeholder
                    alt={product.name}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint={product.dataAiHint || 'кофе'}
                    />
                </div>
              </CardHeader>
              <CardContent className="p-2 flex-grow"> {/* Reduced padding */}
                 <CardTitle className="text-sm md:text-base mb-1 line-clamp-2">{product.name}</CardTitle> {/* Smaller title, allow 2 lines */}
                 <p className="text-xs md:text-sm text-muted-foreground font-semibold">{product.price.toFixed(2)} ₽</p>
              </CardContent>
              <CardFooter className="p-2 pt-0 mt-auto"> {/* Reduced padding */}
                <Button onClick={() => addToOrder(product)} className="w-full h-8 text-xs" variant="outline"> {/* Smaller button */}
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
        <Card className="sticky top-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Текущий заказ</span>
               <ShoppingCart className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {order.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Ваш заказ пуст.</p>
            ) : (
              <ul className="space-y-3">
                {order.map((item) => (
                  <li key={item.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">{item.quantity}</Badge> {/* Smaller badge */}
                    </div>
                    <div className="flex items-center gap-1"> {/* Reduced gap */}
                       <span className="font-mono text-xs">{(item.price * item.quantity).toFixed(2)} ₽</span> {/* Smaller price text */}
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFromOrder(item.id)}> {/* Smaller button */}
                         <MinusCircle className="h-3 w-3 text-destructive" /> {/* Smaller icon */}
                      </Button>
                    </div>

                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-col gap-3 pt-3"> {/* Reduced gap and padding */}
             {order.length > 0 && (
                <>
                 <div className="flex justify-between w-full font-semibold text-base"> {/* Slightly smaller total */}
                    <span>Итого:</span>
                    <span>{totalPrice.toFixed(2)} ₽</span>
                 </div>
                 <div className="flex gap-2 w-full">
                    <Button onClick={handleCheckout} className="flex-1 h-9 text-sm bg-accent hover:bg-accent/90"> {/* Smaller button */}
                    Оформить заказ
                    </Button>
                    <Button variant="outline" onClick={clearOrder} className="flex-1 h-9 text-sm"> {/* Smaller button */}
                        <Trash2 className="mr-1 h-3 w-3" /> Очистить {/* Smaller icon */}
                    </Button>
                 </div>

                </>
             )}
              {order.length === 0 && (
                 <p className="text-muted-foreground text-center text-sm w-full">Добавьте товары, чтобы увидеть итоговую сумму.</p>
              )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
