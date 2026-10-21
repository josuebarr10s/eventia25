# Eventia — Design System v1.0

**Producto:** Eventia, plataforma de descubrimiento, gestión e inscripción a eventos.  
**Modo:** Light Mode exclusivamente.  
**Dirección:** Fresh & Playful Minimalism: fresco, moderno, cercano y vibrante, sin saturación visual ni exceso de tarjetas.  
**Estado:** Propuesta de diseño para validar; no es una descripción de interfaz ya implementada.

## 0. Fundamento y alcance

Este documento sigue el orden de la clase «Sistemas de diseño y consistencia visual»: *fundamentos → design tokens → componentes → variantes → estados → patrones → reglas de uso → documentación → pruebas en varias pantallas*. Un Design System define **cómo se ve, cómo se comporta y cuándo se utiliza** cada parte del producto.

Los flujos tomados como referencia del informe de Eventia son: explorar eventos, ver detalles, inscribirse, consultar inscripciones propias, iniciar sesión/registrarse, crear y editar eventos bajo permisos y administrar eventos propios. Los apartados de API REST del informe son **propuestas académicas** y no deben tratarse como endpoints desplegados.

## 1. Personalidad y principios visuales

1. **Aire antes que contenedores.** La separación espacial, tipografía y divisores finos crean jerarquía; no una tarjeta por cada bloque.
2. **Una acción principal clara.** Solo una CTA dominante por sección o pantalla; acciones secundarias sin competir.
3. **Energía con moderación.** Usar verde y menta para vitalidad, y turquesa oscuro para claridad. Los acentos intensos se reservan para momentos importantes.
4. **Simple y humano.** Texto breve, verbos específicos, iconografía amable y microinteracciones discretas.
5. **Consistencia visual y funcional.** Elementos equivalentes conservan estilo y comportamiento; la misma acción destructiva exige siempre confirmación.
6. **Accesibilidad desde el inicio.** El color nunca es el único indicador de estado o error.

## 2. Foundations / Fundamentos

### 2.1. Paleta original, conservada

| Familia | Valores hex originales | Uso general |
|---|---|---|
| Verde suave | `#EBF5E4` `#ECF4E2` `#D7EAC1` `#D3E4C1` `#CCE4BF` | Lienzos alternos, etiquetas, hero y detalles suaves |
| Menta clara | `#EFF8F7` `#D0F0ED` `#D0EDEC` `#CEEBE7` `#B7E8E6` | Fondo base, filas seleccionadas, superficies y separadores |
| Turquesa | `#CFF0EA` `#88C9C4` `#3E9B94` `#20666B` `#0C3B45` | Acciones, énfasis, foco, tipografía y contraste |

Colores complementarios estrictamente funcionales (fuera de la paleta artística): `#FFFFFF` para superficies; `#B42318` para peligro, `#FFF3CC` y `#8A5300` para advertencia. No utilizarlos como colores decorativos.

### 2.2. Tokens semánticos de color

| Token | Hex | Cuándo utilizarlo |
|---|---|---|
| `color.background` | `#EFF8F7` | Fondo general |
| `color.surface` | `#FFFFFF` | Formularios, menús, modal, tabla |
| `color.surface.soft` | `#EBF5E4` | Secciones alternas puntuales |
| `color.surface.mint` | `#D0F0ED` | Selección y resaltado suave |
| `color.surface.green` | `#D7EAC1` | Hero y bloques editoriales |
| `color.primary` | `#20666B` | Acción principal |
| `color.primary.hover` | `#0C3B45` | Hover del botón primario |
| `color.accent` | `#3E9B94` | Íconos y detalles de mayor tamaño |
| `color.accent.soft` | `#CFF0EA` | Fondos decorativos |
| `color.text` | `#0C3B45` | Texto general y encabezados |
| `color.text.secondary` | `#20666B` | Metadatos y descripciones |
| `color.border.subtle` | `#D0EDEC` | Divisores y separadores sin función crítica |
| `color.border.strong` | `#3E9B94` | Contorno identificable de input |
| `color.focus` | `#20666B` | Anillo de foco teclado |
| `color.danger` | `#B42318` | Error/destrucción (solo función) |
| `color.warning.background` | `#FFF3CC` | Avisos no destructivos |
| `color.warning.text` | `#8A5300` | Texto de avisos |

**Contraste verificado:** blanco sobre `#20666B` ≈ **6.62:1**; `#0C3B45` sobre `#EFF8F7` ≈ **11.26:1**. Evitar texto blanco pequeño sobre `#3E9B94` (≈ **3.32:1**) y texto turquesa `#3E9B94` sobre blanco en tamaños normales. Separadores suaves no sustituyen bordes identificables o etiquetas.

