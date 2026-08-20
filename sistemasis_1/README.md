1) Ejecuta el SQL en Supabase (SQL editor) para actualizar la función:
	- Ejecuta `supabase/supabase.sql` o copiar la sección modificada y correrla.

Configuración rápida:

1. En Supabase, cree un proyecto y ejecute `supabase/supabase.sql` desde el SQL editor.
# Sistema de Asistencia QR — Plantilla

Este repositorio contiene una plantilla mínima para un sistema de registro de asistencia mediante QR.

- `scanner.html`: página cliente para escanear QR y registrar asistencia.
- `admin.html`: panel administrativo para ver usuarios y registros.
- `assets/js/scanner.js`: lógica de escaneo y comunicación con Supabase.
- `assets/js/admin.js`: lectura simple de `users` y `attendance_logs`.
- `supabase/supabase.sql`: SQL para crear tablas, RLS y función de ayuda.

Configuración rápida:

1. En Supabase, cree un proyecto y ejecute `supabase/supabase.sql` desde el SQL editor.
2. Configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `assets/js/config.js` usando únicamente la clave pública `anon`.
3. Para producción, usa la Pages Function o el Worker de registro, que llaman a `log_attendance_by_token` con la `service_role` sin exponerla al cliente.

Despliegue en Cloudflare Pages:

- Suba los archivos estáticos (`index.html`, `scanner.html`, `login.html`, `admin.html`, `assets/`...) a un repo Git y conecte a Cloudflare Pages.
- En Pages use preset `None`, deje vacío el comando de build y use `.` como directorio de salida.
- `wrangler.toml` es para el Worker y no debe utilizarse como comando de build de Pages.
- Configure variables de entorno para la build si necesita inyectar `SUPABASE_URL`/`ANON_KEY` o utilice un archivo `config.js` que no contenga secretos.

Endpoint seguro (recomendado)

1. Para no exponer la `service_role` key en el cliente, cree un endpoint seguro (Cloudflare Worker o Pages Function) que reciba el `token` y `device_info` y llame a la función RPC `log_attendance_by_token` en Supabase usando la `service_role` key.
2. Ejemplo incluido: `workers/log_attendance/index.js` — es un Worker simple que hace POST a `SUPABASE_URL/rest/v1/rpc/log_attendance_by_token`.
3. Configure las variables en el entorno del Worker (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) y despliegue con Wrangler o Cloudflare dashboard.

Ejemplo rápido usando Wrangler:

```bash
# instalar Wrangler
# npm install -g wrangler
# configurar account_id en wrangler.toml
wrangler publish workers/log_attendance --env production
```

Uso en el cliente

- `scanner.js` ahora envía el token a `window.LOG_ENDPOINT` (por defecto `/api/log_attendance`). Configure `window.LOG_ENDPOINT` en `scanner.html` o despliegue el Worker en una ruta pública y apunte a ella.

Pages Functions

- Si despliegas en Cloudflare Pages, coloca el archivo `functions/api/log_attendance.js` en la raíz del repositorio; Pages lo servirá en `/api/log_attendance` automáticamente.
- Para habilitar rate-limiting con KV en Pages, vincula un namespace KV y nómbralo `RATE_LIMIT_KV` en la configuración de Pages.


Seguridad

- No incluyas la `service_role` key en los archivos del cliente.
- Limita el Worker con medidas extra (rate limiting, CORS, validación) según necesites.

Despliegue recomendado (pasos concretos)

1) Cloudflare Pages (sitio estático + Functions)

- Conecta el repo a Cloudflare Pages y configura la rama para publicar.
- Asegúrate de que `functions/api/log_attendance.js` esté en el repositorio y despliega mediante Git; una subida manual de archivos estáticos no publica Pages Functions.
- En Settings > Environment variables añade:
	- `SUPABASE_URL` = https://<tu-proyecto>.supabase.co
	- `SUPABASE_SERVICE_ROLE_KEY` = <service_role_key>
	- `ALLOWED_ORIGINS` = https://tusitio.com (o múltiples separadas por coma)
	- Añade un KV namespace y asígnalo al binding `RATE_LIMIT_KV` si quieres rate-limiting.

2) Cloudflare Workers con Wrangler (alternativa)

```bash
# instalar wrangler
npm install -g wrangler

# autenticar
wrangler login

# publicar el worker
wrangler publish workers/log_attendance --env production
```

Usa `wrangler secret put VARIABLE` para crear secrets, por ejemplo:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_URL
wrangler secret put ALLOWED_ORIGINS
```

3) Pruebas locales

- Para Pages: usa `wrangler pages dev` o la tooling de Pages para desarrollo local.
- Para Workers: usa `wrangler dev workers/log_attendance` para probar localmente.

Notas de seguridad adicionales

- Rota la `service_role` key regularmente.
- Protege el endpoint con medidas adicionales (rate-limiting, validación de tokens, verificación de origen, logging/alertas).

Automatización y despliegue

- Script para crear secrets con Wrangler: `scripts/setup_wrangler_secrets.sh`.
- Instrucciones rápidas para Pages: `scripts/setup_cloudflare_pages.md`.
- Workflows de ejemplo para GitHub Actions:
	- `/.github/workflows/deploy_pages.yml` — despliega Pages (plantilla).
	- `/.github/workflows/deploy_worker.yml` — publica el Worker con Wrangler.

Scripts de publicación automática

- `scripts/publish_worker.sh` — script Bash para crear secrets (si no existen) y publicar el Worker.
- `scripts/publish_worker.ps1` — script PowerShell equivalente para Windows.

Uso rápido (PowerShell):

```powershell
# asegúrate de haber hecho: wrangler login
.
.\scripts\publish_worker.ps1
```

Uso rápido (Linux/macOS):

```bash
# asegúrate de haber hecho: wrangler login
bash scripts/publish_worker.sh
```

Utilidades locales

- Generador de usuarios CSV para importar a Supabase o Google Sheets:
	- `scripts/generate_users_csv.py` — genera un CSV con `id`, `nombre`, `qr_token`.
	- Ejemplo:

```bash
python scripts/generate_users_csv.py --count 100 --out users.csv
```

- Archivo de ejemplo de variables de entorno: `.env.example`.

VS Code

- Tareas preconfiguradas en `.vscode/tasks.json` para publicar el worker y ejecutar `wrangler pages dev`.

Checklist final antes de publicar

- Verifica que `wrangler.toml` contiene tu `account_id`.
- Asegura que `functions/log_attendance.js` o `workers/log_attendance/index.js` esté configurado según la plataforma elegida.
- Añade en Cloudflare Pages (o con `wrangler secret put`) las variables:
	- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS` (si procede).
