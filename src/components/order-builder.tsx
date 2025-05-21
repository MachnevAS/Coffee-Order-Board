/**
 * @file Компонент конструктора заказов.
 * Позволяет пользователю выбирать товары, формировать заказ, выбирать способ оплаты и оформлять заказ.
 * Данные о товарах и история продаж загружаются из Google Sheets.
 */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types/product";
import type { PaymentMethod, Order } from "@/types/order";
import { Search, ShoppingCart, X, ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, SlidersHorizontal, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader, // Используется для видимой части
  SheetTitle,  // Используется для доступности
  SheetTrigger, // Добавлен импорт SheetTrigger
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ProductGrid } from './order-builder/product-grid';
import { OrderDetails } from './order-builder/order-details';
import type { OrderItem } from './order-builder/order-item-type';
import type { SortOption } from './order-builder/sort-option-type';
import { LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY } from '@/lib/constants';
import { fetchProductsFromSheet, addOrderToSheet, fetchOrdersFromSheet as fetchAllOrdersForPopularity } from '@/services/google-sheets-service';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from "@/context/auth-context";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';


/**
 * Вспомогательная функция для расчета популярности продуктов на основе истории продаж из Google Sheets.
 * Ключ популярности формируется как "Название|Объем".
 * @returns {Promise<Map<string, number>>} Карта, где ключ - "Название|Объем", значение - количество продаж.
 */
const calculatePopularityNameVolumeMapFromSheet = async (): Promise<Map<string, number>> => {
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
    } else {
       console.warn("OrderBuilder: Получены неверные данные о заказах из Google Sheets для расчета популярности.");
    }
  } catch (e) {
    console.error("OrderBuilder: Ошибка при загрузке или обработке истории продаж из Google Sheets для расчета популярности:", e);
  }
  return popularityMap;
};

/**
 * Вспомогательная функция для сопоставления популярности (по ключу "Название|Объем") с ID локальных продуктов.
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
 * Основной компонент конструктора заказов.
 * @returns JSX элемент конструктора заказов.
 */
