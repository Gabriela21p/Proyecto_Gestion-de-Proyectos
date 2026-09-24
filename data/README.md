# Datos de demostración

`rolling-demo.sql` es un volcado sanitizado de PostgreSQL pensado para levantar una copia local de Rolling.

Incluye:

- esquema y extensiones de PostgreSQL/PostGIS;
- barrios y actividades;
- lugares del catálogo demo;
- relaciones entre lugares y actividades;
- eventos públicos.

No incluye usuarios, correos, hashes de contraseñas, sesiones, reseñas, favoritos, reportes, sugerencias ni direcciones aprendidas. Esas tablas se crean vacías al restaurar el esquema.

## Restaurar en Docker

La base de destino debe estar vacía. Desde la raíz del repositorio:

```powershell
docker compose up -d postgres
Get-Content data\rolling-demo.sql -Raw | docker exec -i rolling-postgis psql -U rolling -d rolling -v ON_ERROR_STOP=1
```

MongoDB no tiene datos demo persistentes en este volcado. Actualmente su colección `feed_posts` se inicializa vacía desde la aplicación.

## Regenerar de forma segura

El archivo debe seguir excluyendo las tablas con información aportada por usuarios:

```text
users
reviews
favorites
reports
site_suggestions
address_resolutions
postal_municipalities
```

Antes de subir una nueva versión, revisa que el SQL no contenga correos ni hashes de contraseñas.
