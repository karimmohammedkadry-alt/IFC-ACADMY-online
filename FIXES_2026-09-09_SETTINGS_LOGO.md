# V13.3 — Academy Settings + Logo Fix

- Academy settings are now preserved during global operational-data reset.
- Local reset clears players/payments/expenses/coaches/archives but preserves settings.
- Settings mapper uses nullish checks so intentionally blank values do not silently revert to old defaults.
- Logo is selected from the device as an image file (PNG/JPG/WEBP/GIF), resized/compressed in browser, stored as the existing customLogoUrl data URL, previewed, and saved through the existing Supabase settings path.
- Existing API JSON body limit is 25 MB, and the logo is resized to max 900px before encoding.
