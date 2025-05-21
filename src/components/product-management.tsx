/**
 * @file Компонент для управления товарами.
 * Позволяет добавлять, редактировать, удалять товары, а также просматривать их список.
 * Данные о товарах и их популярность загружаются из Google Sheets.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { Order } from "@/types/order"; // Для расчета популярности
import { PlusCircle, FilePlus2, Search, Trash, SlidersHorizontal, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, TrendingUp, X, RefreshCw, Loader2 } from "lucide-react"; // Added Loader2
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY } from '@/lib/constants';
import {
  fetchProductsFromSheet,
  addProductToSheet,
  updateProductInSheet,
  deleteProductFromSheet,
  clearAllProductsFromSheet,
  syncRawProductsToSheet,
  fetchOrdersFromSheet as fetchAllOrdersForPopularity
} from '@/services/google-sheets-service';
import { useDebounce } from '@/hooks/use-debounce';
// Импорт вынесенных компонентов и типов
import { AddProductForm } from './product-management/add-product-form';
import { ProductList } from './product-management/product-list';
import { productSchema, type ProductFormData, type SortOptionProductMgmt as SortOption } from './product-management/product-management-types';


/**
 * Функция для расчета популярности товаров на основе истории продаж из Google Sheets.
 * Ключ популярности формируется как "Название|Объем".
 * @returns {Promise<Map<string, number>>} Карта, где ключ - "Название|Объем", значение - количество продаж.
 */
const calculatePopularityFromSheet = async (): Promise<Map<string, number>> => {
  const popularityMap = new Map<string, number>();
  try {
    const pastOrders: Order[] = await fetchAllOrdersForPopularity();
    if (Array.isArray(pastOrders)) {
      pastOrders.forEach(ord => {
        ord.items.forEach(item => {
          const key = `${item.name}|${item.volume ?? ''}`;
          popularityMap.set(key, (popularityMap.get(key) || 0) + item.quantity);
        });
      });
    }
  } catch (e) {
    console.error("Ошибка при чтении или обработке истории продаж из Google Sheets для популярности:", e);
  }
  return popularityMap;
};

/**
 * Сопоставляет популярность (по ключу "Название|Объем") с ID локальных продуктов.
 * @param products - Массив локальных продуктов.
 * @param popularityMap - Карта популярности "Название|Объем" -> количество.
 * @returns {Map<string, number>} Карта, где ключ - ID продукта, значение - количество продаж.
 */
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

/**
 * Основной компонент для управления товарами.
 * @returns JSX элемент страницы управления товарами.
 */
