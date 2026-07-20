// Supabase Connection Settings
// Replace these placeholders with your actual Supabase project keys:
const SUPABASE_URL = "https://itzjqlznihnnfdshwcoz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0empxbHpuaWhubmZkc2h3Y296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTI0NDksImV4cCI6MjEwMDEyODQ0OX0.ogrIa24IT7Y4KpB90sIZUC49uWdX4HlZuNaA_Y7aXPI";

// Animation Frames Storage Settings
// Set to true to load animation frames from Supabase Storage instead of the local 'frames/' folder.
const USE_SUPABASE_STORAGE = true; 
const SUPABASE_STORAGE_BUCKET_URL = "https://itzjqlznihnnfdshwcoz.supabase.co/storage/v1/object/public/hero-frames";

// Page Assets Storage Settings
// Set to true to load website images (services, building, etc.) from Supabase Storage instead of local/external hotlinks.
const USE_SUPABASE_ASSETS = true;
const SUPABASE_ASSETS_BUCKET_URL = "https://itzjqlznihnnfdshwcoz.supabase.co/storage/v1/object/public/assets";
