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

  // This useEffect is handled by the middleware now
  // useEffect(() => {
  //   // Redirect to login if not loading and no user is authenticated
  //   if (!isLoading && !user) {
  //     router.push('/login');
  //   }
  // }, [user, isLoading, router]);

  // Optional: Show loading state while checking auth
  // Changed condition to show loading only when isLoading is true
  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-3.5rem)]"> {/* Adjusted height */}
            <p className="text-muted-foreground">Загрузка...</p>
        </main>
    );
  }

  // Redirect if not loading and still no user (should be caught by middleware, but belt-and-suspenders)
  if (!user) {
     // The middleware should handle this, but as a fallback:
     // router.push('/login'); // This might cause hydration issues if called directly in render
     // Return null or a minimal component while redirecting
     return (
        <main className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-3.5rem)]">
             {/* Optionally show a message or redirect indicator */}
        </main>
     );
  }


  // Render the main content only if authenticated and not loading
  return (
    <main className="container mx-auto p-4 md:p-8">
      {/* Header is now in layout.tsx */}
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
