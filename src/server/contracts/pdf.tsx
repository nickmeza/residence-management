import "server-only";

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

// PDF del contrato desde su plantilla, para imprimir y firmar. Helvetica (incluida en el PDF) tiene tildes y ñ.
// Los colores son de un papel impreso (negro y gris), no de la interfaz: por eso no salen de los tokens.

const styles = StyleSheet.create({
  page: {
    paddingVertical: 56,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 15, textAlign: "center", marginBottom: 20 },
  paragraph: { marginBottom: 10, textAlign: "justify" },
  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 56, gap: 40 },
  signature: { flex: 1, borderTopWidth: 1, borderTopColor: "#000000", paddingTop: 6, textAlign: "center" },
  role: { fontSize: 9, color: "#555555" },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 64,
    right: 64,
    fontSize: 8,
    color: "#777777",
    textAlign: "center",
  },
});

export type ContractPdfInput = {
  title: string;
  // Texto ya rellenado con los datos del contrato.
  text: string;
  landlordName: string;
  residentName: string;
};

function ContractDocument({ title, text, landlordName, residentName }: ContractPdfInput) {
  // Un párrafo por cada bloque separado por una línea en blanco.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}
        <View style={styles.signatures} wrap={false}>
          <View style={styles.signature}>
            <Text>{landlordName}</Text>
            <Text style={styles.role}>EL ARRENDADOR</Text>
          </View>
          <View style={styles.signature}>
            <Text>{residentName}</Text>
            <Text style={styles.role}>EL RESIDENTE</Text>
          </View>
        </View>
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export const renderContractPdf = (input: ContractPdfInput) => renderToBuffer(<ContractDocument {...input} />);
