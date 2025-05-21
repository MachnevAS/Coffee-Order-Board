/**
 * @file Страница входа пользователя.
 * Предоставляет форму для аутентификации пользователя.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

// Схема валидации для формы входа
const loginSchema = z.object({
  login: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен'),
});

// Тип для значений формы входа
type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Компонент страницы входа.
 * @returns JSX элемент страницы входа.
 */
export default function LoginPage() {
  // Состояние для отображения ошибки
  const [error, setError] = useState<string | null>(null);
  // Состояние, указывающее, идет ли процесс отправки формы
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  // Хук для аутентификации
  const { login, user, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Инициализация формы с помощью react-hook-form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  });

  // Перенаправление пользователя, если он уже аутентифицирован
  useEffect(() => {
    // Консольный вывод для отслеживания состояния
    console.log(`[LoginPage useEffect] user: ${user?.login}, authIsLoading: ${authIsLoading}`);
    if (user && !authIsLoading) {
      console.log("[LoginPage] Пользователь аутентифицирован и загрузка завершена, перенаправление на /");
      router.push('/');
    }
  }, [user, authIsLoading, router]); // router добавлен как зависимость, так как он используется

  /**
   * Обработчик отправки формы.
   * @param data - Данные формы.
   */
  const onSubmit = async (data: LoginFormValues) => {
    if (isFormSubmitting) return;

    setError(null);
    setIsFormSubmitting(true);

    try {
      const loginSuccessful = await login(data.login, data.password);

      if (loginSuccessful) {
        toast({
          title: 'Вход выполнен',
          description: 'Добро пожаловать!',
        });
        // Редирект теперь полностью обрабатывается useEffect выше.
        // Это гарантирует, что редирект произойдет после обновления состояния user и authIsLoading.
      } else {
        setError('Неверный логин или пароль');
        toast({
          title: 'Ошибка входа',
          description: 'Неверный логин или пароль.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Ошибка на странице входа при отправке:', err);
      setError('Произошла ошибка при входе. Попробуйте снова.');
      toast({
        title: 'Ошибка сервера',
        description: 'Не удалось выполнить вход. Пожалуйста, попробуйте позже.',
        variant: 'destructive',
      });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Компонент для отображения сообщения об ошибке
  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Ошибка</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  // Отображение загрузки, если идет глобальная проверка аутентификации
  // или если пользователь еще не определен (начальная загрузка)
  if (authIsLoading && !user) {
    return (
        <main className="flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground mt-2">Проверка сессии...</p>
        </main>
    );
  }

  // Основная разметка страницы входа
  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Вход</CardTitle>
          <CardDescription>Введите ваш логин и пароль для входа.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="login"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Логин</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ваш логин"
                        {...field}
                        disabled={isFormSubmitting}
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Ваш пароль"
                        {...field}
                        disabled={isFormSubmitting}
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {errorAlert}
              <Button
                type="submit"
                className="w-full"
                disabled={isFormSubmitting}
              >
                {isFormSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isFormSubmitting ? 'Вход...' : 'Войти'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
