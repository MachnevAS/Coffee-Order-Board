'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/auth-context';
import { Coffee, LogOut, User as UserIcon } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import UserProfileModal from './user-profile-modal';

export default function Header() {
  const { user, logout, isLoading } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  return (
    <header className="sticky px-4 top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center">
        <Link href="/" className="flex items-center space-x-2 mr-6">
          <Coffee className="h-6 w-6 text-primary" />
          <span className="font-bold text-primary">Дневник секретиков баристы</span>
        </Link>
        <div className="flex flex-1 items-center justify-end">
          <nav className="flex items-center">
            {isLoading ? (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
            ) : user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback 
                          style={{ backgroundColor: user.iconColor || 'hsl(var(--muted))' }} 
                          className="text-xs font-semibold text-white"
                        >
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {`${user.lastName || ''} ${user.firstName || ''}`.trim() || user.login}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.position || 'Пользователь'}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
                       <UserIcon className="mr-2 h-4 w-4" />
                       <span>Профиль</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Выйти</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <UserProfileModal isOpen={isProfileModalOpen} setIsOpen={setIsProfileModalOpen} />
              </>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">Войти</Link>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}