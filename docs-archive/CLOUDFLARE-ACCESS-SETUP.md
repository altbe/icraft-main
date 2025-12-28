# Cloudflare Access Setup Guide

**Purpose**: Protect dev.icraftstories.com and qa.icraftstories.com with authentication
**Date**: 2025-12-28
**Status**: Pending Implementation

---

## Prerequisites

- [ ] Cloudflare account with icraftstories.com zone
- [ ] Admin access to Cloudflare dashboard
- [ ] Both subdomains (dev, qa) already configured and proxied through Cloudflare

---

## Step 1: Access Zero Trust Dashboard

1. Go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. If first time, complete Zero Trust onboarding (free tier is sufficient)
3. Select your team name or create one (e.g., `icraftstories`)

---

## Step 2: Configure Authentication Method

1. Navigate to **Settings** → **Authentication**
2. Click **Login methods** tab
3. Click **Add new** and select **One-time PIN**
4. Click **Save**

> **Note**: One-time PIN sends a verification code to the user's email. No additional setup required.

---

## Step 3: Create Access Group

Creating a reusable group makes managing both applications easier.

1. Navigate to **Access** → **Access Groups**
2. Click **Add a group**
3. Configure:

| Field | Value |
|-------|-------|
| Group name | `iCraftStories Non-Prod Users` |

4. Under **Define group criteria**, add the following **Include** rules:

### Rule 1: Domain Whitelist
- Selector: **Emails ending in**
- Value: `@icraftstories.com`

### Rule 2: Individual Emails
- Selector: **Emails**
- Add each email (one per line):

```
haleynh823@gmail.com
michelealonzo23@yahoo.com
jimmypass@gmail.com
krhoden@autisminspired.org
poohbeartiggerbarnes1991@gmail.com
egallo@cps.edu
janellfowler29@gmail.com
taryngoodell@icloud.com
julie.orasco@gmail.com
giovanni0215@yahoo.com
travel@altgene.net
aversett@yahoo.com
ciaralavery1@gmail.com
dversetto@yahoo.com
icraftstoriestest5@yahoo.com
icraftstoriestest4@yahoo.com
icraftstoriestest3@yahoo.com
icraftstoriestest2@yahoo.com
icraftstoriestest@yahoo.com
desiree@p2musa.com
jnsinc2002@yahoo.com
sarah@ccw.org.au
ashley.hogan@ivyrehab.com
lola.bellarosa-homer@dogsforautism.org.uk
wrightk@marshlands.eriding.net
melissamacnab82@gmail.com
aaliyahdhosein46@gmail.com
amber.stretton@stopdomesticabuse.uk
```

5. Click **Save**

---

## Step 4: Create Application - Dev Environment

1. Navigate to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**

### Application Configuration

| Field | Value |
|-------|-------|
| Application name | `iCraftStories Dev` |
| Session Duration | `24 hours` |

### Application Domain
| Field | Value |
|-------|-------|
| Subdomain | `dev` |
| Domain | `icraftstories.com` |

Leave **Path** empty to protect the entire subdomain.

4. Click **Next**

### Add Policy

| Field | Value |
|-------|-------|
| Policy name | `Allow Non-Prod Users` |
| Action | `Allow` |

Under **Configure rules** → **Include**:
- Selector: **Access groups**
- Value: `iCraftStories Non-Prod Users`

5. Click **Next**
6. Leave **Setup** defaults (no additional settings needed)
7. Click **Add application**

---

## Step 5: Create Application - QA Environment

1. Navigate to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**

### Application Configuration

| Field | Value |
|-------|-------|
| Application name | `iCraftStories QA` |
| Session Duration | `24 hours` |

### Application Domain
| Field | Value |
|-------|-------|
| Subdomain | `qa` |
| Domain | `icraftstories.com` |

4. Click **Next**

### Add Policy

| Field | Value |
|-------|-------|
| Policy name | `Allow Non-Prod Users` |
| Action | `Allow` |

Under **Configure rules** → **Include**:
- Selector: **Access groups**
- Value: `iCraftStories Non-Prod Users`

5. Click **Next**
6. Click **Add application**

---

## Step 6: Verify Setup

### Test Dev Environment
1. Open an **incognito/private browser window**
2. Navigate to `https://dev.icraftstories.com`
3. You should see the Cloudflare Access login page
4. Enter an authorized email address
5. Check email for one-time PIN
6. Enter PIN to access the site

### Test QA Environment
1. Repeat the above steps for `https://qa.icraftstories.com`

### Test Unauthorized Access
1. Open incognito window
2. Navigate to `https://dev.icraftstories.com`
3. Enter an email NOT in the allowed list
4. Verify access is denied

---

## Verification Checklist

- [ ] Zero Trust dashboard accessible
- [ ] One-time PIN authentication enabled
- [ ] Access Group created with all emails
- [ ] Dev application created and configured
- [ ] QA application created and configured
- [ ] Dev environment requires authentication
- [ ] QA environment requires authentication
- [ ] Authorized email can access both environments
- [ ] Unauthorized email is blocked

---

## Managing Users

### Adding New Users

1. Go to **Access** → **Access Groups**
2. Click on `iCraftStories Non-Prod Users`
3. Add new email to the **Emails** list
4. Click **Save**

> **Note**: Users with `@icraftstories.com` emails are automatically allowed.

### Removing Users

1. Go to **Access** → **Access Groups**
2. Click on `iCraftStories Non-Prod Users`
3. Remove email from the list
4. Click **Save**

---

## Troubleshooting

### User Can't Access After Authentication
- Verify email is in the Access Group
- Check for typos in email address
- Ensure the email domain matches exactly

### Login Page Not Appearing
- Verify the subdomain is proxied (orange cloud) in DNS settings
- Check that the application domain matches exactly
- Clear browser cache and try incognito mode

### One-Time PIN Not Received
- Check spam/junk folder
- Verify email address is correct
- Wait 1-2 minutes and try again
- Check if email provider blocks Cloudflare emails

---

## Configuration Summary

| Setting | Value |
|---------|-------|
| Zero Trust Team | `icraftstories` |
| Authentication | One-time PIN (email) |
| Access Group | `iCraftStories Non-Prod Users` |
| Domain Whitelist | `@icraftstories.com` |
| Individual Emails | 28 external emails |
| Session Duration | 24 hours |
| Protected Domains | `dev.icraftstories.com`, `qa.icraftstories.com` |

---

## Related Documentation

- [Cloudflare Access Documentation](https://developers.cloudflare.com/cloudflare-one/policies/access/)
- [Zero Trust Getting Started](https://developers.cloudflare.com/cloudflare-one/setup/)
- [Authentication Methods](https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/)
