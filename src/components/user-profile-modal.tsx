'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Palette, User as UserIcon, Briefcase, KeyRound } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// Schema definition
const profileSchema = z.object({
  login: z.string().min(3, 'Логин должен быть не менее 3 символов'),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  position: z.string().optional(),
  iconColor: z.string()
    .regex(/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, "Неверный HEX цвет")
    .optional()
    .or(z.literal('')),
  currentPassword: z.string().optional().or(z.literal('')),
  newPassword: z.string()
    .min(6, 'Новый пароль должен быть не менее 6 символов')
    .optional()
    .or(z.literal('')),
  confirmNewPassword: z.string().optional().or(z.literal('')),
})
.refine(
  (data) => !data.newPassword?.length || (data.currentPassword?.length || 0) > 0,
  {
    message: 'Текущий пароль обязателен для смены пароля',
    path: ['currentPassword'],
  }
)
.refine(
  (data) => data.newPassword === data.confirmNewPassword, 
  {
    message: 'Новые пароли не совпадают',
    path: ['confirmNewPassword'],
  }
)
.refine(
  (data) => !data.newPassword || !data.currentPassword || data.newPassword !== data.currentPassword,
  {
    message: 'Новый пароль не должен совпадать с текущим',
    path: ['newPassword'],
  }
);

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function UserProfileModal({ isOpen, setIsOpen }: UserProfileModalProps) {
  const { user, updateUser, isLoading: authLoading, verifyAndChangePassword } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [formInitializedForUserId, setFormInitializedForUserId] = useState<string | number | null>(null);

  // Form setup
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      login: '',
      firstName: '',
      middleName: '',
      lastName: '',
      position: '',
      iconColor: '#cccccc',
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    mode: 'onChange',
  });

  // Initialize form with user data
  useEffect(() => {
    if (user && isOpen && String(formInitializedForUserId) !== String(user.id)) {
      form.reset({
        login: user.login || '',
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        position: user.position || '',
        iconColor: user.iconColor || '#cccccc',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setError(null);
      form.clearErrors();
      setFormInitializedForUserId(user.id);
    } else if (!isOpen) {
      setFormInitializedForUserId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen]);

  // Extract changed fields only
  const getChangedFields = (data: ProfileFormValues): Partial<User> => {
    if (!user) return {};
    
    const fields: (keyof ProfileFormValues)[] = ['login', 'firstName', 'middleName', 'lastName', 'position', 'iconColor'];
    return fields.reduce((acc, key) => {
      const value = data[key];
      const currentValue = user[key as keyof User];
      
      // Only include if value has changed and isn't just switching between empty string and undefined
      if (value !== currentValue && 
          !(currentValue === undefined && (value === '' || value === undefined)) &&
          !(currentValue === '' && value === undefined)) {
        acc[key as keyof User] = value as any || undefined;
      }
      return acc;
    }, {} as Partial<User>);
  };

  // Handle form submission
  const onSubmit = async (data: ProfileFormValues) => {
    setError(null);
    form.clearErrors();

    let profileUpdateSuccess = true;
    let passwordChangeSuccess = true;

    // 1. Handle profile updates
    const changedProfileUpdates = getChangedFields(data);
    
    if (Object.keys(changedProfileUpdates).length > 0) {
      try {
        profileUpdateSuccess = await updateUser(changedProfileUpdates);
        if (profileUpdateSuccess) {
          toast({
            title: 'Профиль обновлен',
            description: 'Основные данные вашего профиля успешно сохранены.',
          });
        } else if (!error) {
          setError('Не удалось обновить основные данные профиля.');
        }
      } catch (err: any) {
        profileUpdateSuccess = false;
        const message = err.response?.data?.error || err.message || 'Ошибка обновления профиля';
        form.setValue('login', form.getValues('login'), { shouldValidate: true });
        setError(message);
        console.error('Profile update error:', err);
      }
    }

    // 2. Handle password change
    if (data.newPassword && data.currentPassword) {
      try {
        passwordChangeSuccess = await verifyAndChangePassword(data.currentPassword, data.newPassword);
        if (passwordChangeSuccess) {
          toast({
            title: 'Пароль изменен',
            description: 'Ваш пароль успешно обновлен.',
          });
          // Reset only password fields
          form.setValue('currentPassword', '', { shouldDirty: false });
          form.setValue('newPassword', '', { shouldDirty: false });
          form.setValue('confirmNewPassword', '', { shouldDirty: false });
        }
      } catch (err: any) {
        passwordChangeSuccess = false;
        const message = err.response?.data?.error || err.message || 'Ошибка смены пароля';
        setError(message);
        
        // Set field-specific errors
        if (message.toLowerCase().includes("текущий пароль")) {
          form.setError("currentPassword", {type: "manual", message});
        } else if (message.toLowerCase().includes("новый пароль")) {
          form.setError("newPassword", {type: "manual", message});
        } else {
          form.setError("currentPassword", {type: "manual", message});
        }
        console.error('Password change error:', err);
      }
    }

    // 3. Handle success/failure and closing modal
    const noChangesAttempted = Object.keys(changedProfileUpdates).length === 0 && !data.newPassword;
    
    if (noChangesAttempted) {
      if (profileUpdateSuccess && passwordChangeSuccess) setIsOpen(false);
      return;
    }

    const allSuccessful = 
      (Object.keys(changedProfileUpdates).length === 0 || profileUpdateSuccess) && 
      (!data.newPassword || passwordChangeSuccess);

    if (allSuccessful) {
      setIsOpen(false);
    } else {
      if (!profileUpdateSuccess && Object.keys(changedProfileUpdates).length > 0) {
        toast({ 
          title: 'Ошибка сохранения профиля', 
          description: error || 'Не удалось обновить данные.', 
          variant: 'destructive' 
        });
      }
      if (!passwordChangeSuccess && data.newPassword) {
        toast({ 
          title: 'Ошибка смены пароля', 
          description: error || 'Проверьте введенные пароли.', 
          variant: 'destructive' 
        });
      }
    }
  };

  // Don't render if no user
  if (!user) return null;

  const isProcessing = form.formState.isSubmitting || authLoading;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!isProcessing) setIsOpen(open);
      }}
    >
      <DialogContent className={cn("sm:max-w-[550px] p-6 w-[95vw] sm:w-full", isOpen ? "max-h-[90vh] overflow-y-auto" : "")}>
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Редактировать профиль
          </DialogTitle>
          <DialogDescription>
            Внесите изменения в ваш профиль. Нажмите "Сохранить", когда закончите.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <h3 className="text-sm font-medium text-muted-foreground">Учетная запись</h3>
              </CardHeader>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="login"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Логин</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isProcessing} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Персональная информация
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
              <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Фамилия</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isProcessing} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  /> 
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">                  
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isProcessing} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Отчество</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={isProcessing} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>                               

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4" /> Должность
                        </FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isProcessing} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="iconColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Palette className="h-4 w-4" /> Цвет иконки
                        </FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input 
                              type="color" 
                              {...field} 
                              disabled={isProcessing} 
                              className="h-10 w-full p-1 cursor-pointer"
                            />
                          </FormControl>                          
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Сменить пароль
                </h3>
                <p className="text-xs text-muted-foreground">Оставьте поля пустыми, если не хотите менять пароль</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Текущий пароль</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          {...field} 
                          disabled={isProcessing} 
                          autoComplete="current-password"
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Новый пароль</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field} 
                            disabled={isProcessing} 
                            autoComplete="new-password"
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmNewPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Подтвердите пароль</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            {...field} 
                            disabled={isProcessing} 
                            autoComplete="new-password"
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {error && !form.formState.errors.login && 
             !form.formState.errors.currentPassword && 
             !form.formState.errors.newPassword && 
             !form.formState.errors.confirmNewPassword && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2 sm:gap-2">
              <DialogClose asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={isProcessing} 
                  className="w-full sm:w-auto"
                >
                  Отмена
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={isProcessing} 
                className="w-full sm:w-auto"
              >
                {isProcessing ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
