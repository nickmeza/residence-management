# Notificaciones

Catálogo de avisos del sistema: qué pasa, quién lo recibe y en qué fase se construye. Es un **borrador** para que el
dueño lo revise y le agregue filas (2026-11-15).

## Cómo se organizan

- **Al instante:** el sistema la crea cuando algo pasa. Llega a la **campanita** (arriba, junto al selector de
  negocio) y a la página **Notificaciones**. Es personal: cada persona ve solo las suyas (RLS).
- **Pendientes:** no se guardan; se **calculan al abrir la app** (por ejemplo "3 comprobantes por revisar") y se
  muestran en el Panel. Desaparecen solos cuando ya no hay nada pendiente.
- **Programados:** recordatorios que llegan a una hora, aunque la persona no abra la app, y más adelante por correo o
  WhatsApp. Necesitan un programador de tareas (Inngest o Trigger.dev); se pregunta antes de instalarlo.
- **Comunicados:** no son automáticos; los escribe el arrendador para el edificio, un piso o una persona (CM-01).
  También se ven en la campanita.

| Tipo | Fase |
|---|---|
| Al instante | 7 (pieza 7.1) |
| Pendientes | 7 (pieza 7.1) |
| Comunicados | 7 (pieza aparte) |
| Programados, correo, WhatsApp y elegir canal (ES-09) | 8 |

## Al instante — los recibe el arrendador (o la cocina)

| Qué pasa | Fase de origen | Urgente |
|---|---|---|
| Un residente aceptó la invitación | 4 | No |
| Un residente subió un documento por aprobar | 4 | No |
| Un residente subió un comprobante de pago (en revisión) | 5 | Sí |
| Un comprobante se confirmó solo | 5 | No |
| Un residente disputó un descuento de la garantía | 5 | Sí |
| Un residente dijo "Estoy conforme" con la liquidación | 5 | No |
| Un comensal mandó su comprobante de pensión | 6 | Sí |
| Un comensal canceló su comida | 6 | No |

## Al instante — los recibe el residente o el comensal

| Qué pasa | Fase de origen | Urgente |
|---|---|---|
| Te aprobaron o rechazaron un documento (con motivo) | 4 | No |
| Tu contrato está listo para firmar | 4 | Sí |
| Te confirmaron o rechazaron un pago (con motivo) | 5 | No |
| ~~Tienes un recibo nuevo~~ → pasa a programados (Fase 8): los recibos se crean de golpe al confirmar el contrato | 5 | — |
| Anularon un pago tuyo (con motivo) | 5 | Sí |
| Tu liquidación de garantía está lista | 5 | Sí |
| Se publicó el menú de la semana | 6 | No |
| La cocina canceló tu comida (con disculpa) | 6 | Sí |
| Tu comida está en táper, puedes recogerla | 6 | Sí |
| Te confirmaron o rechazaron un pago de pensión | 6 | No |

## Pendientes (se calculan al abrir)

| Pendiente | Quién lo ve | Fase de origen |
|---|---|---|
| Comprobantes por revisar (residencia y pensión) | Arrendador / cocina | 5, 6 |
| Documentos por aprobar | Arrendador | 4 |
| Descuentos en disputa | Arrendador | 5 |
| Recibos vencidos | Arrendador y residente | 5 |
| Documentos que te faltan | Residente | 4 |
| Te quedan X días hábiles para reportar lo que ya estaba mal | Residente | 5 |

## Programados (Fase 8)

| Recordatorio | Quién lo recibe |
|---|---|
| Tu recibo vence en X días / venció | Residente |
| Tu pensión está pagada hasta mañana | Comensal |
| Un contrato vence en X días | Arrendador y residente |
| Aún tienes comprobantes sin revisar | Arrendador / cocina |

## Agregados en la Fase 7 (con sus pantallas)

| Qué pasa | Quién lo recibe | Urgente |
|---|---|---|
| Un residente pidió mantenimiento | Arrendador | Si lo marcó urgente |
| Escribieron en un pedido de mantenimiento | El otro (arrendador o residente) | No |
| Cambió el estado de tu pedido | Residente | No |
| Nueva postulación | Arrendador | No |
| Un comunicado | Los destinatarios | Si se marcó urgente |
| Se programó tu ingreso o tu salida | Residente | No |

Pendientes agregados: pedidos de mantenimiento (los urgentes aparte), postulaciones nuevas, ingresos y salidas de
los próximos 7 días, contratos esperando la firma; para el residente, liquidación por responder y contrato por firmar.

## Decidido (Claude, 2026-11-15; el dueño puede cambiarlo)

- **No se agrupan** los avisos: uno por evento. Si molesta, se agrupan después.
- La campanita muestra las **últimas 8**; la página, las **últimas 100**. Borrar las viejas, con el programador (Fase 8).
- **Ninguno se apaga** todavía; las preferencias por tipo y canal (ES-09) llegan con la Fase 8.
- Mientras la migración 0020 no esté aplicada, la campanita queda vacía y los cambios se guardan igual.
