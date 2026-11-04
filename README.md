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
| 3 · Edificio en 3D | Siguiente |

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

### Pantallas de la app (después de iniciar sesión)

| Dirección | Qué es |
| --------- | ------ |
| `/panel` | Saludo y el negocio elegido arriba, con sus propiedades |
| `/negocios` | Todos los negocios del arrendador ("Abrir" cambia el negocio elegido) |
| `/negocio/[id]` | Configuración › Negocio: datos y métodos de pago |
| `/edificio/[id]` | Edificio en modo simple: pisos y unidades en acordeones; tocar una unidad abre su panel de edición |
| `/configurar` | Configuración inicial para cuentas que todavía no tienen negocio |

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
