# Authorities dataset — notes (checked 2026-10-31)
- 26 authorities: 16 India (incl. CPGRAMS, Swachhata), 10 US.
- Emails only from .gov.in/.nic.in/.gov (or the authority's own domain, e.g. kmcgov.in, houstontx.gov). Excluded: complaint@pwddelhi.com, info@punecorporation.org, GHMC zonal gmail ids.
- High-confidence complaint emails: BBMP comm@bbmp.gov.in, Lucknow nnlko@nic.in, Houston houston311@houstontx.gov. Medium: MCD (actually IT helpdesk), NDMC care@, KMC roads (Boroughs I–V only), Bhubaneswar grievance@. Low: GHMC commissioner (third-party source). BMC Mumbai email is app-support only.
- US cities publish no complaint email (except Houston) — use 311 portal / mailto fallback not possible; deep-link the portal.
## Gaps
- Most portal field lists are low/medium: portals need OTP login, so the form itself wasn't opened. Verified field-by-field: KMC (code 12), MyBMC MARG, SF311.
- PWD Delhi portal returned HTTP 500 on fetch.
- BBMP replaced by Greater Bengaluru Authority (5 corporations, 2025) — ward→corporation mapping needed.
- Jaipur Greater/Heritage and Ahmedabad CCRS portals are on non-gov domains (.org, apphost.in).
- Delhi jurisdiction: MCD vs NDMC vs PWD (60ft+ roads) vs NHAI(1033) needs location routing.
- Swachhata has no pothole category — don't route potholes there.
- Some US out-of-city phone numbers (LA, Chicago, Philly, Seattle, Austin) are from memory, marked medium.
- Note: a competitor-like site citylens.lol already does city pothole routing for Hyderabad.
