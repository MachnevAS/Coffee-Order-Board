
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
import { cn } from '@/lib/utils';

const profileSchema = z.object({
  login: z.string().min(3, 'Логин должен быть не менее 3 символов'),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  position: z.string().optional(),
  iconColor: z.string()
    .regex(/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, "Неверный HEX цвет (например, #RRGGBB, #RGB, #RRGGBBAA, #RGBA)")
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
  })
  .refine((data) => {
    if (data.newPassword && data.currentPassword) {
        return data.newPassword !== data.currentPassword;
    }
    return true;
  }, {
    message: 'Новый пароль не должен совпадать с текущим',
    path: ['newPassword'],
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
  // Track which user's data the form was initialized with to prevent unwanted resets
  const [formInitializedForUserId, setFormInitializedForUserId] = useState<string | number | null>(null);


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    // Default values should match the schema structure
    defaultValues: {
      login: '',
      firstName: '',
      middleName: '',
      lastName: '',
      position: '',
      iconColor: '#cccccc', // Ensure this matches the schema (optional or literal empty string allowed)
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    if (user && isOpen) {
      // Type-safe comparison for user ID
      if (String(formInitializedForUserId) !== String(user.id)) {
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
      }
    } else if (!isOpen) {
      setFormInitializedForUserId(null);
    }
  }, [user, isOpen, formInitializedForUserId, form.reset, form.clearErrors]); // Removed form from dependencies

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
      iconColor: data.iconColor || undefined, 
    };

    const changedProfileUpdates = Object.entries(profileUpdates).reduce((acc, [key, value]) => {
        // Check if the user object exists and if the value has actually changed
        if (user && (user[key as keyof User] !== value && 
                     !(user[key as keyof User] === undefined && (value === '' || value === undefined)) &&
                     !(user[key as keyof User] === '' && value === undefined)
                    )
           ) {
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
                 // Error is likely already set by updateUser in auth-context if it throws
                if(!error) setError('Не удалось обновить основные данные профиля.');
            }
        } catch (err: any) {
            profileUpdateSuccess = false;
            const message = err.response?.data?.error || err.message || 'Произошла ошибка при обновлении основных данных профиля.';
            setError(message);
            console.error('Profile update error:', err);
            // Toast handled by verifyAndChangePassword for specific errors
        }
    }


    if (data.newPassword && data.currentPassword && data.confirmNewPassword) {
        // Schema validation already checks if newPassword === currentPassword
        try {
          passwordChangeSuccess = await verifyAndChangePassword(data.currentPassword, data.newPassword);
          if (passwordChangeSuccess) {
            toast({
              title: 'Пароль изменен',
              description: 'Ваш пароль успешно обновлен.',
            });
            form.reset({ // Reset password fields after successful change
              ...form.getValues(), // Keep other form values
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: '',
            });
          } else {
             // Error message is set by verifyAndChangePassword via thrown error
             // No need to set form error here if auth context handles it
          }
        } catch (err: any) {
          passwordChangeSuccess = false;
          const message = err.response?.data?.error || err.message || 'Произошла ошибка при смене пароля.';
          setError(message); 
           if (message.toLowerCase().includes("текущий пароль")) {
                form.setError("currentPassword", {type: "manual", message});
            } else if (message.toLowerCase().includes("новый пароль")){
                form.setError("newPassword", {type: "manual", message});
            } else {
                 form.setError("currentPassword", {type: "manual", message}); // General password error
            }
          console.error('Password change error:', err);
        }
    }

    setIsSaving(false);

    const noProfileChangesAttempted = Object.keys(changedProfileUpdates).length === 0;
    const noPasswordChangeAttempted = !data.newPassword;

    if (noProfileChangesAttempted && noPasswordChangeAttempted) {
        // If no changes were made and no password change was attempted, just close.
        if (profileUpdateSuccess && passwordChangeSuccess) setIsOpen(false); 
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
      <DialogContent className={cn("sm:max-w-md p-4 sm:p-6 w-[90vw] sm:w-full", isOpen ? "max-h-[90vh] overflow-y-auto" : "")}>
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>
            Внесите изменения в ваш профиль. Нажмите "Сохранить", когда закончите.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          
          <div className="grid gap-1.5">
            <Label htmlFor="login">Логин</Label>
            <Input id="login" {...form.register('login')} disabled={isLoading} />
            {form.formState.errors.login && <p className="text-xs text-destructive">{form.formState.errors.login.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input id="lastName" {...form.register('lastName')} disabled={isLoading} />
                {form.formState.errors.lastName && <p className="text-xs text-destructive">{form.formState.errors.lastName.message}</p>}
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="firstName">Имя</Label>
                <Input id="firstName" {...form.register('firstName')} disabled={isLoading} />
                {form.formState.errors.firstName && <p className="text-xs text-destructive">{form.formState.errors.firstName.message}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="middleName">Отчество</Label>
            <Input id="middleName" {...form.register('middleName')} disabled={isLoading} />
            {form.formState.errors.middleName && <p className="text-xs text-destructive">{form.formState.errors.middleName.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="grid gap-1.5">
                <Label htmlFor="position">Должность</Label>
                <Input id="position" {...form.register('position')} disabled={isLoading} />
                {form.formState.errors.position && <p className="text-xs text-destructive">{form.formState.errors.position.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iconColor" className="flex items-center">
                <Palette className="h-4 w-4 mr-1 inline-block" /> Цвет иконки
              </Label>
              <Input 
                id="iconColor" 
                type="color" 
                {...form.register('iconColor')} 
                disabled={isLoading} 
                className="h-10 w-full sm:w-14 p-1"
              />
              {form.formState.errors.iconColor && <p className="text-xs text-destructive">{form.formState.errors.iconColor.message}</p>}
            </div>
          </div>

          <Separator className="my-4" /> 
          <p className="text-sm text-muted-foreground">Изменить пароль (оставьте пустыми, если не хотите менять)</p>
          
          <div className="grid gap-1.5">
            <Label htmlFor="currentPassword">Текущий пароль</Label>
            <Input id="currentPassword" type="password" {...form.register('currentPassword')} disabled={isLoading} autoComplete="current-password" />
            {form.formState.errors.currentPassword && <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
                <Label htmlFor="newPassword">Новый пароль</Label>
                <Input id="newPassword" type="password" {...form.register('newPassword')} disabled={isLoading} autoComplete="new-password"/>
                {form.formState.errors.newPassword && <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>}
            </div>
            <div className="grid gap-1.5">
                <Label htmlFor="confirmNewPassword">Подтвердите новый пароль</Label>
                <Input id="confirmNewPassword" type="password" {...form.register('confirmNewPassword')} disabled={isLoading} autoComplete="new-password"/>
                {form.formState.errors.confirmNewPassword && <p className="text-xs text-destructive">{form.formState.errors.confirmNewPassword.message}</p>}
            </div>
          </div>
          
          {error && !form.formState.errors.login && !form.formState.errors.currentPassword && !form.formState.errors.newPassword && !form.formState.errors.confirmNewPassword && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="pt-4 flex-col sm:flex-row gap-2 sm:gap-0"> 
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading} className="w-full sm:w-auto">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
