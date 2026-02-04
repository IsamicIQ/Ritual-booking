// Schedule page — weekly calendar with time slot selection

class ScheduleManager {
    constructor() {
        this.currentWeekStart = this.getMonday(new Date());
        this.slots = [];
        this.classes = [];
        this.filter = 'all';
        this.init();
    }

    getMonday(d) {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    async init() {
        await this.loadClasses();
        await this.loadSlots();
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        document.getElementById('prevWeek').addEventListener('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
            this.render();
        });
        document.getElementById('nextWeek').addEventListener('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
            this.render();
        });
        document.getElementById('classFilter').addEventListener('change', (e) => {
            this.filter = e.target.value;
            this.render();
        });

        // Modal
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('bookingModal').addEventListener('click', (e) => {
            if (e.target.id === 'bookingModal') this.closeModal();
        });
        document.getElementById('bookingForm').addEventListener('submit', (e) => this.handleBooking(e));
    }

    async loadClasses() {
        try {
            const { data, error } = await window.supabaseClient
                .from('classes')
                .select('id, name')
                .eq('active', true);
            if (error) throw error;
            this.classes = data || [];

            const select = document.getElementById('classFilter');
            this.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error('Error loading classes:', err);
        }
    }

    async loadSlots() {
        try {
            const { data, error } = await window.supabaseClient
                .from('time_slots')
                .select('*, classes(id, name, price_single, price_intro, price_monthly, price_3month, price_pack_5, price_pack_8, price_pack_10, price_pack_12, price_member, price_non_member, price_bundle_fire_ice, price_bundle_pilates_plunge, max_capacity)')
                .eq('active', true);
            if (error) throw error;
            this.slots = data || [];
        } catch (err) {
            console.error('Error loading time slots:', err);
        }
        document.getElementById('scheduleLoading').style.display = 'none';
    }

    getDateForDayOfWeek(dayOfWeek) {
        const date = new Date(this.currentWeekStart);
        // day_of_week: 0=Sun, 1=Mon... currentWeekStart is Monday (1)
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        date.setDate(date.getDate() + diff);
        return date;
    }

    formatTime(timeStr) {
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    }

    getFilteredSlots() {
        let filtered = this.slots;
        if (this.filter !== 'all') {
            filtered = filtered.filter(s => s.class_id === this.filter);
        }
        return filtered;
    }

    async getSpotsRemaining(slotId, date) {
        const dateStr = date.toISOString().split('T')[0];
        try {
            const { count, error } = await window.supabaseClient
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('time_slot_id', slotId)
                .eq('booking_date', dateStr)
                .neq('status', 'cancelled');
            if (error) return null;
            return count;
        } catch {
            return null;
        }
    }

    render() {
        const filtered = this.getFilteredSlots();
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const dayNums = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0

        // Week label
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        document.getElementById('weekLabel').textContent = `${fmt(this.currentWeekStart)} - ${fmt(weekEnd)}`;

        // Desktop grid
        const grid = document.getElementById('calendarGrid');
        let html = '<div class="calendar-header">';
        days.forEach((day, i) => {
            const date = this.getDateForDayOfWeek(dayNums[i]);
            const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            html += `<div class="calendar-day-header"><strong>${day}</strong><br><small>${dateStr}</small></div>`;
        });
        html += '</div><div class="calendar-body">';

        days.forEach((day, i) => {
            const dow = dayNums[i];
            const date = this.getDateForDayOfWeek(dow);
            const dateStr = date.toISOString().split('T')[0];
            const daySlots = filtered
                .filter(s => s.day_of_week === dow)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));

            html += '<div class="calendar-day-col">';
            if (daySlots.length === 0) {
                html += '<div class="no-slots">No classes</div>';
            } else {
                daySlots.forEach(slot => {
                    const className = slot.classes?.name || 'Class';
                    const capacity = slot.classes?.max_capacity || 20;
                    html += `
                        <div class="slot-card" data-slot-id="${slot.id}" data-class-id="${slot.class_id}" data-date="${dateStr}" data-time="${slot.start_time}" data-class-name="${className}">
                            <div class="slot-class">${className}</div>
                            <div class="slot-time">${this.formatTime(slot.start_time)} - ${this.formatTime(slot.end_time)}</div>
                            <div class="slot-instructor">${slot.instructor_name || ''}</div>
                            <div class="slot-spots">${capacity} spots</div>
                        </div>`;
                });
            }
            html += '</div>';
        });
        html += '</div>';
        grid.innerHTML = html;

        // Mobile day list
        const dayList = document.getElementById('dayList');
        let mobileHtml = '';
        days.forEach((day, i) => {
            const dow = dayNums[i];
            const date = this.getDateForDayOfWeek(dow);
            const dateStr = date.toISOString().split('T')[0];
            const dateFmt = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
            const daySlots = filtered
                .filter(s => s.day_of_week === dow)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));

            if (daySlots.length > 0) {
                mobileHtml += `<div class="day-section"><h3 class="day-title">${dateFmt}</h3>`;
                daySlots.forEach(slot => {
                    const className = slot.classes?.name || 'Class';
                    const capacity = slot.classes?.max_capacity || 20;
                    mobileHtml += `
                        <div class="slot-card" data-slot-id="${slot.id}" data-class-id="${slot.class_id}" data-date="${dateStr}" data-time="${slot.start_time}" data-class-name="${className}">
                            <div class="slot-class">${className}</div>
                            <div class="slot-time">${this.formatTime(slot.start_time)} - ${this.formatTime(slot.end_time)}</div>
                            <div class="slot-instructor">${slot.instructor_name || ''}</div>
                            <div class="slot-spots">${capacity} spots</div>
                        </div>`;
                });
                mobileHtml += '</div>';
            }
        });
        dayList.innerHTML = mobileHtml;

        const hasSlots = filtered.some(s => dayNums.includes(s.day_of_week));
        document.getElementById('scheduleEmpty').style.display = hasSlots ? 'none' : 'block';

        // Attach click handlers to slot cards
        document.querySelectorAll('.slot-card').forEach(card => {
            card.addEventListener('click', () => this.openModal(card.dataset));
        });
    }

    openModal(data) {
        const modal = document.getElementById('bookingModal');
        document.getElementById('slotClassId').value = data.classId;
        document.getElementById('slotDate').value = data.date;
        document.getElementById('slotTime').value = data.time;
        document.getElementById('slotTimeSlotId').value = data.slotId;
        document.getElementById('modalSlotInfo').textContent =
            `${data.className} — ${new Date(data.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${this.formatTime(data.time)}`;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('bookingModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('bookingForm').reset();
        document.getElementById('bookingForm').style.display = '';
        document.getElementById('bookingSuccess').style.display = 'none';
    }

    async handleBooking(e) {
        e.preventDefault();
        const form = document.getElementById('bookingForm');
        const fd = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const classId = fd.get('class_id');
        const packageType = fd.get('package') || 'single';

        // Look up price
        let pricePaid = 0;
        const slot = this.slots.find(s => s.class_id === classId);
        if (slot && slot.classes) {
            const priceMap = {
                single: 'price_single', intro: 'price_intro', monthly: 'price_monthly',
                '3month': 'price_3month', pack_5: 'price_pack_5', pack_8: 'price_pack_8',
                pack_10: 'price_pack_10', pack_12: 'price_pack_12', member: 'price_member',
                non_member: 'price_non_member', bundle_fire_ice: 'price_bundle_fire_ice',
                bundle_pilates_plunge: 'price_bundle_pilates_plunge'
            };
            pricePaid = slot.classes[priceMap[packageType]] || slot.classes.price_single || 0;
        }

        const bookingData = {
            customer_name: fd.get('name'),
            customer_email: fd.get('email'),
            customer_phone: fd.get('phone'),
            class_id: classId,
            time_slot_id: fd.get('time_slot_id'),
            booking_date: fd.get('date'),
            booking_time: fd.get('time'),
            package_type: packageType,
            special_requests: fd.get('notes') || null,
            status: 'confirmed',
            price_paid: pricePaid,
            payment_status: 'pending'
        };

        try {
            const { data, error } = await window.supabaseClient
                .from('bookings')
                .insert([bookingData])
                .select()
                .single();

            if (error) throw error;

            // Send confirmation email
            if (window.EmailService) {
                await window.EmailService.sendBookingConfirmation({
                    ...bookingData,
                    id: data.id,
                    class_name: document.getElementById('modalSlotInfo').textContent.split(' — ')[0]
                });
            }

            form.style.display = 'none';
            document.getElementById('bookingSuccess').style.display = 'block';

            // Redirect to payment
            setTimeout(() => {
                window.location.href = `payment.html?booking_id=${data.id}`;
            }, 1500);
        } catch (err) {
            console.error('Booking error:', err);
            alert('Error saving booking. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm Booking';
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ScheduleManager());
} else {
    new ScheduleManager();
}
