# noboo — versión con cuentas y pagos

Qué incluye: registro con correo, datos en la nube por usuario, prueba gratis de 7 días y suscripción mensual con Stripe, y la IA funcionando con tu propia clave (nadie la ve).

Estructura:
- `index.html` → la app (registro, paywall, todo lo que ya tenías)
- `api/ai.js` → llama a Claude por el usuario (solo suscriptores, 60 usos/día)
- `api/checkout.js`, `api/portal.js`, `api/webhook.js` → pagos con Stripe
- `supabase.sql` → tablas y seguridad

## 1. Supabase (cuentas y datos) — gratis
1. Crea un proyecto en supabase.com.
2. SQL Editor → pega `supabase.sql` → Run.
3. Project Settings → API: copia **Project URL**, **anon public key** y **service_role key** (esta última es secreta).
4. Authentication → Providers → Email: déjalo activado con "Confirm email" (así el correo queda verificado).
5. Authentication → URL Configuration: pon como **Site URL** tu dominio final (paso 5).
6. Abre `index.html` y cambia arriba del bloque final `SUPA_URL` y `SUPA_KEY` (la anon, no la service_role) y, si quieres, `PRICE`.

## 2. Stripe (cobros)
1. Crea cuenta en stripe.com y activa tu negocio.
2. Productos → Añadir producto "noboo Premium" → precio recurrente mensual (por ejemplo 4,99 €). Copia el **Price ID** (`price_...`).
3. Settings → Billing → Customer portal → actívalo (para que los usuarios cancelen solos).
4. Developers → Webhooks → Añadir endpoint: `https://TU-DOMINIO/api/webhook` con los eventos `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`. Copia el **Signing secret** (`whsec_...`).
5. Developers → API keys: copia la **Secret key**. Empieza en modo prueba (`sk_test_`) y cambia a `sk_live_` cuando todo funcione.

## 3. Clave de la IA
console.anthropic.com → API keys → crea una. Pon un límite de gasto mensual en Billing.

## 4. Subir y publicar con Vercel
1. Sube esta carpeta a un repositorio de GitHub (privado).
2. En vercel.com → Add New Project → importa el repo.
3. Settings → Environment Variables: añade todas las de `.env.example` con tus valores.
4. Deploy.

## 5. Dominio
Vercel → Settings → Domains. Después actualiza `SITE_URL` (Vercel), la **Site URL** (Supabase) y la URL del webhook (Stripe) con ese dominio y vuelve a desplegar.

## 6. Probar (modo prueba de Stripe)
1. Regístrate con un correo, confirma el email y entra.
2. Rellena tu perfil, pulsa "Empezar prueba gratis" y paga con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y CVC).
3. Vuelves a la app ya dentro. Prueba foto de comida, rutina y Coach.
4. En Perfil → Gestionar suscripción comprueba que puedes cancelar.

## Acceso gratis para ti o para amigos
En Supabase → SQL Editor:
```sql
insert into public.subscriptions (user_id, status)
select id, 'active' from auth.users where email = 'tucorreo@ejemplo.com'
on conflict (user_id) do update set status = 'active';
```

## Antes de cobrar de verdad
- **Costes de IA:** cada foto o consulta cuesta unos céntimos. Con el límite de 60/día y un tope de gasto en Anthropic, controlas el riesgo. Ajusta `DAILY_LIMIT` en `api/ai.js`.
- **Legal:** necesitas política de privacidad y términos (guardas datos de salud y fotos, que son datos sensibles en el RGPD), y avisar de que no sustituye a un profesional médico. Consulta a un gestor sobre autónomo/IVA.
- **Fotos:** se guardan dentro de los datos de cada usuario. Para mucho volumen, conviene moverlas a Supabase Storage.
