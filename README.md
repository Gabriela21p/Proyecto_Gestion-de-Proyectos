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
- Mapas/geocoding: OpenStreetMap tiles, Overpass API y Nominatim publico por defecto.
- Identidad: registro/login JWT local, listo para migrar o federar con Supabase Auth.
- Reputacion: las reviews de usuarios registrados pesan mas que las anonimas; usuarios verificados/moderadores pueden tener mayor peso.
- Infra preparada: Supabase Auth y Cloudflare R2 via variables `.env`, pendientes de credenciales.

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

## Servicios opcionales pesados

El MVP usa Nominatim y Overpass publicos. Si quieres Nominatim local:

```powershell
docker compose --profile geo up -d nominatim
```

Ese servicio descarga datos de Colombia y puede tardar bastante.

## Variables externas pendientes

Copia `backend-node/.env.example` a `backend-node/.env` si vas a correr backend fuera de Docker.

Para Supabase Auth necesitas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Para Cloudflare R2 necesitas:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`

Sin esas credenciales, el MVP funciona con auth simulada de comunidad y sin subida real de fotos.

## Auth y valoraciones ponderadas

Endpoints:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Las reviews enviadas con `Authorization: Bearer <token>` quedan asociadas a un usuario real del sistema y se calculan con `weight`.

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

## Ingesta de datos reales

Para recopilar datos reales desde OpenStreetMap/Overpass:

```text
GET  /api/osm/geocode?q=Chapinero Bogota
GET  /api/osm/nearby?lat=4.6486&lng=-74.0618&radius=700
POST /api/osm/import-nearby
```

`POST /api/osm/import-nearby` guarda resultados como `site_suggestions` en estado `pending`, para que entren por moderacion antes de publicarse. Esto evita contaminar el mapa con datos incompletos o duplicados.

Ejemplo:

```powershell
$body = @{ lat = 4.6486; lng = -74.0618; radius = 700 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/osm/import-nearby -ContentType "application/json" -Body $body
```

Para cargar semilla real automaticamente (sugerencias en estado `pending`) durante el arranque del backend:

```powershell
$env:SEED_REAL_OSM="1"
docker compose up -d postgres mongo redis meilisearch api
```

## Nota sobre el mapa

El mapa ya no reajusta bounds al seleccionar un pin; solo lo hace cuando cambia la lista de sitios por filtros. Esto evita que los puntos parezcan moverse al seleccionar. Si cambias de ciudades muy lejanas, el filtro sí reajusta el mapa para mostrar los resultados.
