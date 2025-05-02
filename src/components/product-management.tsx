

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, buttonVariants } from "@/components/ui/button"; // Import buttonVariants
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
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
import { PlusCircle, Edit, Trash2, Save, X, FilePlus2, Search, Trash, SlidersHorizontal, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, TrendingUp } from "lucide-react"; // Added sorting icons, TrendingUp
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components
import { ProductListItem } from './product-list-item'; // Import the new component
import { cn } from "@/lib/utils"; // Import cn utility
import type { Order, SalesHistoryItem } from "@/types/order"; // Import Order and SalesHistoryItem


const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(), // Add volume field
  price: z.coerce.number().positive("Цена должна быть положительным числом"),
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc'; // Removed 'default', name-asc is now the implicit default
const SORT_STORAGE_KEY = 'productMgmtSortOption'; // Key for localStorage

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>(""); // State for search term
  const [sortOption, setSortOption] = useState<SortOption>('name-asc'); // State for sorting, default to 'name-asc'
  const [popularityVersion, setPopularityVersion] = useState<number>(0); // State to trigger popularity recalculation
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete all dialog

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
        // Load products
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

        // Load sort option
        const storedSortOption = localStorage.getItem(SORT_STORAGE_KEY);
        if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
            setSortOption(storedSortOption as SortOption);
            console.log("ProductManagement: Loaded sort option from localStorage:", storedSortOption);
        } else {
            console.log("ProductManagement: No valid sort option found in localStorage, using default.");
            // Keep default 'name-asc'
        }

    } catch (lsError) {
        console.error("ProductManagement: Error accessing localStorage. Initializing as empty.", lsError);
        loadedProducts = []; // Initialize as empty on localStorage access error
         // Use setTimeout to ensure toast call happens after the initial render cycle
         setTimeout(() => {
             toast({
                title: "Ошибка LocalStorage",
                description: "Не удалось загрузить данные. Настройки могут быть сброшены.",
                variant: "destructive",
             });
         }, 0);
    }

     if (loadedProducts) { // Check if loadedProducts is not null
       setProducts(loadedProducts);
       console.log("ProductManagement: setProducts called with:", loadedProducts.length, "products");
     }

     // Listener for coffeeOrders changes to update popularity sort
     const handleOrderStorageChange = (event: StorageEvent) => {
        if (event.key === "coffeeOrders" && sortOption === 'popularity-desc') {
            console.log("ProductManagement: Detected order change, refreshing popularity sort.");
            setPopularityVersion(v => v + 1); // Trigger recalculation
        }
     };
     window.addEventListener('storage', handleOrderStorageChange);

     return () => {
         window.removeEventListener('storage', handleOrderStorageChange);
     };


   }, [toast]); // Add toast dependency


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
             // Use setTimeout to ensure toast call happens after the current render cycle
             setTimeout(() => {
                 toast({
                   title: "Ошибка сохранения",
                   description: "Не удалось сохранить список товаров.",
                   variant: "destructive",
                 });
             }, 0);
        }
    }
   }, [products, isClient, toast]);


   // Function to update sort option and save to localStorage
   const handleSetSortOption = (newSortOption: SortOption) => {
        setSortOption(newSortOption);
        if (isClient) {
            try {
                localStorage.setItem(SORT_STORAGE_KEY, newSortOption);
                console.log("ProductManagement: Saved sort option to localStorage:", newSortOption);
            } catch (e) {
                console.error("ProductManagement: Failed to save sort option to localStorage.", e);
            }
        }
    };


  // Filter and sort products based on search term and sort option
  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return []; // Return empty array on server

    console.log("ProductManagement: Recalculating filtered/sorted products. PopularityVersion:", popularityVersion); // Log recalculation
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
        console.log("ProductManagement: Sorting by popularity.");
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
                 console.log("ProductManagement: Popularity map calculated:", Object.fromEntries(popularityMap));
             }
          }
        } catch (e) {
          console.error("Error reading or parsing sales history for sorting:", e);
          // Proceed without popularity data if error occurs
        }
        result.sort((a, b) => (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0));
        break;
       }
       default: // Should technically not happen with the new SortOption type
          // Fallback to name-asc if something goes wrong or state is invalid
         result.sort((a, b) => a.name.localeCompare(b.name));
         break;
     }

    return result;
  }, [products, searchTerm, sortOption, isClient, popularityVersion]); // Added popularityVersion


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

     // Use setTimeout to ensure toast call happens after the current render cycle
     setTimeout(() => {
         toast({
           title: "Товар добавлен",
           description: `${data.name} ${data.volume || ''} успешно добавлен.`,
         });
     }, 0);
    form.reset();
  };

   const removeProduct = (id: string) => {
    if (!isClient) return;
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
     // Use setTimeout to ensure toast call happens after the current render cycle
     setTimeout(() => {
         toast({
           title: "Товар удален",
           description: "Товар был удален.",
           variant: "destructive",
         });
     }, 0);
    if (editingProductId === id) {
        setEditingProductId(null);
    }
  };

   // Function to clear all products
   const clearAllProducts = () => {
     if (!isClient) return;
     setProducts([]);
     setIsDeleteDialogOpen(false); // Close the dialog
     // Use setTimeout for toast
     setTimeout(() => {
        toast({
            title: "Все товары удалены",
            description: "Список товаров был очищен.",
            variant: "destructive",
        });
     }, 0);
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

    // Use setTimeout to ensure toast call happens after the current render cycle
    setTimeout(() => {
        toast({
          title: "Товар обновлен",
          description: `${data.name} ${data.volume || ''} успешно обновлен.`,
        });
    }, 0);
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
                     <div className="relative mb-4">
                         <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                         <Input
                             placeholder="Поиск товаров..."
                             className="pl-8 h-9"
                             disabled
                         />
                     </div>
                     <p className="text-muted-foreground">Загрузка списка товаров...</p>
                 </CardContent>
             </Card>
         </div>
     );
   }


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
       {/* Add Product Form */}
      <Card className="shadow-md flex flex-col"> {/* Added flex flex-col */}
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
             <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow"> {/* Added flex-grow */}
          <Form {...form}>
             {/* Form content wrapper */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full"> {/* Added flex flex-col h-full */}
               <div className="space-y-4 flex-grow"> {/* Added flex-grow */}
                    <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Название</FormLabel><FormControl><Input placeholder="например, Латте" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="volume" render={({ field }) => ( <FormItem><FormLabel>Объём (необязательно)</FormLabel><FormControl><Input placeholder="например, 0,3 л" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" placeholder="например, 165" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>URL изображения (необязательно)</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel>Подсказка изображения (необязательно)</FormLabel><FormControl><Input placeholder="например, латте арт" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <Button type="submit" className="w-full mt-4 bg-accent hover:bg-accent/90 text-sm px-3">Добавить товар</Button> {/* Added mt-4 */}
            </form>
          </Form>
        </CardContent>
      </Card>

       {/* Existing Products List */}
       <Card className="shadow-md flex flex-col h-full"> {/* Ensure card takes full height */}
        <CardHeader className="flex flex-row items-center justify-between pb-4"> {/* Added pb-4 */}
          <CardTitle className="text-lg md:text-xl">Существующие товары ({products.length})</CardTitle>
           <div className="flex gap-2"> {/* Wrapper for the buttons */}
                <TooltipProvider>
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={loadRawProducts} className="h-8 w-8">
                        <FilePlus2 className="h-4 w-4" />
                        <span className="sr-only">Загрузить пример товаров</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Загрузить пример товаров</p>
                    </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                 {/* Delete All Products Button */}
                 <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="h-8 w-8" disabled={products.length === 0}>
                                        <Trash className="h-4 w-4" />
                                        <span className="sr-only">Удалить все товары</span>
                                    </Button>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Удалить все товары</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Это действие необратимо. Все товары будут удалены навсегда из списка.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={clearAllProducts} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>
                            Удалить все
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0"> {/* Remove padding, let ScrollArea handle it */}
            {/* Search and Sort Controls */}
            <div className="flex gap-2 px-6 py-4 items-center"> {/* Added padding */}
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
                       className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" // Adjusted right padding
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
                      <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0">
                         <SlidersHorizontal className="h-4 w-4" />
                         <span className="sr-only">Сортировать</span>
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

          <ScrollArea className="h-[440px] md:h-[540px] p-6 pt-0"> {/* Adjust height and add padding */}
            {products.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Товары еще не добавлены.</p>
            ) : filteredAndSortedProducts.length === 0 ? (
               <p className="text-muted-foreground text-center py-4">Товары по вашему запросу не найдены.</p>
            ) : (
              <ul className="space-y-3">
                {filteredAndSortedProducts.map((product) => (
                   <ProductListItem
                      key={product.id}
                      product={product}
                      isEditing={editingProductId === product.id}
                      editForm={editForm}
                      onStartEditing={startEditing}
                      onCancelEditing={cancelEditing}
                      onEditSubmit={onEditSubmit}
                      onRemoveProduct={removeProduct}
                   />
                ))}
              </ul>
            )}
           </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

