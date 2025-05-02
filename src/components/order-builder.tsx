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
      setProducts(JSON.parse(storedProducts));
    } else {
       // Add some default products if none are found in local storage
       const defaultProducts: Product[] = [
        { id: '1', name: 'Espresso', price: 2.50, imageUrl: 'https://picsum.photos/200/150?random=1', dataAiHint: 'espresso coffee' },
        { id: '2', name: 'Latte', price: 3.50, imageUrl: 'https://picsum.photos/200/150?random=2', dataAiHint: 'latte coffee art' },
        { id: '3', name: 'Cappuccino', price: 3.00, imageUrl: 'https://picsum.photos/200/150?random=3', dataAiHint: 'cappuccino froth' },
        { id: '4', name: 'Americano', price: 2.75, imageUrl: 'https://picsum.photos/200/150?random=4', dataAiHint: 'americano black coffee' },
      ];
      setProducts(defaultProducts);
      localStorage.setItem("coffeeProducts", JSON.stringify(defaultProducts));
    }
  }, []);

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
            title: "Order Empty",
            description: "Please add items to your order before checking out.",
            variant: "destructive",
        });
        return;
    }

    const orderData = {
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
        title: "Order Placed!",
        description: `Total: $${totalPrice.toFixed(2)}. Your order has been saved.`,
      });
      clearOrder(); // Clear the order after successful checkout
    } catch (error) {
       console.error("Failed to save order:", error);
       toast({
         title: "Checkout Failed",
         description: "Could not save the order. Please try again.",
         variant: "destructive",
       });
    }
  };


  if (!isClient) {
    return <div>Loading products...</div>; // Or a skeleton loader
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Product List */}
      <div className="lg:col-span-2">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Available Products</h2>
        {products.length === 0 ? (
           <p className="text-muted-foreground">No products available. Add some in the Product Management tab.</p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="p-0">
                <div className="relative h-40 w-full">
                   <Image
                    src={product.imageUrl || `https://picsum.photos/200/150?random=${product.id}`}
                    alt={product.name}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint={product.dataAiHint || 'coffee'}
                    />
                </div>

              </CardHeader>
              <CardContent className="p-4">
                 <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                 <p className="text-muted-foreground font-semibold">${product.price.toFixed(2)}</p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button onClick={() => addToOrder(product)} className="w-full" variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add to Order
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
              <span>Current Order</span>
               <ShoppingCart className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {order.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Your order is empty.</p>
            ) : (
              <ul className="space-y-3">
                {order.map((item) => (
                  <li key={item.id} className="flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <Badge variant="secondary" className="ml-2 px-1.5 py-0.5">{item.quantity}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromOrder(item.id)}>
                         <MinusCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-col gap-4 pt-4">
             {order.length > 0 && (
                <>
                 <div className="flex justify-between w-full font-semibold text-lg">
                    <span>Total:</span>
                    <span>${totalPrice.toFixed(2)}</span>
                 </div>
                 <div className="flex gap-2 w-full">
                    <Button onClick={handleCheckout} className="flex-1 bg-accent hover:bg-accent/90">
                    Checkout
                    </Button>
                    <Button variant="outline" onClick={clearOrder} className="flex-1">
                        <Trash2 className="mr-2 h-4 w-4" /> Clear Order
                    </Button>
                 </div>

                </>
             )}
              {order.length === 0 && (
                 <p className="text-muted-foreground text-center w-full">Add items to see your total.</p>
              )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}