

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
// Removed getRawProductData import as sync logic is in service now
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

const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(),
  price: z.coerce.number().positive("Цена должна быть положительным числом"),
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
            popularityMap.set(item.id, (popularityMap.get(item.id) || 0) + item.quantity);
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

// Extracted Add Product Form Component (no changes needed)
const AddProductForm: React.FC<{
  form: ReturnType<typeof useForm<ProductFormData>>;
  onSubmit: (data: ProductFormData) => void;
}> = ({ form, onSubmit }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="space-y-4 flex-grow">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Название</FormLabel><FormControl><Input placeholder="например, Латте" {...field} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="volume" render={({ field }) => ( <FormItem><FormLabel>Объём (необязательно)</FormLabel><FormControl><Input placeholder="например, 0,3 л" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" placeholder="например, 165" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel>URL изображения (необязательно)</FormLabel><FormControl><Input placeholder="https://..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel>Подсказка изображения (необязательно)</FormLabel><FormControl><Input placeholder="например, латте арт" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
      </div>
      <Button type="submit" className="w-full mt-4 bg-accent hover:bg-accent/90 text-sm px-3">Добавить товар</Button>
    </form>
  </Form>
);

// Extracted Product List Component (no changes needed)
const ProductList: React.FC<{
  products: Product[];
  editForm: ReturnType<typeof useForm<ProductFormData>>;
  editingProductId: string | null;
  topProductsRanking: Map<string, number>;
  onStartEditing: (product: Product) => void;
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void;
  onRemoveProduct: (id: string) => void;
  isLoading?: boolean; // Add isLoading prop
}> = ({
  products,
  editForm,
  editingProductId,
  topProductsRanking,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  isLoading, // Use isLoading prop
}) => {
  if (isLoading) {
    // Optionally show a loading skeleton or message
    return <p className="text-muted-foreground text-center py-4">Загрузка товаров...</p>;
  }

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
  const [isLoading, setIsLoading] = useState(true); // Add loading state

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
  const loadProducts = useCallback(async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
          const fetchedProducts = await fetchProductsFromSheet();
          setProducts(fetchedProducts);
      } catch (error) {
          console.error("Failed to load products:", error);
          toast({
              title: "Ошибка загрузки товаров",
              description: "Не удалось получить список товаров из Google Sheets.",
              variant: "destructive",
          });
          setProducts([]); // Clear products on error
      } finally {
          if (showLoading) setIsLoading(false);
      }
  }, [toast]); // Include toast in dependencies


  // --- Effects ---

  // Initialize client state, load sort options, and initial products
  useEffect(() => {
    setIsClient(true);

    try {
        // Load sort option from localStorage
        const storedSortOption = localStorage.getItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY);
        if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
            setSortOption(storedSortOption as SortOption);
        } else {
            // Set default if not found or invalid
            localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, 'name-asc');
            setSortOption('name-asc');
        }
    } catch (lsError) {
        console.error("ProductManagement: Error accessing localStorage for sort option.", lsError);
        // No toast here, less critical than data loading
    }

    // Load initial products
    loadProducts();

    // Listener for order changes to update popularity
    const handleOrderStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ORDERS_KEY) {
        setPopularityVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', handleOrderStorageChange);
    return () => {
      window.removeEventListener('storage', handleOrderStorageChange);
    };
  }, [loadProducts]); // Load products on initial mount

  // Persist sort option to localStorage
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
  }, [isClient, popularityVersion]); // Depends on client and order changes

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
        // Handle potential undefined prices during sorting
        result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        break;
      case 'price-desc':
         // Handle potential undefined prices during sorting
        result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
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
  }, [products, searchTerm, sortOption, isClient, popularityVersion]);


  // --- Event Handlers ---

  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  const onSubmit = useCallback(async (data: ProductFormData) => {
    if (!isClient) return;
    setIsLoading(true); // Indicate loading state

    const newProduct: Product = {
      // Generate a more robust unique ID (consider UUID library for production)
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name,
      volume: data.volume || undefined,
      price: data.price,
      imageUrl: data.imageUrl || undefined,
      dataAiHint: data.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    const success = await addProductToSheet(newProduct);
    setIsLoading(false); // End loading state

    if (success) {
      setProducts((prevProducts) => [...prevProducts, newProduct].sort((a,b) => a.name.localeCompare(b.name))); // Add locally and sort
       // Re-sort based on current sortOption after adding
       setProducts(prev => {
           const updated = [...prev, newProduct];
           // Apply current sort logic (copied from filteredAndSortedProducts memo)
           switch (sortOption) {
               case 'name-asc': updated.sort((a, b) => a.name.localeCompare(b.name)); break;
               case 'name-desc': updated.sort((a, b) => b.name.localeCompare(a.name)); break;
               case 'price-asc': updated.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
               case 'price-desc': updated.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
               case 'popularity-desc':
                   const popularityMap = calculatePopularity();
                   updated.sort((a, b) => {
                       const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
                       if (popDiff !== 0) return popDiff;
                       return a.name.localeCompare(b.name);
                   });
                   break;
           }
           return updated;
       });

      toast({ title: "Товар добавлен", description: `${data.name} ${data.volume || ''} успешно добавлен.` });
      form.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
    } else {
      toast({ title: "Ошибка добавления", description: "Не удалось добавить товар в Google Sheet.", variant: "destructive" });
    }
  }, [isClient, toast, form, sortOption]); // Add sortOption dependency

  const removeProduct = useCallback(async (id: string) => {
    if (!isClient) return;
    const productToRemove = products.find(p => p.id === id);
    if (!productToRemove) return;

    // Optimistically remove from UI
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== id));
    if (editingProductId === id) {
        setEditingProductId(null); // Cancel editing if the removed product was being edited
    }

    const success = await deleteProductFromSheet(id);

    if (success) {
      toast({ title: "Товар удален", description: `Товар "${productToRemove.name}" был удален.`, variant: "destructive" });
    } else {
      toast({ title: "Ошибка удаления", description: "Не удалось удалить товар из Google Sheet. Восстановление...", variant: "destructive" });
      // Revert UI change if deletion failed
      setProducts((prevProducts) => [...prevProducts, productToRemove]);
       // Consider re-sorting after reverting
       setProducts(prev => {
           const reverted = [...prev, productToRemove];
           // Apply current sort logic
            switch (sortOption) {
               case 'name-asc': reverted.sort((a, b) => a.name.localeCompare(b.name)); break;
               case 'name-desc': reverted.sort((a, b) => b.name.localeCompare(a.name)); break;
               case 'price-asc': reverted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
               case 'price-desc': reverted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
               case 'popularity-desc':
                   const popularityMap = calculatePopularity();
                   reverted.sort((a, b) => {
                       const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
                       if (popDiff !== 0) return popDiff;
                       return a.name.localeCompare(b.name);
                   });
                   break;
           }
           return reverted;
       });
    }
  }, [isClient, toast, products, editingProductId, sortOption]); // Add sortOption dependency

  const clearAllProducts = useCallback(async () => {
    if (!isClient || products.length === 0) return;

    setIsDeleteDialogOpen(false);
    setIsLoading(true);
    const originalProducts = [...products]; // Backup for potential rollback

    // Optimistically clear UI
    setProducts([]);

    let allDeleted = true;
    const failedDeletions: Product[] = [];

    // Delete products one by one (or batch if API supports)
    for (const product of originalProducts) {
      const success = await deleteProductFromSheet(product.id);
      if (!success) {
        allDeleted = false;
        failedDeletions.push(product);
        console.error(`Failed to delete product ${product.id} during clear all.`);
      }
    }

    setIsLoading(false);

    if (allDeleted) {
      toast({ title: "Все товары удалены", description: "Список товаров был очищен.", variant: "destructive" });
    } else {
      toast({
          title: "Ошибка очистки",
          description: `Не удалось удалить ${failedDeletions.length} товаров. Восстановление...`,
          variant: "destructive"
      });
      // Rollback UI: Add back the products that failed to delete
      setProducts(failedDeletions);
      // Optionally re-sort after rollback
      setProducts(prev => {
          // Apply current sort logic
          switch (sortOption) {
               case 'name-asc': prev.sort((a, b) => a.name.localeCompare(b.name)); break;
               case 'name-desc': prev.sort((a, b) => b.name.localeCompare(a.name)); break;
               case 'price-asc': prev.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
               case 'price-desc': prev.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
               case 'popularity-desc':
                   const popularityMap = calculatePopularity();
                   prev.sort((a, b) => {
                       const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
                       if (popDiff !== 0) return popDiff;
                       return a.name.localeCompare(b.name);
                   });
                   break;
           }
           return [...prev]; // Return new array to trigger re-render
      });
    }
  }, [isClient, toast, products, sortOption]); // Add sortOption dependency

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
    editForm.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
  }, [editForm]);

  const onEditSubmit = useCallback(async (data: ProductFormData) => {
    if (!isClient || !editingProductId) return;

    const originalProduct = products.find(p => p.id === editingProductId);
    if (!originalProduct) return;

    const updatedProduct: Product = {
        ...originalProduct, // Keep original ID and potentially other fields
        name: data.name,
        volume: data.volume || undefined,
        price: data.price,
        imageUrl: data.imageUrl || undefined,
        dataAiHint: data.dataAiHint || originalProduct.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
      };


    // Optimistically update UI
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === editingProductId ? updatedProduct : p))
    );
    // Apply sorting immediately after optimistic update
    setProducts(prev => {
        const updated = prev.map(p => p.id === editingProductId ? updatedProduct : p);
        // Apply current sort logic
        switch (sortOption) {
            case 'name-asc': updated.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'name-desc': updated.sort((a, b) => b.name.localeCompare(a.name)); break;
            case 'price-asc': updated.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
            case 'price-desc': updated.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
            case 'popularity-desc':
                const popularityMap = calculatePopularity();
                updated.sort((a, b) => {
                    const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
                    if (popDiff !== 0) return popDiff;
                    return a.name.localeCompare(b.name);
                });
                break;
        }
        return updated;
    });

    cancelEditing(); // Move cancel editing here for faster UI feedback

    const success = await updateProductInSheet(updatedProduct);

    if (success) {
      toast({ title: "Товар обновлен", description: `${data.name} ${data.volume || ''} успешно обновлен.` });
      // No need to call cancelEditing() again here
    } else {
      toast({ title: "Ошибка обновления", description: "Не удалось обновить товар в Google Sheet. Восстановление...", variant: "destructive" });
      // Rollback UI change if update failed
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === editingProductId ? originalProduct : p))
      );
      // Re-apply sorting after rollback
      setProducts(prev => {
           const reverted = prev.map(p => p.id === editingProductId ? originalProduct : p);
           // Apply current sort logic
           switch (sortOption) {
               case 'name-asc': reverted.sort((a, b) => a.name.localeCompare(b.name)); break;
               case 'name-desc': reverted.sort((a, b) => b.name.localeCompare(a.name)); break;
               case 'price-asc': reverted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
               case 'price-desc': reverted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
               case 'popularity-desc':
                   const popularityMap = calculatePopularity();
                   reverted.sort((a, b) => {
                       const popDiff = (popularityMap.get(b.id) || 0) - (popularityMap.get(a.id) || 0);
                       if (popDiff !== 0) return popDiff;
                       return a.name.localeCompare(b.name);
                   });
                   break;
           }
           return reverted;
       });
    }
  }, [isClient, editingProductId, toast, cancelEditing, products, editForm, sortOption]); // Added dependencies

  const handleSyncRawProducts = useCallback(async () => {
    if (!isClient) return;
    setIsLoading(true);
    const result = await syncRawProductsToSheet();
    setIsLoading(false);

    toast({
        title: result.success ? "Синхронизация завершена" : "Ошибка синхронизации",
        description: `${result.message} Добавлено: ${result.addedCount}, Пропущено: ${result.skippedCount}.`,
        variant: result.success ? "default" : "destructive",
    });

    if (result.success && result.addedCount > 0) {
      await loadProducts(false); // Reload products list without showing main loading indicator
    }
  }, [isClient, toast, loadProducts]);

   // Handler for the refresh button
   const handleRefresh = useCallback(async () => {
        await loadProducts();
        toast({ title: "Список обновлен", description: "Данные товаров загружены из Google Sheets." });
    }, [loadProducts, toast]);


  // --- SSR Loading State ---
  if (!isClient) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="flex items-center"><PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Загрузка формы...</p></CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Существующие товары (0)</CardTitle></CardHeader>
          <CardContent>
             <div className="flex gap-2 mb-4 items-center">
                 <div className="relative flex-grow">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Поиск товаров..." value="" className="pl-8 pr-8 h-9" disabled />
                 </div>
                 <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled>
                     <SlidersHorizontal className="h-4 w-4" />
                     <span className="sr-only">Сортировать</span>
                 </Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled>
                     <RefreshCw className="h-4 w-4" />
                     <span className="sr-only">Обновить список</span>
                 </Button>
             </div>
             <p className="text-muted-foreground text-center py-4">Загрузка списка товаров...</p>
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
          <CardTitle className="text-lg md:text-xl">Существующие товары ({isLoading ? '...' : products.length})</CardTitle>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                   {/* Use sync function */}
                   <Button variant="outline" size="icon" onClick={handleSyncRawProducts} className="h-8 w-8" disabled={isLoading}>
                    <FilePlus2 className="h-4 w-4" />
                    <span className="sr-only">Загрузить пример товаров</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Загрузить пример товаров в Google Sheet (пропустит существующие)</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" className="h-8 w-8" disabled={products.length === 0 || isLoading}>
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
                  <AlertDialogDescription>Это действие необратимо. Все товары будут удалены навсегда из Google Sheet.</AlertDialogDescription>
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
             {/* Search Input */}
             <div className="relative flex-grow">
               <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input
                 placeholder="Поиск товаров..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-8 pr-8 h-9"
                 disabled={isLoading} // Disable during load
               />
               {searchTerm && (
                 <Button
                   variant="ghost"
                   size="icon"
                   className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                   onClick={() => setSearchTerm("")}
                   disabled={isLoading} // Disable during load
                 >
                   <X className="h-4 w-4" />
                   <span className="sr-only">Очистить поиск</span>
                 </Button>
               )}
             </div>
             {/* Sort Dropdown */}
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={isLoading}>
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
              {/* Refresh Button */}
             <TooltipProvider>
                 <Tooltip>
                     <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" onClick={handleRefresh} className={cn("h-8 w-8 text-muted-foreground", isLoading && "animate-spin")} disabled={isLoading}>
                             <RefreshCw className="h-4 w-4" />
                             <span className="sr-only">Обновить список</span>
                         </Button>
                     </TooltipTrigger>
                     <TooltipContent><p>Обновить список товаров из Google Sheets</p></TooltipContent>
                 </Tooltip>
             </TooltipProvider>
           </div>

          <ScrollArea className="h-[440px] md:h-[540px] p-6 pt-0">
            {/* Pass isLoading to ProductList */}
            <ProductList
              products={filteredAndSortedProducts}
              editForm={editForm}
              editingProductId={editingProductId}
              topProductsRanking={topProductsRanking}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onEditSubmit={onEditSubmit}
              onRemoveProduct={removeProduct}
              isLoading={isLoading}
            />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
