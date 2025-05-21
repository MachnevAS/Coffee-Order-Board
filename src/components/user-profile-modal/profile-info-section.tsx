/**
 * @file Компонент секции с основной информацией пользователя для формы профиля.
 * Включает поля для логина, ФИО, должности и выбора цвета иконки.
 */
"use client";

import React from 'react';
import type { Control } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Palette, User as UserIcon, Briefcase } from 'lucide-react'; // Иконки
import type { ProfileFormValues } from './user-profile-types'; // Типы

/**
 * Свойства компонента ProfileInfoSection.
 */
interface ProfileInfoSectionProps {
  /** Объект control из react-hook-form. */
  control: Control<ProfileFormValues>;
  /** Флаг, указывающий, идет ли процесс обработки (например, сохранение данных). */
  isProcessing: boolean;
}

/**
 * Компонент для отображения и редактирования основной информации пользователя.
 * @param props - Свойства компонента.
 * @returns JSX элемент секции с основной информацией.
 */
export const ProfileInfoSection: React.FC<ProfileInfoSectionProps> = ({ control, isProcessing }) => {
  return (
    <Card>
      {/* Заголовок секции */}
      <CardHeader className="pb-2 pt-4">
        <h3 className="text-sm font-medium text-muted-foreground">Учетная запись</h3>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Поле "Логин" */}
        <FormField
          control={control}
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

      {/* Заголовок секции "Персональная информация" */}
      <CardHeader className="pb-2 pt-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          Персональная информация
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поле "Фамилия" */}
        <FormField
          control={control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Фамилия</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} disabled={isProcessing} className="bg-background" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Поля "Имя" и "Отчество" в одной строке на больших экранах */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Имя</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} disabled={isProcessing} className="bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="middleName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Отчество</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} disabled={isProcessing} className="bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {/* Поля "Должность" и "Цвет иконки" в одной строке на больших экранах */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <FormField
            control={control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" /> Должность
                </FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} disabled={isProcessing} className="bg-background" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="iconColor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Palette className="h-4 w-4" /> Цвет иконки
                </FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="color" // Тип поля для выбора цвета
                      {...field}
                      value={field.value ?? '#cccccc'} // Значение по умолчанию, если не задано
                      disabled={isProcessing}
                      className="h-10 w-full p-1 cursor-pointer" // Стили для поля выбора цвета
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
  );
};
