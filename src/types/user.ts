/**
 * @fileoverview Defines the structure for User data.
 */

export interface User {
  id: string | number; // ID from Google Sheet (can be number or string)
  login: string;
  passwordHash?: string; // Store the password hash (or password for simple cases)
  firstName?: string;
  middleName?: string;
  lastName?: string;
  position?: string;
  iconColor?: string; // HEX color code, e.g., #32a852
}
