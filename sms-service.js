// SMS Notification Service for Ritual Studio
// Sends booking notifications to studio owner via Africa's Talking

const SMS_CONFIG = {
    // Supabase Edge Function URL for sending SMS (keeps API keys secure)
    edgeFunctionUrl: '', // e.g. https://your-project.supabase.co/functions/v1/send-sms
    // Studio owner phone number to receive booking notifications
    studioPhone: '+254728780654'
};

class SMSService {
    static formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m || '00'} ${ampm}`;
    }

    static formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    static buildMessage(booking) {
        const lines = [
            `NEW BOOKING - Ritual Studio`,
            ``,
            `Client: ${booking.customer_name}`,
            `Phone: ${booking.customer_phone}`,
            ``,
            `Class: ${booking.class_name || 'Class'}`,
            `Date: ${this.formatDate(booking.booking_date)}`,
            `Time: ${this.formatTime(booking.booking_time)}`,
            `Package: ${booking.package_type || 'single'}`
        ];

        if (booking.price_paid) {
            lines.push(`Amount: KES ${booking.price_paid.toLocaleString()}`);
        }

        if (booking.special_requests) {
            lines.push(``);
            lines.push(`Notes: ${booking.special_requests}`);
        }

        return lines.join('\n');
    }

    static async sendBookingNotification(booking) {
        const message = this.buildMessage(booking);

        console.log('SMS Notification:', message);

        // If edge function not configured, log the message (demo mode)
        if (!SMS_CONFIG.edgeFunctionUrl) {
            console.warn('SMS Edge Function not configured - message would be sent to', SMS_CONFIG.studioPhone);
            console.log('Message content:', message);
            return { success: true, demo: true };
        }

        try {
            const response = await fetch(SMS_CONFIG.edgeFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: SMS_CONFIG.studioPhone,
                    message: message
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('SMS notification sent successfully');
                return { success: true };
            } else {
                console.error('SMS sending failed:', result.error);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('SMS service error:', error);
            return { success: false, error: error.message };
        }
    }
}

window.SMSService = SMSService;