**Distribución aproximada en pantallas:** 65–75% fondos claros/blanco, 15–25% verdes y mentas suaves, 5–10% turquesa intenso. No poner los 15 tonos en una sola vista.

### 2.3. Tipografía

**Familia:** `Plus Jakarta Sans` (alternativas: `Inter`, `system-ui`, `sans-serif`). Una familia principal, pesos 400, 500, 600, 700 y 800 según el contexto.

| Token | Escritorio | Móvil | Peso / propósito |
|---|---|---|---|
| `heading.xl` | 48px/1.12 | 36px/1.15 | 800; título de hero |
| `heading.lg` | 32px/1.2 | 28px/1.2 | 700; título de pantalla |
| `heading.md` | 24px/1.25 | 22px/1.25 | 700; título de sección |
| `heading.sm` | 20px/1.3 | 18px/1.3 | 700; subtítulo |
| `body` | 16px/1.55 | 16px/1.55 | 400; lectura |
| `body.small` | 14px/1.5 | 14px/1.5 | 400/500; apoyo |
| `caption` | 12px/1.4 | 12px/1.4 | 500; ayuda complementaria |

El texto principal se alinea a la izquierda. Evitar mayúsculas sostenidas en párrafos y más de tres pesos en el mismo bloque.

### 2.4. Espaciado

Escala exacta de referencia de las diapositivas:

`spacing.xs = 4px` · `spacing.sm = 8px` · `spacing.md = 16px` · `spacing.lg = 24px` · `spacing.xl = 32px`.

Extensiones para composición: `spacing.2xl = 48px`, `spacing.3xl = 64px`, `spacing.4xl = 96px` (hero y separación de secciones). Nunca elegir distancias arbitrarias si ya existe un token.

### 2.5. Dimensiones, bordes, radios, elevación

- `radius.sm = 8px`: etiquetas compactas.
- `radius.md = 12px`: inputs, selects, botones (regla de clase: input y botón comparten radio).
- `radius.lg = 18px`: contenedores editoriales o modales.
- `radius.xl = 24px`: hero destacado; uso excepcional.
- `border.subtle = 1px solid #D0EDEC`; `border.control = 1px solid #3E9B94`.
- `shadow.popover = 0 12px 32px rgba(12,59,69,.12)`; `shadow.modal = 0 24px 64px rgba(12,59,69,.18)`; **sin sombras para filas ordinarias**.
- Altura mínima de controles táctiles: **44px**; formulario cómodo 48px, botones pequeños visualmente pueden existir manteniendo área táctil de 44px.
- Contenido máximo: **1160px**; padding horizontal: **24px escritorio / 16px móvil**.
- Breakpoints guía: móvil `< 640px`; tableta `640–1023px`; escritorio `≥ 1024px`.

## 3. Design Tokens listos para CSS

```css
:root {
  color-scheme: light;
  --color-background: #EFF8F7;
  --color-surface: #FFFFFF;
  --color-surface-soft: #EBF5E4;
  --color-surface-mint: #D0F0ED;
  --color-surface-green: #D7EAC1;
  --color-primary: #20666B;
  --color-primary-hover: #0C3B45;
  --color-accent: #3E9B94;
  --color-accent-soft: #CFF0EA;
  --color-text: #0C3B45;
  --color-text-secondary: #20666B;
  --color-border-subtle: #D0EDEC;
  --color-border-control: #3E9B94;
  --color-focus: #20666B;
  --color-danger: #B42318;
  --color-warning-bg: #FFF3CC;
  --color-warning-text: #8A5300;
  --font-family: "Plus Jakarta Sans", Inter, system-ui, sans-serif;
  --heading-xl: 48px;
  --heading-lg: 32px;
  --heading-md: 24px;
  --body: 16px;
  --body-small: 14px;
  --caption: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --shadow-popover: 0 12px 32px rgba(12,59,69,.12);
  --shadow-modal: 0 24px 64px rgba(12,59,69,.18);
  --content-width: 1160px;
}
```

## 4. Catálogo de componentes

En cada componente documentar **propósito, partes, tamaños, variantes, estados, interacción, uso recomendado y uso prohibido**.

