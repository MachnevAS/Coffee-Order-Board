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
    .regex(/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, "Неверный HEX цвет (например, #RRGGBB, #RGB, #RRGGBBAA, #RGBA)")
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
      setError(null); // Clear previous errors when modal opens or user changes
      form.clearErrors(); // Clear previous form validation errors
    }
  }, [user, isOpen, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    setError(null);
    form.clearErrors();
    setIsSaving(true);

    let profileUpdateSuccess = true;
    let passwordChangeSuccess = true;

    const profileUpdates: Partial<User> = {
      login: data.login, 
      firstName: data.firstName || undefined,
      middleName: data.middleName || undefined,
      lastName: data.lastName || undefined,
      position: data.position || undefined,
      iconColor: data.iconColor || undefined, // Send empty string if cleared, API handles it
    };

    const changedProfileUpdates = Object.entries(profileUpdates).reduce((acc, [key, value]) => {
      if (user && (user[key as keyof User] !== value || (user[key as keyof User] === undefined && value === ''))) {
          // Also consider undefined becoming an empty string as a change for iconColor
           if (key === 'iconColor' && user.iconColor === undefined && value === '') {
             // Don't count this as a change if it was undefined and is now empty string
           } else {
            acc[key as keyof Partial<User>] = value;
           }
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
                // Error already set by updateUser in auth-context if it returns false
                setError(error || 'Не удалось обновить основные данные профиля.');
            }
        } catch (err: any) {
            profileUpdateSuccess = false;
            const message = err.response?.data?.error || err.message || 'Произошла ошибка при обновлении основных данных профиля.';
            setError(message);
            console.error('Profile update error:', err);
            toast({
                title: 'Ошибка сервера',
                description: message,
                variant: 'destructive',
            });
        }
    }


    if (data.newPassword && data.currentPassword && data.confirmNewPassword) {
      if (data.newPassword === data.currentPassword) {
        form.setError("newPassword", { type: "manual", message: "Новый пароль не должен совпадать с текущим." });
        passwordChangeSuccess = false;
      } else {
        try {
          passwordChangeSuccess = await verifyAndChangePassword(data.currentPassword, data.newPassword);
          if (passwordChangeSuccess) {
            toast({
              title: 'Пароль изменен',
              description: 'Ваш пароль успешно обновлен.',
            });
            form.reset({
              ...form.getValues(), 
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: '',
            });
          } else {
            // Error message should be set by verifyAndChangePassword or caught in the catch block
             const currentErrorMessage = form.formState.errors.currentPassword?.message || form.formState.errors.newPassword?.message || 'Не удалось изменить пароль. Проверьте текущий пароль.';
             setError(currentErrorMessage); // Set general error as well
             if (!form.formState.errors.currentPassword && !form.formState.errors.newPassword) {
                form.setError("currentPassword", { type: "manual", message: currentErrorMessage});
             }
          }
        } catch (err: any) {
          passwordChangeSuccess = false;
          const message = err.response?.data?.error || err.message || 'Произошла ошибка при смене пароля.';
          setError(message); // Set general error
          form.setError("currentPassword", {type: "manual", message}); // Set specific error on currentPassword
          console.error('Password change error:', err);
        }
      }
    }

    setIsSaving(false);

    // Close modal logic
    const noProfileChangesAttempted = Object.keys(changedProfileUpdates).length === 0;
    const noPasswordChangeAttempted = !data.newPassword;

    if (noProfileChangesAttempted && noPasswordChangeAttempted) {
        setIsOpen(false); // No changes made, just close
        return;
    }

    let allAttemptedOperationsSuccessful = true;
    if (!noProfileChangesAttempted && !profileUpdateSuccess) {
        allAttemptedOperationsSuccessful = false;
    }
    if (!noPasswordChangeAttempted && !passwordChangeSuccess) {
        allAttemptedOperationsSuccessful = false;
    }

    if (allAttemptedOperationsSuccessful) {
        setIsOpen(false);
    } else {
        // Toast for overall failure if specific toasts weren't enough
        if (!profileUpdateSuccess && Object.keys(changedProfileUpdates).length > 0) {
             toast({ title: 'Ошибка сохранения профиля', description: error || 'Не удалось обновить данные.', variant: 'destructive' });
        }
        if (!passwordChangeSuccess && data.newPassword) {
             toast({ title: 'Ошибка смены пароля', description: error || 'Проверьте введенные пароли.', variant: 'destructive' });
        }
    }
  };

  if (!user) return null;

  const isLoading = authLoading || isSaving;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isLoading) setIsOpen(open); 
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>
            Внесите изменения в ваш профиль. Нажмите "Сохранить", когда закончите.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 py-4"> {/* Reduced gap */}
          
          {/* Profile Fields */}
          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1"> {/* Adjusted grid for better label fit */}
            <Label htmlFor="login" className="text-right whitespace-nowrap">
              Логин
            </Label>
            <Input id="login" {...form.register('login')} disabled={isLoading} className="col-span-2" />
            {form.formState.errors.login && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.login.message}</p>}
          </div>

          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="lastName" className="text-right whitespace-nowrap">
              Фамилия
            </Label>
            <Input id="lastName" {...form.register('lastName')} disabled={isLoading} className="col-span-2" />
            {form.formState.errors.lastName && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.lastName.message}</p>}
          </div>

          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="firstName" className="text-right whitespace-nowrap">
              Имя
            </Label>
            <Input id="firstName" {...form.register('firstName')} disabled={isLoading} className="col-span-2" />
            {form.formState.errors.firstName && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.firstName.message}</p>}
          </div>

          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="middleName" className="text-right whitespace-nowrap">
              Отчество
            </Label>
            <Input id="middleName" {...form.register('middleName')} disabled={isLoading} className="col-span-2" />
            {form.formState.errors.middleName && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.middleName.message}</p>}
          </div>

          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="position" className="text-right whitespace-nowrap">
              Должность
            </Label>
            <Input id="position" {...form.register('position')} disabled={isLoading} className="col-span-2" />
            {form.formState.errors.position && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.position.message}</p>}
          </div>
          
          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="iconColor" className="text-right flex items-center justify-end whitespace-nowrap">
              <Palette className="h-4 w-4 mr-1 inline-block" /> Цвет
            </Label>
            <Input 
              id="iconColor" 
              {...form.register('iconColor')} 
              disabled={isLoading} 
              className="col-span-2" 
              placeholder="#RRGGBB" 
            />
            {form.formState.errors.iconColor && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.iconColor.message}</p>}
          </div>

          <Separator className="my-3" /> {/* Increased margin */}
          <p className="text-sm text-muted-foreground col-span-3">Изменить пароль (оставьте пустыми, если не хотите менять)</p>
          
          {/* Password Fields */}
          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="currentPassword" className="text-right whitespace-nowrap">
              Текущий
            </Label>
            <Input id="currentPassword" type="password" {...form.register('currentPassword')} disabled={isLoading} className="col-span-2" autoComplete="current-password" />
            {form.formState.errors.currentPassword && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>}
          </div>

          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="newPassword" className="text-right whitespace-nowrap">
              Новый
            </Label>
            <Input id="newPassword" type="password" {...form.register('newPassword')} disabled={isLoading} className="col-span-2" autoComplete="new-password"/>
            {form.formState.errors.newPassword && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.newPassword.message}</p>}
          </div>

          <div className="grid grid-cols-3 items-center gap-x-3 gap-y-1">
            <Label htmlFor="confirmNewPassword" className="text-right whitespace-nowrap">
              Подтвердите
            </Label>
            <Input id="confirmNewPassword" type="password" {...form.register('confirmNewPassword')} disabled={isLoading} className="col-span-2" autoComplete="new-password"/>
             {form.formState.errors.confirmNewPassword && <p className="col-start-2 col-span-2 text-xs text-destructive">{form.formState.errors.confirmNewPassword.message}</p>}
          </div>
          
          {/* General Error Alert */}
          {error && !form.formState.errors.login && !form.formState.errors.currentPassword && !form.formState.errors.newPassword && !form.formState.errors.confirmNewPassword && (
            <Alert variant="destructive" className="col-span-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-3"> {/* Added padding top */}
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
