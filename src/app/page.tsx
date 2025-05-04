'use client'; // Add 'use client' for hooks

import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use from next/navigation
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderBuilder } from "@/components/order-builder";
import { ProductManagement } from "@/components/product-management";
import { SalesHistory } from "@/components/sales-history";
import { Coffee } from "lucide-react";
import { useAuth } from '@/context/auth-context'; // Import useAuth

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not loading and no user is authenticated
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Optional: Show loading state or nothing while checking auth
  if (isLoading || !user) {
    return (
        <main className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-screen">
            <p className="text-muted-foreground">Загрузка...</p>
        </main>
    );
  }


  // Render the main content only if authenticated
  return (
    <main className="container mx-auto p-4 md:p-8">
      {/* Header is now in layout.tsx */}
      {/*
      <header className="flex items-center justify-center mb-8">
        <Coffee className="h-6 w-6 sm:h-8 sm:w-8 mr-2 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-primary whitespace-nowrap">
          Дневник секретиков баристы
        </h1>
      </header>
      */}
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
