# Rolling MVP

Rolling es una app comunitaria para descubrir sitios destacables por localidad, priorizando reputacion, reviews utiles, eventos activos y reportes de la comunidad.

## Documentación operativa

- [Primer despliegue](docs/FIRST_DEPLOY.md): configuración, arranque, verificación, móvil, APK y requisitos para un staging público.
- [Estilo de comentarios](docs/COMMENTING_STYLE.md): criterio utilizado para mantener comentarios naturales y útiles.
- [Volcado de datos demo](data/README.md): alcance, restauración y reglas de sanitización.

## Arquitectura implementada

- Cliente web: Next.js + MapLibre GL JS.
- Cliente movil: Expo / React Native con autenticacion, exploracion, mapa, busqueda de direcciones, registro de lugares y reviews.
- Backend/API: Node.js + Fastify con REST y GraphQL.
- Tiempo real: Socket.io.
- Jobs y notificaciones: Redis + BullMQ.
- Datos geo/relacionales: PostgreSQL + PostGIS.
- Feed flexible: MongoDB.
- Busqueda: Meilisearch.
- Mapa visual: OpenStreetMap tiles.
- Resolucion de direcciones: base propia Rolling + servicio oficial 4-72 como fuente autoritativa externa.
- Identidad: registro/login JWT local, listo para migrar o federar con Supabase Auth.
- Reputacion: las reviews de usuarios registrados pesan mas que las anonimas; usuarios verificados/moderadores pueden tener mayor peso.
- Infra preparada: Supabase Auth y Cloudflare R2 via variables `.env`, pendientes de credenciales.

## Direcciones: arquitectura local-first con aprendizaje 4-72

Rolling ya no usa Nominatim como fuente principal para resolver direcciones de nuevas sugerencias. El flujo nuevo toma como referencia la estrategia validada en `PostalViewer` y utiliza el visor oficial de Codigo Postal 4-72.

La prioridad es la siguiente:

```text
1. Direccion ingresada por el usuario
        |
        v
2. Rolling busca la direccion normalizada en address_resolutions
        |
        +-- existe y tiene alta confianza --> responde desde PostgreSQL
        |
        +-- no existe --> consulta oficial 4-72
                              |
                              v
                    direccion estandar + coordenadas
                    codigo postal + DIVIPOLA
                              |
                              v
                    Rolling guarda/aprende el resultado
                              |
                              v
                    siguientes consultas salen de nuestra BD
```

### Objetivo

El servicio oficial 4-72 actua como fuente autoritativa de aprendizaje, no como una dependencia que deba consultarse indefinidamente para la misma direccion. Cada resultado confirmado pasa a formar parte de la base geografica propia de Rolling.

### Datos aprendidos

La tabla `address_resolutions` conserva:

- clave normalizada de direccion;
- direccion digitada originalmente;
- direccion estandar entregada por 4-72;
- departamento;
- municipio;
- codigo DIVIPOLA;
- codigo postal;
- codigo postal ampliado;
- latitud y longitud;
- proveedor/origen del dato;
- nivel de confianza;
- numero de verificaciones;
- respuesta original de referencia;
- fecha de primera captura;
- fecha de ultima verificacion;
- fecha de ultimo uso.

La tabla `postal_municipalities` permite que Rolling tambien aprenda el catalogo municipio/departamento/DIVIPOLA progresivamente.

### Consulta desde el dispositivo

`frontend/src/lib/postal472Client.js` contiene un cliente para intentar la consulta 4-72 desde el dispositivo del usuario. Esto distribuye las peticiones entre los clientes en vez de concentrarlas en una unica IP del backend.

En una aplicacion nativa el cliente puede comunicarse directamente con el servicio remoto. En navegador, el proveedor puede bloquear llamadas cross-origin mediante CORS. Por eso la arquitectura mantiene un fallback local-first desde el backend.

El comportamiento esperado es:

```text
Dispositivo -> intenta 4-72 directamente
             |
             +-- exito --> usa direccion/coords oficiales
             |
             +-- bloqueo CORS/error --> backend Rolling
                                         |
                                         +-- BD propia
                                         +-- 4-72 solo si no conoce la direccion
```

De esta forma un bloqueo de CORS no rompe el flujo y, al mismo tiempo, el volumen de consultas externas disminuye a medida que crece la base propia.

### OpenStreetMap

OpenStreetMap se mantiene como proveedor de tiles para dibujar el mapa con MapLibre. Los endpoints OSM antiguos del backend se conservan temporalmente por compatibilidad, pero el flujo de resolucion de direcciones de nuevas sugerencias ya no depende de Nominatim.

## Levantar servicios

Desde la raiz:

```powershell
docker compose up -d postgres mongo redis meilisearch api
```

El `docker-compose.yml` incluye también el frontend web. Para levantar la experiencia completa:

```powershell
docker compose up -d
```

Abre `http://localhost:3000` para la aplicación y `http://localhost:4000/docs` para la documentación de la API.

### Catálogo demo de Google Maps

La demo puede precargar un catálogo curado de lugares reales de Bogotá con enlaces de consulta en Google Maps. No se copian reseñas ni calificaciones de Google; esas señales empiezan vacías para que Rolling construya su propia reputación.

```text
SEED_GOOGLE_PLACES_DEMO=1  # registra o actualiza los lugares demo
SEED_GOOGLE_PLACES_DEMO=0  # retira únicamente los lugares de esta fuente demo
```

Docker lo activa por defecto para facilitar las pruebas. En otros entornos se configura desde `backend-node/.env`.

