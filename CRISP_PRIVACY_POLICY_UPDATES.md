# Privacy Policy Updates for Crisp.chat Integration

**Date**: 2025-10-24
**Status**: Awaiting Legal Review
**Action Required**: Update Privacy Policy before deploying Crisp.chat

---

## Summary

Crisp.chat integration requires Privacy Policy updates to disclose:
1. **Live chat support service** (third-party provider)
2. **Data collection** for support purposes
3. **Cookies set by Crisp**
4. **Data sharing** with Crisp Chat SAS (France)
5. **Data transfers** to EU (GDPR compliant)

---

## Required Changes

### 1. Update Version and Effective Date

**File**: `frontend/src/pages/PrivacyPage.tsx`

```typescript
// BEFORE
const version = '2.0';
const effectiveDate = 'October 18, 2025';
const lastUpdated = 'October 18, 2025';

// AFTER
const version = '2.1';
const effectiveDate = 'October 25, 2025';  // Or your deployment date
const lastUpdated = 'October 25, 2025';
```

**Also update in markdown files**:
- `frontend/src/content/privacy/en.ts` (line 3-5)
- `frontend/src/content/privacy/es.ts` (line 3-5)

---

### 2. Update Section 3 "Information We Collect"

**File**: `frontend/src/content/privacy/en.ts`

**Add after line 26** (after "Cookies/Similar Tech"):

```markdown
- **Customer Support Communications:** When you use our live chat support, we collect your name, email address, and the content of your messages to provide assistance. This information is processed by our customer support platform provider, Crisp Chat SAS.
```

**Spanish version** (`frontend/src/content/privacy/es.ts`):
```markdown
- **Comunicaciones de Atención al Cliente:** Cuando utiliza nuestro chat de soporte en vivo, recopilamos su nombre, dirección de correo electrónico y el contenido de sus mensajes para brindar asistencia. Esta información es procesada por nuestro proveedor de plataforma de atención al cliente, Crisp Chat SAS.
```

---

### 3. Update Section 6 "Sharing & Disclosures"

**File**: `frontend/src/content/privacy/en.ts`

**Update line 56** (Service Providers section):

```markdown
**BEFORE:**
- **Service Providers:** Authentication, payment processing, cloud hosting/CDN, analytics, AI infrastructure. These providers act under contract and may not use data for their own purposes

**AFTER:**
- **Service Providers:** Authentication, payment processing, cloud hosting/CDN, analytics, AI infrastructure, and live chat support. These providers include:
  - **Crisp Chat SAS** (France) for live chat support and customer service communications
  - Authentication, payment processing, cloud hosting/CDN, analytics, AI infrastructure providers

  These providers act under contract and may not use data for their own purposes
```

**Spanish version**:
```markdown
**ANTES:**
- **Proveedores de Servicios:** Autenticación, procesamiento de pagos, alojamiento en la nube/CDN, análisis, infraestructura de IA. Estos proveedores actúan bajo contrato y no pueden usar datos para sus propios fines

**DESPUÉS:**
- **Proveedores de Servicios:** Autenticación, procesamiento de pagos, alojamiento en la nube/CDN, análisis, infraestructura de IA y soporte por chat en vivo. Estos proveedores incluyen:
  - **Crisp Chat SAS** (Francia) para soporte por chat en vivo y comunicaciones de servicio al cliente
  - Autenticación, procesamiento de pagos, alojamiento en la nube/CDN, análisis, proveedores de infraestructura de IA

  Estos proveedores actúan bajo contrato y no pueden usar datos para sus propios fines
```

---

### 4. Add New Section 6.1 "Live Chat Support"

**Insert after Section 6** (around line 63):

