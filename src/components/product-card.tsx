/**
 * @file Компонент карточки товара.
 * Отображает информацию о товаре, включая изображение, название, объем, цену,
 * а также кнопки для добавления/удаления товара из заказа и значки популярности.
 */
"use client";

import React, { useState } from 'react';
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MinusCircle, Coffee, Crown, Award } from "lucide-react";
import type { Product } from "@/types/product";
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Свойства компонента ProductCard.
 */
interface ProductCardProps {
  /** Объект товара. */
  product: Product;
  /** Функция для добавления товара в заказ. */
  onAddToOrder: (product: Product) => void;
  /** Функция для удаления одной единицы товара из заказа. */
  onRemoveFromOrder: (productId: string) => void;
  /** Текущее количество данного товара в заказе. */
  orderQuantity: number | undefined;
  /** Ранг популярности товара (1, 2 или 3), если применимо. */
  popularityRank?: number;
}

/**
 * Компонент для отображения карточки товара.
 * @param props - Свойства компонента.
 * @returns JSX элемент карточки товара.
 */
export function ProductCard({ product, onAddToOrder, onRemoveFromOrder, orderQuantity, popularityRank }: ProductCardProps) {
  // Состояние для отслеживания ошибки загрузки изображения
  const [imgError, setImgError] = useState(false);
  // Источник изображения: либо URL из данных товара, либо заглушка
  const imgSrc = product.imageUrl && !imgError ? product.imageUrl : `https://placehold.co/100x80.png`;
  const useFallbackIcon = imgError || !product.imageUrl;

  /**
   * Функция для отображения иконки ранга популярности.
   * @returns JSX элемент иконки ранга или null.
   */
  const renderRankIcon = () => {
    if (!popularityRank || popularityRank > 3) return null; // Отображаем только для топ-3

    // Конфигурация для иконок и текста рангов
    const rankConfig = {
      1: { icon: <Crown className="h-4 w-4" />, text: "Топ 1 по популярности", color: "text-yellow-500" }, // Золото
      2: { icon: <Award className="h-4 w-4" />, text: "Топ 2 по популярности", color: "text-gray-400" },   // Серебро
      3: { icon: <Award className="h-4 w-4" />, text: "Топ 3 по популярности", color: "text-orange-600" } // Бронза (используем оранжевый для контраста)
    }[popularityRank];

    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("absolute top-1 right-1 p-0.5 rounded-full bg-background/70 backdrop-blur-sm", rankConfig.color)}>
              {rankConfig.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs px-2 py-1">
            <p>{rankConfig.text}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col text-xs md:text-sm">
      <CardHeader className="p-0 relative">
        {/* Контейнер для изображения товара */}
        <div className="relative h-20 w-full bg-muted flex items-center justify-center">
          {useFallbackIcon ? (
            // Иконка-заглушка, если изображение не загрузилось или отсутствует
            <Coffee className="h-10 w-10 text-muted-foreground/50" />
          ) : (
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              style={{ objectFit: "cover" }}
              data-ai-hint={product.dataAiHint || 'кофе'}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw"
              onError={() => setImgError(true)} // Обработка ошибки загрузки изображения
              unoptimized={true} // Отключаем оптимизацию Next.js для поддержки любых URL
            />
          )}
          {renderRankIcon()} {/* Отображение иконки ранга популярности */}
        </div>
      </CardHeader>
      <CardContent className="p-1.5 md:p-2 flex-grow flex items-center justify-between gap-1">
        {/* Название и объем товара */}
        <div className="flex-grow">
          <CardTitle className="text-xs md:text-sm font-medium line-clamp-2 leading-tight">
            {product.name} {product.volume && <span className="text-muted-foreground font-normal">({product.volume})</span>}
          </CardTitle>
        </div>
        {/* Цена товара */}
        <p className="text-sm md:text-base text-foreground font-semibold whitespace-nowrap flex-shrink-0 font-sans">
          {(product.price !== undefined ? product.price.toFixed(0) : '0')} ₽
        </p>
      </CardContent>
      <CardFooter className="p-1.5 md:p-2 pt-0 mt-auto">
        {/* Кнопки управления количеством товара в заказе */}
        {orderQuantity && orderQuantity > 0 ? (
          <div className="flex items-center justify-between w-full gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
              onClick={() => onRemoveFromOrder(product.id)}
              aria-label={`Убрать 1 ${product.name}`}
            >
              <MinusCircle className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="secondary" className="px-2 text-sm md:text-base font-medium flex-shrink-0 min-w-[28px] justify-center font-sans">
              {orderQuantity}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
              onClick={() => onAddToOrder(product)}
              aria-label={`Добавить 1 ${product.name}`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          // Кнопка для добавления товара в заказ, если его еще нет
          <Button
            onClick={() => onAddToOrder(product)}
            className="w-full h-7 md:h-8 text-xs px-2"
            variant="outline"
          >
            <PlusCircle className="mr-1 h-3 w-3" /> Добавить
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
