// Booking functionality with Supabase integration

class BookingManager {
    constructor() {
        this.modal = document.getElementById('bookingModal');
        this.form = document.getElementById('bookingForm');
        this.success = document.getElementById('bookingSuccess');
        this.classSelect = document.getElementById('bookingClass');
        this.dateInput = document.getElementById('bookingDate');
        this.timeInput = document.getElementById('bookingTime');
        this.packageSelect = document.getElementById('bookingPackage');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadClasses();
    }

    setupEventListeners() {
        // Close buttons
        document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('successClose')?.addEventListener('click', () => this.closeModal());
        
        // Close on overlay click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Form submit
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Wire up all booking buttons
        document.querySelectorAll('.btn-primary').forEach((btn) => {
            const text = btn.textContent.trim();
            const dataClass = btn.getAttribute('data-class');
            
            if (dataClass) {
                btn.addEventListener('click', () => this.openModal(dataClass));
            } else if (text === 'Book Now' || text === 'Book A Class') {
                btn.addEventListener('click', () => this.openModal(''));
            }
        });
    }

    async loadClasses() {
        try {
            if (!window.supabaseClient) {
                console.warn('Supabase client not ready, retrying...');
                setTimeout(() => this.loadClasses(), 500);
                return;
            }
            const { data: classes, error } = await window.supabaseClient
                .from('classes')
                .select('id, name')
                .eq('active', true);

            if (error) {
                console.error('Error loading classes:', error);
                // Keep hardcoded options as fallback
                return;
            }

            // Populate class select dropdown with database classes
            if (classes && classes.length > 0 && this.classSelect) {
                // Clear existing options
                this.classSelect.innerHTML = '<option value="" disabled selected>Select a class</option>';
                
                classes.forEach(classItem => {
                    const option = document.createElement('option');
                    option.value = classItem.id;
                    option.textContent = classItem.name;
                    this.classSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading classes:', error);
            // Keep hardcoded options as fallback
        }
    }

    openModal(classType) {
        if (!this.modal) return;
        
        // Check if user is authenticated
        const user = window.authManager?.getUser();
        if (!user) {
            // Show login modal instead
            alert('Please login or sign up to book a class.');
            document.getElementById('loginModal')?.classList.add('active');
            return;
        }
        
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        if (classType && this.classSelect) {
            // Find option by text content (works with both IDs and names)
            const options = Array.from(this.classSelect.options);
            const option = options.find(opt => 
                opt.textContent.toLowerCase().includes(classType.toLowerCase())
            );
            if (option) {
                this.classSelect.value = option.value;
            }
        }

        // Set minimum date to today
        if (this.dateInput) {
            const today = new Date().toISOString().split('T')[0];
            this.dateInput.min = today;
        }

        // Pre-fill email if user is logged in
        if (user && this.form) {
            const emailInput = this.form.querySelector('#bookingEmail');
            if (emailInput && user.email) {
                emailInput.value = user.email;
            }
        }
    }

    closeModal() {
        if (!this.modal) return;
        
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.form?.reset();
        if (this.form) this.form.style.display = '';
        if (this.success) this.success.style.display = 'none';
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.form) return;

        const formData = new FormData(this.form);
        const bookingData = {
            customer_name: formData.get('name'),
            customer_email: formData.get('email'),
            customer_phone: formData.get('phone'),
            class_id: formData.get('class'),
            booking_date: formData.get('date'),
            booking_time: formData.get('time'),
            package_type: formData.get('package') || 'single',
            special_requests: formData.get('notes') || null,
            status: 'confirmed',
            payment_status: 'pending'
        };

        // Validate required fields
        if (!bookingData.customer_name || !bookingData.customer_email || 
            !bookingData.customer_phone || !bookingData.class_id || 
            !bookingData.booking_date || !bookingData.booking_time) {
            alert('Please fill in all required fields');
            return;
        }

        // Get class price based on package type
        // First, check if class_id is a UUID (from database) or a class name (fallback)
        let classId = bookingData.class_id;
        let classData = null;

        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not initialized');
            }
            // Try to find class by ID first (UUID)
            let query = window.supabaseClient
                .from('classes')
                .select('*');

            // Check if it's a UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(classId)) {
                query = query.eq('id', classId);
            } else {
                // It's a class name, find by name
                query = query.eq('name', classId);
            }

            const { data, error: classError } = await query.single();

            if (classError) {
                console.error('Error fetching class:', classError);
                // Use default price if class not found
                bookingData.price_paid = 0;
            } else if (data) {
                classData = data;
                classId = data.id; // Use the actual UUID
                bookingData.class_id = classId;

                // Map package type to price field
                const priceMap = {
                    'single': 'price_single',
                    'intro': 'price_intro',
                    'monthly': 'price_monthly',
                    '3month': 'price_3month',
                    'pack_5': 'price_pack_5',
                    'pack_8': 'price_pack_8',
                    'pack_10': 'price_pack_10',
                    'pack_12': 'price_pack_12',
                    'member': 'price_member',
                    'non_member': 'price_non_member',
                    'bundle_fire_ice': 'price_bundle_fire_ice',
                    'bundle_pilates_plunge': 'price_bundle_pilates_plunge'
                };

                const priceField = priceMap[bookingData.package_type] || 'price_single';
                bookingData.price_paid = classData[priceField] || classData.price_single || 0;
            }
        } catch (error) {
            console.error('Error getting price:', error);
            bookingData.price_paid = 0; // Default to 0 if price lookup fails
        }

        // Get current user for booking
        const user = window.authManager?.getUser();
        if (user) {
            bookingData.user_id = user.id;
        } else {
            // Should not reach here if modal check works, but just in case
            alert('Please login to make a booking');
            return;
        }

        // Show loading state
        const submitButton = this.form.querySelector('button[type="submit"]');
        const originalText = submitButton?.textContent;
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving...';
        }

        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not initialized');
            }
            // Save booking to Supabase
            const { data, error } = await window.supabaseClient
                .from('bookings')
                .insert([bookingData])
                .select()
                .single();

            if (error) {
                console.error('Error saving booking:', error);
                alert('Error saving booking. Please try again or contact us directly.');
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }
                return;
            }

            // Send confirmation email
            if (window.EmailService) {
                const className = classData ? classData.name : bookingData.class_id;
                await window.EmailService.sendBookingConfirmation({
                    ...bookingData,
                    id: data.id,
                    class_name: className
                });
            }

            // Success!
            if (this.form) this.form.style.display = 'none';
            if (this.success) this.success.style.display = 'block';

            console.log('Booking saved successfully:', data);

            // Redirect to payment page after short delay
            setTimeout(() => {
                window.location.href = `payment.html?booking_id=${data.id}`;
            }, 1500);
        } catch (error) {
            console.error('Error saving booking:', error);
            alert('Error saving booking. Please try again or contact us directly.');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.bookingManager = new BookingManager();
    });
} else {
    window.bookingManager = new BookingManager();
}
