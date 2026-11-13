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
| tipo_ambiente | dormitorio \| estudio \| oficina \| deposito \| otro (opcional) | El "uso" de la historia ED-06. Opcional: las unidades creadas antes no lo tienen. |
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

## Persona (en la base, sin rol todavía)

Una Persona puede tener cuenta para entrar al sistema (`cuenta_id`) o no tenerla, por ejemplo un residente que aún
no se registró. Al crear una cuenta, la base crea su Persona sola.

Sus datos personales se comparten entre los negocios donde está inscrita. El arrendador los puede llenar y editar
**solo mientras la persona no tenga cuenta**; después los edita ella misma.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| cuenta_id | → cuenta de Supabase Auth (opcional) | Única: una cuenta, una Persona. Si se borra la cuenta, la Persona queda sin cuenta. |
| nombre, email, telefono | texto |  |
| terminos_aceptados_en | fecha-hora (opcional) | Cuándo aceptó los Términos y la Política de privacidad al registrarse. |
| tipo_documento, numero_documento | dni \| carne_extranjeria \| pasaporte, texto (opcionales) | Van juntos. Un DNI tiene 8 dígitos. Puede quedarse solo con el número, sin archivo subido. |
| rol | arrendador \| encargado \| residente \| externo \| contabilidad \| mantenimiento \| cocina | Una persona puede tener varios roles. |

## Ficha de residente (en la base)

Una por persona en cada negocio. Lo de aquí es propio del negocio: los demás negocios no lo ven.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| negocio_id, persona_id | → Negocio, → Persona | Una sola ficha por persona y negocio. |
| contacto_emergencia_nombre, contacto_emergencia_telefono | texto (opcional) |  |
| universidad, notas | texto (opcional) |  |
| creada_en | fecha-hora |  |

## Invitación de residente (en la base)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| ficha_id | → Ficha de residente |  |
| token_hash | texto | Solo el hash del enlace; el enlace mismo no se guarda. |
| vence_en, aceptada_en | fecha-hora |  |
| creada_por | → Persona |  |

## Contrato (en la base)

El contrato es el **alquiler** de una unidad, haya papel o no. La **modalidad** dice si hay papel:
sin contrato escrito (solo el acuerdo de pago), contrato en papel propio (se sube firmado) o desde una plantilla
(la app genera el PDF, se imprime, se firma y se sube).

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| unidad_id | → Unidad | Debe ser del mismo arrendador. Sin solapes con otro contrato de la unidad (lo valida el servidor). |
| ficha_id | → Ficha de residente |  |
| fecha_inicio, fecha_fin | fecha | La fecha de fin es opcional (mes a mes) y no puede ser anterior al inicio. |
| renta_mensual | decimal | No negativa. |
| dia_pago | entero 1–31 | Ej.: 5. 31 = fin de mes. |
| modalidad | sin_contrato \| papel \| plantilla |  |
| plantilla_id | → Plantilla de contrato | Solo en la modalidad plantilla, y siempre en ella. |
| estado | borrador \| pendiente_firma \| confirmado \| cancelado | Sin contrato escrito no pasa por pendiente_firma. "Confirmado" se muestra como Firmado (con papel) o Acordado (sin papel). Vigente, por vencer y terminado **no se guardan**: se calculan de las fechas. |
| confirmado_en, cancelado_en | fecha-hora | Obligatorios en esos estados. Solo se confirma con los documentos obligatorios verificados. |
| renovado_de_id | → Contrato (opcional) | Enlaza el contrato nuevo con el anterior. |

## Plantilla de contrato (en la base)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| negocio_id | → Negocio |  |
| nombre, texto | texto | El texto admite datos que se rellenan solos: {nombre}, {unidad}, {renta}… |
| creada_en, actualizada_en | fecha-hora |  |

## Configuración de garantía (en la base: `deposit_settings`, `deposit_unit_exception`)

Igual que los documentos: la configuración del negocio es lo de siempre; la unidad puede tener una excepción y el
contrato puede tener lo decidido para esa persona. Gana el nivel más específico. Sin configuración no se pide garantía.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| negocio_id | → Negocio | Una fila por negocio. El residente la puede leer (qué cubre, plazo). |
| regla_cuarto, monto_fijo_cuarto | sin_garantia \| 1_mes \| 2_meses \| monto_fijo, decimal | Para quien alquila un cuarto. El monto solo con monto fijo. |
| regla_departamento, monto_fijo_departamento | igual | Para quien alquila un departamento completo. |
| cubre | lista de rubros | Paredes, puerta, ventana, muebles, llaves, limpieza. |
| plazo_devolucion_dias | entero 1–60 | Días hábiles. Ej.: 7. |
| metodos_devolucion | lista de métodos de pago | |
| dias_reporte_ingreso | entero 0–60 | Días desde el inicio del contrato para reportar lo que ya estaba mal. Ej.: 7. |
| excepcion_unidad | unidad_id, regla, monto_fijo | Gana sobre la regla de su tipo. |
| negocio.cobro_proporcional | booleano | Mes incompleto: true = solo los días; false = mes completo. |
| contrato.regla_garantia, monto_fijo_garantia, cobrar_garantia_el | (opcionales) | Lo decidido para esta persona. Vacío = lo de la unidad o del negocio. |

