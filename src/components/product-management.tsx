

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
import { LOCAL_STORAGE_ORDERS_KEY, LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY } from '@/lib/constants';
import {
  fetchProductsFromSheet,
  addProductToSheet,
  updateProductInSheet,
  deleteProductFromSheet,
  syncRawProductsToSheet
} from '@/services/google-sheets-service'; // Import sheet service functions
import { useDebounce } from '@/hooks/use-debounce'; // Import debounce hook

// Schema for form data (matches sheet columns except ID)
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

// Helper function to calculate product popularity (remains using localStorage orders)
const calculatePopularity = (): Map<string, number> => {
  const popularityMap = new Map<string, number>();
  try {
    const storedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (storedOrders) {
      const pastOrders: Order[] = JSON.parse(storedOrders);
      if (Array.isArray(pastOrders)) {
        pastOrders.forEach(ord => {
          ord.items.forEach(item => {
            const key = `${item.name}|${item.volume ?? ''}`;
            popularityMap.set(key, (popularityMap.get(key) || 0) + item.quantity);
          });
        });
      } else {
         console.warn("Invalid order data found in localStorage for popularity.");
      }
    }
  } catch (e) {
    console.error("Error reading or parsing sales history for popularity:", e);
  }
  return popularityMap;
};

// Map popularity from Name|Volume key back to local product ID
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


// Extracted Add Product Form Component
const AddProductForm: React.FC<{
  form: ReturnType<typeof useForm<ProductFormData>>;
  onSubmit: (data: ProductFormData) => void;
  isSubmitting: boolean; // Add prop to indicate submission state
}> = React.memo(({ form, onSubmit, isSubmitting }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="space-y-4 flex-grow">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Название</FormLabel><FormControl><Input placeholder="например, Латте" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="volume" render={({ field }) => ( <FormItem><FormLabel>Объём (необязательно)</FormLabel><FormControl><Input placeholder="например, 0,3 л" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="price" render={({ field: { onChange, ...restField } }) => (
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
        <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>URL изображения (необязательно)</FormLabel><FormControl><Input placeholder="https://..." {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel>Подсказка изображения (необязательно)</FormLabel><FormControl><Input placeholder="например, латте арт" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem> )} />
      </div>
      <Button type="submit" className="w-full mt-4 bg-accent hover:bg-accent/90 text-sm px-3" disabled={isSubmitting}>
          {isSubmitting ? 'Добавление...' : 'Добавить товар'}
      </Button>
    </form>
  </Form>
));
AddProductForm.displayName = 'AddProductForm'; // Add display name


// Extracted Product List Component
const ProductList: React.FC<{
  products: Product[];
  editForm: ReturnType<typeof useForm<ProductFormData>>;
  editingProductId: string | null;
  topProductsRanking: Map<string, number>;
  onStartEditing: (product: Product) => void;
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void;
  onRemoveProduct: (product: Product) => void;
  isLoading: boolean; // Pass loading state for edit/delete operations
  isEditingLoading: boolean; // Pass specific loading state for editing
}> = React.memo(({
  products,
  editForm,
  editingProductId,
  topProductsRanking,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  isLoading,
  isEditingLoading, // Receive editing loading state
}) => {
  if (isLoading && products.length === 0) { // Show loading only if initial load or full refresh
    return <p className="text-muted-foreground text-center py-4">Загрузка товаров...</p>;
  }

  if (products.length === 0 && !isLoading) { // Show no products found only after loading finishes
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
          onRemoveProduct={() => onRemoveProduct(product)}
          popularityRank={topProductsRanking.get(product.id)}
          // Disable interactions if any operation is loading
          isLoading={isLoading || isEditingLoading}
        />
      ))}
    </ul>
  );
});
ProductList.displayName = 'ProductList'; // Add display name


