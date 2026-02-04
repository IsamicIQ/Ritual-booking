// Supabase Configuration
// Initialize Supabase client after library loads

(function() {
    // Get Supabase URL and Anon Key
    const SUPABASE_URL = 'https://lqfhgjiwiuolhvxdgwbc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZmhnaml3aXVvbGh2eGRnd2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MjM5NTEsImV4cCI6MjA4NTM5OTk1MX0.aHjttQ-44FQ_wiOaP3v_ngfh8EJy5h-oJ04fmelNLrU';

    // Function to initialize Supabase client
    function initSupabase() {
        // Check if supabase is available (from CDN - it's a global)
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            try {
                window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase client initialized successfully');
            } catch (error) {
                console.error('Error initializing Supabase client:', error);
            }
        } else {
            console.error('Supabase library not loaded yet');
            // Retry after a short delay
            setTimeout(initSupabase, 200);
        }
    }

    // Wait for window to be fully loaded
    if (window.addEventListener) {
        window.addEventListener('load', function() {
            setTimeout(initSupabase, 100);
        });
    } else {
        // Fallback for older browsers
        setTimeout(initSupabase, 500);
    }
})();
