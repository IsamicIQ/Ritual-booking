// Payment page — M-Pesa STK Push & Stripe integration

// Configuration — replace with your actual keys
const PAYMENT_CONFIG = {
    stripe: {
        publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY'
    },
    mpesa: {
        // M-Pesa STK push goes through a Supabase Edge Function for security
        edgeFunctionUrl: '' // e.g. https://your-project.supabase.co/functions/v1/mpesa-stk-push
    }
};

class PaymentManager {
    constructor() {
        this.booking = null;
        this.bookingId = null;
        this.stripe = null;
        this.cardElement = null;
        this.activeMethod = 'mpesa';
        this.init();
    }

    async init() {
        this.bookingId = new URLSearchParams(window.location.search).get('booking_id');
        if (!this.bookingId) {
            this.showError();
            return;
        }
        await this.loadBooking();
        this.setupEventListeners();
        this.initStripe();
    }

    async loadBooking() {
        try {
            const { data, error } = await window.supabaseClient
                .from('bookings')
                .select('*, classes(name)')
                .eq('id', this.bookingId)
                .single();

            if (error || !data) {
                this.showError();
                return;
            }

            this.booking = data;

            // If already paid, go straight to success
            if (data.payment_status === 'paid') {
                document.getElementById('summaryLoading').style.display = 'none';
                document.getElementById('summaryContent').style.display = '';
                this.populateSummary();
                document.getElementById('paymentMethods').style.display = 'none';
                document.getElementById('paymentSuccess').style.display = 'block';
                return;
            }

            this.populateSummary();
            document.getElementById('summaryLoading').style.display = 'none';
            document.getElementById('summaryContent').style.display = '';
            document.getElementById('paymentMethods').style.display = '';

            // Pre-fill M-Pesa phone from booking
            if (data.customer_phone) {
                let phone = data.customer_phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
                document.getElementById('mpesaPhone').value = phone;
            }
        } catch (err) {
            console.error('Error loading booking:', err);
            this.showError();
        }
    }

    populateSummary() {
        const b = this.booking;
        document.getElementById('sumClass').textContent = b.classes?.name || 'Class';
        document.getElementById('sumDate').textContent = new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        document.getElementById('sumTime').textContent = this.formatTime(b.booking_time);
        document.getElementById('sumPackage').textContent = b.package_type || 'single';
        document.getElementById('sumName').textContent = b.customer_name;
        document.getElementById('sumTotal').textContent = `KES ${(b.price_paid || 0).toLocaleString()}`;
    }