| Componente | Variantes / tamaños | Uso y restricciones |
|---|---|---|
| `Button` | `primary`, `secondary`, `tertiary`, `danger`; `md` 48px, `sm` 44px | Primario para una decisión central; secundario para alternativa; terciario para navegación ligera; peligro solo en destruir. No más de una CTA principal por área. |
| `TextField` | normal, con prefijo, búsqueda, contraseña | Siempre etiqueta exterior visible, ayuda contextual, error debajo. No usar placeholder como etiqueta. |
| `Select` | simple, categoría, estado | Mismo alto y radio que TextField; opciones comprensibles. |
| `Textarea` | mínimo 120px | Descripciones de evento; crecimiento posible, límite indicado. |
| `DateTimePicker` | fecha / hora | Zona horaria identificada y validación fecha futura cuando corresponda. |
| `SearchField` | expandido, compacto | Ícono de búsqueda, atajo opcional, botón limpiar si hay texto. |
| `FilterChip` | sin seleccionar, seleccionada, deshabilitada | Fondo menta sutil; estado seleccionado visible por borde, fondo y texto, no solo color. |
| `Tabs` | línea inferior | Secciones de usuario/organizador; foco y teclado, sin apariencia de varias tarjetas. |
| `Badge` | informativo, borrador, publicado, completo | Texto explícito: «Publicado», «Borrador», «Sin cupos»; nunca solo color. |
| `Alert` | info, éxito, advertencia, error | Mensaje claro y acción de recuperación si aplica. Solo información importante. |
| `Modal` | confirmación, detalle corto, destructivo | Foco atrapado, Escape para cerrar salvo operación irreversible en progreso; en eliminación: advertencia y confirmación explícita. |
| `Toast` | éxito, error | Breve, no reemplaza errores persistentes de formulario. |
| `EventRow` | horizontal escritorio, apilado móvil | Patrón preferido para listados de eventos; miniatura, nombre, fecha, ciudad, cupos y acción. |
| `EventCard` | destacado/editorial | Permitida solamente cuando la imagen aporta valor (portada/promoción), no en toda pantalla. |
| `Table` | gestión | Encabezado, ordenación, filtros, filas con divisor; sin tarjeta alrededor salvo necesidad real. |
| `Pagination` | anterior, siguiente y contador | Conserva búsqueda/filtros al avanzar. |
| `Navigation` | header escritorio, menú móvil | Participante solo ve rutas de participante. Organizador ve funciones habilitadas. |
| `Skeleton` | fila, portada, resumen | Reservar espacio y evitar salto de contenido; animación reducida cuando el SO lo solicita. |

### 4.1. Estados obligatorios

Documentar y diseñar `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`, `success` y `selected` cuando correspondan. No todos aplican a todos los componentes.

- **Hover:** transición de 120–180 ms. En `Button primary`, `#20666B` → `#0C3B45`.
- **Focus-visible:** anillo externo de 3px y offset de 2px en `#20666B`, nunca eliminado.
- **Disabled:** contraste y texto que explican la causa cuando sea relevante, sin depender solo de opacidad.
- **Loading:** deshabilitar reenvío, conservar ancho del botón, indicar «Inscribiendo…».
- **Error:** descripción específica y campo asociado; no confiar solo en rojo.
- **Success:** «Inscripción confirmada» y acceso al comprobante/consulta de inscripción.

## 5. Patrones reutilizables

### 5.1. Explorar / buscar eventos

**Título → búsqueda → filtros (categoría, fecha, ciudad) → listado EventRow → paginación → estado vacío / error**.

- Encabezado con un hero editorial visualmente fresco, solo en páginas donde agrega contexto.
- Resultados en filas con separadores: evita una cuadrícula infinita de tarjetas.
- La búsqueda conserva texto y filtros al abrir y volver de un evento.
- Estado vacío: «No encontramos eventos con esos filtros» + «Limpiar filtros».
- Error de carga: «No pudimos cargar los eventos» + «Reintentar».

### 5.2. Detalle e inscripción

**Título del evento → información esencial (fecha, lugar, cupos) → descripción → CTA «Inscribirme» → confirmación o mensaje de error**.

- No pedir cantidad arbitraria: el MVP documentado contempla una inscripción por cuenta y evento.
- Evento sin cupos: estado «Sin cupos» y acción no disponible con explicación.
- Si la persona no ha iniciado sesión, guiar al inicio de sesión y permitir continuar al evento.
- Al enviar, impedir doble acción y mostrar resultado. El servidor valida permisos, fecha y cupos.

### 5.3. Creación / edición de eventos

**Título → campos → validación en línea → acción principal**. Agrupar: `Información` / `Fecha y ubicación` / `Cupos` / `Revisión`.

- Campos: título, descripción, ciudad, ubicación, fecha y capacidad positiva.
- Una acción «Guardar borrador» y, si el permiso y flujo lo permiten, opción de publicación diferenciada.
- No mostrar controles editables para `owner`, permisos o estados privilegiados no permitidos por backend.
- Confirmar abandono con cambios sin guardar.

### 5.4. Gestión de eventos

**Encabezado con acción principal → indicadores como texto grande sin tarjetas → filtros → tabla → menú contextual de fila**.

La tabla debe mostrar nombre, fecha, estado, capacidad e inscripciones, acciones accesibles según permisos. Editar evento ajeno requiere la autorización correspondiente del servidor.

### 5.5. Formularios de registro y acceso

