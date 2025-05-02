

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PlusCircle, FilePlus2, Search, Trash, SlidersHorizontal, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, TrendingUp, X } from "lucide-react";
import { getRawProductData } from "@/lib/product-defaults";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProductListItem } from './product-list-item';
import { cn } from "@/lib/utils";
import type { Order } from "@/types/order";
import { LOCAL_STORAGE_PRODUCTS_KEY, LOCAL_STORAGE_ORDERS_KEY, LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY } from '@/lib/constants';

const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(),
  price: z.coerce.number().positive("Цена должна быть положительным числом"),
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc';

// Helper function to calculate product popularity
const calculatePopularity = (): Map<string, number> => {
  const popularityMap = new Map<string, number>();
  try {
    const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (storedOrders) {
      const pastOrders: Order[] = JSON.parse(storedOrders);
      if (Array.isArray(pastOrders)) {
        pastOrders.forEach(ord => {
          ord.items.forEach(item => {
            popularityMap.set(item.id, (popularityMap.get(item.id) || 0) + item.quantity);
          });
        });
        // console.log("Popularity map calculated:", Object.fromEntries(popularityMap));
      } else {
         console.warn("Invalid order data found in localStorage for popularity.");
      }
    }
  } catch (e) {
    console.error("Error reading or parsing sales history for popularity:", e);
  }
  return popularityMap;
};

