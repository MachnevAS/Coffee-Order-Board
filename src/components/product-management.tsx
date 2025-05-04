

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

// Schema for form data (matches sheet columns except ID)
const productSchema = z.object({
  name: z.string().min(2, "Название товара должно содержать не менее 2 символов"),
  volume: z.string().optional(),
  price: z.coerce.number().positive("Цена должна быть положительным числом").optional(), // Price can be optional visually, but required logic might exist elsewhere
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
          // Use Name+Volume as the key if ID is not reliable or consistent
          ord.items.forEach(item => {
            const key = `${item.name}|${item.volume ?? ''}`; // Example key
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
}> = ({ form, onSubmit }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="space-y-4 flex-grow">
        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Название</FormLabel><FormControl><Input placeholder="например, Латте" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="volume" render={({ field }) => ( <FormItem><FormLabel>Объём (необязательно)</FormLabel><FormControl><Input placeholder="например, 0,3 л" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
        <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" placeholder="например, 165" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
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
  editingProductId: string | null; // Use local ID for editing state
  topProductsRanking: Map<string, number>; // Use local ID for ranking map
  onStartEditing: (product: Product) => void; // Pass full product with local ID
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void;
  onRemoveProduct: (product: Product) => void; // Pass full product for identification
  isLoading?: boolean;
}> = ({
  products,
  editForm,
  editingProductId,
  topProductsRanking,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  isLoading,
}) => {
  if (isLoading) {
    return <p className="text-muted-foreground text-center py-4">Загрузка товаров...</p>;
  }

  if (products.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Товары по вашему запросу не найдены.</p>;
  }

  return (
    <ul className="space-y-3">
      {products.map((product) => (
        <ProductListItem
          key={product.id} // Use local ID as key
          product={product}
          isEditing={editingProductId === product.id}
          editForm={editForm}
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onEditSubmit={onEditSubmit}
          onRemoveProduct={() => onRemoveProduct(product)} // Pass product to handler
          popularityRank={topProductsRanking.get(product.id)}
        />
      ))}
    </ul>
  );
};


export function ProductManagement() {
  // --- States ---
  const [products, setProducts] = useState<Product[]>([]); // Stores products with local IDs
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null); // Tracks local ID being edited
  const [productToDelete, setProductToDelete] = useState<Product | null>(null); // Store full product for deletion confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false); // Separate dialog state for clear all
  const [isLoading, setIsLoading] = useState(true);

  // --- Hooks ---
  const { toast } = useToast();
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    // Price is optional in schema, set default if needed by logic
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
          const fetchedProducts = await fetchProductsFromSheet(); // Fetches products with local IDs
          setProducts(fetchedProducts);
      } catch (error) {
          console.error("Failed to load products:", error);
          toast({
              title: "Ошибка загрузки товаров",
              description: "Не удалось получить список товаров из Google Sheets.",
              variant: "destructive",
          });
          setProducts([]);
      } finally {
          if (showLoading) setIsLoading(false);
      }
  }, [toast]);


  // --- Effects ---

  // Initialize client state, load sort options, and initial products
  useEffect(() => {
    setIsClient(true);
    // Load sort option
    try {
        const storedSortOption = localStorage.getItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY);
        if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
            setSortOption(storedSortOption as SortOption);
        } else {
            localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, 'name-asc');
            setSortOption('name-asc');
        }
    } catch (lsError) { console.error("ProductManagement: Error accessing localStorage for sort option.", lsError); }

    loadProducts(); // Load initial products

    // Listener for order changes to update popularity
    const handleOrderStorageChange = (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_ORDERS_KEY) { setPopularityVersion(v => v + 1); }
    };
    window.addEventListener('storage', handleOrderStorageChange);
    return () => window.removeEventListener('storage', handleOrderStorageChange);
  }, [loadProducts]); // Dependency array includes loadProducts

  // Persist sort option
  useEffect(() => {
    if (isClient) {
      try { localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, sortOption); }
      catch (e) { console.error("ProductManagement: Failed to save sort option to localStorage.", e); }
    }
  }, [sortOption, isClient]);


  // --- Memoized calculations ---

  // Calculate popularity map using Name|Volume keys
  const popularityNameVolumeMap = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    return calculatePopularity();
  }, [isClient, popularityVersion]);

  // Map popularity to local product IDs and get ranking
  const topProductsRanking = useMemo(() => {
    if (!isClient) return new Map<string, number>();
    const productIdPopularityMap = mapPopularityToProductId(products, popularityNameVolumeMap);
    const sortedByPopularity = Array.from(productIdPopularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    return ranking;
  }, [products, popularityNameVolumeMap, isClient]);

  // Filter and sort products based on local state
  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return [];
    let result = [...products];

    // Filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.volume?.toLowerCase().includes(lowerCaseSearchTerm) // Optional: search volume too
      );
    }

    // Sort
    switch (sortOption) {
      case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price-asc': result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
      case 'price-desc': result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
      case 'popularity-desc': {
        const productIdPopularityMap = mapPopularityToProductId(products, popularityNameVolumeMap);
        result.sort((a, b) => {
          const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
          if (popDiff !== 0) return popDiff;
          return a.name.localeCompare(b.name); // Fallback sort by name
        });
        break;
      }
    }
    return result;
  }, [products, searchTerm, sortOption, isClient, popularityNameVolumeMap]);


  // --- Event Handlers ---

  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  // Handle adding a new product
  const onSubmit = useCallback(async (data: ProductFormData) => {
    if (!isClient) return;
    setIsLoading(true);

    // Ensure price is defined before adding
    if (data.price === undefined) {
        toast({ title: "Ошибка", description: "Цена товара должна быть указана.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    // Data for the sheet (without ID)
    const productDataForSheet: Omit<Product, 'id'> = {
      name: data.name,
      volume: data.volume || undefined,
      price: data.price, // Already checked it's defined
      imageUrl: data.imageUrl || undefined,
      // Auto-generate hint if empty
      dataAiHint: data.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    const success = await addProductToSheet(productDataForSheet);
    setIsLoading(false);

    if (success) {
      // Reload the list from the sheet to get the new product with its generated local ID
      await loadProducts(false);
      toast({ title: "Товар добавлен", description: `${data.name} ${data.volume || ''} успешно добавлен.` });
      form.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
    } else {
      toast({ title: "Ошибка добавления", description: `Не удалось добавить товар "${data.name}" в Google Sheet. Возможно, он уже существует.`, variant: "destructive" });
    }
  }, [isClient, toast, form, loadProducts]);

  // Initiate deletion process
  const initiateDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  // Confirm deletion
  const confirmRemoveProduct = useCallback(async () => {
    if (!isClient || !productToDelete) return;

    const productIdentifier = { name: productToDelete.name, volume: productToDelete.volume };
    const localIdToDelete = productToDelete.id; // Store local ID for UI update

    setIsLoading(true);
    setIsDeleteDialogOpen(false); // Close dialog

    // Optimistically remove from UI using local ID
    setProducts((prevProducts) => prevProducts.filter((p) => p.id !== localIdToDelete));
    if (editingProductId === localIdToDelete) {
        setEditingProductId(null); // Cancel editing if the removed product was being edited
    }

    const success = await deleteProductFromSheet(productIdentifier);
    setIsLoading(false);
    setProductToDelete(null); // Clear the product marked for deletion

    if (success) {
      toast({ title: "Товар удален", description: `Товар "${productIdentifier.name}" был удален.`, variant: "destructive" });
      // No need to reload, already updated UI optimistically
    } else {
      toast({ title: "Ошибка удаления", description: `Не удалось удалить товар "${productIdentifier.name}" из Google Sheet. Восстановление...`, variant: "destructive" });
      // Rollback: Re-fetch to ensure consistency, as optimistic update might be wrong
      await loadProducts(false);
    }
  }, [isClient, toast, productToDelete, products, editingProductId, loadProducts]); // Added loadProducts

  // Cancel deletion
  const cancelRemoveProduct = () => {
    setIsDeleteDialogOpen(false);
    setProductToDelete(null);
  };


  // Handle clearing all products
  const clearAllProducts = useCallback(async () => {
    if (!isClient || products.length === 0) return;

    setIsClearAllDialogOpen(false); // Close dialog
    setIsLoading(true);
    const originalProducts = [...products]; // Backup for potential rollback

    // Optimistically clear UI
    setProducts([]);

    let allDeleted = true;
    const failedDeletions: Product[] = [];

    // Delete products one by one from the sheet using Name+Volume
    for (const product of originalProducts) {
      const success = await deleteProductFromSheet({ name: product.name, volume: product.volume });
      if (!success) {
        allDeleted = false;
        failedDeletions.push(product); // Store the original product object
        console.error(`[GSHEET] Failed to delete product ${product.name} (${product.volume}) during clear all.`);
      }
    }

    setIsLoading(false);

    if (allDeleted) {
      toast({ title: "Все товары удалены", description: "Список товаров был очищен.", variant: "destructive" });
    } else {
      toast({
          title: "Ошибка очистки",
          description: `Не удалось удалить ${failedDeletions.length} из ${originalProducts.length} товаров. Восстановление...`,
          variant: "destructive"
      });
      // Rollback UI: Show only the products that failed to delete
      setProducts(failedDeletions);
      // Optionally re-sort after rollback if needed, though fetching might be safer
      // await loadProducts(false); // Consider re-fetching for guaranteed consistency
    }
  }, [isClient, toast, products, loadProducts]); // Added loadProducts

  // Start editing a product (using local ID)
  const startEditing = useCallback((product: Product) => {
    setEditingProductId(product.id);
    editForm.reset({
      name: product.name,
      volume: product.volume || "",
      // Ensure price is number or undefined for the form
      price: product.price !== undefined ? Number(product.price) : undefined,
      imageUrl: product.imageUrl || "",
      dataAiHint: product.dataAiHint || "",
    });
  }, [editForm]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingProductId(null);
    editForm.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
  }, [editForm]);

  // Submit edited product
  const onEditSubmit = useCallback(async (data: ProductFormData) => {
    if (!isClient || !editingProductId) return;

    const originalProduct = products.find(p => p.id === editingProductId);
    if (!originalProduct) return;

     // Ensure price is defined before updating
    if (data.price === undefined) {
        toast({ title: "Ошибка", description: "Цена товара должна быть указана.", variant: "destructive" });
        return;
    }


    // Data for sheet update (without ID) - use original name/volume to find the row
    const productDataForSheet: Omit<Product, 'id'> = {
        name: data.name,
        volume: data.volume || undefined,
        price: data.price, // Already checked if defined
        imageUrl: data.imageUrl || undefined,
        dataAiHint: data.dataAiHint || originalProduct.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
      };

    // Updated product data for local state (with local ID)
    const updatedProductLocal: Product = {
      ...originalProduct, // Keep original local ID
      name: data.name,
      volume: data.volume || undefined,
      price: data.price,
      imageUrl: data.imageUrl || undefined,
      dataAiHint: productDataForSheet.dataAiHint, // Use the potentially generated hint
    };

    setIsLoading(true); // Indicate loading while updating sheet

    // Optimistically update UI
    setProducts((prevProducts) =>
      prevProducts.map((p) => (p.id === editingProductId ? updatedProductLocal : p))
    );
    // Apply sorting immediately
    setProducts(prev => {
        const updated = prev.map(p => p.id === editingProductId ? updatedProductLocal : p);
        // Apply current sort logic (copy logic from filteredAndSortedProducts)
        switch (sortOption) { /* ... sort logic ... */
             case 'name-asc': updated.sort((a, b) => a.name.localeCompare(b.name)); break;
             case 'name-desc': updated.sort((a, b) => b.name.localeCompare(a.name)); break;
             case 'price-asc': updated.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
             case 'price-desc': updated.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
             case 'popularity-desc': {
                const productIdPopularityMap = mapPopularityToProductId(updated, popularityNameVolumeMap);
                updated.sort((a, b) => {
                    const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
                    if (popDiff !== 0) return popDiff;
                    return a.name.localeCompare(b.name);
                });
                break;
             }
        }
        return updated;
    });
    cancelEditing(); // Close edit form

    // Update the sheet using original name/volume to find row, send new data
    // We pass the data intended for the sheet, not the local state object
    const success = await updateProductInSheet(productDataForSheet);
    setIsLoading(false); // Finish loading

    if (success) {
      toast({ title: "Товар обновлен", description: `${data.name} ${data.volume || ''} успешно обновлен.` });
      // Potentially reload to ensure perfect sync, but optimistic should be ok most times
      // await loadProducts(false);
    } else {
      toast({ title: "Ошибка обновления", description: `Не удалось обновить товар "${data.name}" в Google Sheet. Восстановление...`, variant: "destructive" });
      // Rollback UI change if update failed
      setProducts((prevProducts) =>
        prevProducts.map((p) => (p.id === editingProductId ? originalProduct : p))
      );
      // Re-apply sorting after rollback
       setProducts(prev => {
           const reverted = prev.map(p => p.id === editingProductId ? originalProduct : p);
            // Apply current sort logic
           switch (sortOption) { /* ... sort logic ... */
                case 'name-asc': reverted.sort((a, b) => a.name.localeCompare(b.name)); break;
                case 'name-desc': reverted.sort((a, b) => b.name.localeCompare(a.name)); break;
                case 'price-asc': reverted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
                case 'price-desc': reverted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
                case 'popularity-desc': {
                    const productIdPopularityMap = mapPopularityToProductId(reverted, popularityNameVolumeMap);
                    reverted.sort((a, b) => {
                        const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
                        if (popDiff !== 0) return popDiff;
                        return a.name.localeCompare(b.name);
                    });
                    break;
                }
           }
           return reverted;
       });
    }
  }, [isClient, editingProductId, toast, cancelEditing, products, editForm, sortOption, loadProducts, popularityNameVolumeMap]);

  // Handle syncing raw products
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
      await loadProducts(false); // Reload products list
    }
  }, [isClient, toast, loadProducts]);

   // Handler for the refresh button
   const handleRefresh = useCallback(async () => {
        await loadProducts();
        toast({ title: "Список обновлен", description: "Данные товаров загружены из Google Sheets." });
    }, [loadProducts, toast]);


  // --- SSR Loading State ---
  if (!isClient) { /* ... SSR Loading UI ... */
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
        <CardContent className="flex-grow flex flex-col"> {/* Ensure CardContent can grow */}
          <AddProductForm form={form} onSubmit={onSubmit} />
        </CardContent>
      </Card>

      {/* Existing Products List */}
      <Card className="shadow-md flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg md:text-xl">Существующие товары ({isLoading ? '...' : products.length})</CardTitle>
          <div className="flex gap-2">
            {/* Sync Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button variant="outline" size="icon" onClick={handleSyncRawProducts} className="h-8 w-8" disabled={isLoading}>
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
        <CardContent className="flex-grow overflow-hidden p-0 flex flex-col"> {/* Allow content to grow and manage overflow */}
           {/* Search, Sort, Refresh controls */}
           <div className="flex gap-2 px-6 py-4 items-center flex-shrink-0 border-b"> {/* Prevent controls from shrinking */}
             {/* Search Input */}
             <div className="relative flex-grow">
               <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input
                 placeholder="Поиск товаров..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-8 pr-8 h-9"
                 disabled={isLoading}
               />
               {searchTerm && (
                 <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")} disabled={isLoading}>
                   <X className="h-4 w-4" /> <span className="sr-only">Очистить поиск</span>
                 </Button>
               )}
             </div>
             {/* Sort Dropdown */}
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" disabled={isLoading}>
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
                         <Button variant="ghost" size="icon" onClick={handleRefresh} className={cn("h-8 w-8 text-muted-foreground", isLoading && "animate-spin")} disabled={isLoading}>
                             <RefreshCw className="h-4 w-4" /> <span className="sr-only">Обновить список</span>
                         </Button>
                     </TooltipTrigger>
                     <TooltipContent><p>Обновить список товаров из Google Sheets</p></TooltipContent>
                 </Tooltip>
             </TooltipProvider>
           </div>

          {/* Scrollable Product List */}
           <ScrollArea className="flex-grow min-h-0 p-6 pt-4"> {/* Allow ScrollArea to grow and add padding */}
            <ProductList
              products={filteredAndSortedProducts}
              editForm={editForm}
              editingProductId={editingProductId}
              topProductsRanking={topProductsRanking}
              onStartEditing={startEditing}
              onCancelEditing={cancelEditing}
              onEditSubmit={onEditSubmit}
              onRemoveProduct={initiateDeleteProduct} // Use initiate function
              isLoading={isLoading}
            />
          </ScrollArea>
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
                <AlertDialogCancel onClick={cancelRemoveProduct} className="text-xs px-3 h-9">Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRemoveProduct} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}>Удалить</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

    </div>
  );
}
