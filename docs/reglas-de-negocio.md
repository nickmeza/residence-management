# Reglas de negocio

Reglas que el servidor debe cumplir.

- **Precio:** El precio siempre está en lo que se alquila: cuarto suelto, departamento completo o cuarto de un departamento por cuartos.
- **Departamento completo o por cuartos:** Son excluyentes. Si se alquila completo, sus cuartos solo describen. Si es por cuartos, el precio va en cada cuarto y el departamento no se alquila entero.
- **Ocupa todo el piso:** Se activa solo cuando el piso tiene un único departamento. En el 3D, el doble clic entra directo al departamento; si no, entra al piso y luego a cada unidad.
- **Tamaño de la propiedad:** Un cuarto es una propiedad con un piso y una unidad. Un piso es una propiedad con un piso. No hay modelos distintos, solo distinto nivel de detalle.
- **Contratos:** Una unidad no puede tener dos contratos vigentes con fechas que se solapen.
- **Estado de la unidad:** Se deriva del contrato vigente (ocupado), de la ausencia de contrato (disponible) o de una orden de mantenimiento abierta.
- **Garantía:** La política es del arrendador: puede no pedir, pedir 1 mes, 2 meses o un monto fijo, por tipo de unidad y con excepciones por unidad.
- **Monto a devolver:** Garantía menos la suma de descuentos vigentes. Nunca es negativo.
- **Disputa:** Un descuento disputado no se paga hasta que el arrendador lo ajuste o lo retire.
- **Revisión de ingreso:** Sirve de base. Lo que figura como detalle al ingresar no se puede descontar al salir.
- **Renovación:** Al renovar no se liquida la garantía: pasa al contrato nuevo y no se pide otra.
- **Firma del contrato:** Solo se habilita cuando todos los documentos obligatorios están verificados.
- **Posición de cuartos:** El servidor valida que estén dentro de la losa y sin solaparse, no solo el navegador.
- **Nombre del piso:** "Piso N" se calcula del nivel; al reordenar pisos se renumeran solos.
- **Pensión:** El precio del plan no debería superar la suma de las comidas sueltas. Es una advertencia, no un bloqueo.
- **Reseñas:** Si la reseña es anónima, el arrendador ve las calificaciones y el comentario sin el nombre.
- **Recibo único:** Renta, pensión, servicios extra y consumos se suman en un solo recibo mensual por residente.
- **Pensión: confirmación:** La confirmación diaria cierra a la hora límite. Después de esa hora, solo la cocina puede cambiarla.
- **Pensión: pausa:** Los días pausados no se cobran. La pausa no se puede solapar con días ya servidos.
- **Reseñas:** Solo se puede calificar al terminar el contrato, y una sola vez por contrato.
- **Postulantes:** Un postulante aprobado debe tener una unidad asignada antes de crear su contrato.
- **Documentos rechazados:** Rechazar un documento exige un motivo, que el residente ve.
- **3D y modo simple:** Ambos modos leen y escriben los mismos datos. Cambiar de modo no pierde información.
- **Acciones destructivas:** Eliminar, liquidar, descartar cambios y cerrar sesión piden confirmación.
- **Errores:** Un error nunca borra lo que la persona escribió. Siempre ofrece reintentar o corregir.
- **Notificaciones:** Cada persona elige qué avisos recibe y por qué canal. Los avisos de pago vencido no se pueden desactivar en la app.
- **Comprobante de pago:** Un comprobante cuyo monto no coincide con el recibo queda en revisión, no se confirma solo.