export function OrderBuilder() {
  // Состояния компонента
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [popularityVersion, setPopularityVersion] = useState<number>(0); // Состояние для триггера обновления популярности
  const [isClient, setIsClient] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);
  const [resolvedPopularityMap, setResolvedPopularityMap] = useState<Map<string, number>>(new Map()); // Карта популярности
  const [isPopularityLoading, setIsPopularityLoading] = useState(false); // Флаг загрузки популярности

  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const orderSheetTitleId = React.useId(); // ID для заголовка шторки
  const orderCardTitleId = React.useId(); // ID для заголовка карточки

  /**
   * Загружает список продуктов из Google Sheets.
   * @param showLoadingIndicator - Показывать ли индикатор загрузки.
   */
  const loadProducts = useCallback(async (showLoadingIndicator = true) => {
      if (showLoadingIndicator) setIsLoading(true);
      setErrorLoading(null);
      try {
          console.log("OrderBuilder: Загрузка продуктов...");
          const fetchedProducts = await fetchProductsFromSheet();
          console.log(`OrderBuilder: Загружено ${fetchedProducts.length} продуктов.`);
          setProducts(fetchedProducts);
          // Обновление цен в текущем заказе, если продукты были обновлены
          setOrder(prevOrder => prevOrder.map(orderItem => {
              const updatedProduct = fetchedProducts.find(p => p.id === orderItem.id);
              return updatedProduct ? { ...updatedProduct, quantity: orderItem.quantity, price: updatedProduct.price !== undefined ? updatedProduct.price : 0  } : null;
          }).filter((item): item is OrderItem => item !== null)); // Удаляем null элементы, если продукт был удален из таблицы
      } catch (error: any) {
          console.error("OrderBuilder: Не удалось загрузить продукты:", error);
          const errorMessage = error.message || "Не удалось получить список товаров из Google Sheets.";
          setErrorLoading(errorMessage);
          toast({
              title: "Ошибка загрузки товаров",
              description: errorMessage,
              variant: "destructive",
          });
          setProducts([]); // Очищаем список продуктов в случае ошибки
          setOrder([]); // Очищаем заказ
      } finally {
          if (showLoadingIndicator) setIsLoading(false);
          console.log("OrderBuilder: Загрузка продуктов завершена.");
      }
  }, [toast]); // toast добавлен как зависимость

  // Эффект для начальной загрузки данных и установки опции сортировки из localStorage
  useEffect(() => {
    setIsClient(true);
    try {
        const storedSortOption = localStorage.getItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY);
        if (storedSortOption && ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-desc'].includes(storedSortOption)) {
            setSortOption(storedSortOption as SortOption);
        } else {
            // Если в localStorage нет валидной опции, устанавливаем по умолчанию 'name-asc'
            localStorage.setItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY, 'name-asc');
            setSortOption('name-asc');
        }
    } catch (lsError) {
        console.error("OrderBuilder: Ошибка доступа к localStorage для опции сортировки.", lsError);
        // В случае ошибки доступа к localStorage, устанавливаем сортировку по умолчанию
        setSortOption('name-asc');
    }

    loadProducts();
  }, [loadProducts]); // loadProducts добавлена как зависимость

  // Эффект для сохранения выбранной опции сортировки в localStorage при ее изменении
  useEffect(() => {
    if (isClient) {
      try {
        localStorage.setItem(LOCAL_STORAGE_ORDER_BUILDER_SORT_KEY, sortOption);
      } catch (e) {
        console.error("OrderBuilder: Не удалось сохранить опцию сортировки в localStorage.", e);
      }
    }
  }, [sortOption, isClient]);

  // Расчет общей стоимости заказа
  const totalPrice = useMemo(() => {
    return order.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);
  }, [order]);

  // Эффект для загрузки и обновления данных о популярности товаров
  useEffect(() => {
    if (!isClient) return; // Выполняем только на клиенте

    const fetchPopularity = async () => {
      setIsPopularityLoading(true);
      console.log("OrderBuilder: Загрузка карты популярности из таблицы, версия:", popularityVersion);
      try {
        const map = await calculatePopularityNameVolumeMapFromSheet();
        setResolvedPopularityMap(map);
      } catch (error) {
        console.error("OrderBuilder: Ошибка при загрузке карты популярности", error);
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
  }, [popularityVersion, isClient, toast]); // Добавляем isClient и toast в зависимости

  // Мемоизированный расчет рангов топ-продуктов
  const topProductsRanking = useMemo(() => {
    const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
    const sortedByPopularity = Array.from(productIdPopularityMap.entries())
      .sort(([, countA], [, countB]) => countB - countA); // Сортировка по убыванию популярности
    const ranking = new Map<string, number>();
    // Присваиваем ранг топ-3 продуктам
    sortedByPopularity.slice(0, 3).forEach(([productId], index) => {
      ranking.set(productId, index + 1); // Ранги 1, 2, 3
    });
    console.log("OrderBuilder: Рассчитаны ранги топ-продуктов:", ranking);
    return ranking;
  }, [products, resolvedPopularityMap]); // resolvedPopularityMap - зависимость

  // Мемоизированный список отфильтрованных и отсортированных продуктов
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Фильтрация по поисковому запросу
    if (debouncedSearchTerm) {
      const lowerCaseSearchTerm = debouncedSearchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (product.volume && product.volume.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    // Сортировка
    switch (sortOption) {
       case 'name-asc':
         result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
         break;
       case 'name-desc':
         result.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
         break;
       case 'price-asc':
         result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
         break;
       case 'price-desc':
         result.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
         break;
       case 'popularity-desc':
         {
           // Используем resolvedPopularityMap для получения данных о популярности
           const productIdPopularityMap = mapPopularityToProductId(products, resolvedPopularityMap);
           result.sort((a, b) => {
             const popA = productIdPopularityMap.get(a.id) || 0;
             const popB = productIdPopularityMap.get(b.id) || 0;
             const popDiff = popB - popA; // Сначала самые популярные
             if (popDiff !== 0) return popDiff;
             return a.name.localeCompare(b.name, 'ru'); // При равной популярности сортируем по имени
           });
         }
         break;
    }
    return result;
  }, [products, debouncedSearchTerm, sortOption, resolvedPopularityMap]); // resolvedPopularityMap добавлена в зависимости

  // Мемоизированный объект с количеством каждого товара в заказе (для ProductGrid)
  const orderQuantities = useMemo(() => {
    return order.reduce((quantities, item) => {
      quantities[item.id] = item.quantity;
      return quantities;
    }, {} as { [productId: string]: number });
  }, [order]);

  /**
   * Обработчик изменения опции сортировки.
   * @param newSortOption - Новая выбранная опция сортировки.
   */
  const handleSetSortOption = useCallback((newSortOption: SortOption) => {
    setSortOption(newSortOption);
  }, []);

  /**
   * Добавляет товар в заказ или увеличивает его количество.
   * @param product - Товар для добавления.
   */
  const addToOrder = useCallback((product: Product) => {
    setOrder((prevOrder) => {
      const existingItemIndex = prevOrder.findIndex((item) => item.id === product.id);
      if (existingItemIndex > -1) {
        // Если товар уже есть в заказе, увеличиваем его количество
        const updatedOrder = [...prevOrder];
        updatedOrder[existingItemIndex] = {
          ...updatedOrder[existingItemIndex],
          quantity: updatedOrder[existingItemIndex].quantity + 1
        };
        return updatedOrder;
      } else {
        // Если товара нет, добавляем его с количеством 1
        const price = product.price ?? 0; // Устанавливаем цену 0, если она undefined
        return [...prevOrder, { ...product, price, quantity: 1 }];
      }
    });
  }, []);

  /**
   * Уменьшает количество товара в заказе или удаляет его, если количество становится 0.
   * @param productId - ID товара для удаления/уменьшения количества.
   */
  const removeFromOrder = useCallback((productId: string) => {
    setOrder((prevOrder) => {
      const existingItemIndex = prevOrder.findIndex((item) => item.id === productId);
      if (existingItemIndex > -1) {
        const currentQuantity = prevOrder[existingItemIndex].quantity;
        if (currentQuantity > 1) {
          // Если количество больше 1, уменьшаем его
          const updatedOrder = [...prevOrder];
          updatedOrder[existingItemIndex] = { ...updatedOrder[existingItemIndex], quantity: currentQuantity - 1 };
          return updatedOrder;
        } else {
          // Если количество 1, удаляем товар из заказа
          return prevOrder.filter((item) => item.id !== productId);
        }
      }
      return prevOrder; // Возвращаем предыдущее состояние, если товар не найден (хотя это маловероятно)
    });
  }, []);

  /**
   * Удаляет всю позицию товара из заказа, независимо от количества.
   * @param productId - ID товара для полного удаления из заказа.
   */
  const removeEntireItem = useCallback((productId: string) => {
    setOrder((prevOrder) => prevOrder.filter((item) => item.id !== productId));
  }, []);

  /**
   * Очищает текущий заказ и сбрасывает выбранный способ оплаты.
   */
  const clearOrder = useCallback(() => {
    setOrder([]);
    setSelectedPaymentMethod(null);
  }, []);

  /**
   * Обработчик выбора способа оплаты.
   * @param method - Выбранный способ оплаты.
   */
  const handleSelectPaymentMethod = useCallback((method: PaymentMethod) => {
      setSelectedPaymentMethod(method);
  }, []);

  /**
   * Обработчик оформления заказа.
   * Собирает данные заказа и отправляет их в Google Sheets.
   */
  const handleCheckout = useCallback(async () => {
    if (order.length === 0) {
      toast({ title: "Заказ пуст", description: "Пожалуйста, добавьте товары в заказ.", variant: "destructive" });
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ title: "Выберите способ оплаты", description: "Пожалуйста, укажите способ оплаты заказа.", variant: "destructive" });
      return;
    }

    setIsCheckoutProcessing(true); // Устанавливаем флаг обработки

    // Формирование строки информации о сотруднике
    let employeeString = 'Неизвестный сотрудник';
    if (currentUser) {
      const initials = `${currentUser.lastName || ''} ${currentUser.firstName ? currentUser.firstName[0] + '.' : ''}${currentUser.middleName ? currentUser.middleName[0] + '.' : ''}`.trim();
      employeeString = `${currentUser.position || 'Сотрудник'} - ${initials} (${currentUser.login})`;
    }

    // Формирование объекта данных заказа
    const orderData: Order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Генерация уникального ID заказа
      items: order.map(item => ({
        id: item.id, // ID продукта
        name: item.name,
        volume: item.volume,
        price: item.price ?? 0, // Цена товара на момент заказа
        quantity: item.quantity,
      })),
      totalPrice: totalPrice,
      timestamp: format(new Date(), 'dd.MM.yyyy HH:mm:ss', { locale: ru }), // Текущая дата и время
      paymentMethod: selectedPaymentMethod,
      employee: employeeString,
    };

    try {
      const success = await addOrderToSheet(orderData); // Отправка заказа в Google Sheets

      if (success) {
        toast({ title: "Заказ оформлен!", description: `Итого: ${totalPrice.toFixed(0)} ₽ (${selectedPaymentMethod}). Ваш заказ сохранен в Google Sheets.` });
        clearOrder(); // Очистка корзины
        setIsSheetOpen(false); // Закрытие шторки на мобильных
        // Обновление данных о популярности, если текущая сортировка по популярности
         if (sortOption === 'popularity-desc') {
            setPopularityVersion(v => v + 1); // Триггер для useEffect, который загружает популярность
         }
      } else {
        toast({ title: "Ошибка оформления заказа", description: "Не удалось сохранить заказ в Google Sheets.", variant: "destructive" });
      }
    } catch (error) {
      console.error("OrderBuilder: Не удалось сохранить заказ в Google Sheet:", error);
      toast({ title: "Ошибка оформления заказа", description: "Не удалось сохранить заказ в Google Sheets.", variant: "destructive" });
    } finally {
      setIsCheckoutProcessing(false); // Снимаем флаг обработки
    }
  }, [order, selectedPaymentMethod, totalPrice, toast, clearOrder, currentUser, sortOption]); // sortOption добавлен для обновления популярности

  /**
   * Обработчик обновления списка продуктов и данных о популярности.
   */
  const handleRefresh = useCallback(async () => {
      await loadProducts(true); // Загрузка продуктов с индикатором
      setPopularityVersion(v => v + 1); // Обновление версии популярности для ее пересчета
      if (!errorLoading) { // Уведомление только если не было ошибки при загрузке
         toast({ title: "Список обновлен", description: "Данные товаров загружены из Google Sheets." });
      }
  }, [loadProducts, toast, errorLoading]); // errorLoading добавлен в зависимости

   // Рендеринг заглушки, если компонент еще не смонтирован на клиенте или идет начальная загрузка
   if (!isClient || (isLoading && products.length === 0 && !errorLoading)) {
     return (
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2">
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Загрузка конструктора...</p>
            </div>
         </div>
         <div className="lg:col-span-1">
           {/* Заглушка для карточки заказа */}
           <Card className="shadow-lg lg:sticky lg:top-8"><CardHeader><CardTitle>Текущий заказ</CardTitle></CardHeader><OrderDetails order={[]} totalPrice={0} selectedPaymentMethod={null} onRemoveFromOrder={()=>{}} onAddToOrder={()=>{}} onRemoveEntireItem={()=>{}} onSelectPaymentMethod={()=>{}} onCheckout={()=>{}} onClearOrder={()=>{}} orderCardTitleId="" orderSheetTitleId="" isCheckoutProcessing={false} /></Card>
         </div>
       </div>
     );
   }

  // --- Основная JSX разметка компонента ---
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 pb-16 lg:pb-0"> {/* Увеличен pb для плавающей кнопки */}
      {/* Секция списка доступных товаров */}
      <div className="lg:col-span-2">
         {/* Заголовок и кнопка обновления */}
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-primary">Доступные товары</h2>
            {/* Кнопка обновления */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleRefresh} className={cn("h-8 w-8 text-muted-foreground", (isLoading || isPopularityLoading) && "animate-spin")} disabled={isLoading || isCheckoutProcessing || isPopularityLoading}>
                            <RefreshCw className="h-4 w-4" />
                            <span className="sr-only">Обновить список</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Обновить список товаров из Google Sheets</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
         </div>

        {/* Поиск и сортировка */}
        <div className="flex gap-2 mb-4">
          {/* Поле поиска */}
          <div className="relative flex-grow">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 h-9" // pr-8 для кнопки очистки
              disabled={isLoading || isCheckoutProcessing || isPopularityLoading}
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")} disabled={isLoading || isCheckoutProcessing || isPopularityLoading}>
                <X className="h-4 w-4" /> <span className="sr-only">Очистить поиск</span>
              </Button>
            )}
          </div>
          {/* Выпадающее меню сортировки */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs sm:text-sm" disabled={isLoading || isCheckoutProcessing || isPopularityLoading}>
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Сортировать
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleSetSortOption('name-asc')} className={cn(sortOption === 'name-asc' && 'bg-accent text-accent-foreground')}> <ArrowDownAZ className="mr-2 h-4 w-4" /> <span>Названию (А-Я)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('name-desc')} className={cn(sortOption === 'name-desc' && 'bg-accent text-accent-foreground')}> <ArrowDownZA className="mr-2 h-4 w-4" /> <span>Названию (Я-А)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('price-asc')} className={cn(sortOption === 'price-asc' && 'bg-accent text-accent-foreground')}> <ArrowDown01 className="mr-2 h-4 w-4" /> <span>Цене (возрастание)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('price-desc')} className={cn(sortOption === 'price-desc' && 'bg-accent text-accent-foreground')}> <ArrowDown10 className="mr-2 h-4 w-4" /> <span>Цене (убывание)</span> </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleSetSortOption('popularity-desc')} className={cn(sortOption === 'popularity-desc' && 'bg-accent text-accent-foreground')}> <TrendingUp className="mr-2 h-4 w-4" /> <span>Популярности (сначала топ)</span> </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Отображение ошибки загрузки */}
        {errorLoading && !isLoading && (
          <p className="text-destructive text-center py-4">Ошибка загрузки: {errorLoading}</p>
        )}

        {/* Сетка продуктов */}
        {!errorLoading && ( // Показываем сетку, только если нет ошибки
            <ProductGrid
            products={filteredAndSortedProducts}
            orderQuantities={orderQuantities}
            topProductsRanking={topProductsRanking}
            onAddToOrder={addToOrder}
            onRemoveFromOrder={removeFromOrder}
            isLoading={isLoading || isPopularityLoading} // Передаем объединенный флаг загрузки
            />
        )}
      </div>

      {/* Секция текущего заказа (шторка для мобильных) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-2 bg-background border-t">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-12 shadow-lg text-base flex items-center justify-between" disabled={isCheckoutProcessing}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {order.length > 0 && (
                  <Badge variant="secondary" className="h-5 w-auto px-1.5 justify-center text-xs font-medium">
                    {order.reduce((sum, item) => sum + item.quantity, 0)} поз.
                  </Badge>
                )}
                <span>Корзина</span> {/* Надпись "Корзина" на кнопке */}
              </div>
              {totalPrice > 0 && (
                <span className="font-semibold font-sans">{totalPrice.toFixed(0)} ₽</span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-lg h-[75vh] flex flex-col p-0" // h-[75vh] или другая подходящая высота
            aria-labelledby={orderSheetTitleId} // Для доступности
            aria-describedby={undefined} // Если нет описания
          >

            <VisuallyHidden><SheetTitle id={orderSheetTitleId}>Текущий заказ</SheetTitle></VisuallyHidden>
            <SheetHeader className="p-3 md:p-4 border-b text-left">
                 <p className="text-lg font-semibold text-foreground" aria-hidden="true">Текущий заказ</p> {/* Видимый заголовок */}
            </SheetHeader>
            <OrderDetails
              isSheet={true} // Указываем, что это шторка
              order={order}
              totalPrice={totalPrice}
              selectedPaymentMethod={selectedPaymentMethod}
              onRemoveFromOrder={removeFromOrder}
              onAddToOrder={addToOrder}
              onRemoveEntireItem={removeEntireItem}
              onSelectPaymentMethod={handleSelectPaymentMethod}
              onCheckout={handleCheckout}
              onClearOrder={clearOrder}
              orderCardTitleId={orderCardTitleId} // Передаем ID для связывания (хотя он для карточки)
              orderSheetTitleId={orderSheetTitleId} // Передаем ID для связывания
              isCheckoutProcessing={isCheckoutProcessing}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Секция текущего заказа (карточка для десктопа) */}
      <div className="hidden lg:block lg:col-span-1">
         <Card className="shadow-md lg:sticky flex flex-col" style={{top: '1rem', maxHeight: 'calc(100vh - 5rem)'}}> {/* Изменен top и maxHeight */}
          <CardHeader className="p-3 md:p-4 pb-3 flex-shrink-0" aria-labelledby={orderCardTitleId}>
            <CardTitle id={orderCardTitleId} className="text-xl">Текущий заказ</CardTitle>
          </CardHeader>
          <OrderDetails
            order={order}
            totalPrice={totalPrice}
            selectedPaymentMethod={selectedPaymentMethod}
            onRemoveFromOrder={removeFromOrder}
            onAddToOrder={addToOrder}
            onRemoveEntireItem={removeEntireItem}
            onSelectPaymentMethod={handleSelectPaymentMethod}
            onCheckout={handleCheckout}
            onClearOrder={clearOrder}
            orderCardTitleId={orderCardTitleId}
            orderSheetTitleId={orderSheetTitleId} // Передаем ID для связывания
            isCheckoutProcessing={isCheckoutProcessing}
          />
        </Card>
      </div>
    </div>
  );
}
