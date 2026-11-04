# Modelo de datos

**Persona → Negocio → Propiedad → Piso → Unidad** (departamento o cuarto). El precio vive siempre en la unidad
que se alquila.

## Cómo leer este documento

- Cada sección es una tabla de la base. Los nombres aquí están en español; en el código están en inglés
  (ver el glosario de `CLAUDE.md`). Por ejemplo, `negocio_id` es `business_id` en el código.
- "→ Persona" significa que el campo apunta a una fila de la tabla Persona.
- Las secciones marcadas **(en la base)** ya existen como tablas. Las demás son el diseño de fases futuras.
- La tabla real y sus reglas exactas están en `src/db/schema.ts`. Si este documento y ese archivo no coinciden,
  hay que corregir uno de los dos.

## Quién es dueño de qué (en la base)

Una **Persona** puede tener varios **Negocios**. Cada negocio es **un servicio** (Residencia, Pensión y, más
adelante, otros como lavandería) con sus propios datos: RUC, contacto y forma de cobrar. Los negocios son
independientes entre sí, aunque sean del mismo dueño.

Un negocio de **Residencia** tiene **Propiedades** (edificios, pisos o cuartos sueltos). Un negocio de **Pensión**
tiene su propio local y no depende de una propiedad.

```text
Persona (arrendador)
├── Negocio: Residencia "Residencias Norte" (RUC A)
│   ├── Propiedad: Edificio Norte → Pisos → Unidades
│   └── Propiedad: Casa Sur → Pisos → Unidades
└── Negocio: Pensión "Comedor Norte" (RUC B, su propia dirección)
```

La seguridad por filas (RLS) sigue esta misma cadena: quien inició sesión solo ve los negocios de su Persona, y
de ahí sus propiedades, pisos y unidades.

## Negocio (en la base)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid | Identificador. |
| propietario_id | → Persona | Dueño del negocio. Una persona puede tener varios negocios. |
| servicio | residencia \| pension | Qué servicio es. Lavandería y cowork se agregan cuando salgan de pausa. |
| tipo | persona_natural \| empresa | Cómo opera ante SUNAT. |
| nombre_comercial | texto | Ej.: Residencias Norte. Obligatorio. |
| razon_social | texto (opcional) | Como figura en SUNAT. |
| ruc | texto (opcional) | 11 dígitos. La base rechaza otro formato. |
| telefono, correo_contacto | texto (opcional) | A donde escriben los residentes o clientes. |
| ciudad | texto (opcional) |  |
| direccion | texto (opcional) | Local propio, por ejemplo de una Pensión. La Residencia usa la dirección de cada propiedad. |
| metodos_pago | lista de yape \| plin \| transferencia \| efectivo \| tarjeta | Los que acepta este negocio. |
| dia_cobro | entero 1–31 (opcional) | Día del mes en que cobra. 31 = fin de mes (en meses cortos, el último día). |

Cada negocio cobra por su cuenta (ver la regla "Recibo único" en `reglas-de-negocio.md`).

## Propiedad (en la base)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid | Identificador. |
| negocio_id | → Negocio | El negocio de Residencia al que pertenece. El dueño se obtiene del negocio. No se puede borrar un negocio que tiene propiedades. |
| nombre | texto |  |
| direccion | texto |  |
| distrito_ciudad | texto |  |
| tipo | cuarto \| piso \| edificio | Tamaño de lo que ofrece. |
| vive_propietario | booleano | Si vive ahí o la administra un encargado. |
| encargado_id | → Persona (opcional) | Solo si no vive ahí. |
| moneda | texto | Predeterminada: PEN (S/). |

## Piso (en la base)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| propiedad_id | → Propiedad |  |
| nivel | entero | El nombre "Piso N" se calcula del nivel; no se guarda. Al reordenar o borrar pisos, los niveles se renumeran solos (1, 2, 3…). |
| contorno | lista de esquinas (x, z) en metros | La forma de la losa. Mínimo 4 esquinas, bordes en ángulo recto: un rectángulo tiene 4 esquinas y una L tiene 6. En el modo simple se crea sola, rectangular; la forma se ajusta en el 3D. |

