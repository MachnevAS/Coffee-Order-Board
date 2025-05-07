'use client'; 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderBuilder } from "@/components/order-builder";
import { ProductManagement } from "@/components/product-management";
import { SalesHistory } from "@/components/sales-history";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context'; 

export default function Home() {
  const { user, isLoading, showPasswordChangeWarning, clearPasswordChangeWarning } = useAuth();
  const router = useRouter();
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);


  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-3.5rem)]"> 
            <p className="text-muted-foreground">Загрузка...</p>
        </main>
    );
  }

  if (!user) {
     return (
        <main className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-3.5rem)]">
             {/* Middleware handles redirect, this is a fallback UI */}
        </main>
     );
  }

  const handleDismissWarning = () => {
    setIsWarningDismissed(true);
    // Optionally, could also call clearPasswordChangeWarning() if we want it dismissed for the session
    // For now, local dismissal is fine.
  };


  return (
    <main className="container mx-auto p-4 md:p-8">
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

      <Tabs defaultValue="order">
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
