"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Keep Label import if needed elsewhere, but FormLabel is used in the form
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import { PlusCircle } from "lucide-react";
import Image from "next/image";

const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  price: z.coerce.number().positive("Цена должна быть положительным числом"),
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      price: 0,
      imageUrl: "",
      dataAiHint: "",
    },
  });

   useEffect(() => {
    setIsClient(true);
    // Load products from localStorage when the component mounts on the client
    const storedProducts = localStorage.getItem("coffeeProducts");
    if (storedProducts) {
      try {
          setProducts(JSON.parse(storedProducts));
      } catch (e) {
          console.error("Failed to parse products from localStorage", e);
          // Optionally clear invalid data
          // localStorage.removeItem("coffeeProducts");
      }

    } else {
        // Set default products if none exist in localStorage
        const defaultProducts: Product[] = [
         { id: '1', name: 'Эспрессо', price: 150, imageUrl: 'https://picsum.photos/200/150?random=1', dataAiHint: 'espresso coffee' },
         { id: '2', name: 'Латте', price: 250, imageUrl: 'https://picsum.photos/200/150?random=2', dataAiHint: 'latte coffee art' },
         { id: '3', name: 'Капучино', price: 200, imageUrl: 'https://picsum.photos/200/150?random=3', dataAiHint: 'cappuccino froth' },
         { id: '4', name: 'Американо', price: 180, imageUrl: 'https://picsum.photos/200/150?random=4', dataAiHint: 'americano black coffee' },
       ];
       setProducts(defaultProducts);
       localStorage.setItem("coffeeProducts", JSON.stringify(defaultProducts));
    }
   }, []);

   // Persist products to localStorage whenever they change
   useEffect(() => {
    if (isClient) {
        try {
            localStorage.setItem("coffeeProducts", JSON.stringify(products));
        } catch (e) {
            console.error("Failed to save products to localStorage", e);
             toast({
               title: "Ошибка сохранения",
               description: "Не удалось сохранить список товаров.",
               variant: "destructive",
             });
        }

    }
   }, [products, isClient, toast]); // Added toast dependency


  const onSubmit = (data: ProductFormData) => {
     if (!isClient) return; // Don't run on server

    const newProduct: Product = {
      id: Date.now().toString(), // Simple unique ID generation
      name: data.name,
      price: data.price,
      imageUrl: data.imageUrl || `https://picsum.photos/200/150?random=${Date.now()}`, // Default placeholder if no URL
      dataAiHint: data.dataAiHint || data.name.toLowerCase().split(' ').slice(0, 2).join(' '), // Generate hint from name
    };

    setProducts((prevProducts) => [...prevProducts, newProduct]);

    toast({
      title: "Товар добавлен",
      description: `${data.name} успешно добавлен.`,
    });
    form.reset(); // Reset the form fields
  };

   const removeProduct = (id: string) => {
    if (!isClient) return;
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    toast({
      title: "Товар удален",
      description: "Товар был удален.",
      variant: "destructive",
    });
  };


   if (!isClient) {
    return <div>Загрузка управления товарами...</div>; // Or a skeleton loader
   }


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       {/* Add Product Form */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
             <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название товара</FormLabel>
                    <FormControl>
                      <Input placeholder="например, Латте со льдом" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена (₽)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" placeholder="например, 250" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL изображения (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" {...field} />
                    </FormControl>
                     <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dataAiHint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Подсказка для поиска изображения (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="например, кофе со льдом" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90">Добавить товар</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

       {/* Existing Products List */}
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Существующие товары</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          {products.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Товары еще не добавлены.</p>
          ) : (
            <ul className="space-y-4">
              {products.map((product) => (
                <li key={product.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-secondary/30 transition-colors duration-150">
                   <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
                         <Image
                          src={product.imageUrl || `https://picsum.photos/100/100?random=${product.id}`}
                          alt={product.name}
                          layout="fill"
                          objectFit="cover"
                          data-ai-hint={product.dataAiHint || 'кофе'}
                          className="bg-muted"
                        />
                    </div>

                    <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.price.toFixed(2)} ₽</p>
                    </div>
                   </div>

                  <Button variant="destructive" size="sm" onClick={() => removeProduct(product.id)}>
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
