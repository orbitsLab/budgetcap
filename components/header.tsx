"use client";

import { Menu, LogOut, User, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";

interface HeaderProps {
  householdName: string;
  userName: string;
  userEmail: string;
  onMenuClick: () => void;
}

export function Header({ householdName, userName, userEmail, onMenuClick }: HeaderProps) {
  async function handleSignOut() {
    toast.loading("Signing out…");
    await signOut({ callbackUrl: "/login" });
  }

  // Get initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 sm:px-6">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden"
        aria-label="Open sidebar"
        id="hamburger-menu-btn"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Household name — center on mobile, left on desktop (desktop sidebar already shows it) */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground lg:hidden truncate">
          {householdName}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 pl-2 pr-3"
              id="user-menu-trigger"
            >
              {/* Avatar circle */}
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </span>
              <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                {userName}
              </span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground font-normal truncate">
                  {userEmail}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings" id="header-settings-link">
                <User className="mr-2 h-4 w-4" />
                Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
              id="sign-out-btn"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