## Unidad (en la base)

Posición en la planta: `pos_x` y `pos_z` son la **esquina** de la unidad con los valores más chicos de x y z. La
unidad ocupa de `pos_x` a `pos_x + ancho` y de `pos_z` a `pos_z + fondo`. Todo va en una cuadrícula de 0.1 m.
Dos unidades pueden compartir una pared, pero no encimarse.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid | Departamento o cuarto. |
| piso_id | → Piso |  |
| unidad_padre_id | → Unidad (opcional) | Si es un cuarto dentro de un departamento. |
| tipo | departamento \| cuarto |  |
| nombre | texto | Ej.: Cuarto 202. |
| ocupa_todo_piso | booleano | Solo departamentos. Permite entrar directo desde el 3D. |
| modo_alquiler | completo \| por_cuartos | Solo departamentos. Son excluyentes. |
| precio_mensual | decimal (opcional) | Vacío si el departamento se alquila por cuartos. |
| area_m2 | decimal |  |
| bano | propio \| compartido |  |
| amoblado | booleano |  |
| estado | disponible \| ocupado \| mantenimiento | **No se guarda**: se calcula del contrato vigente y del mantenimiento abierto. |
| pos_x, pos_z, ancho, fondo | decimal | Posición en la planta (ver arriba). El servidor valida que quede dentro de la losa (y de su departamento, si es un cuarto interior) y sin encimarse. En el modo simple se ubica sola. |

## Amenity y servicio extra

| Campo | Tipo | Regla o descripción |
|---|---|---|
| amenity.id, nombre | uuid, texto | Ej.: WiFi, agua caliente. |
| unidad_amenity | unidad_id, amenity_id | Lo incluido en el alquiler. |
| servicio_extra.id | uuid |  |
| servicio_extra.propiedad_id | → Propiedad |  |
| servicio_extra.nombre, precio | texto, decimal | Ej.: limpieza del cuarto. |
| servicio_extra.unidad_cobro | por_dia \| por_mes \| por_vez |  |
| servicio_extra.activo | booleano |  |

## Persona (en la base, sin dni ni rol todavía)

Una Persona puede tener cuenta para entrar al sistema (`cuenta_id`) o no tenerla, por ejemplo un residente que aún
no se registró. Al crear una cuenta, la base crea su Persona sola.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| cuenta_id | → cuenta de Supabase Auth (opcional) | Única: una cuenta, una Persona. Si se borra la cuenta, la Persona queda sin cuenta. |
| nombre, email, telefono | texto |  |
| terminos_aceptados_en | fecha-hora (opcional) | Cuándo aceptó los Términos y la Política de privacidad al registrarse. |
| dni | texto | Se verifica con el documento subido. |
| rol | arrendador \| encargado \| residente \| externo \| contabilidad \| mantenimiento \| cocina | Una persona puede tener varios roles. |

## Contrato

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| unidad_id | → Unidad |  |
| residente_id | → Persona |  |
| fecha_inicio, fecha_fin | fecha |  |
| renta_mensual | decimal |  |
| dia_pago | entero | Ej.: 5. |
| estado | borrador \| pendiente_firma \| vigente \| por_vencer \| terminado |  |
| firmado_en | fecha-hora (opcional) | Solo se firma con documentos obligatorios verificados. |
| renovado_de_id | → Contrato (opcional) | Enlaza el contrato nuevo con el anterior. |

## Política de garantía

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| propiedad_id | → Propiedad |  |
| tipo_unidad | cuarto \| departamento |  |
| calculo | 1_mes \| 2_meses \| monto_fijo |  |
| monto_fijo | decimal (opcional) |  |
| cubre | lista | Paredes, puertas y ventanas, muebles, llaves, limpieza. |
| plazo_devolucion_dias | entero | Ej.: 7 días hábiles. |
| metodo_devolucion | yape \| plin \| transferencia \| efectivo |  |
| excepcion_unidad | unidad_id, con_garantia, calculo | Anula la política para una unidad. |