- Diseño de una columna centrado, ancho de 400–480px, sin múltiples cajas apiladas.
- Etiquetas exteriores; errores precisos pero mensajes genéricos para credenciales inválidas cuando aplique.
- Cuenta bloqueada temporalmente por exceso de intentos: mensaje comprensible con reintento apropiado, sin exponer identidades.
- Contraseña nunca visible en texto por defecto; alternador Mostrar/Ocultar accesible.

### 5.6. Eliminación

`Acción eliminar → modal con objeto y consecuencias → Cancelar / Eliminar definitivamente → resultado visible`.

El botón peligro conserva siempre estilo, vocabulario y confirmación. Nunca reemplazar el diálogo por un toast.

## 6. Reglas de consistencia visual y funcional

**Sí:** colores por token; tamaño y radio iguales para campos equivalentes; una CTA dominante; estados de interacción; listas/tablas planas; márgenes constantes; texto de acción específico.  
**No:** contenedores anidados innecesariamente; sombra en cada fila; verde saturado detrás de párrafos; fondos oscuros o switch de Dark Mode; cinco botones primarios juntos; íconos sin texto para acciones ambiguas; acciones no autorizadas que aparezcan activas.

Si la navegación es distinta por rol, el diseño lo explica sin prometer seguridad por ocultar botones: **los permisos se hacen cumplir en backend**.

## 7. Plantillas y aplicación en pantallas

| Vista | Estructura | Uso de contenedores |
|---|---|---|
| `Inicio / explorar` | Header, hero, búsqueda/filtros, lista horizontal de eventos | 1 hero destacado, resto sin tarjetas repetidas |
| `Detalle de evento` | Información jerarquizada + inscripción junto al resumen | Un panel de inscripción si simplifica la acción |
| `Mis inscripciones` | Título, pestañas por estado, filas de inscripciones | Lista con divisores |
| `Panel organizador` | Resumen textual, filtros, tabla, acción crear | Paneles solo para diálogos y formularios críticos |
| `Crear/editar` | Formulario por secciones con divisores | Un área de formulario continua |
| `Acceso/registro` | Formulario centrado y texto de ayuda | Una única superficie; fondo claro |

## 8. Responsive, accesibilidad y microinteracción

- Semántica HTML: botones como `button`, enlaces como `a`, tablas para datos tabulares, etiquetas conectadas a campos.
- Contraste de texto normal ideal **≥ 4.5:1**, elementos gráficos y bordes esenciales **≥ 3:1**. Validar combinaciones finales.
- Todos los controles operables con teclado; orden lógico de foco; `aria-live` para resultados cuando sea pertinente.
- `prefers-reduced-motion: reduce`: respetar reducción de animaciones.
- En móvil, convertir filas horizontales a dos líneas; mantener CTA visible y tocar cómodamente.
- Evitar depender de hover en móvil; acciones críticas siempre visibles o claramente localizables.
- Microinteracciones de 120–180ms, sin rebotes exagerados o confeti constante.

## 9. Lista de control de evaluación (alineada con diapositiva 21)

- [ ] **Color:** ¿Se utilizan los tokens establecidos en vez de hex dispersos?
- [ ] **Tipografía:** ¿Respeta la escala y la jerarquía?
- [ ] **Espaciado:** ¿Se utiliza la escala del sistema?
- [ ] **Componentes:** ¿Se reutilizan definiciones existentes?
- [ ] **Variantes:** ¿La variante corresponde a la intención de la acción?
- [ ] **Estados:** ¿Incluye hover, focus, loading, disabled y error cuando aplica?
- [ ] **Patrones:** ¿Búsqueda, formulario y confirmación se comportan igual en las pantallas?
- [ ] **Consistencia:** ¿Se percibe como un único producto?
- [ ] **Accesibilidad:** ¿Se puede navegar con teclado y comprender sin color?
- [ ] **Roles:** ¿La interfaz comunica acciones disponibles sin sustituir las verificaciones del backend?

**Validar inicialmente en tres vistas:** explorar eventos, detalle/inscripción y panel del organizador. Comparar estructura, color, interacción, responsive y estados antes de construir más pantallas.

## 10. Referencias proporcionadas

1. **Clase 12 — Sistemas de diseño y consistencia visual**, Ing. Manuel Rojas, 24 páginas. Define fundamentos, tokens, componentes, variantes, estados, patrones, documentación y evaluación.
2. **Actividad 23 — Eventia**, informe académico entregado en este chat. Contiene el alcance del MVP, eventos, inscripciones, autenticación, permisos y limitaciones actuales de las APIs propuestas.

---

*Este sistema es una propuesta de diseño visual y de interacción. Los valores y patrones nuevos deben validarse con el usuario y con la implementación antes de declararlos estándares aprobados.*
