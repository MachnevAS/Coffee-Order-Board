
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
import { PlusCircle, FilePlus2, Search, Trash, SlidersHorizontal, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, TrendingUp, X, RefreshCw } from "lucide-react";
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
import { LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY } from '@/lib/constants';
import {
  fetchProductsFromSheet,
  addProductToSheet,
  updateProductInSheet,
  deleteProductFromSheet,
  clearAllProductsFromSheet, // Добавить эту строку
  syncRawProductsToSheet,
  fetchOrdersFromSheet as fetchAllOrdersForPopularity
} from '@/services/google-sheets-service';
import { useDebounce } from '@/hooks/use-debounce';

// Schema для данных формы
const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(),
  price: z.string()
        .refine((val) => /^\d*([.,]\d+)?$/.test(val.trim()) || val.trim() === '', { message: "Цена должна быть числом" })
        .transform((val) => val.trim() === '' ? undefined : parseFloat(val.replace(',', '.')))
        .refine((val) => val === undefined || val >= 0, { message: "Цена должна быть 0 или больше" })
        .optional(),
  imageUrl: z.string().url("Должен быть действительный URL").optional().or(z.literal('')),
  dataAiHint: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popularity-desc';

// Функция для расчета популярности товаров из Google Sheets
const calculatePopularityFromSheet = async (): Promise<Map<string, number>> => {
  const popularityMap = new Map<string, number>();
  try {
    const pastOrders: Order[] = await fetchAllOrdersForPopularity(); // Fetch orders from Google Sheets
    if (Array.isArray(pastOrders)) {
      pastOrders.forEach(ord => {
        ord.items.forEach(item => {
          const key = `${item.name}|${item.volume ?? ''}`;
          popularityMap.set(key, (popularityMap.get(key) || 0) + item.quantity);
        });
      });
    }
  } catch (e) {
    console.error("Error reading or parsing sales history from Google Sheets for popularity:", e);
  }
  return popularityMap;
};


// Сопоставление популярности с ID продукта
const mapPopularityToProductId = (products: Product[], popularityMap: Map<string, number>): Map<string, number> => {
  const productIdPopularityMap = new Map<string, number>();
  products.forEach(product => {
    const key = `${product.name}|${product.volume ?? ''}`;
    if (popularityMap.has(key)) {
      productIdPopularityMap.set(product.id, popularityMap.get(key)!);
    }
  });
  return productIdPopularityMap;
};

// Компонент формы добавления продукта
const AddProductForm = React.memo(({ form, onSubmit, isSubmitting }: {
  form: ReturnType<typeof useForm<ProductFormData>>;
  onSubmit: (data: ProductFormData) => void;
  isSubmitting: boolean;
}) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="space-y-4 flex-grow">
        <FormField 
          control={form.control} 
          name="name" 
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input placeholder="например, Латте" {...field} disabled={isSubmitting} />
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
                <Input placeholder="например, 0,3 л" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} 
        />
        <FormField 
          control={form.control} 
          name="price" 
          render={({ field: { onChange, ...restField } }) => (
            <FormItem>
              <FormLabel>Цена (₽)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="например, 165"
                  onChange={(e) => onChange(e.target.value)}
                  value={restField.value !== undefined ? String(restField.value) : ''}
                  disabled={isSubmitting}
                  {...restField}
                />
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
                <Input placeholder="https://..." {...field} disabled={isSubmitting} />
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
              <FormLabel>Подсказка изображения (необязательно)</FormLabel>
              <FormControl>
                <Input placeholder="например, латте арт" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} 
        />
      </div>
      <Button type="submit" className="w-full mt-4 bg-accent hover:bg-accent/90 text-sm px-3" disabled={isSubmitting}>
        {isSubmitting ? 'Добавление...' : 'Добавить товар'}
      </Button>
    </form>
  </Form>
));
AddProductForm.displayName = 'AddProductForm';

