// Unir los datos al aceptar una invitación. Función pura.

type PersonData = {
  fullName: string;
  email: string | null;
  phone: string | null;
  identityDocumentType: "dni" | "foreign_id" | "passport" | null;
  identityDocumentNumber: string | null;
};

const filled = (v: string | null | undefined) => (v && v.trim() ? v : null);

// Ganan los datos del residente (su cuenta); lo que le falte se completa con lo que llenó el arrendador.
// El correo es el de la cuenta con la que entró. El documento va en pareja (tipo y número) para no mezclar
// el tipo de uno con el número del otro.
export function mergePersonData(account: PersonData, invited: PersonData, accountEmail: string | null) {
  const accountHasDocument = Boolean(account.identityDocumentType && filled(account.identityDocumentNumber));
  return {
    fullName: filled(account.fullName) ?? invited.fullName,
    email: filled(accountEmail) ?? filled(account.email) ?? filled(invited.email),
    phone: filled(account.phone) ?? filled(invited.phone),
    identityDocumentType: accountHasDocument ? account.identityDocumentType : invited.identityDocumentType,
    identityDocumentNumber: accountHasDocument
      ? account.identityDocumentNumber
      : invited.identityDocumentNumber,
  };
}
