// Animation Frames Storage Settings
// Set to true to load animation frames from Supabase Storage (proxied via /db) instead of the local 'frames/' folder.
const USE_SUPABASE_STORAGE = true; 
const SUPABASE_STORAGE_BUCKET_URL = `/db/storage/v1/object/public/hero-frames`;

// Page Assets Storage Settings
// Set to true to load website images (services, building, etc.) from Supabase Storage (proxied via /db) instead of local/external hotlinks.
const USE_SUPABASE_ASSETS = true;
const SUPABASE_ASSETS_BUCKET_URL = `/db/storage/v1/object/public/assets`;
