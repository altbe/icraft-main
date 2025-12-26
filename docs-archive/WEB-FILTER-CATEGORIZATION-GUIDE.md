# Web Filter Categorization Submission Guide

**Site**: icraftstories.com
**Requested Category**: Education
**Date Created**: 2025-12-12

## Purpose

Schools use web filtering solutions to comply with CIPA (Children's Internet Protection Act) requirements. To ensure iCraftStories is accessible in educational environments, the site must be properly categorized as "Education" across major web filtering vendors.

---

## Submission Tracking

| Vendor | Status | Submitted | Approved | Notes |
|--------|--------|-----------|----------|-------|
| Palo Alto Networks | [ ] Pending | | | |
| Fortinet/FortiGuard | [ ] Pending | | | |
| Cisco Talos | [ ] Pending | | | |
| Zscaler | [ ] Pending | | | |
| Symantec/Broadcom | [ ] Pending | | | |
| Cloudflare | [ ] Pending | | | |
| Lightspeed Systems | [ ] Pending | | | |
| GoGuardian | [ ] Pending | | | |

**Status Legend**: [ ] Pending | [~] Submitted | [x] Approved | [-] Rejected

---

## Standard Description (Copy for All Submissions)

Use this description when submitting categorization requests:

> **iCraftStories** is an educational platform for creating visual social stories, designed specifically for:
>
> - **Autism support** and social skill development
> - **ADHD learning** with visual engagement tools
> - **Special education** curriculum support
> - **Speech therapy** and communication development
>
> The platform is used by:
> - Schools and school districts
> - Special education teachers
> - Speech-language pathologists
> - Occupational therapists
> - Parents supporting children with learning differences
>
> Features include AI-powered story generation, dyslexia-friendly fonts (Lexend, Atkinson Hyperlegible), WCAG 2.1 AA accessibility compliance, and offline PWA support for classroom use.
>
> **Appropriate Category**: Education / Educational Materials / Special Education

---

## Vendor Submission Details

### 1. Palo Alto Networks (PAN-DB)

**Priority**: High (widely used in enterprise/school networks)

**Submission URL**: https://urlfiltering.paloaltonetworks.com/

**Steps**:
1. Go to https://urlfiltering.paloaltonetworks.com/
2. Enter `icraftstories.com` in the search box
3. Click "Check URL"
4. Review current categorization
5. Click "Request a Change"
6. Select suggested category: **Education**
7. Enter your email for notifications
8. Paste the standard description above
9. Submit

**Bulk Submission** (if needed): https://urlfiltering.paloaltonetworks.com/bulk_cr/
- Format: `URL,category1,category2,comment`
- Max 1000 entries per file

**Turnaround**: Automated crawler reviews first; if not auto-approved, human review within 24-72 hours

---

### 2. Fortinet / FortiGuard

**Priority**: High (common in K-12 schools)

**Submission URL**: https://fortiguard.com/webfilter

**Steps**:
1. Go to https://fortiguard.com/webfilter
2. Enter `icraftstories.com` in the URL lookup
3. View current rating
4. If incorrect, click "Submit URL for Rating"
5. Or go directly to: https://www.fortiguard.com/faq/wfratingsubmit
6. Fill in:
   - URL: `https://icraftstories.com`
   - Suggested Category: **Education**
   - Comments: Paste standard description
   - Email: Your contact email
7. Complete CAPTCHA and submit

**Alternative**: https://url.fortinet.net/rate/submit.php

**Turnaround**: 24-48 hours typical

---

### 3. Cisco Talos

**Priority**: High (powers Cisco Umbrella, Meraki, and WSA)

**Submission URL**: https://talosintelligence.com/reputation_center/web_categorization

**Steps**:
1. Go to https://talosintelligence.com/reputation_center
2. Log in with Cisco CCO credentials (create free account if needed)
3. Click "Submit a Web Categorization Ticket"
4. Enter URL: `icraftstories.com`
5. Click "Get Category Data"
6. If miscategorized, select "Submit a Web Categorization Request"
7. Suggested category: **Education**
8. Add comments with standard description
9. Submit

**Limits**: 50 URLs per submission for individual users

**Turnaround**: 3-5 business days

---

### 4. Zscaler

**Priority**: High (common in enterprise and education)

**Submission URL**: https://sitereview.zscaler.com/

**Steps**:
1. Go to https://sitereview.zscaler.com/
2. Enter `icraftstories.com`
3. Click "Look Up"
4. Review current categories
5. Click dropdown to suggest new categories
6. Select: **Education**
7. In Comments box, paste standard description
8. Enter your email address
9. Click "Submit Request"

**Alternative Tools**:
- https://threatlabz.zscaler.com/tool/url-check
- https://tools.zscaler.com/category/

**Turnaround**: 24-72 hours

---

### 5. Symantec / Broadcom (Blue Coat)

**Priority**: Medium (legacy but still widely deployed)

**Submission URL**: https://sitereview.bluecoat.com/

**Steps**:
1. Go to https://sitereview.bluecoat.com/sitereview.jsp
2. Enter `icraftstories.com`
3. Click "Check Rating"
4. Review current categorization
5. If site is not locked, click to request recategorization
6. Select suggested category: **Education**
7. Enter email for notification
8. Add comments with standard description
9. Submit

**Note**: Some sites may be "locked" and cannot be recategorized via self-service

**Turnaround**: 24-48 hours

---

### 6. Cloudflare

**Priority**: Medium (powers 1.1.1.1 for Families, Gateway, Zero Trust)

**Submission URL**: https://radar.cloudflare.com/domains/feedback/icraftstories.com

**Steps**:
1. Go to https://radar.cloudflare.com/domains/feedback/icraftstories.com
2. Review current categorization
3. Click to suggest category changes
4. Select: **Education**
5. Add comments with standard description
6. Submit feedback

**Alternative** (for Cloudflare customers):
- Dashboard > Security Center > Investigate > Change Categorization

**Turnaround**: Content category changes typically 24-48 hours

---

### 7. Lightspeed Systems

**Priority**: High (K-12 specific, very common in US schools)

**Submission URL**: https://archive.lightspeedsystems.com/

**Steps**:
1. Go to https://archive.lightspeedsystems.com/
2. Use the Dynamic Database Lookup tool
3. Search for `icraftstories.com`
4. Review current categorization
5. Click to submit for review
6. Enter your email address
7. Provide reasoning: Paste standard description
8. Submit

**Note**: Sites with reasoning/email are prioritized in review queue

**Turnaround**: Reviews processed hourly; decisions within 24 hours

---

### 8. GoGuardian

**Priority**: High (very common in K-12, especially Chromebook deployments)

**Submission URL**: No public portal - requires admin access or support contact

**Steps**:
1. If you have GoGuardian admin access:
   - Navigate to Activity or Individual Student page
   - Hover over category name
   - Click to edit/suggest new category
2. If no admin access:
   - Contact GoGuardian Support: https://support.goguardian.com/
   - Request categorization review for `icraftstories.com`
   - Suggest category: **Education**
   - Include standard description

**Alternative**: Ask a school district IT admin who uses GoGuardian to submit the request

**Turnaround**: Varies; typically 3-5 business days

---

## Verification Steps

After submissions are approved, verify categorization:

### Quick Check URLs

| Vendor | Check URL |
|--------|-----------|
| Palo Alto | https://urlfiltering.paloaltonetworks.com/ |
| Fortinet | https://fortiguard.com/webfilter |
| Cisco Talos | https://talosintelligence.com/reputation_center |
| Zscaler | https://sitereview.zscaler.com/ |
| Symantec | https://sitereview.bluecoat.com/ |
| Cloudflare | https://radar.cloudflare.com/scan/icraftstories.com |
| Google Safe Browsing | https://transparencyreport.google.com/safe-browsing/search?url=icraftstories.com |

---

## Additional Recommendations

### 1. Google Search Console
Ensure site is verified in Google Search Console to:
- Monitor for any security issues
- Receive alerts if site is flagged
- Request review if incorrectly flagged

**URL**: https://search.google.com/search-console

### 2. SSL/Security
Ensure the site maintains:
- Valid SSL certificate (HTTPS)
- No mixed content warnings
- No malware or suspicious scripts
- Clean security headers

### 3. Content Guidelines
To maintain Education categorization:
- Keep content appropriate for all ages
- No adult/mature content
- No gambling or violence
- No excessive advertising
- Educational focus evident on homepage

### 4. Re-check Periodically
Web filter databases are updated regularly. Re-verify categorization:
- After major site redesigns
- Every 6 months as maintenance
- If users report access issues

---

## Troubleshooting

### Site Still Blocked After Approval

1. **DNS Cache**: School may need to flush DNS cache
2. **Local Override**: School IT may have local block rules
3. **Different Vendor**: School may use a vendor not yet submitted to
4. **Subcategory Block**: "Education" may be allowed but a subcategory blocked

### Request Rejected

1. Review rejection reason
2. Update site content if needed
3. Resubmit with more detailed justification
4. Contact vendor support for clarification

### Contact School IT Directly

If a specific school reports issues:
1. Ask which web filter they use
2. Request they whitelist `icraftstories.com` locally
3. Provide this document as reference

---

## References

- [Palo Alto URL Filtering Documentation](https://docs.paloaltonetworks.com/advanced-url-filtering)
- [FortiGuard Web Filter Categories](https://www.fortiguard.com/webfilter/categories)
- [Cisco Talos Intelligence](https://talosintelligence.com/)
- [Zscaler URL Categories](https://help.zscaler.com/zia/url-categories)
- [Cloudflare Radar](https://radar.cloudflare.com/)
- [Lightspeed Systems](https://www.lightspeedsystems.com/)
- [GoGuardian Support](https://support.goguardian.com/)

---

*Last Updated: 2025-12-12*
