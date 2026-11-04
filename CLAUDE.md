# CLAUDE.md · Sistema de gestión de residencias

Este archivo son las reglas del proyecto. Léelo completo antes de tocar código.

Instrucciones oficiales de Next.js para esta versión: @AGENTS.md

## 1. Qué es este proyecto

Un sistema para que un arrendador gestione su residencia: cuartos, departamentos, residentes, contratos, cobros, garantías,
mantenimiento y pensión (comidas). Tiene una vista en 3D del edificio y un modo simple (listas y acordeones) para equipos lentos.

Hay tres tipos de persona que lo usan: **arrendador** (y su equipo), **residente** y, más adelante, **visitante/postulante**.

**Alcance actual:** Residencia y Pensión.
**En pausa (no construir):** lavandería, cowork y espacios de estudio, sensores de mantenimiento predictivo, bot de WhatsApp,
casilleros inteligentes, compatibilidad entre compañeros, modo vacaciones.
**Idea futura (solo preparar el modelo, no construir):** "Foráneos", una capa pública para buscar cuartos cerca de universidades u hospitales.

## 2. Cómo debes trabajar conmigo (importante)

El dueño del proyecto **quiere entender lo que se construye**. No quiere delegarlo todo.

- **Plan antes que código.** Para cualquier tarea que toque más de un archivo, primero propón un plan corto y espera mi aprobación.
- **Una pieza a la vez.** No avances a la siguiente fase sin que la actual funcione y yo la haya probado.
- **Explica lo que hiciste** en lenguaje simple: qué archivos cambiaste y por qué. Si usas un concepto nuevo, defínelo en una frase.
- **No amplíes el alcance.** Haz lo que pedí. Si ves otra mejora, sugiérela al final, no la apliques.
- **Pregunta ante la duda,** sobre todo en reglas de negocio, dinero y permisos. No supongas.
- **No inventes datos reales.** Los nombres, montos, plazos y textos de las pantallas son ejemplos.
- **No instales paquetes nuevos** sin decirme cuál es, para qué sirve y por qué no basta lo que ya hay.
- **Nunca toques** `.env.local` ni subas secretos. Si necesitas una variable de entorno, dime el nombre y yo la creo.
- **Antes de aplicar una migración** de base de datos, muéstrame el archivo y espera mi confirmación.

## 3. Stack

- **Frontend:** Next.js (App Router) con TypeScript estricto, Tailwind CSS y shadcn/ui.
- **3D:** React Three Fiber, drei y three.js. Cargado de forma diferida; el modo simple no debe descargar nada de 3D.
- **Estado y datos:** TanStack Query (datos del servidor), Zustand (estado de pantalla), React Hook Form con Zod (formularios).
- **Base de datos:** PostgreSQL en Supabase, con seguridad por filas (RLS). Acceso con Drizzle ORM.
- **Archivos privados:** Supabase Storage con enlaces firmados.
- **Pruebas:** Vitest (lógica y componentes) y Playwright (flujos completos).
- **Despliegue:** Vercel. Un solo proyecto por ahora (no monorepo todavía).
- **Más adelante:** tareas programadas (Inngest o Trigger.dev), correo (Resend), WhatsApp Business, pasarela de pagos peruana, PostGIS y mapa.

Las versiones exactas están en `package.json`. Next.js reciente usa React 19: usa versiones de React Three Fiber compatibles (v9 o superior).

## 4. Comandos

```bash
pnpm dev                     # servidor local en localhost:3000
pnpm build                   # compilación de producción
pnpm lint                    # revisar estilo
pnpm typecheck               # revisar tipos (tsc --noEmit)
pnpm test                    # pruebas con Vitest
pnpm drizzle-kit generate    # crear migración desde el esquema
pnpm drizzle-kit migrate     # aplicar migraciones (pedir confirmación antes)
pnpm drizzle-kit studio      # visor de tablas
```

Antes de dar una tarea por terminada, corre `pnpm typecheck` y `pnpm lint`, y `pnpm test` si hay pruebas del área.

## 5. Estructura de carpetas

```text
src/
  app/
    (publico)/        landing, iniciar sesión, registro
    (arrendador)/     panel, edificio, residentes, contratos, cobros, pensión...
    (residente)/      inicio, mi cuarto, pagos, pensión, mantenimiento...
  components/
    ui/               componentes de shadcn (no editar a mano sin avisar)
    edificio-3d/      escena, cámara, pisos, unidades
    edificio-simple/  acordeones y formularios del modo simple
  db/                 schema.ts (tablas) e index.ts (conexión)
  server/             reglas de negocio: garantía, solapes, pagos, pensión
  lib/                utilidades
  styles/tokens.css   colores, radios, tipografía y transiciones
docs/                 material de referencia (ver sección 12)
```

La lógica de negocio va en `src/server/`, **nunca dentro de componentes de pantalla**.

## 6. Modelo de datos (resumen)

**Propiedad → Piso → Unidad.** Una unidad es un **departamento** o un **cuarto**.