// Компонент списка продуктов
const ProductList = React.memo(({
  products,
  editForm,
  editingProductId,
  topProductsRanking,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  isLoading,
  isEditingLoading,
}: {
  products: Product[];
  editForm: ReturnType<typeof useForm<ProductFormData>>;
  editingProductId: string | null;
  topProductsRanking: Map<string, number>;
  onStartEditing: (product: Product) => void;
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void;
  onRemoveProduct: (product: Product) => void;
  isLoading: boolean;
  isEditingLoading: boolean;
}) => {
  if (isLoading && products.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Загрузка товаров...</p>;
  }

  if (products.length === 0 && !isLoading) {
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
          onRemoveProduct={() => onRemoveProduct(product)} // Pass a function here
          popularityRank={topProductsRanking.get(product.id)}
          isLoading={isLoading || isEditingLoading} // Pass combined loading state
        />
      ))}
    </ul>
  );
});
ProductList.displayName = 'ProductList';

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0); // Used to trigger re-calc of popularity
  const [isClient, setIsClient] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // For initial load and refresh
  const [isSubmitting, setIsSubmitting] = useState(false); // For add/edit/delete operations
  const [errorLoading, setErrorLoading] = useState<string | null>(null);


  const { toast } = useToast();
  
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" },
  });
  
  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" },
  });


  const loadProducts = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    setErrorLoading(null);
    
    try {
      const fetchedProducts = await fetchProductsFromSheet();
      setProducts(fetchedProducts);
    } catch (error: any) {
      console.error("Failed to load products:", error);
      const errorMessage = error.message || "Не удалось получить список товаров.";
      setErrorLoading(errorMessage);
      toast({
        title: "Ошибка загрузки товаров",
        description: errorMessage,
        variant: "destructive",
      });
      setProducts([]);
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    setIsClient(true);
    
    try {
      const storedSortOption = localStorage.getItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY);
      if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
        setSortOption(storedSortOption as SortOption);
      } else {
        localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, 'name-asc');
        setSortOption('name-asc');
      }
    } catch (lsError) {
      console.error("Error accessing localStorage for sort option.", lsError);
    }

    loadProducts();
    // When an order is placed (handled in OrderBuilder), it will update Google Sheets.
    // To reflect popularity changes here, we might need a mechanism to refetch popularity,
    // or simply rely on the popularityVersion state which can be updated after critical actions.
  }, [loadProducts]);

  useEffect(() => {
    if (isClient) {
      try {
        localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, sortOption);
      } catch (e) {
        console.error("Failed to save sort option to localStorage.", e);
      }
    }
  }, [sortOption, isClient]);

  // Calculate popularity map using Google Sheets
  const popularityNameVolumeMap = useMemo(async () => {
    if (!isClient) return new Map<string, number>();
    console.log("ProductManagement: Recalculating popularity from sheet, version:", popularityVersion);
    return await calculatePopularityFromSheet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, popularityVersion]); // Re-calculate when popularityVersion changes


  const [resolvedPopularityMap, setResolvedPopularityMap] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    popularityNameVolumeMap.then(map => setResolvedPopularityMap(map));
  }, [popularityNameVolumeMap]);


  const topProductsRanking = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    
    const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
    const sortedByPopularity = Array.from(productIdPopularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    
    return ranking;
  }, [products, resolvedPopularityMap, isClient]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return [];
    
    let result = [...products];

    if (debouncedSearchTerm) {
      const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.volume?.toLowerCase().includes(lowerCaseSearchTerm)
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
        result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case 'price-desc':
        result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
        break;
      case 'popularity-desc': {
        const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
        result.sort((a, b) => {
          const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
          return popDiff !== 0 ? popDiff : a.name.localeCompare(b.name);
        });
        break;
      }
    }
    
    return result;
  }, [products, debouncedSearchTerm, sortOption, isClient, resolvedPopularityMap]);


  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  const onSubmit = useCallback(async (data: ProductFormData) => {
    setIsSubmitting(true);

    if (data.price === undefined) {
      toast({ 
        title: "Ошибка", 
        description: "Цена товара должна быть указана (можно 0).", 
        variant: "destructive" 
      });
      setIsSubmitting(false);
      return;
    }

    const productDataForSheet: Omit<Product, 'id'> = {
      name: data.name,
      volume: data.volume || undefined,
      price: data.price,
      imageUrl: data.imageUrl || undefined,
      dataAiHint: data.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    const success = await addProductToSheet(productDataForSheet);

    if (success) {
      await loadProducts(false); // Reload without global loading indicator
      setPopularityVersion(v => v + 1); // Update popularity version
      toast({ 
        title: "Товар добавлен", 
        description: `${data.name} ${data.volume || ''} успешно добавлен.` 
      });
      form.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
    } else {
      toast({ 
        title: "Ошибка добавления", 
        description: `Не удалось добавить товар "${data.name}". Возможно, он уже существует или ошибка на сервере.`, 
        variant: "destructive" 
      });
    }
    
    setIsSubmitting(false);
  }, [toast, form, loadProducts]);


  const initiateDeleteProduct = useCallback((product: Product) => {
    if (isLoading || isSubmitting) return;
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  }, [isLoading, isSubmitting]);

  const confirmRemoveProduct = useCallback(async () => {
    if (!productToDelete || isSubmitting) return;

    const productIdentifier = { name: productToDelete.name, volume: productToDelete.volume };
    const localIdToDelete = productToDelete.id;

    setIsSubmitting(true);
    setIsDeleteDialogOpen(false);

    const success = await deleteProductFromSheet(productIdentifier);
    setProductToDelete(null);

    if (success) {
      await loadProducts(false); // Reload
      setPopularityVersion(v => v + 1); // Update popularity
      toast({ 
        title: "Товар удален", 
        description: `Товар "${productIdentifier.name}" был удален.`, 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Ошибка удаления", 
        description: `Не удалось удалить товар "${productIdentifier.name}".`, 
        variant: "destructive" 
      });
      // No need to manually restore if loadProducts is called, as it fetches fresh data
    }
    
    setIsSubmitting(false);
  }, [toast, productToDelete, loadProducts, isSubmitting]);


  const cancelRemoveProduct = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setProductToDelete(null);
  }, []);


  const clearAllProducts = useCallback(async () => {
    if (products.length === 0 || isLoading || isSubmitting) return;
  
    setIsClearAllDialogOpen(false);
    setIsSubmitting(true);
  
    const success = await clearAllProductsFromSheet();
    
    await loadProducts(false); // Reload products from sheet
    setPopularityVersion(v => v + 1); // Update popularity
  
    if (success) {
      toast({ 
        title: "Все товары удалены", 
        description: "Список товаров был очищен из Google Sheet.", 
        variant: "destructive" 
      });
    } else {
      toast({
        title: "Ошибка очистки",
        description: `Не удалось очистить список товаров. Пожалуйста, проверьте Google Sheet.`,
        variant: "destructive"
      });
    }
    setIsSubmitting(false);
  }, [toast, products, isLoading, isSubmitting, loadProducts]);


  const startEditing = useCallback((product: Product) => {
    if (isLoading || isSubmitting) return;
    
    setEditingProductId(product.id);
    editForm.reset({
      name: product.name,
      volume: product.volume || "",
      price: product.price !== undefined ? String(product.price) : '',
      imageUrl: product.imageUrl || "",
      dataAiHint: product.dataAiHint || "",
    });
  }, [editForm, isLoading, isSubmitting]);


  const cancelEditing = useCallback(() => {
    setEditingProductId(null);
    editForm.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
  }, [editForm]);

  const onEditSubmit = useCallback(async (data: ProductFormData) => {
    if (!editingProductId || isSubmitting) return;

    const originalProduct = products.find(p => p.id === editingProductId);
    if (!originalProduct) return;

    if (data.price === undefined) {
      toast({ 
        title: "Ошибка", 
        description: "Цена товара должна быть указана (можно 0).", 
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);

    const productDataForSheet: Omit<Product, 'id'> = {
      name: data.name,
      volume: data.volume || undefined,
      price: data.price,
      imageUrl: data.imageUrl || undefined,
      dataAiHint: data.dataAiHint || originalProduct.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    const success = await updateProductInSheet({
      originalName: originalProduct.name,
      originalVolume: originalProduct.volume,
      newData: productDataForSheet
    });

    if (success) {
      await loadProducts(false); // Reload
      setPopularityVersion(v => v + 1); // Update popularity
      setEditingProductId(null);
      toast({ 
        title: "Товар обновлен", 
        description: `${data.name} ${data.volume || ''} успешно обновлен.` 
      });
    } else {
      toast({ 
        title: "Ошибка обновления", 
        description: `Не удалось обновить товар "${originalProduct.name}". Возможно, новый товар уже существует или ошибка на сервере.`, 
        variant: "destructive" 
      });
    }
    
    setIsSubmitting(false);
  }, [editingProductId, toast, products, isSubmitting, loadProducts]);


  const handleSyncRawProducts = useCallback(async () => {
    if (isLoading || isSubmitting) return;
    
    setIsSubmitting(true); // Use isSubmitting here
    const result = await syncRawProductsToSheet();
    setIsSubmitting(false);

    toast({
      title: result.success ? "Синхронизация завершена" : "Ошибка синхронизации",
      description: `${result.message} Добавлено: ${result.addedCount}, Пропущено: ${result.skippedCount}.`,
      variant: result.success ? "default" : "destructive",
    });

    if (result.success && result.addedCount > 0) {
      await loadProducts(false);
      setPopularityVersion(v => v + 1);
    }
  }, [toast, loadProducts, isLoading, isSubmitting]);

  const handleRefresh = useCallback(async () => {
    if (isLoading || isSubmitting) return;
    
    await loadProducts(true);
    setPopularityVersion(v => v + 1); // Refresh popularity too
    
    if (!errorLoading) {
      toast({ 
        title: "Список обновлен", 
        description: "Данные товаров загружены из Google Sheets." 
      });
    }
  }, [loadProducts, toast, isLoading, isSubmitting, errorLoading]);


  if (!isClient) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Добавить товар</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Загрузка...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Существующие товары</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Загрузка...</p>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
      <Card className="shadow-md flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
            <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
          <AddProductForm form={form} onSubmit={onSubmit} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>

      <Card className="shadow-md flex flex-col h-[70vh]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg md:text-xl">
            Существующие товары ({isLoading && products.length === 0 ? '...' : products.length})
          </CardTitle>
          <div className="flex gap-2">
          {products.length === 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleSyncRawProducts} 
                      className="h-8 w-8" 
                      disabled={isLoading || isSubmitting}
                    >
                      <FilePlus2 className="h-4 w-4" />
                      <span className="sr-only">Загрузить пример товаров</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Загрузить пример товаров в Google Sheet (пропустит существующие)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-8 w-8" 
                        disabled={products.length === 0 || isLoading || isSubmitting}
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Удалить все товары</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Удалить все товары из Google Sheet</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие необратимо. Все товары ({products.length}) будут удалены навсегда из Google Sheet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs px-3 h-9" disabled={isSubmitting}>Отмена</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={clearAllProducts} 
                    className={buttonVariants({ variant: "destructive", size: "sm", className: "text-xs px-3 h-9" })}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Удаление...' : 'Удалить все'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0 flex flex-col">
          <div className="flex gap-2 px-6 py-4 items-center flex-shrink-0 border-b">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск товаров..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 h-9"
                disabled={isLoading || isSubmitting}
              />
              {searchTerm && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                  onClick={() => setSearchTerm("")} 
                  disabled={isLoading || isSubmitting}
                >
                  <X className="h-4 w-4" /> 
                  <span className="sr-only">Очистить поиск</span>
                </Button>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 flex-shrink-0" 
                  disabled={isLoading || isSubmitting}
                >
                  <SlidersHorizontal className="h-4 w-4" /> 
                  <span className="sr-only">Сортировать</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onSelect={() => handleSetSortOption('name-asc')} 
                  className={cn(sortOption === 'name-asc' && 'bg-accent text-accent-foreground')}
                >
                  <ArrowDownAZ className="mr-2 h-4 w-4" />
                  <span>Названию (А-Я)</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={() => handleSetSortOption('name-desc')} 
                  className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}
                >
                  <ArrowDownZA className="mr-2 h-4 w-4" />
                  <span>Названию (Я-А)</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={() => handleSetSortOption('price-asc')} 
                  className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}
                >
                  <ArrowDown01 className="mr-2 h-4 w-4" />
                  <span>Цене (возрастание)</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={() => handleSetSortOption('price-desc')} 
                  className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}
                >
                  <ArrowDown10 className="mr-2 h-4 w-4" />
                  <span>Цене (убывание)</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={() => handleSetSortOption('popularity-desc')} 
                  className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span>Популярности (сначала топ)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleRefresh} 
                    className={cn("h-8 w-8 text-muted-foreground", (isLoading || isSubmitting) && "animate-spin")} 
                    disabled={isLoading || isSubmitting}
                  >
                    <RefreshCw className="h-4 w-4" /> 
                    <span className="sr-only">Обновить список</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Обновить список товаров из Google Sheets</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {errorLoading && !isLoading && (
            <p className="text-destructive text-center py-4 px-6">Ошибка загрузки: {errorLoading}</p>
          )}

          {!errorLoading && (
            <ScrollArea className="flex-grow min-h-0 p-6 pt-4">
              <ProductList
                products={filteredAndSortedProducts}
                editForm={editForm}
                editingProductId={editingProductId}
                topProductsRanking={topProductsRanking}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onEditSubmit={onEditSubmit}
                onRemoveProduct={initiateDeleteProduct}
                isLoading={isLoading}
                isEditingLoading={isSubmitting}
              />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Товар "{productToDelete?.name} {productToDelete?.volume || ''}" будет удален навсегда из Google Sheet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={cancelRemoveProduct} 
              className="text-xs px-3 h-9" 
              disabled={isSubmitting}
            >
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRemoveProduct} 
              className={buttonVariants({ variant: "destructive", size: "sm", className: "text-xs px-3 h-9" })} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

