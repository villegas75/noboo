# noboo como página web con control de acceso

Con esto tendrás un enlace público (por ejemplo `https://noboo.vercel.app`) donde cada persona crea su cuenta, y **solo entra quien tú apruebes** desde un panel de administración (`/admin.html`). La IA funciona para todos con tu clave, sin que nadie necesite cuenta de Claude.

## 1. Supabase
SQL Editor → pega y ejecuta, uno por uno (debe salir "Success"):
1. `supabase.sql` (si ya lo hiciste antes, no lo repitas)
2. `supabase-retos.sql`
3. `supabase-acceso.sql`

Authentication → Providers → Email: activado y con **Confirm email** marcado.

## 2. GitHub
Sube a tu repositorio, reemplazando lo anterior: `index.html`, `admin.html`, `config.js`, `privacidad.html`, `terminos.html`, los `.sql` y la carpeta **`api`** (10 archivos). Después edita `config.js` en GitHub (lápiz ✏️): pon tu **Project URL** y tu clave **publishable** de Supabase. Esas dos son públicas; nunca pongas aquí la secret.

## 3. Vercel
Importa el repositorio y, en **Environment Variables**, añade:

| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | tu Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | tu clave **secret** de Supabase |
| `ANTHROPIC_API_KEY` | tu clave de Anthropic (con saldo cargado) |
| `SITE_URL` | la dirección de tu web (al principio, la que te dé Vercel) |
| `ADMIN_EMAILS` | **tu correo** (el que usarás para registrarte) |
| `ACCESS_MODE` | `invite` |
| `CONTACT_EMAIL` | tu correo, para mostrarlo a quien pida acceso |

No necesitas nada de Stripe para esta fase. Pulsa **Deploy**.

## 4. Configura el enlace en Supabase
Authentication → URL Configuration: pon tu dirección de Vercel en **Site URL** y añádela también en **Redirect URLs**. Así los correos de confirmación llevan a tu web.

## 5. Prueba y controla quién entra
1. Abre tu web y **crea tu cuenta con el mismo correo que pusiste en `ADMIN_EMAILS`**. Confirma el correo y entra: como administrador, te deja pasar sin pagar.
2. Abre `tu-web/admin.html` e inicia sesión con esa cuenta.
3. En **Dar acceso por correo**, escribe el correo de tu madre o de quien quieras y pulsa **Dar acceso**. Funciona aunque todavía no se hayan registrado.
4. Pásales el enlace de la web. Ellos se registran con ese correo, confirman el email y entran.
5. Quien se registre sin que lo hayas aprobado verá "Acceso por invitación" y tu correo de contacto; en el panel aparece como "Sin acceso", y le das acceso con un clic.
6. **Bloquear** impide entrar a esa persona aunque tenga suscripción; **Quitar regla** la deja como estaba.

## 6. Cuando quieras cobrar
- Cambia `ACCESS_MODE` a `paid`: entra quien tenga suscripción o esté aprobado por ti.
- Añade en Vercel `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` y `STRIPE_WEBHOOK_SECRET`, y crea el webhook en Stripe (`https://tu-web/api/webhook`, eventos `customer.subscription.created`, `.updated` y `.deleted`).
- El plan gratuito de Vercel (Hobby) no permite uso comercial: para cobrar tendrás que pasar al plan Pro. Compruébalo en vercel.com/pricing.

## Avisos
- Supabase envía los correos de confirmación con un servicio básico y con un **límite bajo de envíos por hora**. Para muchos registros seguidos, configura tu propio servicio de correo (SMTP) en Authentication → SMTP.
- Bloquear no cancela pagos de Stripe: si alguien bloqueado paga, cancela su suscripción desde tu panel de Stripe.
- Las reglas se basan en el correo y solo valen cuando está **confirmado**, así que nadie puede colarse escribiendo el correo de otro.
- Antes de abrirlo al público, que un profesional revise `privacidad.html` y `terminos.html` (hay fotos y datos de salud).
