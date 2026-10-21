# 08 · Aplicación del Design System

Fuente única: `Eventia_Design_System.md` v1.0, leído antes de construir la aplicación. Exclusivamente modo claro.

| Fundamento | Aplicación |
| --- | --- |
| Paleta | Tokens semánticos centralizados en `frontend/src/styles.css`; fondo `#EFF8F7`, texto `#0C3B45`, primario `#20666B`, hero `#D7EAC1`, selección `#D0F0ED` |
| Tipografía | Plus Jakarta Sans autohospedada, pesos 400–800; títulos 48/32/24/20 y adaptación móvil 36/28/22/18; cuerpo 16/14 y apoyo 12 |
| Espacio | Tokens 4/8/16/24/32/48/64/96; contenido 1160 y padding 24/16 |
| Radios | 8 para etiquetas, 12 para controles, 18 para diálogo/panel, 24 para hero |
| Componentes | `Brand`, botones por clase, `Field`, `Alert`, `Badge`, `Loading`, `Empty`, `ErrorState`, `EventRow`, `Pagination`, `Modal`, iconos de categoría |
| Patrones | Hero editorial, búsqueda/categorías reales, filas con divisores, detalle con único panel de inscripción, tabla de gestión, formulario continuo por secciones |

Botones: primario para confirmar una acción, secundario para alternativas y terciario para navegación ligera. El estado loading deshabilita reenvíos y cambia el texto; el botón no simula guardado. Inputs y botones comparten radio, tienen altura de 48 px y etiquetas exteriores. Errores con texto, `aria-invalid` y asociación al campo. Las etiquetas de estado expresan texto, no solamente color.

El diálogo nativo ofrece foco contenido, retorno al invocador y cierre con Escape. Se usa al publicar y abandonar cambios. No hay acciones destructivas que requieran eliminación en este alcance.

La navegación tiene enlace para saltar al contenido, foco visible de 3 px y menú móvil con estado expandido. Las acciones de organizador dependen de los permisos que entrega la API, que además los verifica al ejecutar. Animaciones de 150 ms y reducción de movimiento según preferencia del sistema.

Los eventos se presentan con iconografía y geometría de la paleta: no se inventaron portadas ni fotografías de convocatorias inexistentes. La ilustración del hero es editorial y no representa un evento de la base.

Las verificaciones automáticas de viewport, flujo y capturas están en `frontend/e2e/mvp.spec.ts`; los resultados concretos y límites de accesibilidad se registran en `05-PRUEBAS.md`.
