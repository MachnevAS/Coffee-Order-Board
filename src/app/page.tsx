import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderBuilder } from "@/components/order-builder";
import { ProductManagement } from "@/components/product-management";
import { Coffee } from "lucide-react";

export default function Home() {
  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-center mb-8">
        <Coffee className="h-8 w-8 mr-2 text-primary" />
        <h1 className="text-3xl font-bold text-center text-primary">
          Coffee Order Board
        </h1>
      </header>
      <Tabs defaultValue="order">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
          <TabsTrigger value="order">Order Builder</TabsTrigger>
          <TabsTrigger value="manage">Product Management</TabsTrigger>
        </TabsList>
        <TabsContent value="order">
          <OrderBuilder />
        </TabsContent>
        <TabsContent value="manage">
          <ProductManagement />
        </TabsContent>
      </Tabs>
    </main>
  );
}