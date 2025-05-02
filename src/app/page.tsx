import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderBuilder } from "@/components/order-builder";
import { ProductManagement } from "@/components/product-management";
import { SalesHistory } from "@/components/sales-history"; // Import the new component
import { Coffee } from "lucide-react";

export default function Home() {
  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-center mb-8">
        <Coffee className="h-8 w-8 mr-2 text-primary" />
        <h1 className="text-3xl font-bold text-center text-primary">
          Доска заказов кофе
        </h1>
      </header>
      <Tabs defaultValue="order">
        <TabsList className="grid w-full grid-cols-3 mx-auto mb-6"> {/* Removed max-w-lg */}
          <TabsTrigger value="order" className="text-xs sm:text-sm px-2 sm:px-3">Конструктор заказов</TabsTrigger> {/* Adjusted text size and padding */}
          <TabsTrigger value="manage" className="text-xs sm:text-sm px-2 sm:px-3">Управление товарами</TabsTrigger> {/* Adjusted text size and padding */}
          <TabsTrigger value="history" className="text-xs sm:text-sm px-2 sm:px-3">История продаж</TabsTrigger> {/* Adjusted text size and padding */}
        </TabsList>
        <TabsContent value="order">
          <OrderBuilder />
        </TabsContent>
        <TabsContent value="manage">
          <ProductManagement />
        </TabsContent>
         <TabsContent value="history"> {/* Added history content */}
          <SalesHistory />
        </TabsContent>
      </Tabs>
    </main>
  );
}