- Una propiedad es de tipo `cuarto`, `piso` o `edificio`. Un cuarto suelto es una propiedad con un piso y una unidad.
- El **nivel de un piso** es su posición. El nombre "Piso N" se calcula, no se guarda.
- Un departamento tiene `ocupa_todo_piso` (booleano) y `modo_alquiler`: `completo` o `por_cuartos`.
- Un cuarto puede estar suelto en un piso o dentro de un departamento (`unidad_padre_id`).
- Los cuartos tienen posición en la planta: `pos_x`, `pos_z`, `ancho`, `fondo`.
- Estados de una unidad: `disponible`, `ocupado`, `mantenimiento`. Se derivan del contrato y de las órdenes de mantenimiento.

El modelo completo está en `docs/modelo-de-datos.md`. Si el diseño y el modelo chocan, **gana el modelo**.

### Glosario (español ↔ código)

| Español | En el código |
|---|---|
| propiedad | `property` |
| piso | `floor` |
| unidad | `unit` |
| departamento | `apartment` |
| cuarto | `room` |
| residente | `resident` |
| contrato | `contract` |
| garantía | `deposit` |
| liquidación | `settlement` |
| pensión (comidas) | `meal_plan` |
| arrendador | `landlord` |

El código usa inglés y la interfaz usa español. Si prefieres nombres en español en el código, dímelo antes de empezar.

## 7. Reglas de negocio clave

La lista completa está en `docs/reglas-de-negocio.md`. Las más importantes:

1. **El precio vive en lo que se alquila:** cuarto suelto, departamento completo o cada cuarto de un departamento "por cuartos".
2. **Departamento completo y por cuartos son excluyentes.** No se puede alquilar lo mismo dos veces.
3. **"Ocupa todo el piso"** solo es posible si el piso tiene un único departamento. En el 3D, el doble clic entra directo a él.
4. **Una unidad no puede tener dos contratos vigentes** con fechas solapadas.
5. **Garantía:** la política es del arrendador (sin garantía, 1 mes, 2 meses o monto fijo), por tipo de unidad y con excepciones por unidad.
6. **Monto a devolver = garantía − descuentos vigentes, y nunca es negativo.**
7. **Un descuento disputado no se paga** hasta que el arrendador lo ajuste o lo retire.
8. **La revisión de ingreso es la base:** lo que ya estaba mal al ingresar no se descuenta al salir.
9. **Al renovar no se liquida la garantía:** pasa al contrato nuevo.
10. **No se firma un contrato** hasta que los documentos obligatorios estén verificados.
11. **Posición de los cuartos:** el servidor valida que estén dentro de la losa y sin solaparse. No basta validar en el navegador.
12. **Pensión:** la confirmación diaria cierra a una hora límite. Los días pausados no se cobran.
13. **Recibo único:** renta, pensión, extras y consumos se suman en un solo recibo mensual por residente.

## 8. El 3D y el modo simple

- Los dos modos **leen y escriben los mismos datos**. El 3D es solo otra forma de mostrarlos.
- El 3D nunca guarda información propia que el modo simple no tenga.
- El 3D se carga solo cuando se necesita (importación diferida). El modo simple no puede depender de three.js.
- Siempre debe existir un interruptor 3D / Simple. Al entrar se puede sugerir el modo simple si el equipo es lento.
- Interacciones del 3D: clic (ver datos), doble clic (entrar al piso o directo al departamento si ocupa todo el piso),
  arrastrar pisos (reordenar) y arrastrar unidades dentro de la planta (con cuadrícula de 0.1, sin solapes ni salirse).
- La lógica de colisiones, límites y reordenamiento es una **función pura en `src/server/`** que se prueba sin 3D.
- Referencia funcional: el prototipo en https://claude.ai/artifact/5rDEgSTFkgtNCBS4xrzbZH (muestra la lógica de cámara, clic y arrastre).

## 9. Diseño

**Todo el diseño es un concepto.** Los colores, la tipografía, los textos, los nombres y los montos pueden cambiar.

- **Nunca escribas un color, un radio o una fuente directamente en un componente.** Usa los tokens de `src/styles/tokens.css`.
- Usa los componentes de `src/components/ui/` antes de crear uno nuevo.
- Esquinas redondeadas, sombras suaves y transiciones de 0.2 s, con la paleta definida en los tokens.
- **Todo estado lleva texto además de color** (por ejemplo "Ocupado", no solo rojo).
- Cada pantalla debe cubrir: **estado vacío, error, carga y confirmación** de acciones destructivas.
- Cada pantalla debe funcionar en **escritorio, tablet (1024 px) y móvil (390 px)**. Las tablas se deslizan de lado en móvil.
- El prototipo en https://claude.ai/code/artifact/86526841-fb83-484e-be72-58d868cbd9eb es una **referencia de flujos
  y contenido**: qué pantallas existen, qué hace cada una, qué datos y acciones muestra y qué estados cubre.
  **Sus colores y estilos no se copian ni se mantienen actualizados.** Lo visual sale siempre de `tokens.css` y
  `src/components/ui/`.