## Garantía (en la base: `deposit`)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| id | uuid |  |
| contrato_id | → Contrato | Único. Al renovar pasa al contrato nuevo (regla 9). |
| monto, regla | decimal, regla | Se calcula una vez, al confirmar el contrato. |
| estado | sin_garantia \| retenida \| en_liquidacion \| devuelta | "Por cobrar" y "En disputa" se calculan. |
| cargo_id | → Cargo (opcional) | El cargo "Garantía" del recibo donde se cobra. |

## Reporte de ingreso (en la base: `entry_report`)

No hay inspección obligatoria al entrar: el residente reporta lo que ya estaba mal cuando lo nota, con una foto, durante
los primeros días del contrato (lo revisa también la base). Es la base de la regla 8.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| contrato_id | → Contrato |  |
| rubro | paredes \| puerta \| ventana \| muebles \| llaves \| limpieza \| otro |  |
| nota, foto | texto, archivo | La foto es obligatoria. |
| reportado_por, creado_en | → Persona, fecha-hora |  |

## Liquidación (en la base: `settlement`, `settlement_discount`, `deposit_refund`)

| Campo | Tipo | Regla o descripción |
|---|---|---|
| garantia_id | → Garantía | Una por garantía. |
| estado | borrador \| enviada \| cerrada | El residente no ve el borrador. "Aceptada" y "En disputa" se calculan. |
| metodo, cuenta | método de pago, texto | Donde recibe el residente (lo elige él). |
| enviada_en, aceptada_en, cerrada_en | fecha-hora |  |
| cargo_diferencia_id, diferencia_perdonada | → Cargo, booleano | Si los descuentos pasan la garantía: se cobra o se perdona. |
| descuento.rubro, nota, monto, foto | texto, decimal, archivo |  |
| descuento.peor_que_al_ingresar | booleano | Obligatorio (con foto) si el rubro está en el reporte de ingreso (regla 8). |
| descuento.estado | vigente \| disputado \| ajustado \| retirado | Lo disputado no se resta ni se paga (regla 7). |
| descuento.motivo_disputa, monto_original | texto, decimal |  |
| devolucion.monto, metodo, fecha, operacion, comprobante | | Puede ir en partes; nunca más de lo no disputado. |
| monto_devolver | (se calcula) | Garantía − descuentos vigentes y ajustados; nunca negativo. |

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

## Documentos (en la base)

Subir documentos es opcional. Solo los requisitos que el arrendador marca como obligatorios impiden confirmar el
contrato. Los puede subir el residente o el arrendador, y se guarda quién lo hizo.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| requisito.id | uuid |  |
| requisito.negocio_id, propiedad_id | → Negocio, → Propiedad (opcional) | Sin propiedad: vale para todo el negocio. |
| requisito.nombre, descripcion, obligatorio | texto, texto, booleano | Obligatorio: no, salvo que el arrendador lo marque. |
| requisito.formatos, tam_max_mb | lista de pdf \| imagen, entero 1–20 | Ej.: PDF o foto, 5 MB. |
| documento.id | uuid |  |
| documento.ficha_id | → Ficha de residente |  |
| documento.tipo | requisito \| contrato_firmado \| otro | Un contrato firmado siempre apunta a su contrato. |
| documento.requisito_id, contrato_id | → Requisito, → Contrato (opcionales) |  |
| documento.ruta, nombre_archivo, tipo_archivo, tamano | texto, entero | Archivo privado en Supabase Storage. |
| documento.estado | en_revision \| verificado \| rechazado | El residente no puede verificar los suyos. Rechazar exige un motivo. |
| documento.subido_por, subido_en | → Persona, fecha-hora |  |
| documento.revisado_por, revisado_en, motivo_rechazo | → Persona, fecha-hora, texto |  |

## Pensión