    setupEventListeners() {
        // Payment tabs
        document.querySelectorAll('.payment-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeMethod = tab.dataset.method;
                document.getElementById('mpesaForm').style.display = this.activeMethod === 'mpesa' ? '' : 'none';
                document.getElementById('stripeForm').style.display = this.activeMethod === 'stripe' ? '' : 'none';
            });
        });

        // M-Pesa pay
        document.getElementById('mpesaPay').addEventListener('click', () => this.payMpesa());

        // Stripe pay
        document.getElementById('stripePay').addEventListener('click', () => this.payStripe());

        // Retry
        document.getElementById('retryPayment').addEventListener('click', () => {
            document.getElementById('paymentFailure').style.display = 'none';
            document.getElementById('mpesaForm').style.display = this.activeMethod === 'mpesa' ? '' : 'none';
            document.getElementById('stripeForm').style.display = this.activeMethod === 'stripe' ? '' : 'none';
        });
    }

    initStripe() {
        if (PAYMENT_CONFIG.stripe.publishableKey === 'YOUR_STRIPE_PUBLISHABLE_KEY') {
            console.warn('Stripe not configured — using placeholder');
            return;
        }
        try {
            this.stripe = Stripe(PAYMENT_CONFIG.stripe.publishableKey);
            const elements = this.stripe.elements();
            this.cardElement = elements.create('card', {
                style: {
                    base: {
                        fontSize: '16px',
                        color: '#2d3e2d',
                        fontFamily: 'Inter, sans-serif',
                        '::placeholder': { color: '#6a7a6a' }
                    }
                }
            });
            this.cardElement.mount('#stripeCardElement');
            this.cardElement.on('change', (event) => {
                document.getElementById('stripeError').textContent = event.error ? event.error.message : '';
            });
        } catch (err) {
            console.error('Stripe init error:', err);
        }
    }

    async payMpesa() {
        const phone = document.getElementById('mpesaPhone').value.trim();
        if (!/^254\d{9}$/.test(phone)) {
            alert('Please enter a valid phone number in format 254XXXXXXXXX');
            return;
        }

        this.showProcessing();

        if (!PAYMENT_CONFIG.mpesa.edgeFunctionUrl) {
            // Demo mode — simulate success after delay
            console.warn('M-Pesa Edge Function not configured — simulating payment');
            setTimeout(() => this.onPaymentSuccess('MPESA_DEMO_' + Date.now()), 3000);
            return;
        }

        try {
            const response = await fetch(PAYMENT_CONFIG.mpesa.edgeFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    amount: this.booking.price_paid,
                    booking_id: this.bookingId,
                    account_reference: `Ritual-${this.bookingId.slice(0, 8)}`
                })
            });

            const result = await response.json();
            if (result.success) {
                // STK push sent — poll for payment confirmation
                this.pollMpesaStatus(result.checkout_request_id);
            } else {
                this.onPaymentFailure(result.message || 'M-Pesa request failed');
            }
        } catch (err) {
            console.error('M-Pesa error:', err);
            this.onPaymentFailure('Network error. Please try again.');
        }
    }

    async pollMpesaStatus(checkoutRequestId) {
        // Poll for up to 60 seconds
        let attempts = 0;
        const maxAttempts = 12;
        const poll = async () => {
            attempts++;
            try {
                const { data, error } = await window.supabaseClient
                    .from('bookings')
                    .select('payment_status, payment_reference')
                    .eq('id', this.bookingId)
                    .single();

                if (data && data.payment_status === 'paid') {
                    this.onPaymentSuccess(data.payment_reference);
                    return;
                }
            } catch (err) { /* continue polling */ }

            if (attempts < maxAttempts) {
                setTimeout(poll, 5000);
            } else {
                this.onPaymentFailure('Payment confirmation timed out. If money was deducted, please contact us.');
            }
        };
        setTimeout(poll, 5000);
    }

    async payStripe() {
        if (!this.stripe || !this.cardElement) {
            // Demo mode
            console.warn('Stripe not configured — simulating payment');
            this.showProcessing();
            setTimeout(() => this.onPaymentSuccess('STRIPE_DEMO_' + Date.now()), 2000);
            return;
        }

        this.showProcessing();

        try {
            // In production, create a PaymentIntent on the server and confirm here
            // For now, use token-based flow as example
            const { token, error } = await this.stripe.createToken(this.cardElement);
            if (error) {
                this.onPaymentFailure(error.message);
                return;
            }

            // Send token to your backend / Supabase Edge Function to charge
            // For demo purposes, treat as success
            this.onPaymentSuccess('STRIPE_' + token.id);
        } catch (err) {
            this.onPaymentFailure(err.message || 'Payment processing error');
        }
    }

    async onPaymentSuccess(reference) {
        try {
            await window.supabaseClient
                .from('bookings')
                .update({ payment_status: 'paid', payment_reference: reference })
                .eq('id', this.bookingId);
        } catch (err) {
            console.error('Error updating payment status:', err);
        }

        document.getElementById('paymentProcessing').style.display = 'none';
        document.getElementById('mpesaForm').style.display = 'none';
        document.getElementById('stripeForm').style.display = 'none';
        document.getElementById('paymentSuccess').style.display = 'block';

        // Update My Bookings link with email
        const link = document.querySelector('#paymentSuccess a');
        if (link && this.booking) {
            link.href = `my-bookings.html?email=${encodeURIComponent(this.booking.customer_email)}`;
        }
    }

    onPaymentFailure(reason) {
        document.getElementById('paymentProcessing').style.display = 'none';
        document.getElementById('failureReason').textContent = reason;
        document.getElementById('paymentFailure').style.display = 'block';
    }

    showProcessing() {
        document.getElementById('mpesaForm').style.display = 'none';
        document.getElementById('stripeForm').style.display = 'none';
        document.getElementById('paymentFailure').style.display = 'none';
        document.getElementById('paymentProcessing').style.display = 'flex';
    }

    showError() {
        document.getElementById('summaryLoading').style.display = 'none';
        document.getElementById('paymentError').style.display = 'block';
    }

    formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PaymentManager());
} else {
    new PaymentManager();
}