- La skill `ui-ux-pro-max` y su `design-system/<proyecto>/MASTER.md` son **propuestas**. Lo que yo apruebe se pasa a
  `src/styles/tokens.css`, que es la única fuente que usa el código. No instales librerías que la skill recomiende
  (GSAP, íconos, fuentes…) sin preguntarme.

## 10. Datos personales y seguridad

- El sistema guarda DNI, contratos y comprobantes: son **datos sensibles**.
- Cada arrendador solo ve lo suyo y cada residente solo lo suyo, con RLS en la base. Toda tabla nueva lleva su política.
- Los archivos son privados y se sirven con enlaces que vencen.
- Valida todo en el servidor con Zod, no confíes en el navegador.
- Anota en una bitácora los cambios de garantías, liquidaciones y pagos.
- **No uses datos reales** (DNI, contratos) hasta que la seguridad esté probada con dos cuentas.
- Zona horaria: **America/Lima**. Moneda: **soles (S/)**. Idioma de la interfaz: español de Perú.

## 11. Qué hago yo y qué puedes hacer tú

| Lo hago yo (el dueño) | Lo puedes proponer o hacer con mi revisión |
|---|---|
| Decidir el modelo de datos y los nombres | Cálculo de garantía y liquidación |
| Escribir las reglas de negocio | Validación de solapes y límites de unidades |
| Armar pantallas y conectarlas a los datos | Políticas de seguridad por fila |
| Probar cada fase con casos reales | Conciliación de pagos y comprobantes |
| Aprobar cada plan y cada migración | Tareas programadas y reintentos |
| | PDF de contratos y recibos, y rendimiento del 3D |
| | Pruebas automáticas |

Para lo de la derecha: propón un plan, espera mi aprobación, escribe pruebas que verifiquen las reglas de la sección 7
y explícame cómo funciona.

## 12. Material de referencia (`docs/`)

| Archivo | Contenido |
|---|---|
| `docs/modelo-de-datos.md` | Entidades, campos y relaciones |
| `docs/reglas-de-negocio.md` | Reglas que el servidor debe cumplir |
| `docs/historias-de-usuario.csv` | Historias por área, con fase y estado de diseño |
| `docs/pantallas.md` | Inventario de pantallas y sus versiones |
| `docs/stack.md` | Stack y razones |
| `docs/comandos-de-inicio.md` | Comandos para arrancar el proyecto |
| `docs/sistema-de-diseno.md` | Paleta, tipografía y reglas visuales elegidas, con alternativas guardadas |

Estos archivos salen de `matriz_requerimientos.xlsx` (hojas "Modelo de datos", "Reglas de negocio", "Pantallas" y las de historias).

## 13. Convenciones de código y git

- TypeScript estricto. Sin `any` salvo con un comentario que explique por qué.
- Componentes de React en `PascalCase`, archivos de utilidades en `kebab-case`.
- Funciones de reglas de negocio **puras y con pruebas** (reciben datos y devuelven un resultado).
- Commits pequeños con mensaje claro, por ejemplo: `feat: tabla de unidades` o `fix: validación de solape`.
- **Una rama por fase,** por ejemplo `fase-1-datos`. No trabajar directo en `main`.
- Un registro de decisiones en el `README`: qué se eligió y por qué.

## 14. Fases y estado actual

Marca cada fase cuando funcione y esté probada.

- [ ] **Fase 0:** base del proyecto (Next.js, tokens, shadcn, Supabase, despliegue vacío)
- [ ] **Fase 1:** datos y cuentas (Propiedad, Piso, Unidad; registro e inicio de sesión; RLS)
- [ ] **Fase 2:** registro y edificio en modo simple
- [ ] **Fase 3:** edificio en 3D (mostrar, clic, doble clic directo, arrastre, guardar)
- [ ] **Fase 4:** residentes, contratos y documentos
- [ ] **Fase 5:** cobros y garantía
- [ ] **Fase 6:** pensión (menú, confirmación diaria, cocina)
- [ ] **Fase 7:** operación diaria (mantenimiento, avisos, postulantes, check-in/out, reportes, configuración)
- [ ] **Fase 8:** avisos automáticos y pagos en línea
- [ ] **Fase 9:** estados, móvil y pulido
- [ ] **Fase 10 (opcional):** preparar Foráneos (ubicación, visibilidad por unidad, lugar de interés)

**Fase actual:** 0

## 15. Lo que NO debes hacer

- No construir nada de lo marcado "en pausa" en la sección 1.
- No guardar colores, fuentes ni textos fijos dentro de los componentes.
- No poner lógica de negocio en componentes de pantalla.
- No hacer cambios masivos ni "refactorizar de paso".
- No modificar la base de datos sin mostrar antes la migración.
- No dar por terminada una tarea sin correr `pnpm typecheck` y `pnpm lint`.
