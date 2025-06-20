
# ☕ Дневник секретиков баристы

![Демонстарция приложения](./src/app/Coffee-Order-Board.gif)

"Дневник секретиков баристы" — это веб-приложение, разработанное для упрощения процесса управления заказами и товарами в небольшой кофейне или для бариста, работающего на мероприятиях. Приложение позволяет быстро собирать заказы, управлять ассортиментом товаров и просматривать историю продаж. В качестве бэкенда для хранения данных (товары, пользователи, история продаж) используется Google Sheets.

## 🚀 Основные возможности

*   **Конструктор заказов**: Интуитивно понятный интерфейс для быстрого добавления товаров в заказ, выбора способа оплаты и оформления продажи.
*   **Управление товарами**: Возможность добавлять, редактировать и удалять товары из ассортимента.
*   **История продаж**: Просмотр всех совершенных продаж с возможностью фильтрации по дате и сортировки.
*   **Аутентификация пользователей**: Система входа для сотрудников с проверкой учетных данных через Google Sheets.
*   **Управление профилем**: Пользователи могут обновлять свою информацию и менять пароль.
*   **Адаптивный дизайн**: Приложение оптимизировано для использования как на десктопных, так и на мобильных устройствах.

## 🛠️ Стек технологий

*   **Фреймворк**: [Next.js](https://nextjs.org/) (App Router)
*   **Язык**: [TypeScript](https://www.typescriptlang.org/)
*   **Библиотека UI**: [React](https://react.dev/)
*   **Компоненты UI**: [ShadCN/UI](https://ui.shadcn.com/)
*   **Стилизация**: [Tailwind CSS](https://tailwindcss.com/)
*   **Аутентификация**: [iron-session](https://github.com/vvo/iron-session) для управления сессиями
*   **Работа с формами**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) для валидации
*   **Взаимодействие с Google Sheets**: [googleapis](https://github.com/googleapis/google-api-nodejs-client)
*   **Хеширование паролей**: [bcrypt](https://www.npmjs.com/package/bcrypt)
*   **Уведомления (Toasts)**: Кастомная реализация
*   **ИИ-функциональность (если применимо)**: [Genkit](https://firebase.google.com/docs/genkit) (например, для генерации подсказок к изображениям)
*   **База данных**: [Google Sheets](https://www.google.com/sheets/about/)

## 📦 Ключевые пакеты

*   `next`: Основной фреймворк.
*   `react`, `react-dom`: Библиотека для построения UI.
*   `tailwindcss`, `autoprefixer`, `postcss`: Для стилизации.
*   `lucide-react`: Для иконок.
*   `@radix-ui/*`: Низкоуровневые примитивы для компонентов ShadCN/UI.
*   `class-variance-authority`, `clsx`, `tailwind-merge`: Утилиты для работы с классами.
*   `googleapis`, `google-auth-library`: Для взаимодействия с Google Sheets API.
*   `iron-session`: Для управления сессиями.
*   `bcrypt`: Для безопасного хеширования паролей.
*   `zod`, `@hookform/resolvers`: Для валидации форм.
*   `date-fns`: Для работы с датами.
*   `genkit`, `@genkit-ai/googleai`, `@genkit-ai/next` (если используется ИИ): Для интеграции с Genkit.

## 🌳 Структура проекта (упрощенная)

```
.
├── public/                   # Статические ассеты (favicon, изображения)
├── src/
│   ├── ai/                   # Логика, связанная с Genkit (если используется)
│   │   └── flows/
│   ├── app/                  # Основная директория Next.js App Router
│   │   ├── (authenticated)/  # Группа маршрутов, требующих аутентификации
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx      # Главная страница (Конструктор заказов)
│   │   ├── api/              # API маршруты (аутентификация, данные)
│   │   ├── login/            # Страница входа
│   │   ├── globals.css       # Глобальные стили и переменные Tailwind/ShadCN
│   │   └── layout.tsx        # Корневой макет приложения
│   ├── components/           # Общие компоненты UI
│   │   ├── order-builder/    # Компоненты для конструктора заказов
│   │   ├── product-management/# Компоненты для управления товарами
│   │   ├── sales-history/    # Компоненты для истории продаж
│   │   ├── user-profile-modal/# Компоненты для модального окна профиля
│   │   ├── shared/           # Переиспользуемые мелкие компоненты
│   │   └── ui/               # Компоненты ShadCN/UI (кнопки, карточки и т.д.)
│   ├── context/              # React Context (например, AuthContext)
│   ├── hooks/                # Кастомные React хуки (useToast, useDebounce)
│   ├── lib/                  # Вспомогательные утилиты и константы
│   ├── services/             # Сервисы для взаимодействия с внешними API (Google Sheets)
│   └── types/                # Определения TypeScript типов (Product, User, Order)
├── .env                      # Переменные окружения (ключи API, конфигурация)
├── next.config.js            # Конфигурация Next.js
├── package.json              # Зависимости и скрипты проекта
├── tailwind.config.ts        # Конфигурация Tailwind CSS
└── tsconfig.json             # Конфигурация TypeScript
```

## ⚙️ Запуск проекта

1.  **Клонируйте репозиторий (если применимо):**
    ```bash
    git clone <URL_РЕПОЗИТОРИЯ>
    cd <НАЗВАНИЕ_ПРОЕКТА>
    ```

2.  **Установите зависимости:**
    ```bash
    npm install
    # или
    yarn install
    ```

3.  **Настройте переменные окружения:**
    Создайте файл `.env` в корне проекта и заполните его необходимыми значениями, следуя примеру из `.env.example` (если он есть) или инструкциям ниже.
    Ключевые переменные:
    *   `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Email сервисного аккаунта Google.
    *   `GOOGLE_PRIVATE_KEY`: Приватный ключ сервисного аккаунта Google (в одну строку, заменяя переносы строк на `\n`).
    *   `GOOGLE_SHEET_ID`: ID вашей Google Таблицы.
    *   `GOOGLE_SHEET_NAME` (или `GOOGLE_PRODUCTS_SHEET_NAME`): Название листа с товарами (например, `price`).
    *   `GOOGLE_USERS_SHEET_NAME`: Название листа с пользователями (например, `users`).
    *   `GOOGLE_HISTORY_SHEET_NAME`: Название листа с историей продаж (например, `history`).
    *   `IRON_SESSION_PASSWORD`: Секретный пароль для шифрования сессий (минимум 32 символа).

    **Важно:** Убедитесь, что сервисный аккаунт имеет права на редактирование вашей Google Таблицы.

4.  **Запустите сервер для разработки:**
    ```bash
    npm run dev
    # или
    yarn dev
    ```
    Приложение будет доступно по адресу `http://localhost:9002` (порт может отличаться).

5.  **(Опционально) Запустите Genkit (если используется ИИ):**
    ```bash
    npm run genkit:dev
    ```

## 🔑 Аутентификация

Аутентификация пользователей реализована через проверку логина и пароля по данным, хранящимся на листе `users` (или как указано в `GOOGLE_USERS_SHEET_NAME`) в Google Таблице. Пароли хешируются с использованием `bcrypt` перед сохранением и при проверке. Сессии управляются с помощью `iron-session`.

При первом входе с "голым" (нехешированным) паролем пользователю будет предложено сменить пароль в настройках профиля для повышения безопасности.

## 📄 Google Таблица

Приложение использует Google Таблицу как базу данных. Ожидается следующая структура листов:

### Лист товаров (например, `price`)

| Название             | Объём (необязательно) | Цена (₽) | URL изображения (необязательно) | Подсказка изображения (необязательно) |
| :------------------- | :-------------------- | :------- | :----------------------------- | :------------------------------------ |
| Капучино             | 0.2 л                 | 150      | https://...                    | cappuccino small cup                  |
| Американо            |                       | 115      | https://...                    | americano black coffee                |
| ...                  | ...                   | ...      | ...                            | ...                                   |

### Лист пользователей (например, `users`)

| ID | Логин     | Хеш пароля / Пароль | Имя (необязательно) | Отчество (необязательно) | Фамилия (необязательно) | Должность   | Цвет иконки (HEX) |
| -- | :-------- | :------------------ | :------------------ | :----------------------- | :---------------------- | :---------- | :---------------- |
| 1  | asmachnev | $2b$10$...          | Артем               | Сергеевич                | Мачнев                  | Разработчик | #32a852           |
| 2  | vika      | 1234                | Вика                |                          |                         | Сотрудник   | #a83240           |
| ...| ...       | ...                 | ...                 | ...                      | ...                     | ...         | ...               |

### Лист истории продаж (например, `history`)

| ID Заказа                     | Дата и время        | Товары                                                         | Способ оплаты | Итого (₽) | Сотрудник                             |
| :---------------------------- | :------------------ | :------------------------------------------------------------- | :------------ | :-------- | :------------------------------------ |
| order_1746558773243_7v8r5     | 06.05.2025 19:12:53 | Американо (0,2 л) x1, Американо (0,3 л) x1, Капучино (0,4 л) x5 | Карта         | 1225      | Разработчик - Мачнев А.С. (asmachnev) |
| ...                           | ...                 | ...                                                            | ...           | ...       | ...                                   |

---

Приятной работы с "Дневником секретиков баристы"!
