"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { SidebarNav, type NavLinks } from "./sidebar-nav";

// En tablet y móvil el menú lateral se abre con un botón.
export function MobileNav({
  links,
  brand,
  footer,
}: {
  links: NavLinks;
  brand: ReactNode;
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 lg:hidden"
            aria-label="Abrir el menú"
          />
        }
      >
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-6 p-4">
        <SheetTitle className="sr-only">Menú</SheetTitle>
        {brand}
        <div className="flex-1 overflow-y-auto">
          <SidebarNav links={links} onNavigate={() => setOpen(false)} />
        </div>
        {footer}
      </SheetContent>
    </Sheet>
  );
}
