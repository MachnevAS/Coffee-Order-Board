

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

// Assuming ProductFormData is defined elsewhere or passed in
type ProductFormData = {
  name: string;
  volume?: string;
  price: number | undefined; // Allow undefined
  imageUrl?: string;
  dataAiHint?: string;
};

interface ProductListItemProps {
  product: Product;
  isEditing: boolean;
  editForm: UseFormReturn<ProductFormData>; // Pass the form instance
  onStartEditing: (product: Product) => void;
  onCancelEditing: () => void;
  onEditSubmit: (data: ProductFormData) => void; // Pass the submit handler
  onRemoveProduct: (id: string) => void;
  popularityRank?: number; // Added for consistency, though not used visually here
}

export function ProductListItem({
  product,
  isEditing,
  editForm,
  onStartEditing,
  onCancelEditing,
  onEditSubmit,
  onRemoveProduct,
  popularityRank, // Receive prop
}: ProductListItemProps) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = product.imageUrl || `https://picsum.photos/100/100?random=${product.id}`;

  return (
    <li key={product.id} className="flex flex-col p-3 border rounded-md bg-card transition-colors duration-150">
      {isEditing ? (
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
             <FormField control={editForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Название</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="volume" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Объём</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="price" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Цена (₽)</FormLabel><FormControl><Input type="text" inputMode="numeric" pattern="[0-9]*([\.,][0-9]+)?" {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="imageUrl" render={({ field }) => ( <FormItem><FormLabel className="text-xs">URL изображения</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <FormField control={editForm.control} name="dataAiHint" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Подсказка ИИ</FormLabel><FormControl><Input {...field} value={field.value ?? ''} className="h-8 text-sm" /></FormControl><FormMessage /></FormItem> )} />
             <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onCancelEditing} className="text-xs px-2 h-8"><X className="h-4 w-4 mr-1" /> Отмена</Button> {/* Adjusted text size and padding */}
                  <Button type="submit" size="sm" className="text-xs px-2 h-8"><Save className="h-4 w-4 mr-1" /> Сохранить</Button> {/* Adjusted text size and padding */}
             </div>
          </form>
        </Form>
      ) : (
        <div className="flex items-center justify-between gap-2">
           <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-grow">
             <div className="relative h-10 w-10 md:h-12 md:w-12 rounded-md overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {imgError || !product.imageUrl ? (
                    <Coffee className="h-6 w-6 text-muted-foreground/50" /> // Fallback icon
                  ) : (
                     <Image
                      src={imgSrc}
                      alt={product.name}
                      fill
                      style={{objectFit:"cover"}}
                      data-ai-hint={product.dataAiHint || 'кофе'}
                      sizes="40px md:48px"
                      onError={() => setImgError(true)} // Set error state on failure
                      unoptimized={imgSrc.includes('picsum.photos')} // Avoid optimizing picsum placeholders
                    />
                  )}
             </div>

            <div className="overflow-hidden flex-grow">
                <p className="font-medium truncate text-sm md:text-base">{product.name}</p>
                {(product.volume || product.price !== undefined) && (
                    // Use font-sans for price/currency
                    <p className="text-xs md:text-sm text-muted-foreground font-sans">
                        {product.volume && <span>{product.volume} / </span>}
                        {product.price.toFixed(0)} ₽
                    </p>
                )}
            </div>
           </div>

          <div className="flex gap-1 flex-shrink-0">
               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onStartEditing(product)}>
                 <Edit className="h-4 w-4" />
                 <span className="sr-only">Редактировать {product.name}</span>
               </Button>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Удалить {product.name}</span>
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Это действие необратимо. Товар "{product.name} {product.volume || ''}" будет удален навсегда.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs px-3 h-9">Отмена</AlertDialogCancel> {/* Adjusted size */}
                        <AlertDialogAction onClick={() => onRemoveProduct(product.id)} className={buttonVariants({ variant: "destructive", size:"sm", className:"text-xs px-3 h-9" })}> {/* Adjusted size */}
                            Удалить
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
          </div>
        </div>
      )}
    </li>
  );
}
