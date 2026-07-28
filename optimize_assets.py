import os
import re
import urllib.request
import urllib.parse
from PIL import Image

# Directories
ASSETS_DIR = "assets"
if not os.path.exists(ASSETS_DIR):
    os.makedirs(ASSETS_DIR)

# Find all HTML files
html_files = [f for f in os.listdir(".") if f.endswith(".html")]

# Patterns to extract image references
# We look for /db/storage/v1/object/public/assets/... and /assets/...
remote_pattern = re.compile(r'/db/storage/v1/object/public/assets/[a-zA-Z0-9%\._-]+')
local_pattern = re.compile(r'/assets/[a-zA-Z0-9%\._-]+')

unique_refs = set()

for fname in html_files:
    with open(fname, "r", encoding="utf-8") as f:
        content = f.read()
    
    for ref in remote_pattern.findall(content):
        unique_refs.add(ref)
    for ref in local_pattern.findall(content):
        # Avoid matching stylesheet, js, favicon or apple-touch-icon if already updated
        if not ref.endswith(('.css', '.js', '.map', 'favicon.png', 'apple-touch-icon.png')):
            unique_refs.add(ref)

print(f"Found {len(unique_refs)} unique image references to process.")

# Mapping from original reference to optimized local reference
ref_mapping = {}

def sanitize_filename(ref_path):
    filename = os.path.basename(ref_path)
    decoded = urllib.parse.unquote(filename)
    decoded = decoded.lower()
    # Replace spaces and special characters with dash
    sanitized = re.sub(r'[^a-z0-9\._-]', '-', decoded)
    sanitized = re.sub(r'-+', '-', sanitized)
    sanitized = sanitized.strip('-')
    base, _ = os.path.splitext(sanitized)
    return base + ".webp"

# Process each unique reference
for ref in unique_refs:
    print(f"Processing reference: {ref}")
    sanitized_name = sanitize_filename(ref)
    local_webp_path = os.path.join(ASSETS_DIR, sanitized_name)
    
    temp_path = None
    success = False
    
    try:
        if ref.startswith("/db/storage/v1/object/public/assets/"):
            # Remote file
            remote_filename = ref.replace("/db/storage/v1/object/public/assets/", "")
            # Encode remote filename back for the URL
            encoded_remote_filename = urllib.parse.quote(remote_filename)
            url = f"https://itzjqlznihnnfdshwcoz.supabase.co/storage/v1/object/public/assets/{encoded_remote_filename}"
            print(f"  Downloading from {url}...")
            temp_path = f"temp_{sanitized_name}"
            
            # Use headers to request the file successfully
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req) as response, open(temp_path, 'wb') as out_file:
                out_file.write(response.read())
            source_path = temp_path
        else:
            # Local file
            local_filename = ref.replace("/assets/", "")
            source_path = os.path.join(ASSETS_DIR, local_filename)
            if not os.path.exists(source_path):
                print(f"  Warning: Local file {source_path} not found.")
                continue
        
        # Open and optimize the image
        print(f"  Optimizing {source_path} -> {local_webp_path}...")
        with Image.open(source_path) as img:
            # Convert to WebP (WebP supports RGBA/transparency)
            img.save(local_webp_path, "WEBP", quality=80)
            
        success = True
        ref_mapping[ref] = f"/assets/{sanitized_name}"
        print(f"  Successfully optimized {ref} -> /assets/{sanitized_name}")
        
    except Exception as e:
        print(f"  Error processing {ref}: {e}")
        
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# Create optimized favicon and apple-touch-icon from logo if they exist
logo_sources = ["assets/logo.webp", "assets/logo1.webp", "assets/logo.png", "assets/logo1.png"]
logo_found = None
for l in logo_sources:
    if os.path.exists(l):
        logo_found = l
        break

if logo_found:
    print(f"Creating optimized favicon and apple-touch-icon from {logo_found}...")
    try:
        with Image.open(logo_found) as img:
            # Favicon 32x32 PNG
            fav_img = img.resize((32, 32), Image.Resampling.LANCZOS)
            fav_img.save("assets/favicon.png", "PNG")
            print("  Created assets/favicon.png")
            
            # Apple touch icon 180x180 PNG
            apple_img = img.resize((180, 180), Image.Resampling.LANCZOS)
            apple_img.save("assets/apple-touch-icon.png", "PNG")
            print("  Created assets/apple-touch-icon.png")
            
    except Exception as e:
        print(f"  Error creating icons: {e}")

# 3. Replace references in HTML files and add defer to head scripts
for fname in html_files:
    print(f"Updating HTML content in {fname}...")
    with open(fname, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Replace all image references
    for orig_ref, new_ref in ref_mapping.items():
        content = content.replace(orig_ref, new_ref)
        
    # Replace logo references in favicon link tags specifically
    favicon_pattern = re.compile(r'<link\s+rel="icon"\s+type="image/png"\s+href="[^"]+"\s*/>')
    apple_pattern = re.compile(r'<link\s+rel="apple-touch-icon"\s+href="[^"]+"\s*/>')
    
    content = favicon_pattern.sub('<link rel="icon" type="image/png" href="/assets/favicon.png" />', content)
    content = apple_pattern.sub('<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />', content)
    
    # Add defer to script tags in the head
    target_scripts = [
        'src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"',
        'src="config.js"',
        'src="/config.js"',
        'src="https://unpkg.com/lucide@latest"',
        'src="https://unpkg.com/lucide@latest"'
    ]
    
    for script_src in target_scripts:
        # Match both space and no-space
        content = content.replace(f'<script {script_src}></script>', f'<script {script_src} defer></script>')
        
    with open(fname, "w", encoding="utf-8") as f:
        f.write(content)

# Cleanup old PNG/JPEG/JPG files
print("Cleaning up old uncompressed images...")
for f in os.listdir(ASSETS_DIR):
    if f.lower().endswith(('.png', '.jpeg', '.jpg')):
        if f not in ["favicon.png", "apple-touch-icon.png"]:
            file_path = os.path.join(ASSETS_DIR, f)
            print(f"  Removing {file_path}")
            os.remove(file_path)

print("Asset optimization complete!")
