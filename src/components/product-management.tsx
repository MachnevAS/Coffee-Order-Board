
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
import { PlusCircle, Edit, Trash2, Save, X, FilePlus2 } from "lucide-react"; // Added icons
import Image from "next/image";
import { getRawProductData } from "@/lib/product-defaults"; // Import defaults and raw data getter
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
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

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
    setIsClient(true);
    console.log("ProductManagement: useEffect running, isClient=true");

    let loadedProducts: Product[] | null = null;

    try {
        const storedProducts = localStorage.getItem("coffeeProducts");
        console.log("ProductManagement: storedProducts from localStorage:", storedProducts ? storedProducts.substring(0, 100) + '...' : null);

        if (storedProducts) {
            try {
              const parsedProducts: any = JSON.parse(storedProducts);
              if (Array.isArray(parsedProducts) && parsedProducts.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number')) {
                 console.log("ProductManagement: Parsed valid products from localStorage.", parsedProducts.length);
                 loadedProducts = parsedProducts as Product[];
              } else {
                 console.warn("ProductManagement: Stored products invalid structure, initializing as empty.");
                 loadedProducts = []; // Initialize as empty if structure is invalid
                 localStorage.removeItem("coffeeProducts");
              }
            } catch (e) {
              console.error("ProductManagement: Failed to parse products from localStorage, initializing as empty.", e);
              loadedProducts = []; // Initialize as empty on parse error
              localStorage.removeItem("coffeeProducts");
            }
        } else {
            console.log("ProductManagement: No products found in localStorage, initializing as empty.");
            loadedProducts = []; // Initialize as empty if nothing stored
            // Don't automatically save empty array to localStorage here, let user decide
        }

    } catch (lsError) {
        console.error("ProductManagement: Error accessing localStorage. Initializing as empty.", lsError);
        loadedProducts = []; // Initialize as empty on localStorage access error
         toast({
            title: "Ошибка LocalStorage",
            description: "Не удалось загрузить товары. Список инициализирован как пустой.",
            variant: "destructive",
         });
    }

    setProducts(loadedProducts);
    console.log("ProductManagement: setProducts called with:", loadedProducts.length, "products");

   }, []); // Run only once on mount


   // Persist products to localStorage whenever they change
   useEffect(() => {
    if (isClient) { // No need to check products.length > 0, save even if empty
        console.log("ProductManagement: Persisting products to localStorage", products.length);
        try {
            const currentStoredValue = localStorage.getItem("coffeeProducts");
            const newProductsJson = JSON.stringify(products);

            if (currentStoredValue !== newProductsJson) {
                localStorage.setItem("coffeeProducts", newProductsJson);
                console.log("ProductManagement: Products saved to localStorage.");
                // Manually dispatch storage event for other components (like OrderBuilder)
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
   }, [products, isClient, toast]);


  const onSubmit = (data: ProductFormData) => {
     if (!isClient) return;

    const newProduct: Product = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: data.name,
      volume: data.volume || undefined,
      price: data.price,
      imageUrl: data.imageUrl || undefined,
      dataAiHint: data.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    setProducts((prevProducts) => [...prevProducts, newProduct]);

    toast({
      title: "Товар добавлен",
      description: `${data.name} ${data.volume || ''} успешно добавлен.`,
    });
    form.reset();
  };

   const removeProduct = (id: string) => {
    if (!isClient) return;
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    toast({
      title: "Товар удален",
      description: "Товар был удален.",
      variant: "destructive",
    });
    if (editingProductId === id) {
        setEditingProductId(null);
    }
  };

  const startEditing = (product: Product) => {
    setEditingProductId(product.id);
    editForm.reset({
        name: product.name,
        volume: product.volume || "",
        price: product.price,
        imageUrl: product.imageUrl || "",
        dataAiHint: product.dataAiHint || "",
    });
  };

  const cancelEditing = () => {
    setEditingProductId(null);
    editForm.reset();
  };

  const onEditSubmit = (data: ProductFormData) => {
    if (!isClient || !editingProductId) return;

    setProducts((prevProducts) =>
      prevProducts.map((p) =>
        p.id === editingProductId
          ? {
              ...p,
              name: data.name,
              volume: data.volume || undefined,
              price: data.price,
              imageUrl: data.imageUrl || undefined,
              dataAiHint: data.dataAiHint || p.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
            }
          : p
      )
    );

    toast({
      title: "Товар обновлен",
      description: `${data.name} ${data.volume || ''} успешно обновлен.`,
    });
    cancelEditing();
  };

   // Function to load raw products
   const loadRawProducts = () => {
    if (!isClient) return;
    const rawProductData = getRawProductData();
    console.log("ProductManagement: Loading raw products.", rawProductData.length);

    let productsToAdd: Product[] = [];
    let messageTitle = "";
    let messageDescription = "";
    let messageVariant: "default" | "destructive" | null | undefined = "default"; // Type matches useToast

    // Update state first
    setProducts(prevProducts => {
        const existingIds = new Set(prevProducts.map(p => p.id));
        const filteredProductsToAdd = rawProductData.filter(rp => !existingIds.has(rp.id));

        if (filteredProductsToAdd.length === 0) {
            // Prepare message but don't modify state
            messageTitle = "Товары уже загружены";
            messageDescription = "Начальный список товаров уже присутствует.";
            return prevProducts; // Return existing products, no state change needed
        } else {
            // Prepare message and update state
            productsToAdd = filteredProductsToAdd; // Assign for toast message later
            messageTitle = "Начальные товары добавлены";
            messageDescription = `Добавлено ${productsToAdd.length} новых товаров из начального списка.`;
            return [...prevProducts, ...productsToAdd]; // Return updated products
        }
    });

    // Call toast *after* the setProducts update has been processed by React
    if (messageTitle) {
        // Use setTimeout to ensure toast call happens after the current render cycle
        setTimeout(() => {
            toast({
                title: messageTitle,
                description: messageDescription,
                variant: messageVariant,
            });
        }, 0);
    }
   };


   if (!isClient) {
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
          <CardTitle className="flex items-center text-lg md:text-xl">
             <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Название</FormLabel><FormControl><Input placeholder="например, Латте" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="volume" render={({ field }) => ( <FormItem><FormLabel>Объём (необязательно)</FormLabel><FormControl><Input placeholder="например, 0,3 л" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" placeholder="например, 165" {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>URL изображения (необязательно)</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={form.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel>Подсказка для ИИ-изображения (необязательно)</FormLabel><FormControl><Input placeholder="например, латте арт" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-sm px-3">Добавить товар</Button> {/* Adjusted text size and padding */}
            </form>
          </Form>
        </CardContent>
      </Card>

       {/* Existing Products List */}
       <Card className="shadow-md flex flex-col h-full"> {/* Ensure card takes full height */}
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg md:text-xl">Существующие товары</CardTitle>
           <Button variant="outline" size="sm" onClick={loadRawProducts} className="text-xs px-2 h-8"> {/* Adjusted text size and padding */}
             <FilePlus2 className="h-4 w-4 mr-1" /> Загрузить начальные
           </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0"> {/* Remove padding, let ScrollArea handle it */}
          <ScrollArea className="h-[500px] md:h-[600px] p-6 pt-0"> {/* Adjust height and add padding */}
            {products.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Товары еще не добавлены.</p>
            ) : (
              <ul className="space-y-3">
                {products.map((product) => (
                  <li key={product.id} className="flex flex-col p-3 border rounded-md bg-card transition-colors duration-150">
                    {editingProductId === product.id ? (
                      <Form {...editForm}>
                          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
                             <FormField control={editForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Название</FormLabel><FormControl><Input {...field} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={editForm.control} name="volume" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Объём</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={editForm.control} name="price" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" {...field} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={editForm.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel className="text-xs">URL изображения</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={editForm.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Подсказка ИИ</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
                             <div className="flex justify-end gap-2 pt-2">
                                  <Button type="button" variant="ghost" size="sm" onClick={cancelEditing} className="text-xs px-2 h-8"><X className="h-4 w-4 mr-1" /> Отмена</Button> {/* Adjusted text size and padding */}
                                  <Button type="submit" size="sm" className="text-xs px-2 h-8"><Save className="h-4 w-4 mr-1" /> Сохранить</Button> {/* Adjusted text size and padding */}
                             </div>
                          </form>
                      </Form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-grow">
                          <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-md overflow-hidden flex-shrink-0">
                               <Image
                                src={product.imageUrl || `https://picsum.photos/100/100?random=${product.id}`}
                                alt={product.name}
                                fill
                                style={{objectFit:"cover"}}
                                data-ai-hint={product.dataAiHint || 'кофе'}
                                className="bg-muted"
                                 sizes="40px md:48px"
                                 onError={(e) => { e.currentTarget.src = `https://picsum.photos/100/100?random=${product.id}&error=1` }} // Fallback for broken image URLs
                              />
                          </div>

                          <div className="overflow-hidden flex-grow">
                              <p className="font-medium truncate text-sm md:text-base">{product.name}</p>
                              {(product.volume || product.price !== undefined) && (
                                  <p className="text-xs md:text-sm text-muted-foreground">
                                      {product.volume && <span>{product.volume} / </span>}
                                      {product.price.toFixed(0)} ₽
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
                                      <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel> {/* Adjusted size */}
                                      <AlertDialogAction onClick={() => removeProduct(product.id)} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}> {/* Adjusted size */}
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
           </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

