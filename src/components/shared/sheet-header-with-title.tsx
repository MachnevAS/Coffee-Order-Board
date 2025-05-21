/**
 * @file Компонент для отображения заголовка внутри Sheet (шторки) с использованием VisuallyHidden для доступности.
 */
"use client";

import React from 'react';
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/**
 * Свойства компонента SheetHeaderWithTitle.
 */
interface SheetHeaderWithTitleProps {
  /** Уникальный ID для заголовка, используемый для aria-labelledby. */
  titleId: string;
  /** Текст заголовка, видимый для зрячих пользователей. */
  visibleTitle: string;
  /** Текст заголовка, который будет прочитан скринридерами (если отличается от visibleTitle или для явного указания). */
  accessibleTitle: string;
  /** Дополнительные классы CSS для SheetHeader. */
  className?: string;
}

/**
 * Компонент для отображения заголовка в шторке (Sheet).
 * Включает видимый заголовок и скрытый заголовок для скринридеров для улучшения доступности.
 * @param props - Свойства компонента.
 * @returns JSX элемент заголовка шторки.
 */
export const SheetHeaderWithTitle: React.FC<SheetHeaderWithTitleProps> = ({
  titleId,
  visibleTitle,
  accessibleTitle,
  className,
}) => {
  return (
    <SheetHeader className={cn("p-3 md:p-4 border-b text-left", className)}>
      {/* Скрытый заголовок для скринридеров, связанный с aria-labelledby */}
      <VisuallyHidden>
        <SheetTitle id={titleId}>{accessibleTitle}</SheetTitle>
      </VisuallyHidden>
      {/* Видимый заголовок, не связанный напрямую с aria, так как эту роль выполняет скрытый */}
      <p className="text-lg font-semibold text-foreground" aria-hidden="true">
        {visibleTitle}
      </p>
    </SheetHeader>
  );
};

// Импорт cn из utils, если он еще не импортирован глобально в проекте
// import { cn } from '@/lib/utils'; // Предполагается, что этот файл существует
// Если cn не используется, его импорт можно удалить.
// В данном случае он используется в className={cn(...)}, поэтому оставляем.
import { cn } from '@/lib/utils';
