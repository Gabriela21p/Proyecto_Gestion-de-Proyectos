# Rolling MVP

Rolling es una app comunitaria para descubrir sitios destacables por localidad, priorizando reputacion, reviews utiles, eventos activos y reportes de la comunidad.

## Arquitectura implementada

- Cliente web: Next.js + MapLibre GL JS.
- Cliente movil: Expo / React Native base en `mobile/`.
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

```powershell
cd mobile
npm install
npm run start
```

Si pruebas en celular fisico, cambia `EXPO_PUBLIC_API_URL` por la IP local de tu PC:

```powershell
$env:EXPO_PUBLIC_API_URL="http://TU_IP_LOCAL:4000"
npm run start
```

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