```markdown
### 6.1. Live Chat Support (Crisp Chat)

We use Crisp Chat SAS (France) to provide live chat support on our website and application. When you use the chat widget:

**Information Shared with Crisp:**
- Your name and email address (if you are logged in)
- Your messages and conversation history
- Your subscription plan, credit balance, and team membership status (to provide better support)
- Technical information (browser type, device, IP address, pages visited)

**Crisp's Data Processing:**
- Crisp Chat SAS is based in France and complies with GDPR
- Crisp processes your data only to provide chat functionality and does not use it for their own marketing
- Your chat data is stored in Crisp's EU data centers
- Crisp's privacy policy is available at: https://crisp.chat/en/privacy/

**Your Rights:**
- You can request deletion of your chat history by contacting us at info@iCraftStories.com
- Chat conversations are retained for 12 months for quality assurance and training purposes
- You can decline to use the chat widget and contact us via email instead (info@iCraftStories.com)

**Third-Party Terms:**
Crisp Chat's use of your information is governed by their own Privacy Policy and Terms of Service. We recommend reviewing these documents.
```

**Spanish version**:
```markdown
### 6.1. Soporte por Chat en Vivo (Crisp Chat)

Utilizamos Crisp Chat SAS (Francia) para proporcionar soporte por chat en vivo en nuestro sitio web y aplicación. Cuando utiliza el widget de chat:

**Información Compartida con Crisp:**
- Su nombre y dirección de correo electrónico (si ha iniciado sesión)
- Sus mensajes e historial de conversación
- Su plan de suscripción, saldo de créditos y estado de membresía del equipo (para brindar un mejor soporte)
- Información técnica (tipo de navegador, dispositivo, dirección IP, páginas visitadas)

**Procesamiento de Datos de Crisp:**
- Crisp Chat SAS tiene su sede en Francia y cumple con el RGPD
- Crisp procesa sus datos solo para proporcionar funcionalidad de chat y no los usa para su propio marketing
- Sus datos de chat se almacenan en los centros de datos de Crisp en la UE
- La política de privacidad de Crisp está disponible en: https://crisp.chat/en/privacy/

**Sus Derechos:**
- Puede solicitar la eliminación de su historial de chat contactándonos en info@iCraftStories.com
- Las conversaciones de chat se conservan durante 12 meses para garantía de calidad y fines de capacitación
- Puede optar por no usar el widget de chat y contactarnos por correo electrónico (info@iCraftStories.com)

**Términos de Terceros:**
El uso de Crisp Chat de su información se rige por su propia Política de Privacidad y Términos de Servicio. Recomendamos revisar estos documentos.
```

---

### 5. Update Section 16 "Cookies & Tracking Technologies"

**File**: `frontend/src/content/privacy/en.ts`

**Update around line 159**:

```markdown
**BEFORE:**
We use cookies and similar technologies to operate and secure the Service, remember preferences, and analyze usage.

- A cookie consent banner allows you to accept or reject non-essential cookies (e.g., analytics)
- You can adjust preferences in the banner at any time or manage cookies in your browser settings (functionality may be affected)
- **We do not use cookies for cross-context behavioral advertising**

**AFTER:**
We use cookies and similar technologies to operate and secure the Service, remember preferences, and analyze usage.

**Types of Cookies We Use:**
- **Essential Cookies:** Required for authentication, security, and basic functionality
- **Analytics Cookies:** Help us understand how users interact with our Service (optional, requires consent)
- **Live Chat Cookies:** Set by Crisp Chat to enable chat support and remember your conversation history (optional, requires consent)

**Third-Party Cookies:**
- **Crisp Chat:** Sets cookies to maintain your chat session, remember your name and conversation history, and provide better support. These cookies are set when you use the live chat widget and are subject to Crisp's cookie policy: https://crisp.chat/en/privacy/

**Your Control:**
- A cookie consent banner allows you to accept or reject non-essential cookies (e.g., analytics, live chat)
- You can adjust preferences in the banner at any time or manage cookies in your browser settings (functionality may be affected)
- Declining chat cookies will prevent the chat widget from loading, but you can still contact us via email
- **We do not use cookies for cross-context behavioral advertising**

**Cookie Duration:**
- Essential cookies: Expire when you log out or close your browser
- Analytics cookies: Expire after 2 years
- Crisp chat cookies: Expire after 6 months of inactivity
```

