# Primer despliegue de Rolling

Esta guía deja una ruta corta y comprobable para levantar Rolling por primera vez. El objetivo inicial es tener web, API, datos y aplicación móvil hablando entre sí antes de preparar un entorno público.

## 1. Requisitos

- Git.
- Docker Desktop con Docker Compose.
- Node.js 22.13 o superior para Expo.
- Expo Go en el teléfono, o Android Studio si se va a generar una APK.
- Al menos 8 GB de memoria disponibles para Docker.

Comprueba las herramientas:

```powershell
git --version
docker --version
docker compose version
node --version
npm --version
```

## 2. Descargar y configurar

```powershell
git clone https://github.com/ZunriseHH/WebAppRolling.git
cd WebAppRolling
Copy-Item .env.deploy.example .env.deploy
```

Abre `.env.deploy` y reemplaza todos los valores que empiezan por `cambiar_`. Estos valores no deben subirse al repositorio.

Para generar secretos desde PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

La opción `SEED_GOOGLE_PLACES_DEMO` controla el catálogo de demostración:

- `1`: carga los lugares curados de la demo.
- `0`: retira únicamente esos lugares y deja los datos propios de Rolling.

## 3. Levantar la plataforma

Desde la raíz del repositorio:

```powershell
docker compose --env-file .env.deploy config --quiet
docker compose --env-file .env.deploy up -d
docker compose --env-file .env.deploy ps
```

El primer arranque puede tardar mientras Docker descarga imágenes e instala dependencias. Revisa el avance sin detener los contenedores:

```powershell
docker compose --env-file .env.deploy logs --tail 100 api frontend
```

Servicios disponibles:

| Componente | Dirección |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000` |
| Documentación REST | `http://localhost:4000/docs` |
| GraphQL | `http://localhost:4000/graphql` |

## 4. Verificación mínima

Ejecuta estas comprobaciones antes de probar flujos de usuario:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/sites
Invoke-WebRequest -UseBasicParsing http://localhost:3000
```

Luego verifica manualmente:

1. Iniciar sesión en la web.
2. Abrir el explorador y seleccionar un marcador.
3. Buscar una dirección y confirmar el punto encontrado.
4. Registrar una sugerencia.
5. Entrar como moderador o administrador y revisar la sugerencia.
6. Confirmar que una aprobación aparece en el mapa.

## 5. Probar en un teléfono

El teléfono y el computador deben compartir red. Obtén la IPv4 del computador con `ipconfig` y crea `mobile/.env`:

```text
EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:4000
```

Después:

```powershell
cd mobile
npm install
npm run start:tunnel
```

Escanea el QR con Expo Go. El túnel conecta Expo Go con Metro, pero la API sigue llegando al computador por `EXPO_PUBLIC_API_URL`; el firewall debe permitir el puerto `4000` en la red local.

## 6. Generar una APK de prueba

Esta ruta requiere Android Studio, Android SDK y JDK:

```powershell
cd mobile
npm install
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

La APK se genera en:

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Antes de compartirla, configura `EXPO_PUBLIC_API_URL` con una API accesible desde los teléfonos que la instalarán. Una IP privada solo funciona dentro de la misma red.

## 7. Restaurar el volcado demo

El repositorio incluye `data/rolling-demo.sql`, sanitizado y sin usuarios ni credenciales. Para cargarlo en una base vacía:

```powershell
docker compose --env-file .env.deploy up -d postgres
Get-Content data\rolling-demo.sql -Raw | docker exec -i rolling-postgis psql -U rolling -d rolling -v ON_ERROR_STOP=1
```

Consulta [data/README.md](../data/README.md) antes de regenerar o reemplazar el volcado.

## 8. Primer entorno público

El Compose principal está orientado a desarrollo y demostración: usa servidores con recarga, monta el código como volumen y publica los puertos de datos. No debe exponerse directamente a Internet.

> **Bloqueo conocido:** el frontend todavía usa Next.js 14.2.5. Esa rama está fuera de soporte y la auditoría actual informa vulnerabilidades. Antes de publicar, migra a una versión con soporte y parche vigente, ejecuta `npm audit --omit=dev` y repite el build completo. Consulta siempre el [último aviso de seguridad de Next.js](https://nextjs.org/blog) porque la versión mínima segura cambia con nuevos reportes.

Para un primer staging público:

1. Usa una máquina Linux con Docker y un dominio.
2. Construye imágenes inmutables para API y frontend; no ejecutes `npm install` en cada arranque.
3. Publica únicamente `80/443` mediante Caddy, Traefik o Nginx.
4. Mantén PostgreSQL, MongoDB, Redis y Meilisearch en una red privada sin puertos públicos.
5. Configura HTTPS y establece `FRONTEND_ORIGIN=https://tu-dominio`.
6. Usa contraseñas únicas para PostgreSQL, Meilisearch, JWT y todas las cuentas iniciales.
7. Deja `SEED_GOOGLE_PLACES_DEMO=0` si el entorno ya trabajará con catálogo propio.
8. Automatiza copias de los volúmenes de PostgreSQL y MongoDB antes de aceptar datos reales.
9. Ejecuta las auditorías de dependencias de `frontend`, `backend-node` y `mobile`; documenta cualquier excepción aceptada.
10. Ejecuta nuevamente la verificación mínima usando el dominio público.

El primer despliegue público se considera terminado cuando web y API usan HTTPS, las bases no son accesibles desde Internet, las credenciales demo fueron reemplazadas y existe una restauración de respaldo probada.

## 9. Operación básica

Actualizar el código y recrear servicios:

```powershell
git pull
docker compose --env-file .env.deploy up -d --build
```

Ver estado y registros:

```powershell
docker compose --env-file .env.deploy ps
docker compose --env-file .env.deploy logs --tail 100 api frontend
```

Detener sin borrar datos:

```powershell
docker compose --env-file .env.deploy down
```

No uses `docker compose down -v` en un entorno con información que quieras conservar: esa opción elimina los volúmenes de datos.
