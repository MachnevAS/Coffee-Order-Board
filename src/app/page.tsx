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
        <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto mb-6"> {/* Updated grid-cols */}
          <TabsTrigger value="order">Конструктор заказов</TabsTrigger>
          <TabsTrigger value="manage">Управление товарами</TabsTrigger>
          <TabsTrigger value="history">История продаж</TabsTrigger> {/* Added history tab */}
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
