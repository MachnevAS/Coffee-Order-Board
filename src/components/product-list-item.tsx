

"use client";

import React, { useState } from 'react';
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
import type { Product } from "@/types/product";
import { Edit, Trash2, Save, X, Coffee } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

// Assuming ProductFormData matches the management form schema
type ProductFormData = {
  name: string;
  volume?: string;
  price: number | undefined;
  imageUrl?: string;
  dataAiHint?: string;
};

interface ProductListItemProps {
  product: Product; // Contains local ID
  isEditing: boolean;
  editForm: UseFormReturn<ProductFormData>;
  onStartEditing: (product: Product) => void; // Pass product with local ID
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void;
  onRemoveProduct: (product: Product) => void; // Pass the full product object
  popularityRank?: number;
}

export function ProductListItem({
  product,
  isEditing,
  editForm,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  popularityRank,
}: ProductListItemProps) {
  const [imgError, setImgError] = useState(false);
  // Use picsum as fallback only if imageUrl is truly missing/invalid after fetch
  const imgSrc = !imgError && product.imageUrl ? product.imageUrl : `https://picsum.photos/100/80?random=${product.id}`;
  const useFallbackIcon = imgError || !product.imageUrl;

  return (
    <li key={product.id} className="flex flex-col p-3 border rounded-md bg-card transition-colors duration-150">
      {isEditing ? (
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
             {/* Form fields remain the same */}
             <FormField control={editForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Название</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="volume" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Объём</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="price" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel className="text-xs">URL изображения</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Подсказка ИИ</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onCancelEditing} className="text-xs px-2 h-8"><X className="h-4 w-4 mr-1" /> Отмена</Button>
                  <Button type="submit" size="sm" className="text-xs px-2 h-8"><Save className="h-4 w-4 mr-1" /> Сохранить</Button>
             </div>
          </form>
        </Form>
      ) : (
        <div className="flex items-center justify-between gap-2">
           <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-grow">
             <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-md overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {useFallbackIcon ? (
                    <Coffee className="h-6 w-6 text-muted-foreground/50" />
                  ) : (
                     <Image
                      src={imgSrc} // Already determined above
                      alt={product.name}
                      fill
                      style={{objectFit:"cover"}}
                      data-ai-hint={product.dataAiHint || 'кофе'}
                      sizes="40px md:48px"
                      onError={() => setImgError(true)}
                      unoptimized={imgSrc.includes('picsum.photos')}
                    />
                  )}
             </div>

            <div className="overflow-hidden flex-grow">
                <p className="font-medium truncate text-sm md:text-base">{product.name}</p>
                {(product.volume || product.price !== undefined) && (
                    <p className="text-xs md:text-sm text-muted-foreground font-sans">
                        {product.volume && <span>{product.volume} / </span>}
                        {(product.price !== undefined ? product.price.toFixed(0) : 'N/A')} ₽
                    </p>
                )}
            </div>
           </div>

          <div className="flex gap-1 flex-shrink-0">
               {/* Edit button still uses local ID implicitly via onStartEditing */}
               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onStartEditing(product)}>
                 <Edit className="h-4 w-4" />
                 <span className="sr-only">Редактировать {product.name}</span>
               </Button>

               {/* Delete button now triggers handler with the full product object */}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onRemoveProduct(product)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Удалить {product.name}</span>
                </Button>
          </div>
        </div>
      )}
    </li>
  );
}
