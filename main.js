(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const loader = document.getElementById('animation-loader');
  const heroSection = document.getElementById('home');

  // Rewrite image assets if USE_SUPABASE_ASSETS is enabled
  function rewriteAssetUrls() {
    if (typeof USE_SUPABASE_ASSETS !== 'undefined' && USE_SUPABASE_ASSETS) {
      document.querySelectorAll("img").forEach(img => {
        const src = img.getAttribute("src");
        if (src && (src.startsWith("/assets/") || src.startsWith("assets/") || src.includes("lovable.app/assets/"))) {
          const filename = src.split("/").pop();
          img.src = `${SUPABASE_ASSETS_BUCKET_URL}/${filename}`;
        }
      });
    }
  }
  rewriteAssetUrls();

  const frameCount = 240;
  const framesDir = 'frames/genrate_a_vidio_for_the_animat_gwr_video_mvp_frames';
  const getFrameUrl = (index) => {
    const paddedIndex = String(index).padStart(3, '0');
    if (typeof USE_SUPABASE_STORAGE !== 'undefined' && USE_SUPABASE_STORAGE) {
      return `${SUPABASE_STORAGE_BUCKET_URL}/frame_${paddedIndex}.jpg`;
    }
    return `${framesDir}/frame_${paddedIndex}.jpg`;
  };

  const images = [];
  let loadedCount = 0;
  let lastRenderedImage = null;

  // Dynamic header height measurement to sync CSS layout variables
  function updateHeaderHeight() {
    const header = document.querySelector('.site-header');
    if (header) {
      const height = header.offsetHeight;
      document.documentElement.style.setProperty('--header-height', `${height}px`);
    }
  }
  window.addEventListener('resize', () => {
    updateHeaderHeight();
    handleScroll();
  });
  updateHeaderHeight();

  // Preload first frame immediately
  const firstImg = new Image();
  firstImg.src = getFrameUrl(1);

  let firstFrameLoaded = false;
  let progressAnimationComplete = false;

  function hideLoaderIfReady() {
    if (firstFrameLoaded && progressAnimationComplete && loader) {
      loader.classList.add('hidden');
    }
  }

  // Smooth progress animation over exactly 0.5s (500ms)
  const duration = 500;
  const startProgressTime = performance.now();

  function animateLoader() {
    const now = performance.now();
    const elapsed = now - startProgressTime;
    const progress = Math.min(1, elapsed / duration);
    const percentage = Math.round(progress * 100);

    if (loader) {
      loader.textContent = `Loading animation (${percentage}%)...`;
    }

    if (progress < 1) {
      requestAnimationFrame(animateLoader);
    } else {
      progressAnimationComplete = true;
      hideLoaderIfReady();
    }
  }
  requestAnimationFrame(animateLoader);

  firstImg.onload = () => {
    firstFrameLoaded = true;
    drawFrame(1);
    handleScroll();
    hideLoaderIfReady();
    startBackgroundLoading();
  };

  firstImg.onerror = () => {
    firstFrameLoaded = true;
    hideLoaderIfReady();
    startBackgroundLoading();
  };

  for (let i = 1; i <= frameCount; i++) {
    if (i === 1) {
      images.push(firstImg);
    } else {
      images.push(new Image());
    }
  }

  function getClosestLoadedImage(index) {
    const targetImg = images[index - 1];
    if (targetImg && targetImg.complete && targetImg.naturalWidth > 0) {
      return targetImg;
    }

    let left = index - 1;
    let right = index + 1;
    while (left >= 1 || right <= frameCount) {
      if (left >= 1) {
        const img = images[left - 1];
        if (img && img.complete && img.naturalWidth > 0) {
          return img;
        }
      }
      if (right <= frameCount) {
        const img = images[right - 1];
        if (img && img.complete && img.naturalWidth > 0) {
          return img;
        }
      }
      left--;
      right++;
    }
    return firstImg;
  }

  function startBackgroundLoading() {
    const loadQueue = [];

    // Step 1: Every 4th frame for quick low-res scan
    for (let i = 5; i <= frameCount; i += 4) {
      loadQueue.push(i);
    }

    // Step 2: Every 2nd frame for medium resolution
    for (let i = 3; i <= frameCount; i += 4) {
      loadQueue.push(i);
    }

    // Step 3: All remaining frames for full detail
    for (let i = 2; i <= frameCount; i += 2) {
      loadQueue.push(i);
    }

    // Ensure last frame is loaded early
    if (!loadQueue.includes(frameCount) && frameCount > 1) {
      loadQueue.push(frameCount);
    }

    const MAX_CONCURRENT_LOADS = 4;
    let activeLoads = 0;
    let queueIndex = 0;

    function loadNextFromQueue() {
      while (activeLoads < MAX_CONCURRENT_LOADS && queueIndex < loadQueue.length) {
        const frameIdx = loadQueue[queueIndex++];
        const img = images[frameIdx - 1];

        if (img.src) {
          continue; // Already loading/loaded via scroll priority
        }

        activeLoads++;
        img.src = getFrameUrl(frameIdx);

        img.onload = () => {
          activeLoads--;
          loadedCount++;
          if (getCurrentScrollFrameIndex() === frameIdx) {
            drawFrame(frameIdx);
          }
          loadNextFromQueue();
        };

        img.onerror = () => {
          activeLoads--;
          loadedCount++;
          loadNextFromQueue();
        };
      }
    }

    loadNextFromQueue();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const physicalWidth = Math.round(rect.width * dpr);
    const physicalHeight = Math.round(rect.height * dpr);

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
      
      // Re-apply smoothing settings as canvas resize resets them
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }

  function drawFrame(index) {
    const img = getClosestLoadedImage(index) || lastRenderedImage;
    if (img && img.complete && img.naturalWidth > 0) {
      resizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      let drawX = 0;
      let drawY = 0;

      if (canvasRatio > imgRatio) {
        drawHeight = canvas.width / imgRatio;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        drawWidth = canvas.height * imgRatio;
        drawX = (canvas.width - drawWidth) / 2;
      }

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      lastRenderedImage = img;
    }
  }

  function getCurrentScrollFrameIndex() {
    if (!heroSection) return 1;
    const heroTop = heroSection.offsetTop;
    const heroHeight = heroSection.offsetHeight;
    const viewportHeight = window.innerHeight;
    const scrollOffset = window.scrollY - heroTop;
    const scrollRange = heroHeight - viewportHeight;

    let progress = scrollOffset / scrollRange;
    progress = Math.max(0, Math.min(1, progress));
    return Math.floor(progress * (frameCount - 1)) + 1;
  }

  function handleScroll() {
    if (!heroSection) return;
    const heroTop = heroSection.offsetTop;
    const heroHeight = heroSection.offsetHeight;
    const viewportHeight = window.innerHeight;
    const scrollOffset = window.scrollY - heroTop;
    const scrollRange = heroHeight - viewportHeight;

    let progress = scrollOffset / scrollRange;
    progress = Math.max(0, Math.min(1, progress));

    const targetFrame = Math.floor(progress * (frameCount - 1)) + 1;

    // Prioritize loading the target frame if it hasn't started loading yet
    const img = images[targetFrame - 1];
    if (img && !img.src) {
      img.src = getFrameUrl(targetFrame);
      img.onload = () => {
        if (getCurrentScrollFrameIndex() === targetFrame) {
          drawFrame(targetFrame);
        }
      };
    }

    drawFrame(targetFrame);

    // Fade out and translate the hero text as scroll increases
    const text = document.querySelector('.hero-text');
    if (text) {
      let textOpacity = 1;
      let textTranslateY = 0;
      if (progress > 0.05) {
        // Linear fade out between 5% and 40% scroll progress
        textOpacity = 1 - (progress - 0.05) / 0.35;
        textOpacity = Math.max(0, textOpacity);
        textTranslateY = -progress * 60; // Translate up slightly (up to 60px)
      }
      text.style.opacity = textOpacity;
      text.style.transform = `translateY(${textTranslateY}px)`;
    }
  }

  // Smooth scroll scrubbing loop using requestAnimationFrame decoupling
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // Initial draw
  handleScroll();

  // --- Supabase Integration ---
  let supabaseClient = null;

  function isSupabaseConfigured() {
    return (
      typeof supabase !== 'undefined' &&
      typeof SUPABASE_URL !== 'undefined' &&
      typeof SUPABASE_ANON_KEY !== 'undefined' &&
      !SUPABASE_URL.includes("your-project-id") &&
      !SUPABASE_ANON_KEY.includes("your-anon-public-key")
    );
  }

  async function initSupabase() {
    if (!isSupabaseConfigured()) {
      console.log("Supabase is not configured yet. Using local fallback data.");
      setupLocalFormFallback();
      return;
    }

    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase client initialized successfully!");
      
      // Load data dynamically from Supabase
      loadDepartments();
      loadPackages();
      setupSupabaseForm();
      loadAvailableDoctors();
    } catch (err) {
      console.error("Error initializing Supabase client:", err);
      setupLocalFormFallback();
    }
  }

  // Fallback for form submit when Supabase is not connected
  function setupLocalFormFallback() {
    const form = document.querySelector('.contact-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        alert('This is a static demo form — connect it to a backend or form service (or configure Supabase in config.js) to receive submissions.');
      };
    }
    populateStaticDoctors();
  }

  // Handle form submission to Supabase
  function setupSupabaseForm() {
    const form = document.querySelector('.contact-form');
    if (!form || !supabaseClient) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      
      // 1. Honeypot check
      const honeypot = form.querySelector('#form_website_url')?.value;
      if (honeypot) {
        console.warn("Spam submission detected via honeypot.");
        alert('Callback request submitted successfully! We will get back to you shortly.');
        form.reset();
        return;
      }

      // Helper function to sanitize user inputs to prevent XSS
      function sanitizeInput(str) {
        if (!str) return '';
        return str.replace(/<[^>]*>/g, '').trim();
      }

      // 2. Fetch and sanitize inputs
      const rawName = form.querySelector('#form_full_name').value;
      const rawPhone = form.querySelector('#form_phone_number').value;
      const rawEmail = form.querySelector('#form_email_address').value;
      const rawService = form.querySelector('#form_service_requested').value;
      const rawDoctor = form.querySelector('#form_preferred_doctor').value;
      const rawMessage = form.querySelector('#form_message').value;

      const fullName = sanitizeInput(rawName);
      const phoneNumber = sanitizeInput(rawPhone);
      const emailAddress = sanitizeInput(rawEmail);
      const serviceRequested = sanitizeInput(rawService);
      const preferredDoctor = sanitizeInput(rawDoctor);
      const message = sanitizeInput(rawMessage);

      // 3. Client-side Validation Checks
      if (fullName.length < 2 || fullName.length > 100) {
        alert('Please enter a valid full name (2-100 characters).');
        return;
      }

      const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
      if (!phoneRegex.test(phoneNumber)) {
        alert('Please enter a valid phone number (7-20 digits).');
        return;
      }

      const emailRegex = /^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/;
      if (!emailRegex.test(emailAddress)) {
        alert('Please enter a valid email address.');
        return;
      }

      if (message.length > 1000) {
        alert('Message is too long. Please restrict it to 1000 characters.');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      const payload = {
        full_name: fullName,
        phone_number: phoneNumber,
        email_address: emailAddress,
        service_requested: serviceRequested,
        preferred_doctor: preferredDoctor,
        message: message
      };

      try {
        const { error } = await supabaseClient.from('appointments').insert([payload]);
        if (error) throw error;

        alert('Callback request submitted successfully! We will get back to you shortly.');
        form.reset();
      } catch (err) {
        console.error("Error submitting appointment:", err);
        alert('Failed to submit request. Please try again later.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Request';
        }
      }
    };
  }

  // Load available doctors for selection
  async function loadAvailableDoctors() {
    if (!supabaseClient) {
      populateStaticDoctors();
      return;
    }

    let doctors = null;
    try {
      const { data, error } = await supabaseClient
        .from('doctors')
        .select('name, is_available')
        .eq('is_available', true)
        .order('name', { ascending: true });

      if (error) throw error;
      doctors = data;
    } catch (err) {
      console.warn("Failed to query 'is_available' from doctors table, falling back to all doctors. Error:", err);
      // Fallback: Query all doctors regardless of availability
      try {
        const { data, error } = await supabaseClient
          .from('doctors')
          .select('name')
          .order('name', { ascending: true });
        
        if (error) throw error;
        doctors = data;
      } catch (fallbackErr) {
        console.warn("Failed to load doctors entirely from Supabase, loading fallback list:", fallbackErr);
        populateStaticDoctors();
        return;
      }
    }

    const doctorSelect = document.querySelector('#form_preferred_doctor');
    if (!doctorSelect) return;

    doctorSelect.innerHTML = '<option value="" disabled selected>Select preferred doctor</option>';

    if (doctors && doctors.length > 0) {
      doctors.forEach(doc => {
        const opt = document.createElement('option');
        opt.value = doc.name;
        opt.textContent = doc.name;
        doctorSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = "General Hospital Staff";
      opt.textContent = "General Hospital Staff (No specific doctor available)";
      doctorSelect.appendChild(opt);
    }
  }

  // Populate static fallback doctors in dropdown
  function populateStaticDoctors() {
    const doctorSelect = document.querySelector('#form_preferred_doctor');
    if (!doctorSelect) return;
    doctorSelect.innerHTML = `
      <option value="" disabled selected>Select preferred doctor</option>
      <option value="Dr. Nataraj R. Rao">Dr. Nataraj R. Rao (Medicine)</option>
      <option value="Dr. Anitha N. Rao">Dr. Anitha N. Rao (Gynaecology)</option>
      <option value="Dr. Bhagwan B. K.">Dr. Bhagwan B. K. (Paediatrics)</option>
      <option value="Dr. Rajesh Bhakta">Dr. Rajesh Bhakta (General Surgery)</option>
      <option value="Dr. Sania Sabahi">Dr. Sania Sabahi (Dentistry)</option>
    `;
  }

  // Load Departments and Doctors from Supabase
  async function loadDepartments() {
    if (!supabaseClient) return;
    
    try {
      const { data: doctors, error } = await supabaseClient
        .from('doctors')
        .select('*')
        .order('display_order', { ascending: true });
        
      if (error) throw error;
      if (!doctors || doctors.length === 0) return;

      const grid = document.querySelector('#departments .grid');
      if (!grid) return;

      grid.innerHTML = ''; // Clear skeleton loader
      doctors.forEach(doc => {
        let cardMedia = `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" class="dept-card-icon">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
                <path d="M12 11v6M10 14h4"/>
              </svg>
        `;

        const nameLower = doc.name ? doc.name.toLowerCase() : "";
        const hasCustomImage = doc.image_url || doc.image_path || doc.image;

        if (hasCustomImage) {
          const imgUrl = hasCustomImage.startsWith('http') ? hasCustomImage : `${SUPABASE_ASSETS_BUCKET_URL}/${hasCustomImage}`;
          cardMedia = `<img src="${imgUrl}" alt="${doc.name}" class="dept-card-img" />`;
        } else if (nameLower.includes("sania sabahi")) {
          cardMedia = `<img src="${SUPABASE_ASSETS_BUCKET_URL}/sania-sabahi.jpeg" alt="${doc.name}" class="dept-card-img" />`;
        } else if (nameLower.includes("rajesh bhakta")) {
          cardMedia = `<img src="${SUPABASE_ASSETS_BUCKET_URL}/rajesh%20bhakta.jpeg" alt="${doc.name}" class="dept-card-img" />`;
        } else if (nameLower.includes("bhagwan")) {
          cardMedia = `<img src="${SUPABASE_ASSETS_BUCKET_URL}/bhagwan.jpeg" alt="${doc.name}" class="dept-card-img" />`;
        } else if (nameLower.includes("nataraj r. rao") || nameLower.includes("nataraj rao")) {
          cardMedia = `<img src="${SUPABASE_ASSETS_BUCKET_URL}/founder.jpeg" alt="${doc.name}" class="dept-card-img" />`;
        } else if (nameLower.includes("anita n. rao") || nameLower.includes("anitha n. rao") || nameLower.includes("anita rao") || nameLower.includes("anitha rao")) {
          cardMedia = `<img src="${SUPABASE_ASSETS_BUCKET_URL}/co-founder.png" alt="${doc.name}" class="dept-card-img" />`;
        }

        grid.innerHTML += `
          <div class="dept-card">
            <div class="dept-card-icon-wrapper">
              ${cardMedia}
            </div>
            <div class="dept-card-content">
              <span class="dept-badge">${doc.department}</span>
              <h3 class="dept-card-title">${doc.name}</h3>
              <p class="dept-card-edu">${doc.education}</p>
              <p class="dept-card-desc">${doc.description || ''}</p>
            </div>
          </div>
        `;
      });
    } catch (err) {
      console.warn("Failed to load departments from Supabase, keeping static html content:", err);
    }
  }

  // Load checkup packages from Supabase
  async function loadPackages() {
    if (!supabaseClient) return;

    try {
      const { data: packages, error } = await supabaseClient
        .from('packages')
        .select('*')
        .order('price', { ascending: false });

      if (error) throw error;
      if (!packages || packages.length === 0) return;

      const grid = document.querySelector('#packages .grid');
      if (!grid) return;

      grid.innerHTML = ''; // Clear loading indicators
      
      // We highlight the middle card by placing 'featured' class on it
      packages.forEach((pkg, index) => {
        const isFeatured = index === 1; // Middle item of 3
        const listItems = (pkg.features || []).map(f => `<li>${f}</li>`).join('');
        const displayPrice = pkg.price ? pkg.price.replace('?', '₹') : '';
        const displayLocation = pkg.location ? pkg.location.replace(/[^\x00-\x7F]+/g, ' · ').replace('Adarsha Hospital', 'ADARSH HOSPITAL') : 'ADARSH HOSPITAL · Koppa 577126';
        
        grid.innerHTML += `
          <div class="pkg-card ${isFeatured ? 'featured' : ''}">
            <p class="pkg-loc">${displayLocation}</p>
            <h3>${pkg.name}</h3>
            <p class="price">${displayPrice}</p>
            <ul>
              ${listItems}
            </ul>
            <a href="packages.html" class="btn btn-primary btn-block">Details & Booking</a>
          </div>
        `;
      });
    } catch (err) {
      console.warn("Failed to load packages from Supabase, keeping static html content:", err);
    }
  }

  // --- Mobile Navigation ---
  function initMobileNav() {
    const toggleBtn = document.getElementById('mobile-nav-toggle');
    const navMenu = document.querySelector('.nav');
    const overlay = document.getElementById('mobile-nav-overlay');
    
    if (!toggleBtn || !navMenu || !overlay) return;
    
    function toggleMenu() {
      const isActive = navMenu.classList.toggle('active');
      toggleBtn.classList.toggle('active');
      overlay.classList.toggle('active');
      
      // Prevent body scroll when menu is active
      if (isActive) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    
    function closeMenu() {
      navMenu.classList.remove('active');
      toggleBtn.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });
    
    overlay.addEventListener('click', closeMenu);
    
    // Close menu when clicking navigation links
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });
    
    // Close menu when clicking ESC key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    });
  }
  
  // --- Scroll-Triggered Animations ---
  function initScrollAnimations() {
    const animItems = document.querySelectorAll('.animate-on-scroll');
    if (animItems.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1
    });

    animItems.forEach(item => {
      observer.observe(item);
    });
  }
  
  // --- Ambulance Carousel ---
  function initAmbulanceCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    let currentSlide = 0;
    
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');
    
    function showSlide(index) {
      slides.forEach(slide => slide.classList.remove('active'));
      currentSlide = (index + slides.length) % slides.length;
      slides[currentSlide].classList.add('active');
    }
    
    if (prevBtn && nextBtn) {
      prevBtn.onclick = (e) => { e.preventDefault(); showSlide(currentSlide - 1); };
      nextBtn.onclick = (e) => { e.preventDefault(); showSlide(currentSlide + 1); };
    }
    
    // Auto-slide every 5 seconds
    setInterval(() => {
      showSlide(currentSlide + 1);
    }, 5000);
  }

  // --- Dropdown Click Toggle for Mobile & Desktop Touch ---
  function initDropdown() {
    const dropdown = document.querySelector('.nav-item-dropdown');
    const trigger = document.querySelector('.dropdown-trigger');
    
    if (!dropdown || !trigger) return;
    
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });
    
    // Close dropdown when clicking anywhere else
    document.addEventListener('click', () => {
      dropdown.classList.remove('active');
    });
  }

  // Initialize mobile navigation
  initMobileNav();

  // Run Supabase initialization
  initSupabase().finally(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
    initScrollAnimations();
    initAmbulanceCarousel();
    initDropdown();
  });
})();
