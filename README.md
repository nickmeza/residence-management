# Residence Management

Sistema para que un arrendador gestione su residencia: cuartos, departamentos, residentes, contratos, cobros,
garantías, mantenimiento y pensión. Las reglas del proyecto están en [`CLAUDE.md`](CLAUDE.md) y el material de
referencia en [`docs/`](docs/).

## Requisitos

- **Node 24** (fijado en `.nvmrc` y en `engines` de `package.json`).
- **pnpm 9**.
- Un proyecto de **Supabase** en la nube.

## Arrancar en local

1. `pnpm install`
2. Crea `.env.local` en la raíz con estas dos variables (los valores salen de tu proyecto de Supabase):
   - `NEXT_PUBLIC_SUPABASE_URL`: solo `https://<referencia>.supabase.co`, **sin** `/rest/v1/` al final.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. `pnpm dev` y abre http://localhost:3000. La insignia debe decir **"Supabase: Conectado"**.

`.env.local` nunca se sube a git.

## Comandos

| Comando             | Qué hace                                           |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Servidor local en `localhost:3000`                 |
| `pnpm build`        | Compilación de producción                          |
| `pnpm lint`         | Revisa el estilo del código                        |
| `pnpm typecheck`    | Revisa los tipos (`tsc --noEmit`)                  |
| `pnpm test`         | Corre las pruebas una vez                          |
| `pnpm test:watch`   | Vuelve a correr las pruebas al guardar un archivo  |
| `pnpm format`       | Formatea todo el proyecto con Prettier             |
| `pnpm format:check` | Solo revisa el formato, sin cambiar nada           |

## Despliegue

Vercel despliega solo desde GitHub (`nickmeza/residence-management`):

- La rama `main` va a la dirección principal.
- Cada rama de fase tiene su propia versión de prueba (*preview*).

Las dos variables de Supabase también están configuradas en Vercel.

## Fases

| Fase | Estado |
| ---- | ------ |
| 0 · Base del proyecto | ✅ Terminada |
| 1 · Datos y cuentas | ✅ Terminada |
| 2 · Registro y edificio en modo simple | ✅ Terminada |
| 3 · Edificio en 3D | ✅ Terminada |
| 4 · Residentes, contratos y documentos | ✅ Terminada |
| 5 · Cobros y garantía | En curso (en revisión del dueño) |

### Fase 0, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 1. Proyecto base | Next.js 16 con TypeScript estricto, Tailwind 4, ESLint, App Router y `src/` |
| 2. Diseño | Tokens Lavanda (claro y nocturno), shadcn, fuentes y modo nocturno |
| 3. Carpetas | Estructura de la sección 5 de `CLAUDE.md` |
| 4. Supabase | Conexión desde servidor y navegador, con insignia de estado |
| 5. Herramientas | Prettier y Vitest, con las primeras pruebas |
| 6. Despliegue | GitHub y Vercel |

### Fase 1, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 1. Drizzle | Conexión a la base con `DATABASE_URL` (pooler de Supabase, puerto 6543) |
| 2. Tablas | `person`, `property`, `floor` y `unit`, con reglas en la base y RLS |
| 3. Cuentas | Registro, inicio y cierre de sesión con Supabase Auth; `/panel` protegido |
| 4. Seguridad | Pruebas de RLS (`pnpm test:db`) y comprobación con dos cuentas reales y la API pública |

### Fase 2, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 1. Reglas del edificio | Funciones puras en `src/server/building/`: losa (rectángulo, L…), solapes, precios, "ocupa todo el piso", ubicación automática y numeración de pisos |
| 2. Negocios | Tabla `business` (uno por servicio: Residencia, Pensión) con RUC, contacto y cobros; la propiedad cuelga del negocio |
| 3. Registro | `/registro` con la estructura del prototipo: Servicios → Tu negocio → Estructura (qué ofreces y arma tu edificio) → Cuenta. Borrador en el navegador; al crear la cuenta se guarda todo. `/configurar` para cuentas sin negocio |
| 4. App y edificio | Menú lateral, selector de negocio (estilo GCP), saludo, Configuración › Negocio, `/negocios` y la pantalla Edificio en modo simple, que se edita con un panel lateral |
| 5. Cierre | Revisión en escritorio, tablet y móvil, y despliegue |

