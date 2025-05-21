/**
 * @file Компонент секции для смены пароля пользователя в форме профиля.
 * Включает поля для ввода текущего пароля, нового пароля и его подтверждения.
 */
"use client";

import React from 'react';
import type { Control } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { KeyRound } from 'lucide-react'; // Иконка
import type { ProfileFormValues } from './user-profile-types'; // Типы

/**
 * Свойства компонента PasswordChangeSection.
 */
interface PasswordChangeSectionProps {
  /** Объект control из react-hook-form. */
  control: Control<ProfileFormValues>;
  /** Флаг, указывающий, идет ли процесс обработки (например, сохранение данных). */
  isProcessing: boolean;
}

/**
 * Компонент для отображения и редактирования полей смены пароля.
 * @param props - Свойства компонента.
 * @returns JSX элемент секции смены пароля.
 */
export const PasswordChangeSection: React.FC<PasswordChangeSectionProps> = ({ control, isProcessing }) => {
  return (
    <Card>
      {/* Заголовок секции */}
      <CardHeader className="pb-2 pt-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Сменить пароль
        </h3>
        <p className="text-xs text-muted-foreground">Оставьте поля пустыми, если не хотите менять пароль</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поле "Текущий пароль" */}
        <FormField
          control={control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Текущий пароль</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  {...field}
                  disabled={isProcessing}
                  autoComplete="current-password" // Подсказка для автозаполнения
                  className="bg-background"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Поля "Новый пароль" и "Подтвердите пароль" в одной строке на больших экранах */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Новый пароль</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    {...field}
                    disabled={isProcessing}
                    autoComplete="new-password" // Подсказка для автозаполнения
                    className="bg-background"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="confirmNewPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Подтвердите пароль</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    {...field}
                    disabled={isProcessing}
                    autoComplete="new-password" // Подсказка для автозаполнения
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
  );
};