- Si usas KV para rate-limiting, vincula un namespace con el binding `RATE_LIMIT_KV`.
- Prueba localmente con `wrangler pages dev` o `wrangler dev`.

Comprobación rápida del endpoint

Usa los scripts de prueba incluidos para validar el endpoint antes de poner en producción:

Bash:
```bash
bash scripts/test_endpoint.sh https://<tu-site>/api/log_attendance <sample-token>
```

PowerShell:
```powershell
.\scripts\test_endpoint.ps1 -Endpoint https://<tu-site>/api/log_attendance -Token <sample-token>
```

Si obtienes 200 y un payload con el `id` del registro, el flujo básico funciona.


Testing the RPC (Bash y PowerShell)

Hay dos scripts incluidos para llamar a la RPC `log_attendance_by_token` usando la `service_role` key. Elige según tu entorno.

- Bash (Linux/macOS/WSL/Git Bash):

```bash
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<key>
bash scripts/call_rpc_sample.sh <sample-token> "cli-test"
```

- PowerShell (Windows):

```powershell
$env:SUPABASE_URL = 'https://<project>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = '<key>'
.\scripts\call_rpc_sample.ps1 -Token '<sample-token>' -DeviceInfo 'ps-test'
```

Ambos scripts envían una petición POST a `SUPABASE_URL/rest/v1/rpc/log_attendance_by_token` con los encabezados `apikey` y `Authorization: Bearer <service_role>`; la respuesta se imprime en JSON.

## Configuración de producción

El flujo de asistencia conserva el esquema Supabase actual (`users` y `attendance_logs`) y añade el patrón operativo de METACOM: cada lectura se registra como `entrada` o `salida`, y se rechaza el mismo tipo repetido para el mismo usuario durante el día.

Para activar estas funciones en un proyecto existente, ejecuta la migración `supabase/migrations/2026-08-19_metacom_features.sql` después de las migraciones anteriores. El escáner muestra el tipo elegido y el panel lo incluye en el listado.

La política horaria se configura en `public.attendance_policy`. Ejemplo:

```sql
UPDATE public.attendance_policy
SET workday_start = '08:00:00',
	workday_end = '17:00:00',
	grace_minutes = 10,
	hourly_discount = 25.00,
	updated_at = now()
WHERE id = true;
```

1. En Supabase, ejecuta las migraciones de `supabase/migrations/` desde el SQL Editor.
2. En Authentication > Users, crea el usuario o usuarios administrativos con correo y contraseña.
3. En `assets/js/config.js`, configura únicamente los valores públicos:

```js
window.SUPABASE_URL = 'https://tu-proyecto.supabase.co';
window.SUPABASE_ANON_KEY = 'tu-clave-anon';
window.ADMIN_ENDPOINT = 'https://tu-worker.workers.dev';
window.LOG_ENDPOINT = '/api/log_attendance';
```

No coloques `SUPABASE_SERVICE_ROLE_KEY` en archivos del sitio publicado.

## Worker de consultas administrativas

Si quieres evitar que el cliente haga llamadas directas a Supabase con capacidades de lectura amplias, despliega el Worker incluido en `workers/get_attendance_logs/index.js`. Este Worker valida el `access_token` de Supabase Auth, restringe los orígenes configurados y solo después llama a la RPC `get_attendance_logs` usando la `SUPABASE_SERVICE_ROLE_KEY`.

Pasos rápidos:

1. Asegúrate de tener `wrangler` instalado y autenticado: `npm i -g wrangler && wrangler login`.
2. Publica el Worker usando uno de los scripts:

```bash
bash scripts/deploy_worker.sh <account_id>
```

o en PowerShell:

```powershell
.\scripts\deploy_worker.ps1 -AccountId <account_id>
```

3. Crea los secrets con Wrangler (te pedirá el valor):

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_URL
wrangler secret put ALLOWED_ORIGINS  # opcional, coma-separados
```

4. Después de publicar, establece la URL del Worker en `assets/js/config.js` mediante `window.ADMIN_ENDPOINT`.

Con esto, `assets/js/admin.js` enviará automáticamente el token de sesión al Worker para obtener logs paginados y el total.

Seguridad y recomendaciones:
- Usa `ALLOWED_ORIGINS` para atar el Worker a los orígenes de tu panel admin (ej. `https://tusitio.com`).
- El endpoint admin requiere una sesión válida de Supabase Auth; conocer la URL no concede acceso.
- Para mayor seguridad, protege el Worker con Cloudflare Access o añade autenticación adicional.
- No pongas `SUPABASE_SERVICE_ROLE_KEY` en el cliente.