// Extracted Add Product Form Component
const AddProductForm: React.FC<{
  form: ReturnType<typeof useForm<ProductFormData>>;
  onSubmit: (data: ProductFormData) => void;
}> = ({ form, onSubmit }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="space-y-4 flex-grow">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Название</FormLabel><FormControl><Input placeholder="например, Латте" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="volume" render={({ field }) => ( <FormItem><FormLabel>Объём (необязательно)</FormLabel><FormControl><Input placeholder="например, 0,3 л" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" placeholder="например, 165" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>URL изображения (необязательно)</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel>Подсказка изображения (необязательно)</FormLabel><FormControl><Input placeholder="например, латте арт" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      </div>
      <Button type="submit" className="w-full mt-4 bg-accent hover:bg-accent/90 text-sm px-3">Добавить товар</Button>
    </form>
  </Form>
);

// Extracted Product List Component
const ProductList: React.FC<{
  products: Product[];
  editForm: ReturnType<typeof useForm<ProductFormData>>;
  editingProductId: string | null;
  topProductsRanking: Map<string, number>;
  onStartEditing: (product: Product) => void;
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void;
  onRemoveProduct: (id: string) => void;
}> = ({
  products,
  editForm,
  editingProductId,
  topProductsRanking,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
}) => {
  if (products.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Товары по вашему запросу не найдены.</p>;
  }

  return (
    <ul className="space-y-3">
      {products.map((product) => (
        <ProductListItem
          key={product.id}
          product={product}
          isEditing={editingProductId === product.id}
          editForm={editForm}
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onEditSubmit={onEditSubmit}
          onRemoveProduct={onRemoveProduct}
          popularityRank={topProductsRanking.get(product.id)}
        />
      ))}
    </ul>
  );
};


export function ProductManagement() {
  // --- States ---
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // --- Hooks ---
  const { toast } = useToast();
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: 0, imageUrl: "", dataAiHint: "" },
  });
  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: 0, imageUrl: "", dataAiHint: "" },
  });

  // --- Effects ---

  // Initialize client state and load data
  useEffect(() => {
    setIsClient(true);
    let loadedProducts: Product[] = [];

    try {
      const storedProducts = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
      if (storedProducts) {
        try {
          const parsedProducts = JSON.parse(storedProducts);
          if (Array.isArray(parsedProducts) && parsedProducts.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.price === 'number')) {
            loadedProducts = parsedProducts as Product[];
          } else {
            console.warn("ProductManagement: Stored products invalid structure, initializing as empty.");
            localStorage.removeItem(LOCAL_STORAGE_PRODUCTS_KEY);
          }
        } catch (e) {
          console.error("ProductManagement: Failed to parse products from localStorage.", e);
          localStorage.removeItem(LOCAL_STORAGE_PRODUCTS_KEY);
        }
      }

      const storedSortOption = localStorage.getItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY);
      if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
        setSortOption(storedSortOption as SortOption);
      } else {
        localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, 'name-asc');
      }
    } catch (lsError) {
      console.error("ProductManagement: Error accessing localStorage.", lsError);
      setTimeout(() => {
        toast({ title: "Ошибка LocalStorage", description: "Не удалось загрузить данные.", variant: "destructive" });
      }, 0);
    }

    setProducts(loadedProducts);

    const handleOrderStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ORDERS_KEY) {
        setPopularityVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', handleOrderStorageChange);
    return () => {
      window.removeEventListener('storage', handleOrderStorageChange);
    };
  }, [toast]);


  // Persist products to localStorage
  useEffect(() => {
    if (isClient) {
      try {
        const currentStoredValue = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
        const newProductsJson = JSON.stringify(products);
        if (currentStoredValue !== newProductsJson) {
          localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, newProductsJson);
          window.dispatchEvent(new StorageEvent('storage', {
            key: LOCAL_STORAGE_PRODUCTS_KEY,
            newValue: newProductsJson,
            oldValue: currentStoredValue,
            storageArea: localStorage,
          }));
        }
      } catch (e) {
        console.error("ProductManagement: Failed to save products to localStorage", e);
        setTimeout(() => {
          toast({ title: "Ошибка сохранения", description: "Не удалось сохранить список товаров.", variant: "destructive" });
        }, 0);
      }
    }
  }, [products, isClient, toast]);

  // Persist sort option
  useEffect(() => {
    if (isClient) {
      try {
        localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, sortOption);
      } catch (e) {
        console.error("ProductManagement: Failed to save sort option to localStorage.", e);
      }
    }
  }, [sortOption, isClient]);


  // --- Memoized calculations ---

  const topProductsRanking = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    const popularityMap = calculatePopularity();
    const sortedByPopularity = Array.from(popularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    return ranking;
  }, [isClient, popularityVersion]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return [];
    let result = [...products];

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

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
        const popularityMap = calculatePopularity();
        result.sort((a, b) => {
          const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
          if (popDiff !== 0) return popDiff;
          return a.name.localeCompare(b.name);
        });
        break;
      }
    }
    return result;
  }, [products, searchTerm, sortOption, isClient, popularityVersion]); // Removed calculatePopularity from deps


  // --- Event Handlers ---

  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  const onSubmit = useCallback((data: ProductFormData) => {
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
    setTimeout(() => {
      toast({ title: "Товар добавлен", description: `${data.name} ${data.volume || ''} успешно добавлен.` });
    }, 0);
    form.reset();
  }, [isClient, toast, form]);

  const removeProduct = useCallback((id: string) => {
    if (!isClient) return;
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    setTimeout(() => {
      toast({ title: "Товар удален", description: "Товар был удален.", variant: "destructive" });
    }, 0);
    if (editingProductId === id) {
      setEditingProductId(null);
    }
  }, [isClient, toast, editingProductId]);

  const clearAllProducts = useCallback(() => {
    if (!isClient) return;
    setProducts([]);
    setIsDeleteDialogOpen(false);
    setTimeout(() => {
      toast({ title: "Все товары удалены", description: "Список товаров был очищен.", variant: "destructive" });
    }, 0);
  }, [isClient, toast]);

  const startEditing = useCallback((product: Product) => {
    setEditingProductId(product.id);
    editForm.reset({
      name: product.name,
      volume: product.volume || "",
      price: product.price,
      imageUrl: product.imageUrl || "",
      dataAiHint: product.dataAiHint || "",
    });
  }, [editForm]);

  const cancelEditing = useCallback(() => {
    setEditingProductId(null);
    editForm.reset();
  }, [editForm]);

  const onEditSubmit = useCallback((data: ProductFormData) => {
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
    setTimeout(() => {
      toast({ title: "Товар обновлен", description: `${data.name} ${data.volume || ''} успешно обновлен.` });
    }, 0);
    cancelEditing();
  }, [isClient, editingProductId, toast, cancelEditing]);

  const loadRawProducts = useCallback(() => {
    if (!isClient) return;
    const rawProductData = getRawProductData();
    let messageTitle = "";
    let messageDescription = "";
    let messageVariant: "default" | "destructive" | null | undefined = "default";

    setProducts(prevProducts => {
      const existingIds = new Set(prevProducts.map(p => p.id));
      const productsToAdd = rawProductData.filter(rp => !existingIds.has(rp.id));

      if (productsToAdd.length === 0) {
        messageTitle = "Товары уже загружены";
        messageDescription = "Начальный список товаров уже присутствует.";
        return prevProducts;
      } else {
        messageTitle = "Начальные товары добавлены";
        messageDescription = `Добавлено ${productsToAdd.length} новых товаров из начального списка.`;
        return [...prevProducts, ...productsToAdd];
      }
    });

    if (messageTitle) {
      setTimeout(() => {
        toast({ title: messageTitle, description: messageDescription, variant: messageVariant });
      }, 0);
    }
  }, [isClient, toast]);


  // --- SSR Loading State ---
  if (!isClient) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="flex items-center"><PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Загрузка формы...</p></CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Существующие товары</CardTitle></CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Поиск товаров..." className="pl-8 h-9" disabled />
            </div>
            <p className="text-muted-foreground">Загрузка списка товаров...</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  // --- Main Render Logic (Client-Side) ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
      {/* Add Product Form */}
      <Card className="shadow-md flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
            <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <AddProductForm form={form} onSubmit={onSubmit} />
        </CardContent>
      </Card>

      {/* Existing Products List */}
      <Card className="shadow-md flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg md:text-xl">Существующие товары ({products.length})</CardTitle>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={loadRawProducts} className="h-8 w-8">
                    <FilePlus2 className="h-4 w-4" />
                    <span className="sr-only">Загрузить пример товаров</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Загрузить пример товаров</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                  <TooltipContent><p>Удалить все товары</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>Это действие необратимо. Все товары будут удалены навсегда.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllProducts} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Удалить все</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0">
          <div className="flex gap-2 px-6 py-4 items-center">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск товаров..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 h-9"
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
                  <ArrowDownAZ className="mr-2 h-4 w-4" /><span>Названию (А-Я)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}>
                  <ArrowDownZA className="mr-2 h-4 w-4" /><span>Названию (Я-А)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}>
                  <ArrowDown01 className="mr-2 h-4 w-4" /><span>Цене (возрастание)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}>
                  <ArrowDown10 className="mr-2 h-4 w-4" /><span>Цене (убывание)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}>
                  <TrendingUp className="mr-2 h-4 w-4" /><span>Популярности (сначала топ)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="h-[440px] md:h-[540px] p-6 pt-0">
            {products.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Товары еще не добавлены.</p>
            ) : (
              <ProductList
                products={filteredAndSortedProducts}
                editForm={editForm}
                editingProductId={editingProductId}
                topProductsRanking={topProductsRanking}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onEditSubmit={onEditSubmit}
                onRemoveProduct={removeProduct}
              />
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
