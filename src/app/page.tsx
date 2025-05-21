/**
 * @file Главная страница приложения.
 * Отображает вкладки для конструктора заказов, управления товарами и истории продаж.
 * Показывает предупреждение о смене пароля, если это необходимо.
 */
'use client';

import React, { useEffect, useState } from 'react'; // React импортирован
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderBuilder } from "@/components/order-builder";
import { ProductManagement } from "@/components/product-management";
import { SalesHistory } from "@/components/sales-history";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

/**
 * Компонент главной страницы.
 * @returns JSX элемент главной страницы.
 */
export default function Home() {
  const { user, isLoading, showPasswordChangeWarning } = useAuth();
  const router = useRouter();
  // Состояние для отслеживания, было ли предупреждение о смене пароля отклонено пользователем
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);

  // Отображение состояния загрузки, пока данные пользователя загружаются
  if (isLoading) {
    return (
        <main className="h-full flex flex-col justify-center items-center"> {/* Используем h-full для заполнения и центрирования */}
          <div className="container mx-auto p-4 md:p-8 text-center"> {/* Внутренний контейнер для контента */}
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-2">Загрузка данных пользователя...</p>
          </div>
        </main>
    );
  }

  // Если пользователь не аутентифицирован, middleware должен перенаправить на страницу входа.
  // Этот блок служит запасным вариантом UI, если middleware не успел сработать.
  if (!user) {
     return (
        <main className="container mx-auto p-4 md:p-8 flex justify-center items-center h-full"> {/* Используем h-full */}
             {/* Middleware обрабатывает перенаправление, это запасной UI */}
        </main>
     );
  }

  /**
   * Обработчик для закрытия предупреждения о смене пароля.
   */
  const handleDismissWarning = () => {
    setIsWarningDismissed(true);
    // Опционально, можно вызвать clearPasswordChangeWarning() из AuthContext,
    // чтобы предупреждение не показывалось до следующего входа.
    // На данный момент локальное скрытие достаточно.
  };

  // Основная разметка страницы
  return (
    <main className="container mx-auto p-4 md:p-8">
      {/* Отображение предупреждения о смене пароля, если необходимо и оно не было отклонено */}
      {showPasswordChangeWarning && !isWarningDismissed && (
        <Alert variant="destructive" className="mb-6 relative">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Рекомендация по безопасности</AlertTitle>
          <AlertDescription>
            Ваш пароль хранится в небезопасном формате. Пожалуйста, смените его в настройках профиля для повышения безопасности вашего аккаунта.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6" style={{paddingLeft: 0}}
            onClick={handleDismissWarning}
            aria-label="Закрыть предупреждение"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* Компонент вкладок для навигации по основным разделам */}
      <Tabs defaultValue="order" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mx-auto mb-6 h-auto min-h-10 items-stretch">
          <TabsTrigger value="order" className="text-xs sm:text-sm px-1 py-1 sm:px-3 sm:py-1.5 whitespace-normal h-full">Конструктор заказов</TabsTrigger>
          <TabsTrigger value="manage" className="text-xs sm:text-sm px-1 py-1 sm:px-3 sm:py-1.5 whitespace-normal h-full">Управление товарами</TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm px-1 py-1 sm:px-3 sm:py-1.5 whitespace-normal h-full">История продаж</TabsTrigger>
        </TabsList>
        <TabsContent value="order">
          <OrderBuilder />
        </TabsContent>
        <TabsContent value="manage">
          <ProductManagement />
        </TabsContent>
         <TabsContent value="history">
          <SalesHistory />
        </TabsContent>
      </Tabs>
    </main>
  );
}
