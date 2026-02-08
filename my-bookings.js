// My Bookings — lookup by email, view & cancel bookings

class MyBookingsManager {
    constructor() {
        this.email = '';
        this.cancelBookingId = null;
        this.init();
    }

    init() {
        document.getElementById('emailLookup').addEventListener('submit', (e) => {
            e.preventDefault();
            this.email = document.getElementById('lookupEmail').value.trim();
            this.loadBookings();
        });

        document.getElementById('changeEmail').addEventListener('click', () => {
            document.getElementById('lookupForm').style.display = '';
            document.getElementById('bookingsResults').style.display = 'none';
        });

        // Cancel modal
        document.getElementById('cancelModalClose').addEventListener('click', () => this.closeCancelModal());
        document.getElementById('cancelNo').addEventListener('click', () => this.closeCancelModal());
        document.getElementById('cancelYes').addEventListener('click', () => this.confirmCancel());
        document.getElementById('cancelModal').addEventListener('click', (e) => {
            if (e.target.id === 'cancelModal') this.closeCancelModal();
        });

        // Check URL params for pre-filled email
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        if (emailParam) {
            document.getElementById('lookupEmail').value = emailParam;
            this.email = emailParam;
            this.loadBookings();
        }
    }

    async loadBookings() {
        document.getElementById('lookupForm').style.display = 'none';
        document.getElementById('bookingsLoading').style.display = 'block';
        document.getElementById('bookingsResults').style.display = 'none';

        try {
            const { data, error } = await window.supabaseClient
                .from('bookings')
                .select('*, classes(name)')
                .eq('customer_email', this.email)
                .order('booking_date', { ascending: false });

            if (error) throw error;

            document.getElementById('bookingsLoading').style.display = 'none';
            document.getElementById('bookingsResults').style.display = 'block';
            document.getElementById('resultsTitle').textContent = `Bookings for ${this.email}`;

            if (!data || data.length === 0) {
                document.getElementById('noBookings').style.display = 'block';
                document.getElementById('upcomingSection').style.display = 'none';
                document.getElementById('pastSection').style.display = 'none';
                return;
            }

            document.getElementById('noBookings').style.display = 'none';
            const today = new Date().toISOString().split('T')[0];
            const upcoming = data.filter(b => b.booking_date >= today && b.status !== 'cancelled');
            const past = data.filter(b => b.booking_date < today || b.status === 'cancelled');

            this.renderList('upcomingList', upcoming, true);
            this.renderList('pastList', past, false);

            document.getElementById('upcomingSection').style.display = upcoming.length ? '' : 'none';
            document.getElementById('pastSection').style.display = past.length ? '' : 'none';
        } catch (err) {
            console.error('Error loading bookings:', err);
            document.getElementById('bookingsLoading').style.display = 'none';
            alert('Error loading bookings. Please try again.');
            document.getElementById('lookupForm').style.display = '';
        }
    }

    renderList(containerId, bookings, showCancel) {
        const container = document.getElementById(containerId);
        const today = new Date().toISOString().split('T')[0];
        container.innerHTML = bookings.map(b => {
            const className = b.classes?.name || 'Class';
            const date = new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const time = this.formatTime(b.booking_time);
            const statusClass = b.status === 'cancelled' ? 'status-cancelled' : b.status === 'confirmed' ? 'status-confirmed' : 'status-default';
            const paymentBadge = b.payment_status === 'paid'
                ? '<span class="badge badge-paid">Paid</span>'
                : '<span class="badge badge-pending">Payment Pending</span>';
            const isSameDay = b.booking_date === today;
            const canCancel = showCancel && !isSameDay;

            return `
                <div class="booking-card">
                    <div class="booking-card-header">
                        <span class="booking-class">${className}</span>
                        <span class="booking-status ${statusClass}">${b.status}</span>
                    </div>
                    <div class="booking-card-body">
                        <div class="booking-detail"><strong>Date:</strong> ${date}</div>
                        <div class="booking-detail"><strong>Time:</strong> ${time}</div>
                        <div class="booking-detail"><strong>Package:</strong> ${b.package_type || 'single'}</div>
                        <div class="booking-detail"><strong>Price:</strong> KES ${(b.price_paid || 0).toLocaleString()}</div>
                        <div class="booking-detail">${paymentBadge}</div>
                    </div>
                    ${canCancel ? `<div class="booking-card-footer"><button class="btn-outline btn-cancel" data-id="${b.id}" data-class="${className}" data-date="${date}">Cancel Booking</button></div>` : ''}
                    ${showCancel && isSameDay ? `<div class="booking-card-footer"><span style="color:#6b766b;font-size:0.9rem;">Same-day cancellations are not allowed</span></div>` : ''}
                </div>`;
        }).join('');

        // Attach cancel handlers
        container.querySelectorAll('.btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                this.cancelBookingId = btn.dataset.id;
                document.getElementById('cancelInfo').textContent =
                    `Are you sure you want to cancel your ${btn.dataset.class} booking on ${btn.dataset.date}?`;
                document.getElementById('cancelModal').classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        });
    }

    closeCancelModal() {
        document.getElementById('cancelModal').classList.remove('active');
        document.body.style.overflow = '';
        this.cancelBookingId = null;
    }

    async confirmCancel() {
        if (!this.cancelBookingId) return;
        const btn = document.getElementById('cancelYes');
        btn.disabled = true;
        btn.textContent = 'Cancelling...';

        try {
            const { error } = await window.supabaseClient
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', this.cancelBookingId);

            if (error) throw error;

            this.closeCancelModal();
            await this.loadBookings();
        } catch (err) {
            console.error('Cancel error:', err);
            alert('Error cancelling booking. Please try again.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Cancel It';
        }
    }

    formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${m} ${ampm}`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new MyBookingsManager());
} else {
    new MyBookingsManager();
}