**Spanish version**:
```markdown
**ANTES:**
Usamos cookies y tecnologías similares para operar y asegurar el Servicio, recordar preferencias y analizar el uso.

- Un banner de consentimiento de cookies le permite aceptar o rechazar cookies no esenciales (por ejemplo, análisis)
- Puede ajustar las preferencias en el banner en cualquier momento o administrar cookies en la configuración de su navegador (la funcionalidad puede verse afectada)
- **No usamos cookies para publicidad conductual entre contextos**

**DESPUÉS:**
Usamos cookies y tecnologías similares para operar y asegurar el Servicio, recordar preferencias y analizar el uso.

**Tipos de Cookies que Usamos:**
- **Cookies Esenciales:** Requeridas para autenticación, seguridad y funcionalidad básica
- **Cookies de Análisis:** Nos ayudan a entender cómo los usuarios interactúan con nuestro Servicio (opcional, requiere consentimiento)
- **Cookies de Chat en Vivo:** Establecidas por Crisp Chat para habilitar el soporte por chat y recordar su historial de conversación (opcional, requiere consentimiento)

**Cookies de Terceros:**
- **Crisp Chat:** Establece cookies para mantener su sesión de chat, recordar su nombre e historial de conversación, y brindar un mejor soporte. Estas cookies se establecen cuando usa el widget de chat en vivo y están sujetas a la política de cookies de Crisp: https://crisp.chat/en/privacy/

**Su Control:**
- Un banner de consentimiento de cookies le permite aceptar o rechazar cookies no esenciales (por ejemplo, análisis, chat en vivo)
- Puede ajustar las preferencias en el banner en cualquier momento o administrar cookies en la configuración de su navegador (la funcionalidad puede verse afectada)
- Rechazar las cookies de chat evitará que se cargue el widget de chat, pero aún puede contactarnos por correo electrónico
- **No usamos cookies para publicidad conductual entre contextos**

**Duración de las Cookies:**
- Cookies esenciales: Expiran cuando cierra sesión o cierra su navegador
- Cookies de análisis: Expiran después de 2 años
- Cookies de chat de Crisp: Expiran después de 6 meses de inactividad
```

---

### 6. Update Section 12 "Data Retention"

**Add after line 131**:

```markdown
- **Chat conversation history:** Retained for 12 months for quality assurance and support team training
```

**Spanish**:
```markdown
- **Historial de conversaciones de chat:** Conservado durante 12 meses para garantía de calidad y capacitación del equipo de soporte
```

---

### 7. Update Section 13 "International Data Transfers"

**Add after line 138**:

```markdown
**Crisp Chat Data Transfer:**
- Crisp Chat SAS is based in France (EU) and stores all chat data in EU data centers
- Data transfers to Crisp are protected by Standard Contractual Clauses (SCCs) and GDPR compliance
- Crisp is certified under the EU-US Data Privacy Framework (if applicable)
```

**Spanish**:
```markdown
**Transferencia de Datos de Crisp Chat:**
- Crisp Chat SAS tiene su sede en Francia (UE) y almacena todos los datos de chat en centros de datos de la UE
- Las transferencias de datos a Crisp están protegidas por Cláusulas Contractuales Estándar (SCC) y cumplimiento del RGPD
- Crisp está certificado bajo el Marco de Privacidad de Datos UE-EE. UU. (si corresponde)
```

---

## Cookie Consent Banner Update

**File**: `frontend/src/components/CookiePolicy.tsx` (if exists)

**Add Crisp Chat to cookie categories**:

```tsx
const cookieCategories = [
  {
    id: 'essential',
    name: 'Essential Cookies',
    description: 'Required for authentication and basic functionality',
    required: true
  },
  {
    id: 'analytics',
    name: 'Analytics Cookies',
    description: 'Help us understand how you use our service',
    required: false
  },
  {
    id: 'chat',  // NEW
    name: 'Live Chat Support',
    description: 'Enable live chat support and remember your conversation history (Crisp Chat)',
    required: false
  }
];
```

---

## Timeline for Updates

