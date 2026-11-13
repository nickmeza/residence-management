import { MessageCircle, Phone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { whatsappLink } from "@/server/residents/invitation";

// Llamar y escribir por WhatsApp al negocio. El mensaje es un ejemplo: el dueño puede cambiarlo.
export function ContactButtons({
  phone,
  businessName,
  firstName,
}: {
  phone: string | null;
  businessName: string;
  firstName: string;
}) {
  if (!phone) {
    return <p className="text-xs text-muted-foreground">Tu residencia todavía no registró un teléfono.</p>;
  }
  const message = `Hola, soy ${firstName}, residente de ${businessName}.`;
  return (
    <div className="flex gap-2">
      <a
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        className={buttonVariants({ className: "h-10 flex-1 rounded-full" })}
      >
        <Phone aria-hidden="true" />
        Llamar
      </a>
      <a
        href={whatsappLink(phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", className: "h-10 flex-1 rounded-full" })}
      >
        <MessageCircle aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}
