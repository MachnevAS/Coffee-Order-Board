

"use client";

import React, { useState } from 'react';
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Import Badge
import { PlusCircle, MinusCircle, Coffee, Crown, Award } from "lucide-react"; // Removed Medal, kept Award
import type { Product } from "@/types/product";
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

interface ProductCardProps {
  product: Product;
  onAddToOrder: (product: Product) => void;
  onRemoveFromOrder: (productId: string) => void; // Add remove function prop
  orderQuantity: number | undefined; // Add quantity prop
  popularityRank?: number; // Optional rank (1, 2, or 3)
}

export function ProductCard({ product, onAddToOrder, onRemoveFromOrder, orderQuantity, popularityRank }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = product.imageUrl || `https://picsum.photos/100/80?random=${product.id}`;

  const RankIcon = () => {
    if (!popularityRank) return null;

    let icon = null;
    let tooltipText = "";
    let colorClass = "";

    if (popularityRank === 1) {
        icon = <Crown className="h-4 w-4" />;
        tooltipText = "Топ 1 по популярности";
        colorClass = "text-yellow-500";
    } else if (popularityRank === 2) {
        icon = <Award className="h-4 w-4" />;
        tooltipText = "Топ 2 по популярности";
        colorClass = "text-gray-400"; // Silver-like
    } else if (popularityRank === 3) {
        icon = <Award className="h-4 w-4" />; // Changed Medal to Award
        tooltipText = "Топ 3 по популярности";
        colorClass = "text-orange-500"; // Changed color to a darker bronze/orange
    }

    if (!icon) return null;

    return (
         <TooltipProvider delayDuration={100}>
           <Tooltip>
             <TooltipTrigger asChild>
                <div className={cn("absolute top-1 right-1 p-0.5 rounded-full bg-background/70 backdrop-blur-sm", colorClass)}>
                  {icon}
                </div>
             </TooltipTrigger>
             <TooltipContent side="top" className="text-xs px-2 py-1">
               <p>{tooltipText}</p>
             </TooltipContent>
           </Tooltip>
         </TooltipProvider>
    );
  };


  return (
    <Card key={product.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col text-xs md:text-sm">
      <CardHeader className="p-0 relative"> {/* Make header relative for positioning rank icon */}
        <div className="relative h-20 w-full bg-muted flex items-center justify-center">
          {imgError || !product.imageUrl ? (
            <Coffee className="h-10 w-10 text-muted-foreground/50" /> // Fallback icon
          ) : (
            <Image
              src={imgSrc}
              alt={product.name}
              fill
              style={{ objectFit: "cover" }}
              data-ai-hint={product.dataAiHint || 'кофе'}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw"
              onError={() => setImgError(true)} // Set error state on failure
              unoptimized={imgSrc.includes('picsum.photos')} // Avoid optimizing picsum placeholders
            />
          )}
           <RankIcon /> {/* Render the rank icon */}
        </div>
      </CardHeader>
      <CardContent className="p-1.5 md:p-2 flex-grow flex items-center justify-between gap-1"> {/* Adjusted padding & flex items-center */}
         <div className="flex-grow"> {/* Wrapper for name and volume */}
             <CardTitle className="text-xs md:text-sm font-medium mb-0 line-clamp-2 leading-tight"> {/* Removed mb-0.5 */}
                 {product.name} {product.volume && <span className="text-muted-foreground font-normal">({product.volume})</span>}
             </CardTitle>
         </div>
         {/* Use font-sans for currency and handle undefined price */}
         <p className="text-sm md:text-base text-foreground font-semibold whitespace-nowrap flex-shrink-0 font-sans">
           {(product.price !== undefined ? product.price.toFixed(0) : '0')} ₽
         </p>
      </CardContent>
      <CardFooter className="p-1.5 md:p-2 pt-0 mt-auto">
        {orderQuantity && orderQuantity > 0 ? (
          <div className="flex items-center justify-between w-full gap-1"> {/* Use justify-between and gap */}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" // flex-shrink-0
              onClick={() => onRemoveFromOrder(product.id)}
              aria-label={`Убрать 1 ${product.name}`}
            >
              <MinusCircle className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="secondary" className="px-2 text-sm md:text-base font-medium flex-shrink-0 min-w-[28px] justify-center"> {/* Added min-width & justify-center */}
              {orderQuantity}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" // flex-shrink-0
              onClick={() => onAddToOrder(product)}
               aria-label={`Добавить 1 ${product.name}`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
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
