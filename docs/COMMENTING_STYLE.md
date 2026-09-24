# Comentarios de código en Rolling

Los comentarios del proyecto están escritos para contar el motivo de una decisión, no para repetir lo que ya expresa el código. La voz es directa, cercana y técnica, como una nota breve para la siguiente persona que mantenga el módulo.

## Qué merece un comentario

- Una decisión de arquitectura o seguridad que no resulta evidente.
- Un comportamiento de respaldo, compatibilidad o degradación controlada.
- La razón de una validación que existe también en otra capa.
- Un detalle de experiencia de usuario que condiciona la implementación.
- Una integración externa con límites o comportamiento inesperado.

## Qué conviene evitar

- Traducir literalmente una instrucción: `// aumenta el contador`.
- Narrar cada línea de una función pequeña.
- Prometer comportamientos que todavía no existen.
- Mantener comentarios viejos después de cambiar el flujo.
- Usar tono robótico, relleno o expresiones que no aportan contexto.

## Estilo acordado

- Español natural y frases completas.
- Preferir “conservamos”, “evitamos” o “la API valida” cuando ayuda a explicar intención.
- Una o dos líneas cerca de la decisión que documentan.
- JSDoc solo cuando el contrato público necesita más contexto que el nombre y los tipos.
- Los comentarios de seguridad deben explicar el riesgo que se está conteniendo.

Ejemplo útil:

```js
// La copia local acelera el arranque, pero siempre confirmamos el token con
// la API antes de dar acceso a la aplicación.
```

Ejemplo que no se debe agregar:

```js
// Llama a la API y guarda la respuesta.
```

## Revisión final realizada

Se revisaron manualmente los comentarios propios de:

- `backend-node/src`;
- `frontend/src`;
- `mobile/App.js` y `mobile/src`.

La revisión confirmó que las notas actuales explican decisiones como restauración de sesión, validación en servidor, sincronización entre mapa y lista, resolución de direcciones, moderación, compatibilidad con OSM y adaptación responsive. No se añadieron comentarios artificiales a consultas, DTO o estilos cuyo propósito ya es claro por su estructura.

Quedan fuera de esta regla los archivos generados, dependencias, volcados SQL y archivos de bloqueo: comentarlos manualmente dificultaría regenerarlos y no aportaría contexto mantenible.

Antes de aprobar un cambio, conviene ejecutar:

```powershell
rg -n "(^\s*//|/\*|<!--|\{\/\*)" backend-node\src frontend\src mobile --glob "!**/node_modules/**" --glob "!**/dist-check/**"
```

La pregunta de revisión es sencilla: “¿este comentario explica algo que el código por sí solo no cuenta?”. Si la respuesta es no, se elimina o se reescribe.