### Fase 3, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 1. Reglas del arrastre | `src/server/building/drag.ts`: cuadrícula de 0.1 m, no salirse de la losa (también en L), deslizarse al chocar; forma de la losa (rectángulo o L). Acciones para mover unidades, cambiar la losa y llevar un piso a otro nivel |
| 2. Interruptor 3D / Simple | El 3D se descarga solo al elegirlo; el modo se recuerda en el dispositivo; equipos lentos abren en Simple con aviso |
| 3. Clic y doble clic | Panel de datos a la derecha; doble clic entra al piso o directo al departamento; Esc o Volver; transiciones de cámara |
| 4. Arrastre | Arrastrar pisos (reordenar) y unidades (en la planta), guardado en segundo plano: el cambio se ve al instante y se envía en cola |
| 5. Registro en 3D | Vista previa 3D en "Arma tu edificio", calculada con las mismas reglas que el servidor |


### Fase 4, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 4.1 Datos y reglas | Tablas `resident`, `resident_invitation`, `contract`, `contract_template`, `document_requirement` y `document` con RLS. Reglas puras en `src/server/contracts/` (fase del contrato, solapes, confirmar, plantillas) y `src/server/residents/invitation.ts` |
| 4.2 Residentes | `/residentes` (lista con filtros y buscador) y `/residentes/[id]` (perfil). Agregar y editar en un panel lateral; invitación por WhatsApp o copiando el mensaje |
| 4.3 Contratos | `/contratos` (lista con filtros) y `/contratos/[id]`. Crear con modalidad (sin contrato, papel o plantilla) o como borrador; cambiar modalidad; cambiar condiciones (contrato nuevo enlazado); terminar y cancelar. El estado "Ocupado" de Edificio sale de los contratos |
| 4.4 Plantillas y PDF | Configuración › Plantillas (`/negocio/[id]/plantillas`): editor con datos que se rellenan solos, vista previa y PDF de ejemplo. Los contratos desde plantilla se descargan en PDF (`/contratos/[id]/pdf`) para imprimir y firmar |
| 4.5 Documentos | Configuración › Documentos: listas de Cuarto y Departamento, obligatorio u opcional, Activo. En el perfil: "Pedírselo", subir, Ver (enlace de 5 min en `/documentos/[id]`), Verificar y Rechazar con motivo. En el contrato: copia firmada y "Confirmar contrato firmado". Archivos en el espacio privado `documents` (migración 0007) |
| 4.6 Residente y seguridad | Invitación `/invitacion/[token]` → código al correo → cuenta enlazada a su ficha. Entrada sin contraseña en `/entrar`. Lado del residente en `/mi` (inicio, documentos, contrato y su PDF). Pruebas con dos arrendadores y un residente en `tests/db` |
### Fase 5, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 5.1 Datos y reglas | Migración 0010: `deposit_settings`, `deposit_unit_exception`, `charge`, `payment`, `deposit`, `entry_report`, `settlement`, `settlement_discount`, `deposit_refund` y la bitácora `money_log`, con RLS. Reglas puras en `src/server/payments/rules.ts` y `src/server/deposits/rules.ts` |
| 5.2 Configuración › Garantía | `/negocio/[id]/garantia`: cuánto se pide por tipo de unidad, excepciones por unidad, qué cubre, plazo y métodos de devolución, días para reportar lo de ingreso y cobro del mes incompleto |
| 5.3 Garantía en el contrato | Al crear el contrato se puede cambiar la garantía para esa persona y cuándo se cobra. Al confirmarlo se crean la garantía y un recibo por mes (`src/server/payments/billing.ts`); al terminar o cambiar condiciones se corrigen solos; al renovar, la garantía pasa al contrato nuevo |
| 5.4 Cobros | `/cobros` (mes a mes: cobrado, pendiente, vencido, comprobantes por revisar, morosidad, registrar pago) y `/cobros/[residente]/[mes]` (detalle del recibo, pagos, confirmar, rechazar o anular) |
| 5.5 Residente | `/mi/pagos` (recibo del mes, cómo pagar, subir comprobante, próximos e historial) y `/mi/garantia` (estado, qué cubre, reportar lo que ya estaba mal, responder la liquidación) |
| 5.6 Liquidación | `/garantias` (retenido, por liquidar, devuelto) y `/garantias/[id]` (descuentos con nota y foto, enviar, responder disputas, registrar devolución, cobrar o perdonar la diferencia, cerrar) |
| 5.7 Pruebas | `tests/db/payments.test.ts`: recibos, renovación, RLS con dos arrendadores y un residente, liquidación y plazo del reporte de ingreso |

