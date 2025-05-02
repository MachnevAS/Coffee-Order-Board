import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderBuilder } from "@/components/order-builder";
import { ProductManagement } from "@/components/product-management";
import { SalesHistory } from "@/components/sales-history"; // Import the new component
import { Coffee } from "lucide-react"; // Ensure Coffee icon is imported

export default function Home() {
  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="flex items-center justify-center mb-8">
        <Coffee className="h-6 w-6 sm:h-8 sm:w-8 mr-2 text-primary" /> {/* Coffee icon already present, adjusted size */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-primary whitespace-nowrap"> {/* Changed text, adjusted responsive size, added nowrap */}
          Дневник секретиков баристы
        </h1>
      </header>
      <Tabs defaultValue="order">
        <TabsList className="grid w-full grid-cols-3 mx-auto mb-6 h-auto min-h-10 items-stretch"> {/* Added h-auto, min-h-10, items-stretch */}
          <TabsTrigger value="order" className="text-xs sm:text-sm px-1 py-1 sm:px-3 sm:py-1.5 whitespace-normal h-full">Конструктор заказов</TabsTrigger> {/* Adjusted text size and padding, added whitespace-normal, h-full */}
          <TabsTrigger value="manage" className="text-xs sm:text-sm px-1 py-1 sm:px-3 sm:py-1.5 whitespace-normal h-full">Управление товарами</TabsTrigger> {/* Adjusted text size and padding, added whitespace-normal, h-full */}
          <TabsTrigger value="history" className="text-xs sm:text-sm px-1 py-1 sm:px-3 sm:py-1.5 whitespace-normal h-full">История продаж</TabsTrigger> {/* Adjusted text size and padding, added whitespace-normal, h-full */}
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
