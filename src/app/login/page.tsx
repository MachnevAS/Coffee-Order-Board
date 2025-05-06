'use client';

import React, { useState } from 'react';
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
import { AlertCircle } from 'lucide-react';

// Схема валидации вынесена за пределы компонента для оптимизации
const loginSchema = z.object({
  login: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (isLoading) return; // Предотвращаем множественные отправки
    
    setError(null);
    setIsLoading(true);
    
    try {
      const loginSuccessful = await login(data.login, data.password);
      
      if (loginSuccessful) {
        toast({
          title: 'Вход выполнен',
          description: 'Добро пожаловать!',
        });
        
        // Используем setTimeout для гарантии выполнения после обновления состояния
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 0);
      } else {
        setError('Неверный логин или пароль');
        toast({
          title: 'Ошибка входа',
          description: 'Неверный логин или пароль.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Произошла ошибка при входе. Попробуйте снова.');
      toast({
        title: 'Ошибка сервера',
        description: 'Не удалось выполнить вход. Пожалуйста, попробуйте позже.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Мемоизируем форму ошибки для предотвращения ненужных перерисовок
  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Ошибка</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  return (
    <main className="flex flex-col items-center justify-center p-4" style={{height: "80vh"}}>
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                disabled={isLoading}
              >
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