### Pantallas de la app (después de iniciar sesión)

| Dirección | Qué es |
| --------- | ------ |
| `/panel` | Saludo y el negocio elegido arriba, con sus propiedades |
| `/negocios` | Todos los negocios del arrendador ("Abrir" cambia el negocio elegido) |
| `/negocio/[id]` | Configuración › Negocio: datos y métodos de pago |
| `/edificio/[id]` | Edificio en 3D o en modo simple. En 3D: clic, doble clic para entrar, arrastrar pisos y unidades, forma de la losa. En simple: acordeones. En los dos, tocar una unidad abre su panel de edición |
| `/configurar` | Configuración inicial para cuentas que todavía no tienen negocio |
| `/residentes` | Residentes del negocio elegido: filtros (por vencer, documentos pendientes), buscador y "Agregar residente" |
| `/residentes/[id]` | Perfil del residente: datos personales, documentos y contrato; editar datos e invitar |
| `/contratos` | Contratos del negocio elegido: vigentes, por vencer, por cerrar y terminados; "Crear contrato" |
| `/contratos/[id]` | Un contrato: condiciones, modalidad, historial y acciones (confirmar, cambiar modalidad o condiciones, terminar, cancelar) |
| `/negocio/[id]/plantillas` | Configuración › Plantillas: crear, editar y borrar plantillas de contrato |
| `/contratos/[id]/pdf` | PDF del contrato desde su plantilla, listo para imprimir |
| `/negocio/[id]/documentos` | Configuración › Documentos: requisitos que pides a los residentes |
| `/negocio/[id]/garantia` | Configuración › Garantía: política, excepciones, devolución y cobro del mes incompleto |
| `/cobros` | Cobros y morosidad del mes (`?mes=AAAA-MM` para otro mes) |
| `/cobros/[residente]/[mes]` | Un recibo: cargos, pagos y registrar un pago |
| `/garantias` y `/garantias/[id]` | Garantías del negocio y liquidar una |
| `/archivos/[tipo]/[id]` | Abre un comprobante o una foto con un enlace que vence en 5 minutos |
| `/mi/pagos` y `/mi/garantia` | Lado del residente: sus pagos y su garantía |

## Base de datos

- Las tablas se escriben en `src/db/schema.ts`. Para cambiarlas: `pnpm drizzle-kit generate` crea la migración en
  `drizzle/`, se revisa y después `pnpm drizzle-kit migrate` la aplica.
- Las consultas de usuarios van con `withRls` (`src/db/rls.ts`), para que la base aplique el RLS.
- `pnpm test:db` prueba el RLS contra la base real y deshace todo al terminar.

## Registro de decisiones

