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
import { AlertCircle } from 'lucide-react';

// Schema for editable fields (adjust as needed)
const profileSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  // Add password fields if implementing password change
  // currentPassword: z.string().optional(),
  // newPassword: z.string().min(6, 'Новый пароль должен быть не менее 6 символов').optional(),
  // confirmPassword: z.string().optional(),
})
// .refine(data => !data.newPassword || data.currentPassword, {
//   message: "Текущий пароль обязателен для смены пароля",
//   path: ["currentPassword"],
// })
// .refine(data => data.newPassword === data.confirmPassword, {
//   message: "Новые пароли не совпадают",
//   path: ["confirmPassword"],
// });

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function UserProfileModal({ isOpen, setIsOpen }: UserProfileModalProps) {
  const { user, updateUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      // currentPassword: '',
      // newPassword: '',
      // confirmPassword: '',
    },
  });

  // Reset form when user data changes or modal opens
  useEffect(() => {
    if (user && isOpen) {
      form.reset({
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        // Reset password fields
        // currentPassword: '',
        // newPassword: '',
        // confirmPassword: '',
      });
      setError(null); // Clear errors when modal opens
    }
  }, [user, isOpen, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    setError(null);
    setIsSaving(true);

    const updates: Partial<User> = {
        firstName: data.firstName || undefined, // Send undefined if empty
        middleName: data.middleName || undefined,
        lastName: data.lastName || undefined,
    };

    // --- Password Change Logic (Optional) ---
    // if (data.newPassword && data.currentPassword) {
    //   // TODO: Add API call to verify currentPassword before allowing update
    //   // If verified:
    //   // updates.passwordHash = data.newPassword; // Or hash the new password before sending
    //   // else:
    //   // setError("Текущий пароль неверен");
    //   // setIsSaving(false);
    //   // return;
    // }
    // --- End Password Change Logic ---

    try {
      const success = await updateUser(updates);
      if (success) {
        toast({
          title: 'Профиль обновлен',
          description: 'Ваши данные успешно сохранены.',
        });
        setIsOpen(false); // Close modal on success
      } else {
        // Error handled by updateUser, potentially set local error if needed
        setError('Не удалось обновить профиль.');
         toast({
           title: 'Ошибка сохранения',
           description: 'Не удалось обновить данные профиля. Возможно, ошибка на сервере.',
           variant: 'destructive',
         });
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError('Произошла ошибка при обновлении профиля.');
       toast({
         title: 'Ошибка сервера',
         description: 'Произошла непредвиденная ошибка.',
         variant: 'destructive',
       });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null; // Don't render modal if no user

  const isLoading = authLoading || isSaving;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
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
             <Input id="login" value={user.login} disabled className="col-span-3" />
           </div>
           <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="position" className="text-right">
                Должность
              </Label>
              <Input id="position" value={user.position || '-'} disabled className="col-span-3" />
           </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lastName" className="text-right">
              Фамилия
            </Label>
            <Input id="lastName" {...form.register('lastName')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.lastName && <p className="col-span-4 text-xs text-destructive">{form.formState.errors.lastName.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstName" className="text-right">
              Имя
            </Label>
            <Input id="firstName" {...form.register('firstName')} disabled={isLoading} className="col-span-3" />
          </div>
           {form.formState.errors.firstName && <p className="col-span-4 text-xs text-destructive">{form.formState.errors.firstName.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="middleName" className="text-right">
              Отчество
            </Label>
            <Input id="middleName" {...form.register('middleName')} disabled={isLoading} className="col-span-3" />
          </div>
           {form.formState.errors.middleName && <p className="col-span-4 text-xs text-destructive">{form.formState.errors.middleName.message}</p>}


          {/* --- Password Fields (Optional) --- */}
          {/*
          <Separator />
          <p className="text-sm text-muted-foreground col-span-4">Изменить пароль (оставьте пустыми, если не хотите менять)</p>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="currentPassword" className="text-right">
              Текущий пароль
            </Label>
            <Input id="currentPassword" type="password" {...form.register('currentPassword')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.currentPassword && <p className="col-span-4 text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="newPassword" className="text-right">
              Новый пароль
            </Label>
            <Input id="newPassword" type="password" {...form.register('newPassword')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.newPassword && <p className="col-span-4 text-xs text-destructive">{form.formState.errors.newPassword.message}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirmPassword" className="text-right">
              Подтвердите пароль
            </Label>
            <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} disabled={isLoading} className="col-span-3" />
          </div>
          {form.formState.errors.confirmPassword && <p className="col-span-4 text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>}
           */}
           {/* --- End Password Fields --- */}


           {error && (
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
