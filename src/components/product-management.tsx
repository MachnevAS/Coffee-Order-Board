
"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import { Input } from "@/components/ui/input";
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
import { PlusCircle, Edit, Trash2, Save, X } from "lucide-react"; // Added icons
import Image from "next/image";
import { getDefaultProducts } from "@/lib/product-defaults"; // Import defaults
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(), // Add volume field
  price: z.coerce.number().positive("Цена должна быть положительным числом"),
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      volume: "",
      price: 0,
      imageUrl: "",
      dataAiHint: "",
    },
  });

  const editForm = useForm<ProductFormData>({
      resolver: zodResolver(productSchema),
      defaultValues: { // Will be populated when editing starts
        name: "",
        volume: "",
        price: 0,
        imageUrl: "",
        dataAiHint: "",
      },
  });

   useEffect(() => {
    // This effect runs only once on the client after hydration
    setIsClient(true);
    console.log("ProductManagement: useEffect running, isClient=true"); // Log start

    let loadedProducts: Product[] | null = null; // Temp variable to store products to be set

    try { // Wrap all localStorage access
        const storedProducts = localStorage.getItem("coffeeProducts");
        console.log("ProductManagement: storedProducts from localStorage:", storedProducts ? storedProducts.substring(0, 100) + '...' : null); // Log stored data

        if (storedProducts) {
            try {
              const parsedProducts: any = JSON.parse(storedProducts); // Use 'any' temporarily for validation
              // More robust validation: check if it's an array and items have basic product structure
              if (Array.isArray(parsedProducts) && parsedProducts.length > 0 && parsedProducts.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number')) {
                 console.log("ProductManagement: Parsed valid products from localStorage.", parsedProducts.length);
                 loadedProducts = parsedProducts as Product[]; // Assign to temp variable after validation
              } else {
                 console.warn("ProductManagement: Stored products invalid structure or empty, falling back to defaults.");
                 localStorage.removeItem("coffeeProducts"); // Clear invalid data
              }
            } catch (e) {
              console.error("ProductManagement: Failed to parse products from localStorage, falling back to defaults.", e);
              localStorage.removeItem("coffeeProducts"); // Clear invalid data
            }
        } else {
            console.log("ProductManagement: No products found in localStorage, using defaults.");
        }

        // If loadedProducts is still null (no valid data found or parsing failed), use defaults
        if (loadedProducts === null) {
            const defaultProds = getDefaultProducts();
            console.log("ProductManagement: Setting default products.", defaultProds.length);
            loadedProducts = defaultProds;
            try {
                localStorage.setItem("coffeeProducts", JSON.stringify(defaultProds));
                console.log("ProductManagement: Saved default products to localStorage.");
            } catch (lsError) {
                console.error("ProductManagement: Failed to save default products to localStorage.", lsError);
                toast({
                    title: "Ошибка LocalStorage",
                    description: "Не удалось сохранить начальные товары.",
                    variant: "destructive",
                });
            }
        }

    } catch (lsError) {
        console.error("ProductManagement: Error accessing localStorage. Using defaults.", lsError);
        // Fallback in case of general localStorage access error
        const defaultProds = getDefaultProducts();
        console.log("ProductManagement: Setting default products due to localStorage access error.");
        loadedProducts = defaultProds;
         toast({
            title: "Ошибка LocalStorage",
            description: "Не удалось загрузить или сохранить товары. Используются значения по умолчанию.",
            variant: "destructive",
         });
    }

    // Set state *once* with either loaded or default products
    setProducts(loadedProducts);
    console.log("ProductManagement: setProducts called with:", loadedProducts.length, "products");

   }, []); // Empty dependency array ensures this runs only once on mount


   // Persist products to localStorage whenever they change
   useEffect(() => {
    // Only run this effect after the initial load and if products state is not empty
    if (isClient && products.length > 0) {
        console.log("ProductManagement: Persisting products to localStorage", products.length);
        try {
            const currentStoredValue = localStorage.getItem("coffeeProducts");
            const newProductsJson = JSON.stringify(products);

            // Only update localStorage if the value has actually changed
            if (currentStoredValue !== newProductsJson) {
                localStorage.setItem("coffeeProducts", newProductsJson);
                console.log("ProductManagement: Products saved to localStorage.");
                // Trigger a storage event for other tabs (like OrderBuilder)
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'coffeeProducts',
                    newValue: newProductsJson,
                    oldValue: currentStoredValue,
                    storageArea: localStorage,
                }));
            }
        } catch (e) {
            console.error("ProductManagement: Failed to save products to localStorage", e);
             toast({
               title: "Ошибка сохранения",
               description: "Не удалось сохранить список товаров.",
               variant: "destructive",
             });
        }
    }
   }, [products, isClient, toast]); // Rerun when products, isClient, or toast changes


  const onSubmit = (data: ProductFormData) => {
     if (!isClient) return; // Don't run on server

    const newProduct: Product = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, // Improved unique ID
      name: data.name,
      volume: data.volume || undefined, // Store as undefined if empty
      price: data.price,
      imageUrl: data.imageUrl || undefined, // Don't assign default here, do it in render
      // Generate hint using name and numeric part of volume, fallback to name if volume is empty
      dataAiHint: data.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    setProducts((prevProducts) => [...prevProducts, newProduct]);

    toast({
      title: "Товар добавлен",
      description: `${data.name} ${data.volume || ''} успешно добавлен.`,
    });
    form.reset(); // Reset the form fields
  };

   const removeProduct = (id: string) => {
    if (!isClient) return;
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    toast({
      title: "Товар удален",
      description: "Товар был удален.",
      variant: "destructive", // Use destructive variant for deletion confirmation
    });
     // If removing the product being edited, cancel edit mode
    if (editingProductId === id) {
        setEditingProductId(null);
    }
  };

  const startEditing = (product: Product) => {
    setEditingProductId(product.id);
    editForm.reset({ // Populate the edit form
        name: product.name,
        volume: product.volume || "",
        price: product.price,
        imageUrl: product.imageUrl || "",
        dataAiHint: product.dataAiHint || "",
    });
  };

  const cancelEditing = () => {
    setEditingProductId(null);
    editForm.reset(); // Clear edit form
  };

  const onEditSubmit = (data: ProductFormData) => {
    if (!isClient || !editingProductId) return;

    setProducts((prevProducts) =>
      prevProducts.map((p) =>
        p.id === editingProductId
          ? {
              ...p, // Keep the original ID
              name: data.name,
              volume: data.volume || undefined,
              price: data.price,
              imageUrl: data.imageUrl || undefined, // Update or keep old image, store undefined if empty
               // Update hint, use existing if not provided, fallback to generated if all else fails
              dataAiHint: data.dataAiHint || p.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
            }
          : p
      )
    );

    toast({
      title: "Товар обновлен",
      description: `${data.name} ${data.volume || ''} успешно обновлен.`,
    });
    cancelEditing(); // Exit edit mode
  };


   if (!isClient) {
    // Simple text loader for server-side rendering or before hydration
    return (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card className="shadow-lg">
                 <CardHeader>
                     <CardTitle className="flex items-center">
                         <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
                     </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Загрузка формы...</p>
                 </CardContent>
             </Card>
             <Card className="shadow-lg">
                 <CardHeader>
                     <CardTitle>Существующие товары</CardTitle>
                 </CardHeader>
                 <CardContent>
                     <p className="text-muted-foreground">Загрузка списка товаров...</p>
                 </CardContent>
             </Card>
         </div>
     );
   }


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
       {/* Add Product Form */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl"> {/* Slightly smaller */}
             <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4"> {/* Reduced space */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input placeholder="например, Латте" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Объём (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="например, 0,3 л" {...field} value={field.value ?? ''} />
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
                      {/* Use type="text" and inputMode="numeric" for better mobile experience */}
                      <Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" placeholder="например, 165" {...field} />
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
                      <Input placeholder="https://..." {...field} value={field.value ?? ''} />
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
                    <FormLabel>Подсказка для ИИ-изображения (необязательно)</FormLabel>
                    <FormControl>
                      <Input placeholder="например, латте арт" {...field} value={field.value ?? ''} />
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
       <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Существующие товары</CardTitle> {/* Slightly smaller */}
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          {products.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Товары еще не добавлены.</p>
          ) : (
            <ul className="space-y-3">
              {products.map((product) => (
                <li key={product.id} className="flex flex-col p-3 border rounded-md bg-card transition-colors duration-150">
                  {editingProductId === product.id ? (
                    // Edit Form
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
                           <FormField control={editForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Название</FormLabel><FormControl><Input {...field} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                           <FormField control={editForm.control} name="volume" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Объём</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                           <FormField control={editForm.control} name="price" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" {...field} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                           <FormField control={editForm.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel className="text-xs">URL изображения</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                           <FormField control={editForm.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Подсказка ИИ</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                           <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="ghost" size="sm" onClick={cancelEditing}><X className="h-4 w-4 mr-1" /> Отмена</Button>
                                <Button type="submit" size="sm"><Save className="h-4 w-4 mr-1" /> Сохранить</Button>
                           </div>
                        </form>
                    </Form>
                  ) : (
                    // Display View
                    <div className="flex items-center justify-between gap-2">
                       <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-grow"> {/* Allow growth */}
                        <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-md overflow-hidden flex-shrink-0">
                             <Image
                              src={product.imageUrl || `https://picsum.photos/100/100?random=${product.id}`}
                              alt={product.name}
                              layout="fill"
                              objectFit="cover"
                              data-ai-hint={product.dataAiHint || 'кофе'}
                              className="bg-muted"
                               sizes="40px md:48px"
                            />
                        </div>

                        <div className="overflow-hidden flex-grow"> {/* Allow growth */}
                            <p className="font-medium truncate text-sm md:text-base">{product.name}</p>
                            {(product.volume || product.price !== undefined) && (
                                <p className="text-xs md:text-sm text-muted-foreground">
                                    {product.volume && <span>{product.volume} / </span>}
                                    {product.price.toFixed(0)} ₽ {/* Removed decimals */}
                                </p>
                            )}
                        </div>
                       </div>

                      <div className="flex gap-1 flex-shrink-0">
                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditing(product)}>
                             <Edit className="h-4 w-4" />
                             <span className="sr-only">Редактировать {product.name}</span>
                           </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Удалить {product.name}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Это действие необратимо. Товар "{product.name} {product.volume || ''}" будет удален навсегда.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                                    {/* Use buttonVariants for destructive action style */}
                                    <AlertDialogAction onClick={() => removeProduct(product.id)} className={buttonVariants({ variant: "destructive" })}>
                                        Удалить
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