| Fecha | Decisión | Por qué |
| ----- | -------- | ------- |
| 2026-11-04 | Instalar cada librería **solo cuando su fase la necesite** | Entender cada pieza y avanzar de a una. Drizzle entra en la Fase 1, three.js en la Fase 3. |
| 2026-11-04 | Código en **inglés**, interfaz en **español** | Sigue el glosario de `CLAUDE.md`. |
| 2026-11-04 | **Node 24 LTS** en lugar de 25 | Es una versión LTS (con soporte largo) y Vercel la soporta. |
| 2026-11-04 | Paleta **Lavanda**, con Bosque guardada como alternativa | La eligió el dueño. Sin degradados ni azul clásico, y con modo nocturno teñido de índigo, no gris. Detalle en `docs/sistema-de-diseno.md`. |
| 2026-11-04 | **Plus Jakarta Sans** para todo y **Great Vibes** solo en saludos | Great Vibes pierde su toque si se usa mucho. Se cargan con `next/font`, sin instalar nada. |
| 2026-11-04 | Las variables de shadcn **apuntan a `tokens.css`** | `tokens.css` es la única fuente de colores, radios y fuentes. |
| 2026-11-04 | **Base UI** en lugar de Radix para shadcn | Es la base que shadcn usa por defecto hoy. |
| 2026-11-04 | El prototipo de diseño es **referencia de flujos**, no de estilos | Mantener sus colores al día obligaría a tocar unas 150 pantallas que no van a producción. |
| 2026-11-04 | Se mantiene **`cacheComponents`** activado | Viene activado en la plantilla de Next.js 16. Lo que cambia en cada visita, como las consultas a Supabase, va dentro de `<Suspense>`. |
| 2026-11-04 | Supabase **en la nube** | El dueño ya tenía un proyecto creado. |
| 2026-11-04 | `pnpm test` es `vitest run` (corre y termina) | `CLAUDE.md` pide correr las pruebas antes de cerrar cada tarea. El modo que se queda esperando es `pnpm test:watch`. |
| 2026-11-04 | Prettier **no formatea** los Markdown ni `components/ui/` | Para no cambiar `CLAUDE.md` ni `docs/` sin que se note, y porque los componentes de shadcn no se editan a mano. |
| 2026-11-04 | Repositorio privado en GitHub con nombre en inglés: `residence-management` | Lo eligió el dueño. |
| 2026-11-04 | Se prueba en local durante la fase; **Vercel solo al cerrar cada fase** | Lo pidió el dueño. |
| 2026-11-04 | Se borró una base de prueba anterior que estaba en el mismo proyecto de Supabase | El dueño confirmó que no servía. Quedó un respaldo fuera del repositorio. |
| 2026-11-04 | El dueño de una propiedad es una **Persona**, no una cuenta | Así dice el modelo. Una Persona puede tener cuenta o no, por ejemplo un residente que aún no se registra. |
| 2026-11-04 | La Persona **se crea sola al registrarse**, con un trigger en la base | Lo pidió el dueño. La cuenta y su Persona nunca quedan separadas. |
| 2026-11-04 | La losa del piso se guarda como **contorno** (lista de esquinas), no como ancho y fondo | Las losas pueden tener forma de L. Bordes en ángulo recto, para que encajen con cuartos rectangulares. |
| 2026-11-04 | Los **roles** llegan en la Fase 4 | En la Fase 1, ser arrendador es ser dueño de alguna propiedad. |
| 2026-11-04 | El **estado** de la unidad no se guarda | Se deriva de contratos y mantenimiento, como dice el modelo. |
| 2026-11-04 | No hay restricción de "un nivel por piso" en la base | Al reordenar pisos se intercambian niveles. Lo controlará la función de reordenamiento, con pruebas. |
| 2026-11-04 | Columnas en `snake_case` en la base y camelCase en TypeScript | Convención de PostgreSQL. Drizzle traduce solo. |
| 2026-11-04 | Las consultas van **como el usuario con sesión** (`withRls`) | Drizzle entra como administrador y se saltaría el RLS. Así lo protege la base aunque el código tenga un error. |
| 2026-11-04 | Se mantiene la **confirmación de correo** | Más seguro. El correo de fábrica funciona si el enlace se abre en el mismo navegador. |
| 2026-11-04 | **SMTP propio (Resend) pendiente** | El correo gratuito de Supabase envía muy pocos correos por hora y no deja editar la plantilla. Se configura antes de tener residentes reales. |
| 2026-11-04 | `connection()` antes de leer la sesión | Next.js 16 exige marcar como "en cada visita" lo que mira la hora, y Supabase la mira para ver si el token venció. |
| 2026-11-04 | `pnpm test:db` va aparte de `pnpm test` | Necesita conexión a la base. Las pruebas normales siguen rápidas y sin conexión. |
| 2026-11-04 | **Negocio** como tabla nueva: una persona puede tener varios, cada uno es un servicio (Residencia, Pensión…) con su RUC, contacto y cobros | Lo definió el dueño. Cada servicio puede necesitar su propia razón social. |
| 2026-11-04 | La propiedad cuelga del **negocio de Residencia**, no directo de la persona | Así cada edificio cobra con el RUC de su negocio. Se quitó `owner_id` de la propiedad para no tener dos dueños que se contradigan. |
| 2026-11-04 | La Pensión tiene **lugar propio** (dirección en el negocio) | Lo definió el dueño. No depende de un edificio. |
| 2026-11-04 | Regla 13 reescrita: cada negocio cobra aparte; el residente ve **un solo resumen agrupado por negocio** | Dos RUC distintos no pueden ir en un mismo comprobante. Lo definió el dueño. |
| 2026-11-04 | Registro con la **cuenta al final**, como el prototipo | Lo eligió el dueño. Lo armado se guarda como borrador en el navegador y, al crear la cuenta, el servidor lo guarda todo de una vez. |
| 2026-11-04 | En el modo simple la losa y la posición de los cuartos **se calculan solas** | El prototipo no las pide. La forma real se ajusta en el 3D (Fase 3). |
| 2026-11-04 | Contraseña con mayúscula y número, y aceptar términos (se guarda la fecha) | Como el prototipo. Los textos legales están pendientes. |
| 2026-11-04 | El prototipo es referencia de **flujos, contenido y estructura**; solo colores y tipografía salen de los tokens | El dueño pidió que las pantallas sigan la distribución del diseño (bloques, columnas, barras), no solo su contenido. |
| 2026-11-04 | El registro muestra **4 pasos**; "Estructura" agrupa "Qué ofreces" y "Arma tu edificio" como partes | Así lo muestra el prototipo ("Paso 3 de 4 · Parte 1 de 2"). El paso de Pensión llega en la Fase 6. |
| 2026-11-04 | **Menú lateral** con íconos y avatar abajo, en lugar del menú de arriba del prototipo | Lo decidió el dueño: es lo habitual en un sistema de gestión. |
| 2026-11-04 | **Selector de negocio** estilo GCP; el panel muestra solo el negocio elegido | Lo decidió el dueño. El negocio elegido se recuerda en una cookie y siempre se comprueba que sea propio. |
| 2026-11-04 | Saludo "**Buenos días**" (según la hora de Lima) en Great Vibes, con nombre y primer apellido | Lo pidió el dueño. El nombre son las dos primeras palabras del nombre completo. |
| 2026-11-04 | Las unidades se editan en un **panel lateral** | Lo eligió el dueño: la lista sigue a la vista; en móvil ocupa toda la pantalla. |
| 2026-11-04 | Campo nuevo **tipo de ambiente** (dormitorio, estudio, oficina, depósito, otro), opcional | Es el "uso" de la historia ED-06, según el dueño. |
| 2026-11-04 | Al agregar una unidad y no haber espacio, **la losa rectangular crece**; una L se ajusta en el 3D | Evita inventar formas de losa en el modo simple. |
| 2026-11-04 | Al cambiar "completo / por cuartos", **el precio pasa al lado que se alquila** | Regla "el precio vive en lo que se alquila". |
| 2026-11-04 | Sin m² en el registro; el logo del negocio aparece como "pronto" | Como el prototipo; el logo necesita Supabase Storage. |
| 2026-11-04 | Columna `area_m_2` renombrada a `area_m2` | Drizzle la había nombrado así al convertir `areaM2`; ahora coincide con el modelo. |
| 2026-11-04 | Local y producción usan **la misma base** por ahora | Hay un solo proyecto de Supabase. Antes de usar datos reales conviene uno aparte para pruebas. |
| 2026-11-04 | 3D con **three.js + React Three Fiber v9 + drei** | Los del stack. Fiber v9 es compatible con React 19.3. Zustand no hizo falta: el estado del 3D cabe en el componente. |
| 2026-11-04 | El 3D se carga **solo al elegirlo** (importación diferida); three.js va en un archivo aparte | El modo simple no debe descargar nada de 3D (CLAUDE.md, sección 8). Comprobado en la compilación. |
| 2026-11-04 | Modo inicial: **3D salvo equipo lento** (4 núcleos o menos, o 4 GB o menos); se recuerda en el dispositivo | Lo eligió el dueño. Depende del equipo, no de la cuenta. |
| 2026-11-04 | Etiquetas del 3D **dibujadas en la escena**, no con `<Html>` de drei | `<Html>` crea otra raíz de React y fallaba al desmontarse con React 19. |
| 2026-11-04 | Los colores del 3D salen de los **tokens** y cambian con el modo nocturno | El 3D no tiene colores propios. |
| 2026-11-04 | Edición **básica de la losa** en el 3D: rectángulo o L | Lo pidió el dueño. El servidor no deja guardar si una unidad quedaría fuera. |
| 2026-11-04 | Al mover un departamento, **sus cuartos se mueven con él** | Los cuartos están dentro del departamento. |
| 2026-11-04 | **Guardado en segundo plano** en el 3D: cambio optimista (`useOptimistic`) y cola de guardado | El dueño vio que al mover rápido dos unidades, la primera volvía atrás. La cola evita que dos cambios se validen sin conocerse. |
| 2026-11-04 | En el registro, el 3D es **vista previa** (sin arrastre) | Así lo muestra el prototipo. Nada está guardado todavía; luego se ajusta en la pantalla Edificio. |
| 2026-11-10 | El contrato tiene **modalidad**: sin contrato escrito, contrato en papel o desde plantilla | En Perú muchas veces no hay contrato, solo el pago, o hay un papel sin notario. Lo definió el dueño. |
| 2026-11-10 | Estados guardados del contrato: borrador, pendiente de firma, confirmado y cancelado. Vigente, por vencer y terminado se calculan | "Confirmado" se muestra como "Firmado" si hay papel y "Acordado" si no. Sin papel no hay "pendiente de firma". |
| 2026-11-10 | No hay firma dentro de la app: el contrato firmado se **sube escaneado** (foto o PDF) | Lo pidió el dueño. La firma electrónica queda para más adelante. |
| 2026-11-10 | La fecha de fin del contrato es **opcional** | Casi siempre hay fin, pero un alquiler mes a mes puede no tenerlo. |
| 2026-11-10 | Datos personales en **Persona** (compartidos); contacto de emergencia, universidad y notas en una **ficha por negocio** | Un residente puede estar en negocios de dueños distintos, y lo de cada negocio es suyo. |
| 2026-11-10 | El arrendador edita los datos personales **solo mientras el residente no tenga cuenta** | Después los edita el residente: otros negocios también los ven. |
| 2026-11-10 | Residente por **invitación**: enlace para WhatsApp o para copiar; se guarda solo su hash | Si alguien lee la tabla, no puede usar el enlace. |
| 2026-11-10 | Documentos **opcionales**; solo los que el arrendador marca obligatorios impiden confirmar el contrato | Puede bastar con el número de DNI. Se guarda quién subió cada archivo. |
| 2026-11-10 | Función `is_resident_of_my_business` en la base (security definer) | Las políticas de Persona y de las fichas se consultaban entre sí y la base entraba en un bucle. |
| 2026-11-10 | `@react-pdf/renderer` para los PDF de las plantillas | Arma el PDF en el servidor con márgenes y saltos de línea; lo aprobó el dueño. |
| 2026-11-10 | En Residentes **no se muestran** pagos, deuda, garantía ni servicios todavía | Llegan con las Fases 5 y 6. Mejor no mostrar datos falsos. Lo aprobó el dueño. |
| 2026-11-10 | Agregar y editar residente en un **panel lateral**; al agregar, se ofrece invitar | El prototipo no tiene ese formulario; se sigue la decisión del panel de unidades. |
| 2026-11-10 | Cada "Invitar" crea un enlace nuevo y **anula los anteriores** sin usar | Si un mensaje se pierde o se manda a otra persona, el enlace viejo deja de servir. |
| 2026-11-10 | Un **borrador** no ocupa la unidad y puede cruzarse con otros contratos; se revisa al confirmarlo | Sirve para preparar un contrato antes de que se libere la unidad. |
| 2026-11-10 | Cambiar el **papel** edita el mismo contrato; cambiar las **condiciones** crea uno nuevo enlazado y el actual termina el día anterior | Lo pidió el dueño: cambiar de contrato debe ser una opción real, y así queda qué había antes. |
| 2026-11-10 | Un contrato acordado o firmado **se termina** (fecha de fin), no se cancela | Cancelar borraría que el residente vivió ahí. Cancelar queda para borradores y pendientes de firma. |
| 2026-11-10 | Una unidad con contratos **no se puede quitar** del edificio | Se perdería con quién vivió ahí. |
| 2026-11-10 | La sección "Solicitudes de renovación" del prototipo queda para la Fase 7 | Es la historia de renovaciones (CT-06/07), asignada a la Fase 7. |
| 2026-11-10 | Una plantilla con un dato mal escrito (`{nombr}`) **no se guarda** | Saldría tal cual en el papel impreso. |
| 2026-11-10 | El PDF lleva **líneas de firma** del arrendador y del residente, y el número de página | Se imprime para firmar a mano. |
| 2026-11-10 | Una plantilla que usa algún contrato **no se borra** (sí se edita) | El contrato debe poder volver a generar su PDF. |
| 2026-11-10 | Sin límite de plantillas por negocio | Limitar por plan de pago es una idea futura del dueño; la base ya admite varias. |
| 2026-11-10 | Quitar un requisito **conserva** los archivos ya subidos (pasan a "otro documento") | No se pierden documentos de los residentes. |
| 2026-11-11 | Requisitos en **dos listas: Cuarto y Departamento**; se quita "Para: propiedad" | Lo pidió el dueño. Un cuarto dentro de un departamento "por cuartos" usa la lista de cuarto. |
| 2026-11-11 | Los requisitos **opcionales no los ve el residente** (también en la base, por RLS); los sube el arrendador | Lo pidió el dueño: no tiene sentido mostrar algo que el residente no sabe qué es. |
| 2026-11-11 | Interruptor **Activo** en cada requisito | Dejar de pedir un documento sin borrarlo ni perder lo subido. |
| 2026-11-11 | Excepción **por persona** ("Pedírselo"): no lo ve y no frena su contrato | Para un familiar o conocido. Al siguiente residente se le pide todo. Lo decidió el dueño. |
| 2026-11-11 | Motivos de rechazo: **texto libre con sugerencias** fijas en el código | Una tabla y una consulta para 4 sugerencias no vale la pena. |
| 2026-11-11 | Los archivos van **directo del navegador a Storage**; el servidor lee su tipo y tamaño reales y recién ahí los registra | Las acciones de servidor tienen un límite de 1 MB, y no se confía en lo que dice el navegador. |
| 2026-11-11 | Lo que sube el **arrendador queda verificado**; lo del residente, en revisión | El arrendador es quien revisa: no tiene sentido revisarse a sí mismo. |
| 2026-11-11 | Un contrato con papel pasa a firmado con **"Confirmar contrato firmado"** | Revisa la regla 10 y que la copia firmada sea de ese contrato. |
| 2026-11-11 | El residente entra **sin contraseña, con un código de 6 números al correo** | Lo eligió el dueño. Entrar solo con el enlace no es seguro para DNI y contratos (el enlace se reenvía). |
| 2026-11-11 | Al aceptar la invitación, **ganan los datos del residente**; lo que le falte se completa con lo del arrendador | Lo decidió el dueño. |
| 2026-11-11 | El residente **no lee las tablas del arrendador**; sus nombres de residencia y unidad salen de `my_resident_places()` | Varias pantallas del arrendador asumen "si veo el negocio, es mío" (por ejemplo, el selector de negocio). |
| 2026-11-12 | Garantía en **tres niveles**: configuración del negocio por tipo de unidad → excepción por unidad → lo decidido para esta persona en su contrato | Lo pidió el dueño, igual que los documentos (por ejemplo, a un familiar no se le pide o se le cobra después). |
| 2026-11-12 | Sin configuración guardada **no se pide garantía** | Mejor no cobrar algo que el arrendador no eligió. |
| 2026-11-12 | La garantía se calcula **una vez, al confirmar** el contrato; cambiar la configuración vale para los siguientes. Los contratos confirmados antes de la Fase 5 **no** reciben garantía retroactiva (sí sus recibos de renta) | El monto acordado no debe cambiar solo ni cobrarse de golpe a quien ya vive ahí. |
| 2026-11-12 | Los recibos se crean **todos al confirmar** (uno por mes); los mes a mes, 12 meses hacia adelante y se extienden solos al abrir Cobros | Decisión del dueño (pregunta 5). Sin tareas programadas hasta la Fase 8. |
| 2026-11-12 | El recibo **no es una tabla**: es lo que un residente le debe a un negocio en un mes. Pagado, pendiente y vencido se calculan | Igual que vigente/terminado en los contratos: no hay estados que se desincronicen. |
| 2026-11-12 | Mes incompleto **proporcional a los días** por defecto; el arrendador puede elegir mes completo | Decisión del dueño (pregunta 4). |
| 2026-11-12 | **Pagos parciales**: se aplican en orden de vencimiento ("Pago parcial · faltan S/ X"); lo pagado de más queda como saldo a favor del mes | Decisión del dueño (pregunta 7). |
| 2026-11-12 | **Sin mora**: solo "Vencido" y días de atraso | Decisión del dueño (pregunta 8). |
| 2026-11-12 | Todo comprobante del residente queda **en revisión**; si el monto no coincide, se avisa al revisarlo | Sin pago en línea no hay cómo confirmarlo solo. |
| 2026-11-12 | Un pago confirmado por error se **anula** con motivo (queda rechazado), no se borra | Queda en la bitácora. |
| 2026-11-12 | Descuento **disputado aparte**: no se resta ni se paga; se devuelve ya lo que nadie discute | Decisión del dueño (pregunta 2). |
| 2026-11-12 | Regla 8: en un rubro reportado al ingresar solo se descuenta si **está peor**, con foto | Decisión del dueño (pregunta 3). |
| 2026-11-12 | Lo de ingreso lo **reporta el residente** cuando lo nota (con foto), sin revisar todo el cuarto, durante los primeros días (7 por defecto, configurable) | Decisión del dueño (pregunta 10). El plazo evita reportar al salir; lo revisa también la base. |
| 2026-11-12 | Descuentos que pasan la garantía: el arrendador elige **cobrar la diferencia** (cargo en el recibo del mes) o **perdonarla** | Decisión del dueño (pregunta 9); la probará y confirmará. |
| 2026-11-12 | Comprobantes y fotos en el espacio privado `documents`, en carpetas aparte (`comprobantes`, `ingreso`, `liquidacion`, `devoluciones`) | Decisión del dueño (pregunta 12). Usa las mismas reglas de Storage de la Fase 4. |
| 2026-11-12 | Las respuestas del residente (aceptar, disputar, dónde recibe) pasan por **funciones de la base**, no por permiso de escritura | Así no puede tocar montos ni estados ni siquiera por la API. |
| 2026-11-12 | **Bitácora** `money_log` llenada por triggers en las tablas de dinero; solo la lee el administrador | CLAUDE.md, sección 10. Anota también lo que entre por la API. Pantalla para verla: más adelante. |
| 2026-11-12 | Gastos y resumen financiero (PG-05, PG-06) quedan para la Fase 7 | Decisión del dueño (pregunta 11). |
