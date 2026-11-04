# Sistema de diseño · decisiones

Registro de lo que se eligió y por qué. **El código usa solo `src/styles/tokens.css`**; este archivo explica
esos valores y guarda alternativas. Si cambias un token, actualiza también esta página.

Decidido el 2026-11-04, comparando paletas sobre la pantalla "Arrendador · Panel" del prototipo.

## Reglas generales

- **Sin degradados.** Barras, botones y fondos usan colores sólidos.
- **Nada de azul clásico saturado** (tipo `#2563EB`). Los colores principales son profundos y apagados.
- **Todo estado lleva texto además de color** ("Ocupado", no solo rojo).
- **Contraste mínimo:** 4.5:1 para texto, 3:1 para barras, bordes de campos y otros gráficos. Todos los pares de
  abajo están verificados con la fórmula WCAG.
- Esquinas redondeadas, sombras suaves y transiciones de 0.2 s.

## Paleta elegida: Lavanda

Fondos con un toque índigo y botones índigo apagado. En modo nocturno el fondo es **índigo noche**, no negro:
así la app conserva su personalidad.

| Token | Claro | Nocturno | Para qué |
|---|---|---|---|
| `bg` | `#E8EAF2` | `#14162A` | fondo de la página |
| `surface` | `#FFFFFF` | `#1C1F38` | tarjetas, encabezado, campos |
| `border` | `#DCDFEA` | `#2C3052` | bordes decorativos y pista de las barras |
| `text` | `#1E2130` | `#E9EBF7` | texto principal |
| `text-2` | `#555A6B` | `#A4A9C4` | texto secundario |
| `primary` | `#3A4170` | `#9CA5EE` | botones principales |
| `on-primary` | `#FFFFFF` | `#12142A` | texto sobre `primary` |
| `primary-text` | `#3A4170` | `#BCC3F7` | menú activo, insignia "Nueva" |
| `primary-soft` | `#E2E5F8` | `#2A2F5A` | fondo del menú activo e insignia "Nueva" |
| `link` | `#3A4170` | `#AEB6F4` | enlaces |
| `chip` / `chip-text` | `#EEF0F4` / `#4E5263` | `#252945` / `#C6CAE0` | etiquetas neutras ("Pendiente") |
| `bar` | `#4C5596` | `#9CA5EE` | barras de porcentaje (sólidas) |
| `accent` | `#B4471F` | `#E07A52` | acento terracota (contadores, toques cálidos) |

### Colores de estado (iguales en cualquier paleta)

| Estado | Claro (texto / fondo) | Nocturno (texto / fondo) |
|---|---|---|
| Correcto (disponible, vigente, pagado) | `#15803D` / `#DCFCE7` | `#86EFAC` / `#14361F` |
| Peligro (ocupado, vencido, urgente) | `#B91C1C` / `#FEE2E2` | `#FCA5A5` / `#45191A` |
| Atención (mantenimiento, en revisión) | `#A16207` / `#FEF9C3` | `#FDE68A` / `#3D3110` |

## Tipografía

| Uso | Fuente | Notas |
|---|---|---|
| Toda la interfaz | **Plus Jakarta Sans** | amigable y profesional; tiene tildes y ñ |
| Saludos de bienvenida ("Buenos días") | **Great Vibes** | caligráfica con floritura |

**Great Vibes se usa poco a propósito:** solo en saludos y bienvenidas, nunca en menús, botones, tablas ni
datos. Si se usa en todas partes pierde su efecto y además cansa al leer. Cada lugar nuevo donde se quiera usar
se evalúa antes.

Ejemplo: "**Buenos días**" en Great Vibes (color `primary`, ~64 px) y ", Carlos" en Plus Jakarta Sans.

## Medidas

| Token | Valor |
|---|---|
| `radius-s` | 10 px (botones, campos) |
| `radius-m` | 14 px (tarjetas) |
| `radius-full` | 99 px (insignias, barras) |
| `shadow` (claro) | `0 4px 16px rgba(15,23,42,.06)` |
| `shadow` (nocturno) | `0 4px 16px rgba(0,0,0,.35)` |
| `transition` | 0.2 s |

## Alternativa guardada: Bosque

Por si más adelante se quiere usar, mejorada, o como tema elegible (selector de tema, posible Fase 9).
Mismas reglas y colores de estado que Lavanda.

| Token | Claro | Nocturno |
|---|---|---|
| `bg` | `#F7F5F0` | `#101814` |
| `surface` | `#FFFFFF` | `#17221C` |
| `border` | `#E7E3DA` | `#26352D` |
| `text` | `#1F2A24` | `#E7EEE9` |
| `text-2` | `#66655E` | `#9FAEA5` |
| `primary` | `#1E5E45` | `#6FBF95` |
| `on-primary` | `#FFFFFF` | `#0B1510` |
| `primary-text` | `#1E5E45` | `#9AD8B6` |
| `primary-soft` | `#E6F0EA` | `#1C3A2C` |
| `link` | `#1E5E45` | `#8FD1AE` |
| `chip` / `chip-text` | `#EFEBE3` / `#57534E` | `#1F2C25` / `#C3CEC7` |
| `bar` | `#1E5E45` | `#6FBF95` |
| `accent` | `#B4471F` | `#E07A52` |

## Descartadas

Tinta y crema, Terracota, Ciruela y coral, Verde azulado, Petróleo, Océano, Celeste y pizarra, Blanco, Beige
(`#FAEBD7`), Piedra y oliva (`#EDECE7`). Fuentes caligráficas probadas y descartadas: Pinyon Script, Imperial
Script, Mea Culpa, Ballet, Monsieur La Doulaise, Allura, Parisienne, Playball, Dancing Script, Sacramento.
