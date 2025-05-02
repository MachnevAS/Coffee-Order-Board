
"use client";

import React, { useState } from 'react';
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Coffee } from "lucide-react";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  onAddToOrder: (product: Product) => void;
}

export function ProductCard({ product, onAddToOrder }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = product.imageUrl || `https://picsum.photos/100/80?random=${product.id}`;

  return (
    <Card key={product.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col text-xs md:text-sm">
      <CardHeader className="p-0">
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
        </div>
      </CardHeader>
      <CardContent className="p-1.5 md:p-2 flex-grow flex items-center justify-between gap-1"> {/* Adjusted padding & flex items-center */}
         <div className="flex-grow"> {/* Wrapper for name and volume */}
             <CardTitle className="text-xs md:text-sm font-medium mb-0 line-clamp-2 leading-tight"> {/* Removed mb-0.5 */}
                 {product.name} {product.volume && <span className="text-muted-foreground font-normal">({product.volume})</span>}
             </CardTitle>
         </div>
         <p className="text-sm md:text-base text-foreground font-semibold whitespace-nowrap flex-shrink-0">{product.price.toFixed(0)} ₽</p> {/* Larger price, nowrap, shrink-0 */}
      </CardContent>
      <CardFooter className="p-1.5 md:p-2 pt-0 mt-auto">
        <Button onClick={() => onAddToOrder(product)} className="w-full h-7 md:h-8 text-xs px-2" variant="outline"> {/* Adjusted px */}
          <PlusCircle className="mr-1 h-3 w-3" /> Добавить
        </Button>
      </CardFooter>
    </Card>
  );
}
