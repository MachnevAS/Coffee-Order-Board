'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Palette } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  login: z.string().min(3, 'Логин должен быть не менее 3 символов'),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  position: z.string().optional(),
  iconColor: z.string()
    .regex(/^#([0-9A-Fa-f]{3}){1,2}$/, "Неверный HEX цвет (например, #RRGGBB или #RGB)")
    .optional()
    .or(z.literal('')), // Allow empty string to clear
  currentPassword: z.string().optional().or(z.literal('')),
  newPassword: z.string()
    .min(6, 'Новый пароль должен быть не менее 6 символов')
    .optional()
    .or(z.literal('')),
  confirmNewPassword: z.string().optional().or(z.literal('')),
})
.refine(
    (data) => {
      if (data.newPassword && data.newPassword.length > 0) {
        return !!data.currentPassword && data.currentPassword.length > 0;
      }
      return true;
    },
    {
      message: 'Текущий пароль обязателен для смены пароля',
      path: ['currentPassword'],
    }
  )
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Новые пароли не совпадают',
    path: ['confirmNewPassword'],
  });


type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function UserProfileModal({ isOpen, setIsOpen }: UserProfileModalProps) {
  const { user, updateUser, isLoading: authLoading, verifyAndChangePassword } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      login: '',
      firstName: '',
      middleName: '',
      lastName: '',
      position: '',
      iconColor: '',
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    if (user && isOpen) {
      form.reset({
        login: user.login || '',
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        position: user.position || '',
        iconColor: user.iconColor || '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setError(null);
    }
  }, [user, isOpen, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    setError(null);
    setIsSaving(true);

    let profileUpdateSuccess = true;
    let passwordChangeSuccess = true;

    const profileUpdates: Partial<User> = {
      login: data.login, // Login can be updated
      firstName: data.firstName || undefined,
      middleName: data.middleName || undefined,
      lastName: data.lastName || undefined,
      position: data.position || undefined,
      iconColor: data.iconColor || undefined,
    };

    // Filter out fields that haven't changed from the original user object
    const changedProfileUpdates = Object.entries(profileUpdates).reduce((acc, [key, value]) => {
      if (user && value !== undefined && user[key as keyof User] !== value) {
        acc[key as keyof Partial<User>] = value;
      }
      return acc;
    }, {} as Partial<User>);


    if (Object.keys(changedProfileUpdates).length > 0) {
        try {
            profileUpdateSuccess = await updateUser(changedProfileUpdates);
            if (profileUpdateSuccess) {
                toast({
                title: 'Профиль обновлен',
                description: 'Основные данные вашего профиля успешно сохранены.',
                });
            } else {
                setError('Не удалось обновить основные данные профиля.');
                toast({
                title: 'Ошибка сохранения профиля',
                description: 'Не удалось обновить данные профиля. Проверьте введенные значения или попробуйте позже.',
                variant: 'destructive',
                });
            }
        } catch (err) {
            profileUpdateSuccess = false;
            console.error('Profile update error:', err);
            setError('Произошла ошибка при обновлении основных данных профиля.');
            toast({
                title: 'Ошибка сервера',
                description: 'Произошла непредвиденная ошибка при обновлении профиля.',
                variant: 'destructive',
            });
        }
    }


    if (data.newPassword && data.currentPassword && data.confirmNewPassword) {
      if (data.newPassword === data.currentPassword) {
        setError("Новый пароль не должен совпадать с текущим.");
        passwordChangeSuccess = false;
      } else {
        try {
          passwordChangeSuccess = await verifyAndChangePassword(data.currentPassword, data.newPassword);
          if (passwordChangeSuccess) {
            toast({
              title: 'Пароль изменен',
              description: 'Ваш пароль успешно обновлен.',
            });
            // Clear password fields after successful change
            form.reset({
              ...form.getValues(), // Keep other form values
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: '',
            });
          } else {
            // Error message for password change failure is handled by verifyAndChangePassword or set locally
            const currentError = form.formState.errors.currentPassword?.message || 'Не удалось изменить пароль. Возможно, текущий пароль неверен.';
            setError(currentError);
            toast({
              title: 'Ошибка смены пароля',
              description: currentError,
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          passwordChangeSuccess = false;
          console.error('Password change error:', err);
          const errorMessage = err.message || 'Произошла ошибка при смене пароля.';
          setError(errorMessage);
          toast({
            title: 'Ошибка сервера',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    }

    setIsSaving(false);

    // Close modal only if all attempted operations were successful
    // or if only profile was updated and it was successful
    // or if only password was changed and it was successful
    if (Object.keys(changedProfileUpdates).length > 0 && !data.newPassword) { // Only profile updated
        if (profileUpdateSuccess) setIsOpen(false);
    } else if (!Object.keys(changedProfileUpdates).length && data.newPassword) { // Only password changed
        if (passwordChangeSuccess) setIsOpen(false);
    } else if (Object.keys(changedProfileUpdates).length > 0 && data.newPassword) { // Both updated
        if (profileUpdateSuccess && passwordChangeSuccess) setIsOpen(false);
    } else if (!Object.keys(changedProfileUpdates).length && !data.newPassword) {
        // No changes made, can close or inform user
        setIsOpen(false);
    }
  };

  if (!user) return null;

  const isLoading = authLoading || isSaving;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isLoading) setIsOpen(open); // Prevent closing while saving
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>
            Внесите изменения в ваш профиль. Нажмите "Сохранить", когда закончите.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="login" className="text-right">
              Логин
            </Label>
            <Input id="login" {...form.register('login')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.login && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.login.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lastName" className="text-right">
              Фамилия
            </Label>
            <Input id="lastName" {...form.register('lastName')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.lastName && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.lastName.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstName" className="text-right">
              Имя
            </Label>
            <Input id="firstName" {...form.register('firstName')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.firstName && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.firstName.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="middleName" className="text-right">
              Отчество
            </Label>
            <Input id="middleName" {...form.register('middleName')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.middleName && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.middleName.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="position" className="text-right">
              Должность
            </Label>
            <Input id="position" {...form.register('position')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.position && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.position.message}</p>}
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="iconColor" className="text-right flex items-center">
              <Palette className="h-4 w-4 mr-1 inline-block" /> Цвет
            </Label>
            <Input id="iconColor" {...form.register('iconColor')} disabled={isLoading} className="col-span-3" placeholder="#RRGGBB" />
          </div>
          {form.formState.errors.iconColor && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.iconColor.message}</p>}


          <Separator className="my-2" />
          <p className="text-sm text-muted-foreground col-span-4">Изменить пароль (оставьте пустыми, если не хотите менять)</p>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="currentPassword" className="text-right">
              Текущий
            </Label>
            <Input id="currentPassword" type="password" {...form.register('currentPassword')} disabled={isLoading} className="col-span-3" autoComplete="current-password" />
          </div>
          {form.formState.errors.currentPassword && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.currentPassword.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newPassword" className="text-right">
              Новый
            </Label>
            <Input id="newPassword" type="password" {...form.register('newPassword')} disabled={isLoading} className="col-span-3" autoComplete="new-password"/>
          </div>
          {form.formState.errors.newPassword && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.newPassword.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirmNewPassword" className="text-right">
              Подтвердите
            </Label>
            <Input id="confirmNewPassword" type="password" {...form.register('confirmNewPassword')} disabled={isLoading} className="col-span-3" autoComplete="new-password"/>
          </div>
          {form.formState.errors.confirmNewPassword && <p className="col-span-4 text-xs text-destructive text-right">{form.formState.errors.confirmNewPassword.message}</p>}
          

          {error && !form.formState.errors.currentPassword && !form.formState.errors.newPassword && !form.formState.errors.confirmNewPassword && ( // Show general error if no specific password errors
            <Alert variant="destructive" className="col-span-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