## Garantía

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| contrato_id | → Contrato |  |
| monto | decimal | Calculado con la política al firmar. |
| estado | sin_garantia \| retenida \| en_liquidacion \| devuelta |  |
| depositada_en | fecha |  |

## Inspección

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| contrato_id | → Contrato |  |
| momento | ingreso \| salida |  |
| realizada_por | → Persona |  |
| fecha | fecha |  |
| item.rubro | paredes \| puerta \| ventana \| muebles \| llaves \| limpieza \| otro |  |
| item.condicion | buen_estado \| detalle_menor \| daño_menor \| daño_mayor |  |
| item.nota, item.fotos | texto, lista de archivos |  |
| item.descuento | decimal | Solo en la inspección de salida. |

## Liquidación

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| garantia_id | → Garantía |  |
| total_descuentos | decimal | Suma de descuentos vigentes. |
| monto_devolver | decimal | Garantía menos descuentos; nunca negativo. |
| estado | borrador \| enviada \| aceptada \| en_disputa \| pagada |  |
| metodo, cuenta | texto | Donde recibe el residente. |
| enviada_en, respondida_en, pagada_en | fecha-hora |  |
| descuento.rubro, nota, monto, fotos | texto, decimal, lista |  |
| descuento.estado | vigente \| disputado \| ajustado \| retirado |  |
| descuento.motivo_disputa | texto (opcional) |  |

## Cierre y renovación

| Campo | Tipo | Regla o descripción |
|---|---|---|
| mensaje_cierre.contrato_id, texto | → Contrato, texto | Mensaje personalizado del arrendador. |
| calificacion.contrato_id | → Contrato |  |
| calificacion.cuarto, limpieza, trato, convivencia, pension | entero 1–5 | Pensión es opcional. |
| calificacion.comentario, recomienda, anonima | texto, booleano, booleano |  |
| renovacion.contrato_id | → Contrato |  |
| renovacion.decision | renovar \| cambiar \| no_renovar |  |
| renovacion.nueva_unidad_id, nueva_renta, nuevo_periodo | → Unidad, decimal, texto |  |
| renovacion.fecha_limite | fecha |  |
| renovacion.estado | solicitada \| aprobada \| rechazada |  |

## Documentos

| Campo | Tipo | Regla o descripción |
|---|---|---|
| requisito.id | uuid |  |
| requisito.propiedad_id / unidad_id | → Propiedad o Unidad | El arrendador elige por edificio o por unidad. |
| requisito.nombre, descripcion, obligatorio | texto, texto, booleano |  |
| requisito.formatos, tam_max_mb | lista, entero | Ej.: PDF o foto, 5 MB. |
| documento.id | uuid |  |
| documento.requisito_id, contrato_id | → Requisito, → Contrato |  |
| documento.archivo | archivo |  |
| documento.estado | pendiente \| en_revision \| verificado \| rechazado |  |
| documento.revisado_por, revisado_en, motivo_rechazo | → Persona, fecha-hora, texto |  |

## Pensión

| Campo | Tipo | Regla o descripción |
|---|---|---|
| comida.id, propiedad_id | uuid, → Propiedad |  |
| comida.nombre | desayuno \| almuerzo \| cena |  |
| comida.horario_inicio, horario_fin | hora |  |
| comida.precio_suelto, activa | decimal, booleano |  |
| plan_pension.id, nombre | uuid, texto | Ej.: Pensión completa. |
| plan_pension.comidas | lista de comidas |  |
| plan_pension.precio_dia | decimal | Precio mensual estimado = días × precio. |
| config_pension.modalidades | comedor \| para_llevar \| delivery |  |
| config_pension.capacidad_turno, hora_limite_confirmacion | entero, hora |  |
| config_pension.acepta_externos, dietas | booleano, lista |  |
| suscripcion.persona_id, plan_id, desde, hasta, pausada | → Persona, → Plan, fecha, fecha, booleano |  |
| confirmacion.persona_id, fecha, comida, confirmada | → Persona, fecha, texto, booleano | Alimenta el panel de cocina. |

