// Mensajes entre el residente (o comensal) y su residencia (CM-03). Funciones puras: orden de las conversaciones.

export type ConversationSummary = {
  residentId: string;
  name: string;
  lastBody: string | null;
  lastAt: Date | null;
  lastFromResident: boolean;
  // Mensajes del residente que el arrendador todavía no leyó.
  unread: number;
};

// Primero las que tienen algo sin leer; después, la última conversación arriba. Las fichas sin mensajes no se
// listan (para escribirle a alguien nuevo está "Nuevo mensaje").
export function sortConversations(rows: ConversationSummary[]): ConversationSummary[] {
  return rows
    .filter((r) => r.lastAt !== null)
    .sort((a, b) => {
      const unread = Number(b.unread > 0) - Number(a.unread > 0);
      if (unread) return unread;
      return (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0);
    });
}