### Before Deploying Crisp.chat:
1. [ ] **Legal review** of Privacy Policy changes (1-2 days)
2. [ ] **Update Privacy Policy markdown files** (30 minutes)
3. [ ] **Update version and effective date** (5 minutes)
4. [ ] **Update cookie consent banner** (if needed) (1 hour)
5. [ ] **Deploy Privacy Policy updates** to production (15 minutes)
6. [ ] **Email notification** to active users (if material change) (optional)

### Deployment Order:
1. Deploy updated Privacy Policy (first)
2. Wait 24 hours (allow users to review)
3. Deploy Crisp.chat integration (second)

---

## Compliance Checklist

### GDPR (EU Users)
- [x] Disclose Crisp Chat as third-party processor
- [x] Explain data shared with Crisp
- [x] Provide link to Crisp's Privacy Policy
- [x] Explain data transfer safeguards (SCCs, EU data centers)
- [x] Allow users to opt-out (via cookie consent)
- [x] Provide deletion rights for chat history

### CCPA/CPRA (California Users)
- [x] Disclose Crisp as "service provider"
- [x] Confirm Crisp does not sell data
- [x] Provide opt-out mechanism (cookie consent)
- [x] Explain data retention (12 months)

### Canada (PIPEDA)
- [x] Identify purpose of data collection (customer support)
- [x] Obtain consent (via cookie banner)
- [x] Provide access to chat history on request

---

## Legal Review Questions

**For Legal Counsel**:

1. **Material Change?**
   - Is adding a live chat provider considered a "material change" requiring 30-day notice?
   - Recommendation: Not material (adds optional support channel, not core functionality)

2. **Cookie Consent**:
   - Do we need explicit opt-in for chat cookies in EU?
   - Recommendation: Yes - make chat cookies optional in cookie banner

3. **Data Transfer**:
   - Are SCCs sufficient for Crisp (France to US users)?
   - Recommendation: Yes - Crisp is EU-based, stores data in EU

4. **Retention Period**:
   - Is 12 months appropriate for chat history?
   - Recommendation: Yes - aligns with support ticket retention

5. **Liability**:
   - Should we add disclaimer about Crisp's third-party policies?
   - Recommendation: Yes - added in Section 6.1

---

## Alternative: Short-Form Disclosure (Minimum Required)

**If legal review delays full update**, add this minimal disclosure:

**Add to Section 6 "Service Providers":**
```markdown
We use Crisp Chat SAS (France, GDPR-compliant) to provide live chat support. When you use the chat widget, Crisp processes your name, email, and messages to enable customer support. Crisp's privacy policy: https://crisp.chat/en/privacy/
```

**Add to Section 16 "Cookies":**
```markdown
Our live chat widget (Crisp Chat) sets cookies to maintain your chat session. You can decline these cookies in our cookie consent banner.
```

**This minimal disclosure allows deployment while full legal review is pending.**

---

## Files to Modify

### Required Changes:
1. `frontend/src/content/privacy/en.ts` - English Privacy Policy
2. `frontend/src/content/privacy/es.ts` - Spanish Privacy Policy
3. `frontend/src/pages/PrivacyPage.tsx` - Version/date updates

### Optional (if exists):
4. `frontend/src/components/CookiePolicy.tsx` - Cookie consent banner
5. `frontend/src/components/CookieConsent.tsx` - Cookie consent logic

---

## Testing After Update

- [ ] Privacy Policy version displays correctly (2.1)
- [ ] Effective date updated (October 25, 2025 or your date)
- [ ] English text renders correctly
- [ ] Spanish text renders correctly
- [ ] Cookie consent banner includes chat option (if updated)
- [ ] Links to Crisp privacy policy work
- [ ] Mobile responsive (privacy policy is long)

---

## Contact for Legal Review

**Send this document to**:
- Legal counsel
- Privacy officer
- Compliance team

**Questions to answer**:
1. Approve changes as written?
2. Any additions/deletions needed?
3. Material change requiring user notice?
4. Timeline for review and approval?

---

**Document Version**: 1.0
**Last Updated**: 2025-10-24
**Author**: Claude Code
**Status**: Awaiting Legal Review