## Cobros

| Campo | Tipo | Regla o descripción |
|---|---|---|
| cargo.id, contrato_id | uuid, → Contrato |  |
| cargo.concepto | renta \| garantia \| pension \| servicio_extra \| descuento |  |
| cargo.monto, periodo, estado | decimal, texto, pendiente \| pagado \| vencido | Un residente recibe un solo recibo mensual con todos los cargos. |
| pago.id, cargo_id, metodo, fecha, comprobante | uuid, → Cargo, texto, fecha, archivo |  |

## Mantenimiento

| Campo | Tipo | Regla o descripción |
|---|---|---|
| solicitud.id, unidad_id | uuid, → Unidad |  |
| solicitud.categoria, descripcion, fotos | texto, texto, lista | Agua, luz, puerta o ventana, mueble, internet, otro. |
| solicitud.urgencia | normal \| urgente |  |
| solicitud.estado | nueva \| en_proceso \| resuelta |  |
| solicitud.asignado_a, creada_en, resuelta_en | → Persona, fecha-hora, fecha-hora |  |

## Postulación

| Campo | Tipo | Regla o descripción |
|---|---|---|
| postulacion.id | uuid |  |
| postulacion.nombre, universidad, mensaje | texto |  |
| postulacion.unidad_interes, fecha_ingreso | → Unidad, fecha |  |
| postulacion.estado | nuevo \| en_revision \| aprobado \| lista_espera \| rechazado |  |
| postulacion.unidad_asignada_id | → Unidad (opcional) | Se llena al aprobar y asignar. |

## Comunicación

| Campo | Tipo | Regla o descripción |
|---|---|---|
| aviso.id, destino | uuid, edificio \| piso \| persona |  |
| aviso.titulo, mensaje, adjuntos, enviado_en | texto, texto, lista, fecha-hora |  |
| mensaje.remitente, destinatario, texto, leido | → Persona, → Persona, texto, booleano | Conversación residente–arrendador. |
| notificacion.usuario_id, tipo, titulo, detalle | → Persona, texto, texto, texto |  |
| notificacion.leida, creada_en | booleano, fecha-hora |  |
| preferencia_notificacion.usuario_id, tipo | → Persona, pagos \| mantenimiento \| documentos \| pension |  |
| preferencia_notificacion.app, correo, whatsapp | booleano | Un interruptor por canal. |

## Usuarios y plantillas

| Campo | Tipo | Regla o descripción |
|---|---|---|
| usuario.persona_id, rol | → Persona, texto |  |
| usuario.modulos_visibles | lista | Qué secciones puede ver cada rol. |
| usuario.estado, invitado_por | invitado \| activo \| suspendido, → Persona |  |
| plantilla.tipo | contrato \| convivencia \| pago_vencido \| agradecimiento |  |
| plantilla.texto | texto | Admite {nombre}, {unidad}, {monto}, {fecha}. |

## Pensión (día a día)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| menu.fecha, comida | fecha, desayuno \| almuerzo \| cena |  |
| menu.plato, opcion_vegetariana | texto, booleano |  |
| menu.estado | borrador \| publicado |  |
| asistencia.persona_id, fecha, comida | → Persona, fecha, texto |  |
| asistencia.confirmo, sirvio | booleano | Confirmó antes de la hora límite; sirvió = comió. |
| suscripcion.pausa_desde, pausa_hasta | fecha | Los días pausados no se cobran. |

## Visitas y llaves

| Campo | Tipo | Regla o descripción |
|---|---|---|
| llave.unidad_id, entregadas, devueltas | → Unidad, entero, entero | Se compara en el check-out. |
| contacto_landing.nombre, correo, telefono, mensaje | texto | Formulario de la landing. |
