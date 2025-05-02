"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  name: z.string().min(2, "Product name must be at least 2 characters"),
  price: z.coerce.number().positive("Price must be a positive number"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
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
      setProducts(JSON.parse(storedProducts));
    }
   }, []);

   // Persist products to localStorage whenever they change
   useEffect(() => {
    if (isClient) {
        localStorage.setItem("coffeeProducts", JSON.stringify(products));
    }
   }, [products, isClient]);


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
      title: "Product Added",
      description: `${data.name} has been added successfully.`,
    });
    form.reset(); // Reset the form fields
  };

   const removeProduct = (id: string) => {
    if (!isClient) return;
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    toast({
      title: "Product Removed",
      description: "The product has been removed.",
      variant: "destructive",
    });
  };


   if (!isClient) {
    return <div>Loading product management...</div>; // Or a skeleton loader
   }


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       {/* Add Product Form */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
             <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Add New Product
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
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Iced Latte" {...field} />
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
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 4.50" {...field} />
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
                    <FormLabel>Image URL (Optional)</FormLabel>
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
                    <FormLabel>Image Search Hint (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. iced coffee" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90">Add Product</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

       {/* Existing Products List */}
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Existing Products</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          {products.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No products added yet.</p>
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
                          data-ai-hint={product.dataAiHint || 'coffee'}
                          className="bg-muted"
                        />
                    </div>

                    <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}</p>
                    </div>
                   </div>

                  <Button variant="destructive" size="sm" onClick={() => removeProduct(product.id)}>
                    Remove
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