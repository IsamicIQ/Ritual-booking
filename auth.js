// Authentication functionality with Supabase

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Check for existing session
        await this.checkSession();
        
        // Listen for auth state changes (wait for client to be ready)
        const setupAuthListener = () => {
            if (window.supabaseClient) {
                window.supabaseClient.auth.onAuthStateChange((_event, session) => {
                    this.currentUser = session?.user || null;
                    this.updateUI();
                });
            } else {
                setTimeout(setupAuthListener, 200);
            }
        };
        setupAuthListener();
    }

    async checkSession() {
        try {
            // Wait for supabaseClient to be available
            if (!window.supabaseClient) {
                // Retry after a short delay
                setTimeout(() => this.checkSession(), 200);
                return;
            }
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            this.currentUser = session?.user || null;
            
            // Load user profile if logged in
            if (this.currentUser) {
                await this.loadUserProfile();
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }

    async loadUserProfile() {
        try {
            if (!window.supabaseClient || !this.currentUser) return;
            
            // Try to get user profile
            const { data: profile, error } = await window.supabaseClient
                .from('user_profiles')
                .select('full_name, phone')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && profile) {
                this.currentUser.profile = profile;
            }
        } catch (error) {
            // Profile table might not exist yet, that's okay
            console.log('Profile not found (this is okay if migration not run yet)');
        }
    }

    updateUI() {
        const authSection = document.getElementById('authSection');
        const userSection = document.getElementById('userSection');
        const loginModal = document.getElementById('loginModal');
        const signupModal = document.getElementById('signupModal');

        if (this.currentUser) {
            // User is logged in
            if (authSection) authSection.style.display = 'none';
            if (userSection) {
                userSection.style.display = 'flex';
                const userName = userSection.querySelector('#userName');
                if (userName) {
                    // Display name from profile if available, otherwise email
                    const displayName = this.currentUser.profile?.full_name || 
                                      this.currentUser.user_metadata?.name || 
                                      this.currentUser.email || 
                                      'User';
                    userName.textContent = displayName;
                }
            }
            // Close modals if open
            if (loginModal) loginModal.classList.remove('active');
            if (signupModal) signupModal.classList.remove('active');
        } else {
            // User is not logged in
            if (authSection) authSection.style.display = 'flex';
            if (userSection) userSection.style.display = 'none';
        }
    }

    async signUp(email, password, name, phone) {
        try {
            if (!window.supabaseClient) {
                return { success: false, message: 'Supabase client not initialized. Please refresh the page.' };
            }
            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name,
                        phone: phone
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                this.currentUser = data.user;
                this.updateUI();
                return { success: true, message: 'Account created successfully! Please check your email to verify your account.' };
            }
        } catch (error) {
            console.error('Sign up error:', error);
            return { success: false, message: error.message || 'Error creating account' };
        }
    }

    async signIn(email, password) {
        try {
            if (!window.supabaseClient) {
                return { success: false, message: 'Supabase client not initialized. Please refresh the page.' };
            }
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (data.user) {
                this.currentUser = data.user;
                this.updateUI();
                return { success: true, message: 'Logged in successfully!' };
            }
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, message: error.message || 'Error signing in' };
        }
    }

    async signOut() {
        try {
            if (!window.supabaseClient) {
                return { success: false, message: 'Supabase client not initialized.' };
            }
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            this.updateUI();
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, message: error.message };
        }
    }

    getUser() {
        return this.currentUser;
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
