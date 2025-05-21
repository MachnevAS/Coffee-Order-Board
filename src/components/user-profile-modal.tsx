/**
 * @file Модальное окно для редактирования профиля пользователя.
 * Позволяет изменять основную информацию (логин, ФИО, должность, цвет иконки)
 * и пароль пользователя.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from "@/components/ui/form"; // Только Form, остальные Form* импортируются в подкомпонентах
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types/user';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, User as UserIcon, Loader2 } from 'lucide-react'; // Добавлен Loader2
import { cn } from '@/lib/utils';
// Импорт вынесенных компонентов и типов
import { ProfileInfoSection } from './user-profile-modal/profile-info-section';
import { PasswordChangeSection } from './user-profile-modal/password-change-section';
import { profileSchema, type ProfileFormValues } from './user-profile-modal/user-profile-types';

/**
 * Свойства компонента UserProfileModal.
 */
interface UserProfileModalProps {
  /** Флаг, указывающий, открыто ли модальное окно. */
  isOpen: boolean;
  /** Функция для установки состояния открытия/закрытия модального окна. */
  setIsOpen: (isOpen: boolean) => void;
}

/**
 * Компонент модального окна для редактирования профиля пользователя.
 * @param props - Свойства компонента.
 * @returns JSX элемент модального окна.
 */