| Campo | Tipo | Regla o descripción |
|---|---|---|
| comida.id, negocio_id (`meal`) | uuid, → Negocio | Cuelga del negocio de Pensión, no de una propiedad (decisión del dueño). |
| comida.tipo | desayuno \| almuerzo \| cena | Una de cada tipo por negocio. |
| comida.horario_inicio, horario_fin | hora |  |
| comida.precio_suelto, activa | decimal, booleano |  |
| plan_pension.id, nombre (`pension_plan`) | uuid, texto | Ej.: Pensión completa. |
| plan_pension.comidas | lista de comidas | Entre 1 y 3. |
| plan_pension.precio_dia, activo | decimal, booleano | Desactivado: no se ofrece a nuevos; con afiliados no se borra. |
| config_pension.modalidades (`meal_settings`) | comedor \| para_llevar \| delivery |  |
| config_pension.dias_atencion (`service_days`) | lista de 1 (lunes) a 7 (domingo) | Días que cocina; por defecto todos. Los demás no se cocinan, no se cancelan ni se cobran. |
| config_pension.capacidad_turno, hora_limite_cancelacion | entero, hora | Hora del **día anterior** hasta la que el comensal cancela. |
| config_pension.acepta_externos, dietas | booleano, lista |  |
| config_pension.acepta_comprobantes (`accepts_payment_proofs`) | booleano | Apagado por defecto. Si está prendido, el comensal avisa su pago con comprobante (0016). |
| afiliacion.ficha_id, plan_id, desde, hasta (`pension_subscription`) | → Ficha del comensal, → Plan, fecha, fecha | Una a la vez por comensal. El comensal es una ficha (`resident`) del negocio de Pensión. |
| afiliacion.frecuencia_cobro, nota_dieta | diario \| semanal \| mensual, texto | Se paga por adelantado. La dieta la ve la cocina. |
| pago_pension.afiliacion_id, monto, metodo, pagado_el (`pension_payment`) | → Afiliación, decimal, método, fecha | Va a la bitácora `money_log`. |
| pago_pension.cubre_desde, cubre_hasta, nota, registrado_por | fecha, fecha, texto, → Persona | Dentro de la afiliación. registrado_por = la cocina o el comensal. |
| pago_pension.estado, comprobante, codigo_operacion (0016) | en_revision \| confirmado \| rechazado, ruta, texto | Lo de la cocina queda confirmado; lo del comensal, en revisión. Solo cuenta lo confirmado. |
| pago_pension.revisado_por, revisado_el, motivo_rechazo (0016) | → Persona, fecha y hora, texto | Rechazar pide motivo (lo ve el comensal). |

## Cobros (en la base: `charge`, `payment`)

Un **recibo** no es una tabla: es todo lo que un residente le debe a un negocio en un mes (sus cargos de ese mes).
Pagado, pago parcial, pendiente y vencido se calculan con los pagos confirmados y la fecha.

| Campo | Tipo | Regla o descripción |
|---|---|---|
| cargo.id, contrato_id | uuid, → Contrato |  |
| cargo.concepto | renta \| garantia \| danos | Pensión y servicios extra llegan con sus fases. |
| cargo.periodo, monto, vence_el, nota | AAAA-MM, decimal, fecha, texto | Una renta por mes y contrato. Se crean al confirmar el contrato. |
| pago.ficha_id, periodo | → Ficha, AAAA-MM | El pago es del recibo, no de un cargo. Puede ser parcial. |
| pago.monto, metodo, pagado_el, operacion, comprobante | decimal, método, fecha, texto, archivo |  |
| pago.estado | en_revision \| confirmado \| rechazado | Lo del arrendador queda confirmado; lo del residente, en revisión. Rechazar exige motivo. |
| pago.enviado_por, revisado_por, revisado_en | → Persona, → Persona, fecha-hora |  |

Bitácora (`money_log`): cada cambio en estas tablas y en las de garantía queda anotado (antes, después y quién).

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
| asistencia.ficha_id, fecha, comida (`meal_attendance`) | → Ficha, fecha, comida | Sin fila = viene (por defecto se cocina). |
| asistencia.cancelada, comio, cambiado_por, cambiado_en | booleano, booleano, → Persona, fecha-hora | Cancelada a tiempo = antes de la hora límite del día anterior. |
| pausa.afiliacion_id, desde, hasta (`pension_pause`) | → Afiliación, fecha, fecha | Los días pausados no se cobran ni se cocinan. |

## Visitas y llaves

| Campo | Tipo | Regla o descripción |
|---|---|---|
| llave.unidad_id, entregadas, devueltas | → Unidad, entero, entero | Se compara en el check-out. |
| contacto_landing.nombre, correo, telefono, mensaje | texto | Formulario de la landing. |
