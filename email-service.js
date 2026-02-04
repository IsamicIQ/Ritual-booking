// EmailJS Configuration and Service
// Replace these with your actual EmailJS credentials
const EMAILJS_CONFIG = {
    serviceId: 'YOUR_EMAILJS_SERVICE_ID',
    templateId: 'YOUR_EMAILJS_TEMPLATE_ID',
    publicKey: 'YOUR_EMAILJS_PUBLIC_KEY'
};

class EmailService {
    static initialized = false;

    static init() {
        if (this.initialized || typeof emailjs === 'undefined') return;
        emailjs.init(EMAILJS_CONFIG.publicKey);
        this.initialized = true;
    }

    static async sendBookingConfirmation(booking) {
        this.init();
        if (typeof emailjs === 'undefined') {
            console.warn('EmailJS SDK not loaded, skipping email');
            return { success: false, reason: 'sdk_not_loaded' };
        }

        const templateParams = {
            to_name: booking.customer_name,
            to_email: booking.customer_email,
            class_name: booking.class_name || 'Class',
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            package_type: booking.package_type || 'single',
            price: booking.price_paid ? `KES ${booking.price_paid.toLocaleString()}` : 'TBD',
            booking_id: booking.id || ''
        };

        try {
            const response = await emailjs.send(
                EMAILJS_CONFIG.serviceId,
                EMAILJS_CONFIG.templateId,
                templateParams
            );
            console.log('Confirmation email sent:', response.status);
            return { success: true };
        } catch (error) {
            console.error('Failed to send confirmation email:', error);
            return { success: false, reason: error.text || error.message };
        }
    }
}

window.EmailService = EmailService;
