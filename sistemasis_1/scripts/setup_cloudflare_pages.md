# Instrucciones para configurar Cloudflare Pages

## Opción recomendada: Pages desde Git

1) Conecta el repositorio a Cloudflare Pages desde el dashboard.

2) Configura la rama a desplegar (por ejemplo `main`).
3) Usa estos valores de build:
	- Framework preset: `None`
	- Build command: vacío
	- Build output directory: `.`

No configures `wrangler.toml` como comando de build. Ese archivo se usa para publicar el Worker, no para compilar el sitio.

4) Variables de entorno (Settings > Environment variables)

- `SUPABASE_URL`: https://<tu-proyecto>.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: <service_role_key> (secreto)
- `ALLOWED_ORIGINS`: https://tusitio.com (opcional, coma-separado)

5) Bindings (KV)

- Crea un namespace KV y añádelo a Pages bindings con el nombre `RATE_LIMIT_KV` si quieres usar rate limiting.

6) Despliegue automático

- Cloudflare Pages desplegará automáticamente al hacer push. También añadimos un GitHub Actions workflow (`.github/workflows/deploy_pages.yml`) como plantilla si prefieres desencadenar despliegues desde Actions.

7) Pruebas

- Visita `https://<tu-site>.pages.dev/scanner.html` y prueba escanear un QR.

## Subida manual

Si utilizas `Add files via upload`, sube únicamente los archivos del sitio estático:
`index.html`, `scanner.html`, `login.html`, `admin.html` y `assets/`. Esa modalidad no publica Pages Functions.

Para que `/api/log_attendance` funcione, conecta el repositorio mediante Git y conserva `functions/api/log_attendance.js`. Como alternativa, publica el Worker de registro desde Wrangler y coloca su URL en `assets/js/config.js`:

```js
window.ADMIN_ENDPOINT = 'https://tu-worker-admin.workers.dev';
window.LOG_ENDPOINT = 'https://tu-worker-registro.workers.dev';
```

El Worker de consultas se publica con:

```powershell
wrangler deploy --config wrangler.toml
```

El archivo `wrangler.toml` ya está configurado con `main = "workers/get_attendance_logs/index.js"`.