Verifica la API:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/sites
```

Docs REST:

```text
http://localhost:4000/docs
```

GraphQL:

```text
http://localhost:4000/graphql
```

## Levantar frontend web

```powershell
cd frontend
npm install
npm run dev
```

Abre:

```text
http://localhost:3000
```

El proxy de Next envia `/api/*` a `http://localhost:4000`.

## Levantar app movil

La app usa Expo SDK 57 y Node.js 22.13 o superior. Comparte usuarios, lugares, direcciones y reviews con la web. El explorador permite seleccionar sitios directamente sobre OpenStreetMap y muestra una ficha flotante sincronizada con los marcadores.

Los usuarios `moderator` y `admin` ven el módulo **Admin** en la navegación móvil. Allí tienen el resumen operativo y la moderación de sugerencias; únicamente `admin` puede consultar usuarios y cambiar roles, igual que en la aplicación web.

```powershell
cd mobile
npm install
```

Para Android Emulator, el valor predeterminado `http://10.0.2.2:4000` apunta al computador anfitrion:

```powershell
npm run start
```

Para un celular fisico, copia `mobile/.env.example` como `mobile/.env` y cambia la IP por la IPv4 local de tu computador:

```text
EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:4000
```

Despues inicia Expo en modo LAN y escanea el QR con Expo Go:

```powershell
npm run start
```

El celular y el computador deben estar conectados a la misma red Wi-Fi, Docker debe estar encendido y el firewall debe permitir el puerto `4000`.

Si Expo Go muestra `Cannot connect to Expo CLI` o Windows bloquea el puerto de Metro, inicia el proyecto mediante túnel:

```powershell
npm run start:tunnel
```

El túnel resuelve la conexión con Expo CLI; la API continúa usando la dirección configurada en `EXPO_PUBLIC_API_URL`.

### Generar APK de prueba local

Con Android Studio, Android SDK y JDK instalados:

```powershell
cd mobile
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

La APK queda en `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Esta compilacion no necesita contratar hosting; durante las pruebas la API sigue ejecutandose en el computador indicado por `EXPO_PUBLIC_API_URL`.

## Configuracion 4-72

Copia `backend-node/.env.example` a `backend-node/.env` si vas a correr backend fuera de Docker.

Variables principales:

```text
OFFICIAL_472_ENTRY_URL=https://visor.codigopostal.gov.co/RestService472/CodigoPostal/EntryOrdinary
OFFICIAL_472_TOKEN_URL=https://visor.codigopostal.gov.co/472/visor/javascript/layout.aspx
OFFICIAL_472_TIMEOUT_MS=30000
OFFICIAL_472_TOKEN_TIMEOUT_MS=10000
OFFICIAL_472_TOKEN_TTL_MS=3600000
```

El token usado por el visor no se deja quemado en codigo. Se obtiene dinamicamente desde el recurso JavaScript del visor y se conserva temporalmente en memoria.

## Variables externas pendientes

Para Supabase Auth necesitas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Para Cloudflare R2 necesitas:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`

Sin esas credenciales, el MVP funciona con autenticacion local y sin subida real de fotos.

## Auth y valoraciones ponderadas

Endpoints:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

La web redirige a `/login` antes de permitir el uso de `/app`. Las acciones de escritura del API tambien exigen `Authorization: Bearer <token>`.

Las reviews autenticadas se calculan con `weight`.

Factores actuales:

- Invitado: peso base `1.0`.
- Registrado: peso base `1.25`.
- Email verificado: suma `0.35`.
- Reputacion: suma hasta `0.5`.
- Moderador/admin: suma `0.4`.
- Visita verificada: suma `0.3`.

El rating de cada sitio usa promedio ponderado:

```text
SUM(rating * weight) / SUM(weight)
```

## Registro y moderacion de nuevos sitios

Flujo funcional actualizado:

```text
Usuario sugiere sitio
 -> Rolling busca direccion aprendida
 -> si no existe consulta 4-72
 -> guarda/aprende direccion oficial
 -> PostGIS detecta duplicados cercanos
 -> queda pending
 -> admin aprueba
 -> se crea site
 -> Meilisearch reindexa
 -> Socket.io notifica
```

Endpoints:

```text
POST /api/site-suggestions/preview
POST /api/site-suggestions
GET  /api/site-suggestions?status=pending
POST /api/site-suggestions/:id/approve
POST /api/site-suggestions/:id/reject
```

La web incluye `/app/admin` para usuarios con rol `admin` o `moderator`. Desde ahi se aprueban o rechazan sugerencias. Al aprobar, el backend crea el sitio real en `sites` con coordenadas PostGIS y lo deja listo para aparecer en el mapa.

## Reporteria y dashboard admin

La vista `/app/admin` incluye un dashboard filtrable para operar el MVP con datos reales del backend.

Filtros disponibles:

- Rango de fechas.
- Localidad.
- Ciudad.
- Categoria.

Metricas incluidas:

- Usuarios, sitios, reviews, feed posts, reportes abiertos y sugerencias pendientes.
- Actividad mensual por usuarios, sitios, reviews, sugerencias y reportes.
- Distribucion de roles.
- Embudo de sugerencias por estado.
- Localidades y categorias con mas sitios aprobados.
- Rating y confianza promedio.
- Graficas de estado de servicios y consumo runtime del API.

Endpoint base:

```text
GET /api/admin/dashboard?from=2026-01-01&to=2026-12-31&localidad=Chapinero&categoria=Cafe
```

El panel permite exportar el reporte filtrado en JSON para auditoria, analisis externo o carga posterior a herramientas BI.

## Compatibilidad OSM heredada

Los endpoints OSM existentes se mantienen temporalmente para no romper integraciones anteriores:

```text
GET  /api/osm/geocode
GET  /api/osm/nearby
POST /api/osm/import-nearby
```

No forman parte del nuevo flujo autoritativo de resolucion de direcciones. La siguiente fase de limpieza puede retirarlos cuando se confirme que ningun consumidor externo depende de ellos.

## Nota sobre el mapa

El mapa usa tiles de OpenStreetMap, pero esto es independiente de la resolucion de direcciones. MapLibre puede continuar mostrando la cartografia OSM mientras las coordenadas y direcciones de Rolling provienen de la base propia aprendida y, cuando hace falta, de 4-72.
