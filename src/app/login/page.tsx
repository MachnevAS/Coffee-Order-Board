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
import { AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  login: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  // isLoading state now reflects form submission status, not global auth loading
  const [isFormSubmitting, setIsFormSubmitting] = useState(false); 
  const { login, user, isLoading: authIsLoading } = useAuth(); // authIsLoading for global state
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  });

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user && !authIsLoading) { // Use authIsLoading here
      console.log("[LoginPage] User is authenticated, redirecting to /");
      router.push('/');
    }
  }, [user, router, authIsLoading]);


  const onSubmit = async (data: LoginFormValues) => {
    if (isFormSubmitting) return;
    
    setError(null);
    setIsFormSubmitting(true); // Use local form submitting state
    
    try {
      const loginSuccessful = await login(data.login, data.password);
      
      if (loginSuccessful) {
        toast({
          title: 'Вход выполнен',
          description: 'Добро пожаловать!',
        });
        // router.push('/'); // This will now be handled by the useEffect above once 'user' state updates
                           // or by middleware if it catches the change faster.
                           // Let's ensure the user state propagates before a forced push.
      } else {
        setError('Неверный логин или пароль');
        toast({
          title: 'Ошибка входа',
          description: 'Неверный логин или пароль.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Login page submit error:', err);
      setError('Произошла ошибка при входе. Попробуйте снова.');
      toast({
        title: 'Ошибка сервера',
        description: 'Не удалось выполнить вход. Пожалуйста, попробуйте позже.',
        variant: 'destructive',
      });
    } finally {
      setIsFormSubmitting(false); // Reset local form submitting state
    }
  };

  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Ошибка</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  // If global auth is loading, or if user is already set (and useEffect will redirect), show loading/minimal UI
  if (authIsLoading) {
    return (
        <main className="flex flex-col items-center justify-center p-4 min-h-screen">
            <p className="text-muted-foreground">Загрузка...</p>
        </main>
    );
  }
  // If user is already set, the useEffect will handle redirection.
  // Showing the form briefly while redirecting might be okay or show a "Redirecting..." message.
  // For now, let's assume the useEffect handles it quickly.

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
                        disabled={isFormSubmitting} // Use local form submitting state
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
                        disabled={isFormSubmitting} // Use local form submitting state
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
                disabled={isFormSubmitting} // Use local form submitting state
              >
                {isFormSubmitting ? 'Вход...' : 'Войти'} 
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