export function ProductManagement() {
  // Состояния компонента
  const [products, setProducts] = useState<Product[]>([]); // Список всех товаров
  const [searchTerm, setSearchTerm] = useState<string>(""); // Поисковый запрос
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Отложенный поисковый запрос
  const [sortOption, setSortOption] = useState<SortOption>('name-asc'); // Текущая опция сортировки
  const [popularityVersion, setPopularityVersion] = useState<number>(0); // Версия данных о популярности
  const [isClient, setIsClient] = useState(false); // Флаг клиентской стороны
  const [editingProductId, setEditingProductId] = useState<string | null>(null); // ID редактируемого товара
  const [productToDelete, setProductToDelete] = useState<Product | null>(null); // Товар, выбранный для удаления
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // Состояние диалога подтверждения удаления
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false); // Состояние диалога подтверждения очистки всех товаров
  const [isLoading, setIsLoading] = useState(true); // Флаг загрузки списка товаров
  const [isSubmitting, setIsSubmitting] = useState(false); // Флаг отправки данных (добавление/редактирование/удаление)
  const [errorLoading, setErrorLoading] = useState<string | null>(null); // Сообщение об ошибке загрузки
  const [resolvedPopularityMap, setResolvedPopularityMap] = useState<Map<string, number>>(new Map()); // Карта популярности
  const [isPopularityLoading, setIsPopularityLoading] = useState(false); // Флаг загрузки данных о популярности

  const { toast } = useToast(); // Хук для уведомлений

  // Форма для добавления нового товара
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" },
  });

  // Форма для редактирования существующего товара
  const editForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    // defaultValues устанавливаются при начале редактирования в startEditing
  });

  /**
   * Загружает список продуктов из Google Sheets.
   * @param showLoadingIndicator - Показывать ли индикатор загрузки.
   */
  const loadProducts = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    setErrorLoading(null);
    try {
      const fetchedProducts = await fetchProductsFromSheet();
      setProducts(fetchedProducts);
    } catch (error: any) {
      console.error("Не удалось загрузить продукты:", error);
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

  // Эффект для начальной загрузки и установки состояния
  useEffect(() => {
    setIsClient(true); // Устанавливаем, что компонент работает на клиенте
    // Загрузка опции сортировки из localStorage
    try {
      const storedSortOption = localStorage.getItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY);
      if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
        setSortOption(storedSortOption as SortOption);
      } else {
        localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, 'name-asc'); // Устанавливаем по умолчанию
        setSortOption('name-asc');
      }
    } catch (lsError) {
      console.error("Ошибка доступа к localStorage для опции сортировки.", lsError);
    }
    loadProducts(); // Загружаем продукты
  }, [loadProducts]);

  // Сохранение опции сортировки в localStorage при ее изменении
  useEffect(() => {
    if (isClient) {
      try {
        localStorage.setItem(LOCAL_STORAGE_PRODUCT_MGMT_SORT_KEY, sortOption);
      } catch (e) {
        console.error("Не удалось сохранить опцию сортировки в localStorage.", e);
      }
    }
  }, [sortOption, isClient]);

  // Загрузка данных о популярности товаров
 useEffect(() => {
    if (!isClient) return; // Только на клиенте
    const fetchPopularity = async () => {
      setIsPopularityLoading(true);
      console.log("ProductManagement: Пересчет популярности из таблицы, версия:", popularityVersion);
      try {
        const map = await calculatePopularityFromSheet();
        setResolvedPopularityMap(map);
      } catch (error) {
        console.error("ProductManagement: Ошибка при загрузке популярности", error);
        toast({
          title: "Ошибка популярности",
          description: "Не удалось загрузить данные о популярности товаров.",
          variant: "destructive",
        });
      } finally {
        setIsPopularityLoading(false);
      }
    };
    fetchPopularity();
  }, [isClient, popularityVersion, toast]);

  // Мемоизированный расчет рангов топ-продуктов
  const topProductsRanking = useMemo(() => {
    if (!isClient) return new Map<string, number>(); // Возвращаем пустую карту на сервере
    const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
    const sortedByPopularity = Array.from(productIdPopularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA);
    const ranking = new Map<string, number>();
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1);
    });
    return ranking;
  }, [products, resolvedPopularityMap, isClient]);

  // Мемоизированный список отфильтрованных и отсортированных продуктов
  const filteredAndSortedProducts = useMemo(() => {
    if (!isClient) return []; // Возвращаем пустой массив на сервере
    let result = [...products];
    // Фильтрация
    if (debouncedSearchTerm) {
      const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.volume?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    // Сортировка
    switch (sortOption) {
      case 'name-asc': result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price-asc': result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
      case 'price-desc': result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
      case 'popularity-desc': {
        const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
        result.sort((a, b) => {
          const popDiff = (productIdPopularityMap.get(b.id) || 0) - (productIdPopularityMap.get(a.id) || 0);
          return popDiff !== 0 ? popDiff : a.name.localeCompare(b.name); // Сначала по популярности, потом по имени
        });
        break;
      }
    }
    return result;
  }, [products, debouncedSearchTerm, sortOption, isClient, resolvedPopularityMap]);

  /**
   * Устанавливает новую опцию сортировки.
   */
  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  /**
   * Обработчик добавления нового товара.
   */
  const onSubmitAddProduct = useCallback(async (data: ProductFormData) => {
    setIsSubmitting(true);
    // Проверка, указана ли цена
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
      price: data.price, // Цена уже число или undefined
      imageUrl: data.imageUrl || undefined,
      dataAiHint: data.dataAiHint || [data.name.toLowerCase(), data.volume?.replace(/[^0-9.,]/g, '')].filter(Boolean).slice(0, 2).join(' ') || data.name.toLowerCase(),
    };

    const success = await addProductToSheet(productDataForSheet);
    if (success) {
      await loadProducts(false); // Обновляем список без индикатора
      setPopularityVersion(v => v + 1); // Обновляем версию популярности
      toast({
        title: "Товар добавлен",
        description: `${data.name} ${data.volume || ''} успешно добавлен.`
      });
      form.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" }); // Сброс формы
    } else {
      toast({
        title: "Ошибка добавления",
        description: `Не удалось добавить товар "${data.name}". Возможно, он уже существует или ошибка на сервере.`,
        variant: "destructive"
      });
    }
    setIsSubmitting(false);
  }, [toast, form, loadProducts]);

  /**
   * Инициирует процесс удаления товара, открывая диалог подтверждения.
   */
  const initiateDeleteProduct = useCallback((product: Product) => {
    if (isLoading || isSubmitting) return; // Не удаляем во время загрузки или другой операции
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  }, [isLoading, isSubmitting]);

  /**
   * Подтверждает и выполняет удаление товара.
   */
  const confirmRemoveProduct = useCallback(async () => {
    if (!productToDelete || isSubmitting) return;
    const productIdentifier = { name: productToDelete.name, volume: productToDelete.volume };
    setIsSubmitting(true);
    setIsDeleteDialogOpen(false);

    const success = await deleteProductFromSheet(productIdentifier);
    setProductToDelete(null); // Сбрасываем выбранный для удаления товар
    if (success) {
      await loadProducts(false);
      setPopularityVersion(v => v + 1);
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
    }
    setIsSubmitting(false);
  }, [toast, productToDelete, loadProducts, isSubmitting]);

  /**
   * Отменяет удаление товара.
   */
  const cancelRemoveProduct = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setProductToDelete(null);
  }, []);

  /**
   * Инициирует удаление всех товаров.
   */
  const initiateClearAllProducts = useCallback(() => {
    if (products.length === 0 || isLoading || isSubmitting) return;
    setIsClearAllDialogOpen(true);
  }, [products, isLoading, isSubmitting]);

  /**
   * Подтверждает и выполняет удаление всех товаров.
   */
  const confirmClearAllProducts = useCallback(async () => {
    if (products.length === 0 || isLoading || isSubmitting) return;
    setIsClearAllDialogOpen(false);
    setIsSubmitting(true);
    const success = await clearAllProductsFromSheet();
    await loadProducts(false);
    setPopularityVersion(v => v + 1);
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

  /**
   * Отменяет удаление всех товаров.
   */
   const cancelClearAllProducts = useCallback(() => {
    setIsClearAllDialogOpen(false);
  }, []);


  /**
   * Начинает процесс редактирования товара, заполняя форму его данными.
   */
  const startEditing = useCallback((product: Product) => {
    if (isLoading || isSubmitting) return;
    setEditingProductId(product.id);
    editForm.reset({ // Заполняем форму редактирования
      name: product.name,
      volume: product.volume || "",
      price: product.price !== undefined ? String(product.price) : '', // Преобразуем число в строку
      imageUrl: product.imageUrl || "",
      dataAiHint: product.dataAiHint || "",
    });
  }, [editForm, isLoading, isSubmitting]);

  /**
   * Отменяет редактирование товара и сбрасывает форму.
   */
  const cancelEditing = useCallback(() => {
    setEditingProductId(null);
    editForm.reset({ name: "", volume: "", price: undefined, imageUrl: "", dataAiHint: "" });
  }, [editForm]);

  /**
   * Обработчик отправки формы редактирования товара.
   */
  const onEditSubmit = useCallback(async (data: ProductFormData) => {
    if (!editingProductId || isSubmitting) return;
    const originalProduct = products.find(p => p.id === editingProductId);
    if (!originalProduct) return;

    // Валидация цены (должна быть указана)
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
      await loadProducts(false);
      setPopularityVersion(v => v + 1);
      setEditingProductId(null); // Завершаем режим редактирования
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

  /**
   * Синхронизирует сырые данные о товарах (из product-defaults) с Google Sheets.
   * Добавляет только те товары, которых еще нет в таблице.
   */
  const handleSyncRawProducts = useCallback(async () => {
    if (isLoading || isSubmitting) return;
    setIsSubmitting(true);
    const result = await syncRawProductsToSheet();
    setIsSubmitting(false);
    if (result.success) {
        toast({
          title: "Синхронизация завершена",
          description: `${result.message} Добавлено: ${result.addedCount}, Пропущено: ${result.skippedCount}.`,
        });
        if (result.addedCount > 0) { // Обновляем список, только если что-то добавили
          await loadProducts(false);
          setPopularityVersion(v => v + 1);
        }
    } else {
         toast({
          title: "Ошибка синхронизации",
          description: result.message,
          variant: "destructive",
        });
    }
  }, [toast, loadProducts, isLoading, isSubmitting]);

  /**
   * Обновляет список товаров и данные о популярности.
   */
  const handleRefresh = useCallback(async () => {
    if (isLoading || isSubmitting) return;
    await loadProducts(true); // Загрузка с индикатором
    setPopularityVersion(v => v + 1); // Обновление версии популярности
    if (!errorLoading) {
      toast({
        title: "Список обновлен",
        description: "Данные товаров загружены из Google Sheets."
      });
    }
  }, [loadProducts, toast, isLoading, isSubmitting, errorLoading]);

  // Рендеринг заглушки, если компонент еще не смонтирован на клиенте
  if (!isClient) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader><CardTitle>Добавить товар</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Загрузка формы...</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Существующие товары</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Загрузка списка...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Основная JSX разметка компонента ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
      {/* Карточка для добавления нового товара */}
      <Card className="shadow-md flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
            <PlusCircle className="h-5 w-5 mr-2 text-primary" /> Добавить новый товар
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
          {/* Компонент формы добавления товара */}
          <AddProductForm form={form} onSubmit={onSubmitAddProduct} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>

      {/* Карточка для отображения и управления существующими товарами */}
      <Card className="shadow-md flex flex-col h-[70vh]">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg md:text-xl">
            Существующие товары ({(isLoading || isPopularityLoading) && products.length === 0 ? <Loader2 className="inline h-4 w-4 animate-spin" /> : products.length})
          </CardTitle>
          {/* Кнопки действий (Загрузить примеры, Удалить все) */}
          <div className="flex gap-2">
          {/* Кнопка для загрузки примеров товаров, если список пуст */}
          {products.length === 0 && !isLoading && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleSyncRawProducts}
                      className="h-8 w-8"
                      disabled={isLoading || isSubmitting || isPopularityLoading}
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
            {/* Диалог подтверждения удаления всех товаров */}
            <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        disabled={products.length === 0 || isLoading || isSubmitting || isPopularityLoading}
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
                  <AlertDialogCancel className="text-xs px-3 h-9" onClick={cancelClearAllProducts} disabled={isSubmitting}>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmClearAllProducts}
                    className={buttonVariants({ variant: "destructive", size: "sm", className: "text-xs px-3 h-9" })}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSubmitting ? 'Удаление...' : 'Удалить все'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden p-0 flex flex-col">
          {/* Панель поиска, сортировки и обновления */}
          <div className="flex gap-2 px-6 py-4 items-center flex-shrink-0 border-b">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск товаров..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 h-9"
                disabled={isLoading || isSubmitting || isPopularityLoading}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchTerm("")}
                  disabled={isLoading || isSubmitting || isPopularityLoading}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Очистить поиск</span>
                </Button>
              )}
            </div>
            {/* Выпадающее меню для сортировки */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  disabled={isLoading || isSubmitting || isPopularityLoading}
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
                {/* Другие опции сортировки... */}
                <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}> <ArrowDownZA className="mr-2 h-4 w-4" /> <span>Названию (Я-А)</span> </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}> <ArrowDown01 className="mr-2 h-4 w-4" /> <span>Цене (возрастание)</span> </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}> <ArrowDown10 className="mr-2 h-4 w-4" /> <span>Цене (убывание)</span> </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}> <TrendingUp className="mr-2 h-4 w-4" /> <span>Популярности (сначала топ)</span> </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Кнопка обновления списка */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    className={cn("h-8 w-8 text-muted-foreground", (isLoading || isSubmitting || isPopularityLoading) && "animate-spin")}
                    disabled={isLoading || isSubmitting || isPopularityLoading}
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

          {/* Отображение ошибки загрузки или списка товаров */}
          {errorLoading && !isLoading && (
            <p className="text-destructive text-center py-4 px-6">Ошибка загрузки: {errorLoading}</p>
          )}
          {!errorLoading && (
            <ScrollArea className="flex-grow min-h-0 p-6 pt-4">
              {/* Компонент списка товаров */}
              <ProductList
                products={filteredAndSortedProducts}
                editForm={editForm}
                editingProductId={editingProductId}
                topProductsRanking={topProductsRanking}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onEditSubmit={onEditSubmit}
                onRemoveProduct={initiateDeleteProduct}
                isLoading={isLoading || isPopularityLoading}
                isEditingLoading={isSubmitting} // Передаем состояние загрузки редактирования
              />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Диалог подтверждения удаления одного товара */}
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
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
