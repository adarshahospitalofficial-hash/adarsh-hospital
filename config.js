// Supabase Connection Settings (Obfuscated using Base64 encoding)
const _u = "aHR0cHM6Ly9pdHpqcWx6bmlobm5mZHNod2Nvei5zdXBhYmFzZS5jbw==";
const _k = "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1sMGVtcHhiSHB1YVdodWJtWmtjMmgzWTI5Nklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT0RRMU5USTBORGtzSW1WNGNDSTZNakV3TURFeU9EUTBPWDAub2dySWEyNElUN1k0S3BCOTBzSVpVQzQ5dVdkWDRIbFp1TmFBX1k3YVhQSQ==";

const SUPABASE_URL = typeof atob !== 'undefined' ? atob(_u) : '';
const SUPABASE_ANON_KEY = typeof atob !== 'undefined' ? atob(_k) : '';

// Animation Frames Storage Settings
// Set to true to load animation frames from Supabase Storage instead of the local 'frames/' folder.
const USE_SUPABASE_STORAGE = true; 
const SUPABASE_STORAGE_BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/hero-frames`;

// Page Assets Storage Settings
// Set to true to load website images (services, building, etc.) from Supabase Storage instead of local/external hotlinks.
const USE_SUPABASE_ASSETS = true;
const SUPABASE_ASSETS_BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/assets`;
