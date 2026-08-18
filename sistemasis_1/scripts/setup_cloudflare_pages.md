# Instrucciones para configurar Cloudflare Pages (rápido)

1) Conecta tu repositorio a Cloudflare Pages desde el dashboard.

2) Configura la rama a desplegar (por ejemplo `main`).

3) Variables de entorno (Settings > Environment variables)

- `SUPABASE_URL`: https://<tu-proyecto>.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: <service_role_key> (secreto)
- `ALLOWED_ORIGINS`: https://tusitio.com (opcional, coma-separado)

4) Bindings (KV)

- Crea un namespace KV y añádelo a Pages bindings con el nombre `RATE_LIMIT_KV` si quieres usar rate limiting.

5) Despliegue automático

- Cloudflare Pages desplegará automáticamente al hacer push. También añadimos un GitHub Actions workflow (`.github/workflows/deploy_pages.yml`) como plantilla si prefieres desencadenar despliegues desde Actions.

6) Pruebas

- Visita `https://<tu-site>.pages.dev/scanner.html` y prueba escanear un QR.