export function ProductManagement() {
  // --- States ---
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Debounce search
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // General loading (fetch, sync, clear all)
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading for add/edit operations
  const [errorLoading, setErrorLoading] = useState<string | null>(null); // State for loading errors

  // --- Hooks ---
  const { toast } = useToast();
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" },
  });
  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" },
  });

  // --- Fetch Products Function ---
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


  // --- Effects ---

  // Initial load and setup
  useEffect(() => {
    setIsClient(true);
    // Load sort option
    try {
        const storedSortOption = localStorage.getItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY);
        if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
            setSortOption(storedSortOption as SortOption);
        } else {
            localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, 'name-asc'); // Set default
            setSortOption('name-asc');
        }
    } catch (lsError) { console.error("ProductManagement: Error accessing localStorage for sort option.", lsError); }

    loadProducts(); // Initial product load

    // Listener for order changes to update popularity
    const handleOrderStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ORDERS_KEY) {
        console.log("ProductManagement: Detected order storage change, updating popularity version.");
        setPopularityVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', handleOrderStorageChange);
    return () => window.removeEventListener('storage', handleOrderStorageChange);
  }, [loadProducts]);

  // Persist sort option
  useEffect(() => {
    if (isClient) {
      try { localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, sortOption); }
      catch (e) { console.error("ProductManagement: Failed to save sort option to localStorage.", e); }
    }
  }, [sortOption, isClient]);


  // --- Memoized calculations ---

  const popularityNameVolumeMap = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    console.log("ProductManagement: Recalculating popularity map, version:", popularityVersion);
    return calculatePopularity();
  }, [isClient, popularityVersion]);

  const topProductsRanking = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    const productIdPopularityMap = mapPopularityToProductId(products, popularityNameVolumeMap);
    const sortedByPopularity = Array.from(productIdPopularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    console.log("ProductManagement: Calculated top product rankings:", ranking);
    return ranking;
  }, [products, popularityNameVolumeMap, isClient]);

  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return [];
    let result = [...products];

    // Filter using debounced term
    if (debouncedSearchTerm) {
      const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.volume?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Sort
    switch (sortOption) {
      case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price-asc': result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
      case 'price-desc': result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
      case 'popularity-desc': {
        // Use pre-calculated map for efficiency
        const productIdPopularityMap = mapPopularityToProductId(products, popularityNameVolumeMap);
        result.sort((a, b) => {
          const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
          if (popDiff !== 0) return popDiff;
          return a.name.localeCompare(b.name); // Fallback sort
        });
        break;
      }
    }
    return result;
  }, [products, debouncedSearchTerm, sortOption, isClient, popularityNameVolumeMap]); // Dependencies updated


  // --- Event Handlers (useCallback) ---

  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  // Handle adding a new product
  const onSubmit = useCallback(async (data: ProductFormData) => {
    // if (!isClient) return; // Redundant check
    setIsSubmitting(true); // Indicate submission start

    if (data.price === undefined) {
        toast({ title: "Ошибка", description: "Цена товара должна быть указана (можно 0).", variant: "destructive" });
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
      // Use loadProducts without indicator for background refresh
      await loadProducts(false);
      toast({ title: "Товар добавлен", description: `${data.name} ${data.volume || ''} успешно добавлен.` });
      form.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
    } else {
      toast({ title: "Ошибка добавления", description: `Не удалось добавить товар "${data.name}". Возможно, он уже существует или ошибка на сервере.`, variant: "destructive" });
    }
    setIsSubmitting(false); // Indicate submission end
  }, [toast, form, loadProducts]);

  const initiateDeleteProduct = useCallback((product: Product) => {
    if (isLoading || isSubmitting) return; // Prevent delete during other loads
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  }, [isLoading, isSubmitting]);

  const confirmRemoveProduct = useCallback(async () => {
    if (!productToDelete || isSubmitting) return; // Prevent delete if already submitting

    const productIdentifier = { name: productToDelete.name, volume: productToDelete.volume };
    const localIdToDelete = productToDelete.id;

    setIsSubmitting(true); // Use submitting state for delete operation
    setIsDeleteDialogOpen(false);

    // Optimistic UI update
    setProducts((prev) => prev.filter((p) => p.id !== localIdToDelete));
    if (editingProductId === localIdToDelete) {
        setEditingProductId(null);
    }

    const success = await deleteProductFromSheet(productIdentifier);
    setProductToDelete(null);

    if (success) {
      toast({ title: "Товар удален", description: `Товар "${productIdentifier.name}" был удален.`, variant: "destructive" });
    } else {
      toast({ title: "Ошибка удаления", description: `Не удалось удалить товар "${productIdentifier.name}". Восстановление...`, variant: "destructive" });
      // Rollback: Re-fetch needed here as optimistic update failed
      await loadProducts(false); // Use false to avoid primary loading indicator clash
    }
    setIsSubmitting(false); // Finish submission state
  }, [toast, productToDelete, editingProductId, loadProducts, isSubmitting]); // Added isSubmitting dependency

  const cancelRemoveProduct = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setProductToDelete(null);
  }, []);

  const clearAllProducts = useCallback(async () => {
    if (products.length === 0 || isLoading || isSubmitting) return; // Check all loading states

    setIsClearAllDialogOpen(false);
    setIsLoading(true); // Use general loading for bulk operation
    const originalProducts = [...products];

    setProducts([]); // Optimistic clear

    let allDeleted = true;
    const failedDeletions: Product[] = [];

    // Perform deletions sequentially or batched if API supports
    for (const product of originalProducts) {
      const success = await deleteProductFromSheet({ name: product.name, volume: product.volume });
      if (!success) {
        allDeleted = false;
        failedDeletions.push(product);
        console.error(`[GSHEET] Failed to delete product ${product.name} (${product.volume}) during clear all.`);
      }
    }

    setIsLoading(false); // Finish general loading

    if (allDeleted) {
      toast({ title: "Все товары удалены", description: "Список товаров был очищен.", variant: "destructive" });
    } else {
      toast({
          title: "Ошибка очистки",
          description: `Не удалось удалить ${failedDeletions.length} из ${originalProducts.length} товаров. Восстановление...`,
          variant: "destructive"
      });
      setProducts(failedDeletions); // Rollback UI
      // Consider re-fetching for guaranteed consistency after partial failure
      // await loadProducts(false);
    }
  }, [toast, products, isLoading, isSubmitting, loadProducts]);

  const startEditing = useCallback((product: Product) => {
    if (isLoading || isSubmitting) return; // Prevent editing during other loads
    setEditingProductId(product.id);
    editForm.reset({
      name: product.name,
      volume: product.volume || "",
      // Price must be a string for the input, Zod handles transformation
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
    if (!editingProductId || isSubmitting) return; // Prevent submission if already submitting

    const originalProduct = products.find(p => p.id === editingProductId);
    if (!originalProduct) return;

    if (data.price === undefined) {
        toast({ title: "Ошибка", description: "Цена товара должна быть указана (можно 0).", variant: "destructive" });
        return;
    }

    setIsSubmitting(true); // Indicate edit submission start

    const productDataForSheet: Omit<Product, 'id'> = {
        name: data.name,
        volume: data.volume || undefined,
        price: data.price,
        imageUrl: data.imageUrl || undefined,
        dataAiHint: data.dataAiHint || originalProduct.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
      };

    const updatedProductLocal: Product = {
      ...originalProduct,
      name: data.name,
      volume: data.volume || undefined,
      price: data.price,
      imageUrl: data.imageUrl || undefined,
      dataAiHint: productDataForSheet.dataAiHint,
    };

    // Optimistic UI Update
    setProducts((prev) =>
        prev.map((p) => (p.id === editingProductId ? updatedProductLocal : p))
    );
    setEditingProductId(null); // Close edit form immediately

    // Update Sheet
    const success = await updateProductInSheet({
        originalName: originalProduct.name,
        originalVolume: originalProduct.volume,
        newData: productDataForSheet
    });

    if (success) {
      toast({ title: "Товар обновлен", description: `${data.name} ${data.volume || ''} успешно обновлен.` });
      // Optional: Reload to ensure perfect sync, but optimistic update is usually sufficient
      // await loadProducts(false);
    } else {
      toast({ title: "Ошибка обновления", description: `Не удалось обновить товар "${originalProduct.name}". Восстановление...`, variant: "destructive" });
      // Rollback UI change
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProductLocal.id ? originalProduct : p))
      );
    }
    setIsSubmitting(false); // Indicate edit submission end
  }, [editingProductId, toast, products, editForm, loadProducts, isSubmitting]); // Added isSubmitting dependency

  const handleSyncRawProducts = useCallback(async () => {
    if (isLoading || isSubmitting) return; // Prevent sync during other loads
    setIsLoading(true); // Use general loading
    const result = await syncRawProductsToSheet();
    setIsLoading(false);

    toast({
        title: result.success ? "Синхронизация завершена" : "Ошибка синхронизации",
        description: `${result.message} Добавлено: ${result.addedCount}, Пропущено: ${result.skippedCount}.`,
        variant: result.success ? "default" : "destructive",
    });

    if (result.success && result.addedCount > 0) {
      await loadProducts(false); // Reload products list without main loading indicator
    }
  }, [toast, loadProducts, isLoading, isSubmitting]);

   const handleRefresh = useCallback(async () => {
       if (isLoading || isSubmitting) return; // Prevent refresh during other loads
        await loadProducts(true); // Show loading indicator
        if (!errorLoading) {
          toast({ title: "Список обновлен", description: "Данные товаров загружены из Google Sheets." });
        }
    }, [loadProducts, toast, isLoading, isSubmitting, errorLoading]);


  // --- SSR Loading State ---
  if (!isClient) {
    // Return simplified skeleton for SSR
    return (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <Card><CardHeader><CardTitle>Добавить товар</CardTitle></CardHeader><CardContent><p>Загрузка...</p></CardContent></Card>
         <Card><CardHeader><CardTitle>Существующие товары</CardTitle></CardHeader><CardContent><p>Загрузка...</p></CardContent></Card>
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
        <CardContent className="flex-grow flex flex-col">
          <AddProductForm form={form} onSubmit={onSubmit} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>

      {/* Existing Products List */}
      <Card className="shadow-md flex flex-col h-[70vh]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg md:text-xl">Существующие товары ({isLoading && products.length === 0 ? '...' : products.length})</CardTitle>
          <div className="flex gap-2">
            {/* Sync Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="outline" size="icon" onClick={handleSyncRawProducts} className="h-8 w-8" disabled={isLoading || isSubmitting}>
                    <FilePlus2 className="h-4 w-4" />
                    <span className="sr-only">Загрузить пример товаров</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Загрузить пример товаров в Google Sheet (пропустит существующие)</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Clear All Button */}
            <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-8 w-8" disabled={products.length === 0 || isLoading || isSubmitting}>
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Удалить все товары</span>
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p>Удалить все товары из Google Sheet</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                  <AlertDialogDescription>Это действие необратимо. Все товары ({products.length}) будут удалены навсегда из Google Sheet.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllProducts} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Удалить все</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0 flex flex-col">
           {/* Search, Sort, Refresh controls */}
           <div className="flex gap-2 px-6 py-4 items-center flex-shrink-0 border-b">
             <div className="relative flex-grow">
               <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input
                 placeholder="Поиск товаров..."
                 value={searchTerm} // Use direct state value
                 onChange={(e) => setSearchTerm(e.target.value)} // Update direct state
                 className="pl-8 pr-8 h-9"
                 disabled={isLoading || isSubmitting} // Disable during any loading
               />
               {searchTerm && (
                 <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")} disabled={isLoading || isSubmitting}>
                   <X className="h-4 w-4" /> <span className="sr-only">Очистить поиск</span>
                 </Button>
               )}
             </div>
             {/* Sort Dropdown */}
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={isLoading || isSubmitting}>
                   <SlidersHorizontal className="h-4 w-4" /> <span className="sr-only">Сортировать</span>
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end">
                 <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onSelect={() => handleSetSortOption('name-asc')} className={cn(sortOption === 'name-asc' && 'bg-accent text-accent-foreground')}> <ArrowDownAZ className="mr-2 h-4 w-4" /><span>Названию (А-Я)</span> </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}> <ArrowDownZA className="mr-2 h-4 w-4" /><span>Названию (Я-А)</span> </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}> <ArrowDown01 className="mr-2 h-4 w-4" /><span>Цене (возрастание)</span> </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}> <ArrowDown10 className="mr-2 h-4 w-4" /><span>Цене (убывание)</span> </DropdownMenuItem>
                 <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}> <TrendingUp className="mr-2 h-4 w-4" /><span>Популярности (сначала топ)</span> </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
             {/* Refresh Button */}
             <TooltipProvider>
                 <Tooltip>
                     <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" onClick={handleRefresh} className={cn("h-8 w-8 text-muted-foreground", isLoading && "animate-spin")} disabled={isLoading || isSubmitting}>
                             <RefreshCw className="h-4 w-4" /> <span className="sr-only">Обновить список</span>
                         </Button>
                     </TooltipTrigger>
                     <TooltipContent><p>Обновить список товаров из Google Sheets</p></TooltipContent>
                 </Tooltip>
             </TooltipProvider>
           </div>

           {/* Error Message Area */}
            {errorLoading && !isLoading && (
              <p className="text-destructive text-center py-4 px-6">Ошибка загрузки: {errorLoading}</p>
            )}

           {/* Scrollable Product List */}
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
                    isLoading={isLoading} // Pass general loading state
                    isEditingLoading={isSubmitting} // Pass submitting state for edit/delete
                    />
                </ScrollArea>
            )}
        </CardContent>
      </Card>

       {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                <AlertDialogDescription>
                    Это действие необратимо. Товар "{productToDelete?.name} {productToDelete?.volume || ''}" будет удален навсегда из Google Sheet.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelRemoveProduct} className="text-xs px-3 h-9" disabled={isSubmitting}>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveProduct} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })} disabled={isSubmitting}>
                    {isSubmitting ? 'Удаление...' : 'Удалить'}
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
