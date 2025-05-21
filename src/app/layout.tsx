/**
 * @file Корневой макет приложения.
 * Определяет базовую HTML-структуру, включая метаданные, шрифты и глобальные провайдеры.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/auth-context";
import Header from "@/components/header";
import { Coffee } from "lucide-react"; // Import Coffee icon

// Инициализация шрифта Geist Sans
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Инициализация моноширинного шрифта Geist Mono
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/**
 * Метаданные для страницы.
 * title: Заголовок страницы.
 * description: Описание страницы.
 * icons: Фавикон для приложения.
 */
export const metadata: Metadata = {
  title: "Дневник секретиков баристы",
  description: "Заказывайте кофе и управляйте товарами",
  // Использование SVG в качестве фавиконки напрямую в метаданных не стандартно.
  // Обычно указывается путь к файлу .ico, .png или .svg.
  // Для простоты, если нужно SVG, его лучше разместить в /public и указать путь.
  // Либо, если это Data URI, то он должен быть корректно сформирован.
  // Оставим favicon.ico, но если есть SVG, он должен быть в /public/favicon.svg
  icons: {
    icon: '/favicon.ico', // Стандартный favicon
    // icon: '/favicon.svg', // Если есть SVG favicon
  },
};

/**
 * Корневой компонент макета.
 * Оборачивает дочерние элементы необходимыми провайдерами и глобальные компоненты.
 * @param children - Дочерние React-элементы, которые будут отображены внутри макета.
 * @returns JSX элемент корневого макета.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full">{/* Установка языка документа на русский и высоты на 100% */}
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased h-full`}> {/* Установка высоты body на 100% */}
        {/* Обертка AuthProvider для предоставления контекста аутентификации всему приложению */}
        <AuthProvider>
          {/* Контейнер для flex-разметки, занимающий всю высоту */}
          <div className="flex flex-col h-full">
            {/* Компонент шапки сайта */}
            <Header />
            {/* Основное содержимое страницы с вертикальной прокруткой, если необходимо */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
            {/* Компонент для отображения всплывающих уведомлений */}
            <Toaster />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

// Для отображения SVG иконки кофе в качестве фавиконки,
// можно создать компонент, который будет вставлять SVG в <head> через react-helmet или next/head.
// Однако, для простоты, обычно используют файл.
// Если нужно динамически генерировать SVG для favicon, это сложнее и выходит за рамки стандартной metadata.
// Ниже пример, как можно было бы сделать SVG иконку (если бы это был отдельный компонент):
// const Favicon = () => (
//   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <path d="M10 21.125V19.75C10 18.0975 11.3475 16.75 13 16.75H14C15.6525 16.75 17 15.4025 17 13.75V8.875C17 7.2225 15.6525 5.875 14 5.875H13C11.3475 5.875 10 4.5275 10 2.875V1.5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//     <path d="M7 19.75H17" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//     <path d="M7.15271 5.16187C6.03021 6.28437 5.34021 7.81687 5.34021 9.50687C5.34021 11.1969 6.03021 12.7294 7.15271 13.8519" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//   </svg>
// );
// И затем использовать <Favicon /> в <head> через next/head, если нужно вставлять SVG напрямую.
// Но для `metadata.icons`, лучше использовать путь к файлу.