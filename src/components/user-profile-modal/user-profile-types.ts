/**
 * @file Определяет типы данных и схему валидации для формы профиля пользователя.
 */
import * as z from 'zod';

/**
 * Схема валидации Zod для формы профиля пользователя.
 * Включает поля для основной информации и для смены пароля.
 */
export const profileSchema = z.object({
  login: z.string().min(3, 'Логин должен быть не менее 3 символов'),
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  position: z.string().optional(),
  iconColor: z.string()
    .regex(/^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, "Неверный HEX цвет") // Валидация HEX цвета
    .optional()
    .or(z.literal('')), // Разрешаем пустую строку (будет заменена на undefined или значение по умолчанию)
  currentPassword: z.string().optional().or(z.literal('')), // Текущий пароль (опционально)
  newPassword: z.string()
    .min(6, 'Новый пароль должен быть не менее 6 символов')
    .optional()
    .or(z.literal('')), // Новый пароль (опционально, минимум 6 символов)
  confirmNewPassword: z.string().optional().or(z.literal('')), // Подтверждение нового пароля (опционально)
})
// Пользовательские правила валидации (refinements)
.refine(
  // Если указан новый пароль, то текущий пароль также должен быть указан
  (data) => !data.newPassword?.length || (data.currentPassword?.length || 0) > 0,
  {
    message: 'Текущий пароль обязателен для смены пароля',
    path: ['currentPassword'], // Поле, к которому относится ошибка
  }
)
.refine(
  // Новый пароль и его подтверждение должны совпадать
  (data) => data.newPassword === data.confirmNewPassword,
  {
    message: 'Новые пароли не совпадают',
    path: ['confirmNewPassword'],
  }
)
.refine(
  // Новый пароль не должен совпадать с текущим (если оба указаны)
  (data) => !data.newPassword || !data.currentPassword || data.newPassword !== data.currentPassword,
  {
    message: 'Новый пароль не должен совпадать с текущим',
    path: ['newPassword'],
  }
);

/**
 * Тип данных для формы профиля пользователя, выведенный из схемы Zod.
 */
export type ProfileFormValues = z.infer<typeof profileSchema>;