export default function UserProfileModal({ isOpen, setIsOpen }: UserProfileModalProps) {
  const { user, updateUser, isLoading: authLoading, verifyAndChangePassword } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null); // Общая ошибка для формы
  const [formInitializedForUserId, setFormInitializedForUserId] = useState<string | number | null>(null); // Отслеживание инициализации формы для текущего пользователя

  // Настройка формы с использованием react-hook-form и Zod для валидации
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { // Значения по умолчанию для формы
      login: '',
      firstName: '',
      middleName: '',
      lastName: '',
      position: '',
      iconColor: '#cccccc', // Цвет иконки по умолчанию
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    mode: 'onChange', // Валидация при изменении полей
  });

  // Эффект для инициализации/сброса формы при изменении пользователя или состояния модального окна
  useEffect(() => {
    if (user && isOpen && String(formInitializedForUserId) !== String(user.id)) {
      // Если пользователь есть, окно открыто и форма не была инициализирована для этого пользователя
      form.reset({ // Сброс формы с данными текущего пользователя
        login: user.login || '',
        firstName: user.firstName || '',
        middleName: user.middleName || '',
        lastName: user.lastName || '',
        position: user.position || '',
        iconColor: user.iconColor || '#cccccc',
        currentPassword: '', // Пароли всегда сбрасываются
        newPassword: '',
        confirmNewPassword: '',
      });
      setError(null); // Сброс общей ошибки
      form.clearErrors(); // Очистка ошибок валидации полей
      setFormInitializedForUserId(user.id); // Помечаем, что форма инициализирована для этого пользователя
    } else if (!isOpen) {
      // Если окно закрывается, сбрасываем флаг инициализации
      setFormInitializedForUserId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen, form]); // Добавляем form в зависимости

  /**
   * Определяет, какие поля профиля были изменены пользователем.
   * @param data - Данные из формы.
   * @returns Частичный объект User только с измененными полями.
   */
  const getChangedFields = (data: ProfileFormValues): Partial<User> => {
    if (!user) return {}; // Если нет пользователя, возвращаем пустой объект

    const fields: (keyof ProfileFormValues)[] = ['login', 'firstName', 'middleName', 'lastName', 'position', 'iconColor'];
    return fields.reduce((acc, key) => {
      const formValue = data[key];
      const userValue = user[key as keyof User];

      // Нормализация пустых строк в undefined для сравнения и отправки
      const normalizedFormValue = formValue === '' ? undefined : formValue;
      const normalizedUserValue = userValue === '' ? undefined : userValue;


      // Поле считается измененным, если его значение отличается от текущего в профиле пользователя
      if (normalizedFormValue !== normalizedUserValue) {
         // Если поле в форме было очищено (стало undefined), но в профиле было значение,
         // или если поле в форме получило значение, а в профиле было undefined,
         // или если значения просто разные и не являются оба undefined.
        acc[key as keyof User] = normalizedFormValue as any;
      }
      return acc;
    }, {} as Partial<User>);
  };

  /**
   * Обработчик отправки формы.
   * Выполняет обновление профиля и/или смену пароля.
   * @param data - Данные из формы.
   */
  const onSubmit = async (data: ProfileFormValues) => {
    setError(null); // Сброс общей ошибки
    form.clearErrors(); // Очистка ошибок полей

    let profileUpdateSuccess = true;
    let passwordChangeSuccess = true;

    // 1. Обработка обновления основной информации профиля
    const changedProfileUpdates = getChangedFields(data);
    if (Object.keys(changedProfileUpdates).length > 0) { // Если есть измененные поля
      try {
        profileUpdateSuccess = await updateUser(changedProfileUpdates); // Вызов функции обновления из AuthContext
        if (profileUpdateSuccess) {
          toast({
            title: 'Профиль обновлен',
            description: 'Основные данные вашего профиля успешно сохранены.',
          });
        } else if (!error) { // Если updateUser вернул false, но не установил ошибку через throw
          setError('Не удалось обновить основные данные профиля.');
        }
      } catch (err: any) {
        profileUpdateSuccess = false;
        const message = err.response?.data?.error || err.message || 'Ошибка обновления профиля';
        // Если ошибка связана с логином (например, дубликат), устанавливаем ошибку для поля login
        if (message.toLowerCase().includes('логин') || message.toLowerCase().includes('login')) {
             form.setError("login", {type: "manual", message});
        } else {
            setError(message); // Общая ошибка
        }
        console.error('Ошибка обновления профиля:', err);
      }
    }

    // 2. Обработка смены пароля
    if (data.newPassword && data.currentPassword) { // Если указан новый и текущий пароли
      try {
        passwordChangeSuccess = await verifyAndChangePassword(data.currentPassword, data.newPassword);
        if (passwordChangeSuccess) {
          toast({
            title: 'Пароль изменен',
            description: 'Ваш пароль успешно обновлен.',
          });
          // Сброс только полей пароля в форме
          form.setValue('currentPassword', '', { shouldDirty: false });
          form.setValue('newPassword', '', { shouldDirty: false });
          form.setValue('confirmNewPassword', '', { shouldDirty: false });
        }
      } catch (err: any) {
        passwordChangeSuccess = false;
        const message = err.response?.data?.error || err.message || 'Ошибка смены пароля';
        // Установка ошибок для конкретных полей пароля
        if (message.toLowerCase().includes("текущий пароль")) {
          form.setError("currentPassword", {type: "manual", message});
        } else if (message.toLowerCase().includes("новый пароль")) {
          form.setError("newPassword", {type: "manual", message});
        } else {
          setError(message); // Общая ошибка, если не удалось определить поле
        }
        console.error('Ошибка смены пароля:', err);
      }
    }

    // 3. Обработка результата и закрытие модального окна
    const noChangesAttempted = Object.keys(changedProfileUpdates).length === 0 && !data.newPassword;
    if (noChangesAttempted) { // Если не было попыток изменить данные
      if (profileUpdateSuccess && passwordChangeSuccess) setIsOpen(false); // Закрываем, если все равно все успешно (хотя ничего не делалось)
      return;
    }

    // Проверка, все ли операции (обновление профиля и смена пароля, если они были инициированы) прошли успешно
    const allSuccessful =
      (Object.keys(changedProfileUpdates).length === 0 || profileUpdateSuccess) &&
      (!data.newPassword || passwordChangeSuccess);

    if (allSuccessful) {
      setIsOpen(false); // Закрываем модальное окно при успехе всех операций
    } else {
      // Показываем уведомления об ошибках, если какие-либо операции не удались
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
          description: form.formState.errors.currentPassword?.message || form.formState.errors.newPassword?.message || error || 'Проверьте введенные пароли.',
          variant: 'destructive'
        });
      }
    }
  };

  // Не рендерим модальное окно, если нет данных пользователя
  if (!user) return null;

  // Флаг, указывающий, идет ли какой-либо процесс (отправка формы или загрузка из AuthContext)
  const isProcessing = form.formState.isSubmitting || authLoading;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Разрешаем закрытие модального окна, только если не идет обработка
        if (!isProcessing) setIsOpen(open);
      }}
    >
      <DialogContent className={cn("sm:max-w-md p-4 sm:p-6 w-[95vw] sm:w-full", isOpen ? "max-h-[90vh] overflow-y-auto" : "")}>
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Редактировать профиль
          </DialogTitle>
          <DialogDescription>
            Внесите изменения в ваш профиль. Нажмите "Сохранить", когда закончите.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}> {/* Обертка react-hook-form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Секция с основной информацией пользователя */}
            <ProfileInfoSection control={form.control} isProcessing={isProcessing} />

            {/* Секция для смены пароля */}
            <PasswordChangeSection control={form.control} isProcessing={isProcessing} />

            {/* Отображение общей ошибки, если она не относится к конкретным полям формы */}
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

            {/* Подвал модального окна с кнопками */}
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
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isProcessing ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
