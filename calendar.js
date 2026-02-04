// Calendar booking - days clickable, shows classes + spots remaining
// Only Hot Pilates, Hot Yoga, Reformer

const ALLOWED_CLASSES = ['Hot Pilates', 'Hot Yoga', 'Reformer Pilates', 'Reformer'];

class CalendarManager {
    constructor() {
        this.currentMonth = new Date();
        this.slots = [];
        this.selectedDate = null;
        this.daySlots = [];
        this.init();
    }

    async init() {
        await this.loadSlots();
        this.setupEventListeners();
        this.renderCalendar();
        this.renderDayDetail(null);
    }

    setupEventListeners() {
        document.getElementById('prevMonth')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('nextMonth')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });
        document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('bookingModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'bookingModal') this.closeModal();
        });
        document.getElementById('bookingForm')?.addEventListener('submit', (e) => this.handleBooking(e));
        document.getElementById('successClose')?.addEventListener('click', () => this.closeModal());
    }

    isAllowedClass(name) {
        if (!name) return false;
        const n = name.toLowerCase();
        return n.includes('hot pilates') || n.includes('hot yoga') || n.includes('reformer');
    }

    async loadSlots() {
        try {
            if (!window.supabaseClient) {
                this.slots = this.getFallbackSlots();
                return;
            }
            const { data, error } = await window.supabaseClient
                .from('time_slots')
                .select('*, classes(id, name, max_capacity)')
                .eq('active', true);
            if (error) throw error;
            this.slots = (data || []).filter(s => this.isAllowedClass(s.classes?.name));
        } catch (err) {
            console.error('Error loading slots:', err);
            this.slots = this.getFallbackSlots();
        }
    }

    getFallbackSlots() {
        // Fallback when no Supabase - sample recurring slots
        const base = [
            { id: 'hp1', day_of_week: 1, start_time: '09:00', end_time: '10:00', instructor_name: 'Sarah', classes: { name: 'Hot Pilates', max_capacity: 12 } },
            { id: 'hp2', day_of_week: 1, start_time: '17:30', end_time: '18:30', instructor_name: 'Sarah', classes: { name: 'Hot Pilates', max_capacity: 12 } },
            { id: 'hy1', day_of_week: 1, start_time: '06:30', end_time: '07:30', instructor_name: 'Priya', classes: { name: 'Hot Yoga', max_capacity: 15 } },
            { id: 'rf1', day_of_week: 1, start_time: '10:00', end_time: '11:00', instructor_name: 'Anna', classes: { name: 'Reformer Pilates', max_capacity: 8 } },
            { id: 'hp3', day_of_week: 2, start_time: '09:00', end_time: '10:00', instructor_name: 'Sarah', classes: { name: 'Hot Pilates', max_capacity: 12 } },
            { id: 'rf2', day_of_week: 2, start_time: '07:00', end_time: '08:00', instructor_name: 'Anna', classes: { name: 'Reformer Pilates', max_capacity: 8 } },
            { id: 'hy2', day_of_week: 3, start_time: '18:00', end_time: '19:00', instructor_name: 'Priya', classes: { name: 'Hot Yoga', max_capacity: 15 } },
            { id: 'rf3', day_of_week: 3, start_time: '16:00', end_time: '17:00', instructor_name: 'David', classes: { name: 'Reformer Pilates', max_capacity: 8 } },
            { id: 'hp4', day_of_week: 4, start_time: '09:00', end_time: '10:00', instructor_name: 'Sarah', classes: { name: 'Hot Pilates', max_capacity: 12 } },
            { id: 'rf4', day_of_week: 5, start_time: '10:00', end_time: '11:00', instructor_name: 'Anna', classes: { name: 'Reformer Pilates', max_capacity: 8 } },
            { id: 'hy3', day_of_week: 5, start_time: '06:30', end_time: '07:30', instructor_name: 'Priya', classes: { name: 'Hot Yoga', max_capacity: 15 } },
        ];
        return base;
    }

    async getSpotsRemaining(slotId, dateStr) {
        if (!window.supabaseClient) return null;
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

    formatTime(t) {
        if (!t) return '';
        const [h, m] = String(t).split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m || '00'} ${ampm}`;
    }

    getDayOfWeek(date) {
        return date.getDay();
    }

    getSlotsForDate(date) {
        const dow = this.getDayOfWeek(date);
        return this.slots
            .filter(s => s.day_of_week === dow)
            .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    }

    hasClassesOnDate(date) {
        return this.getSlotsForDate(date).length > 0;
    }

    renderCalendar() {
        const container = document.getElementById('calendarContainer');
        if (!container) return;

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        document.getElementById('calendarMonthLabel').textContent =
            firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let html = '<div class="calendar-days-header">';
        dayNames.forEach(d => { html += `<div class="cal-day-name">${d}</div>`; });
        html += '</div><div class="calendar-days-grid">';

        for (let i = 0; i < startPadding; i++) {
            html += '<div class="cal-day cal-day-empty"></div>';
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateStr = date.toISOString().split('T')[0];
            const hasClasses = this.hasClassesOnDate(date);
            const isPast = date < today;
            const isSelected = this.selectedDate && this.selectedDate.toDateString() === date.toDateString();
            let cls = 'cal-day';
            if (isPast) cls += ' cal-day-past';
            if (hasClasses) cls += ' cal-day-has-classes';
            if (isSelected) cls += ' cal-day-selected';

            const buttonDisabled = isPast ? 'disabled' : '';
            const buttonClass = isPast ? 'btn-check-classes btn-check-disabled' : 'btn-check-classes';

            html += `<div class="${cls}" data-date="${dateStr}" data-has-classes="${hasClasses}">
                <span class="cal-day-number">${d}</span>
                <button class="${buttonClass}" ${buttonDisabled} data-date="${dateStr}" data-has-classes="${hasClasses}">Check available classes</button>
            </div>`;
        }
        html += '</div>';
        container.innerHTML = html;

        // Make entire day cell clickable (for mobile and accessibility)
        container.querySelectorAll('.cal-day[data-date]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-check-classes')) return;
                const dateStr = el.dataset.date;
                const hasClasses = el.dataset.hasClasses === 'true';
                const date = new Date(dateStr + 'T12:00:00');
                if (date < today) return;
                this.selectedDate = date;
                this.renderCalendar();
                if (hasClasses) {
                    this.loadAndShowDayDetail(date);
                } else {
                    this.renderDayDetail(null, date);
                }
            });
        });

        // Button click handler
        container.querySelectorAll('.btn-check-classes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dateStr = btn.dataset.date;
                const hasClasses = btn.dataset.hasClasses === 'true';
                const date = new Date(dateStr + 'T12:00:00');
                if (date < today) return;
                this.selectedDate = date;
                this.renderCalendar();
                if (hasClasses) {
                    this.loadAndShowDayDetail(date);
                } else {
                    this.renderDayDetail(null, date);
                }
            });
        });
    }

    async loadAndShowDayDetail(date) {
        const dateStr = date.toISOString().split('T')[0];
        const slots = this.getSlotsForDate(date);
        const daySlotsWithSpots = [];

        for (const slot of slots) {
            const capacity = slot.classes?.max_capacity || 12;
            let spotsRemaining = capacity;
            if (window.supabaseClient && slot.id) {
                const booked = await this.getSpotsRemaining(slot.id, dateStr);
                if (booked !== null) spotsRemaining = Math.max(0, capacity - booked);
            }
            daySlotsWithSpots.push({ ...slot, spotsRemaining, capacity });
        }

        this.daySlots = daySlotsWithSpots;
        this.renderDayDetail(daySlotsWithSpots, date);
    }

    renderDayDetail(slotsWithSpots, date) {
        const panel = document.getElementById('dayDetailPanel');
        const list = document.getElementById('dayClassesList');
        if (!panel || !list) return;

        if (!date || !slotsWithSpots || slotsWithSpots.length === 0) {
            panel.classList.remove('day-detail-visible');
            list.innerHTML = date
                ? '<p class="no-classes-msg">No Hot Pilates, Hot Yoga, or Reformer classes on this day.</p>'
                : '<p class="no-classes-msg">Click a day to see classes.</p>';
            return;
        }

        panel.classList.add('day-detail-visible');
        const dateFmt = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        document.getElementById('dayDetailTitle').textContent = `Classes on ${dateFmt}`;

        const dateStr = date.toISOString().split('T')[0];
        list.innerHTML = slotsWithSpots.map(slot => {
            const name = slot.classes?.name || 'Class';
            const spots = slot.spotsRemaining;
            const spotsText = spots <= 0 ? 'Full' : `${spots} spot${spots !== 1 ? 's' : ''} remaining`;
            return `
                <div class="day-class-card" data-slot-id="${slot.id}" data-class-id="${slot.class_id}" data-date="${dateStr}" data-time="${slot.start_time}" data-class-name="${name}">
                    <div class="day-class-info">
                        <span class="day-class-name">${name}</span>
                        <span class="day-class-time">${this.formatTime(slot.start_time)} – ${this.formatTime(slot.end_time)}</span>
                        <span class="day-class-instructor">${slot.instructor_name || ''}</span>
                    </div>
                    <div class="day-class-spots ${spots <= 0 ? 'spots-full' : ''}">${spotsText}</div>
                    <button class="btn-primary btn-book-slot" ${spots <= 0 ? 'disabled' : ''}>Book</button>
                </div>`;
        }).join('');

        list.querySelectorAll('.day-class-card').forEach(card => {
            const btn = card.querySelector('.btn-book-slot');
            if (btn) {
                if (!btn.disabled && window.supabaseClient) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.openModal(card.dataset);
                    });
                } else if (!window.supabaseClient) {
                    btn.title = 'Configure database to book';
                }
            }
        });
    }

    openModal(data) {
        const modal = document.getElementById('bookingModal');
        document.getElementById('slotClassId').value = data.classId || '';
        document.getElementById('slotDate').value = data.date || '';
        document.getElementById('slotTime').value = data.time || '';
        document.getElementById('slotTimeSlotId').value = data.slotId || '';
        document.getElementById('modalSlotInfo').textContent =
            `${data.className || 'Class'} — ${new Date(data.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${this.formatTime(data.time)}`;
        document.getElementById('bookingForm').style.display = '';
        document.getElementById('bookingSuccess').style.display = 'none';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('bookingModal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('bookingForm')?.reset();
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
        let pricePaid = 0;
        const slot = this.slots.find(s => s.class_id === classId);
        if (slot?.classes) {
            const priceMap = {
                single: 'price_single', intro: 'price_intro', monthly: 'price_monthly',
                '3month': 'price_3month', pack_5: 'price_pack_5', pack_8: 'price_pack_8',
                pack_10: 'price_pack_10', pack_12: 'price_pack_12'
            };
            pricePaid = slot.classes[priceMap[packageType]] || slot.classes.price_single || 0;
        }

        const bookingData = {
            customer_name: fd.get('name'),
            customer_email: fd.get('email'),
            customer_phone: fd.get('phone'),
            class_id: classId,
            time_slot_id: fd.get('time_slot_id') || null,
            booking_date: fd.get('date'),
            booking_time: fd.get('time'),
            package_type: packageType,
            special_requests: fd.get('notes') || null,
            status: 'confirmed',
            price_paid: pricePaid,
            payment_status: 'pending'
        };

        try {
            if (!window.supabaseClient) {
                throw new Error('Database not configured');
            }
            const { data, error } = await window.supabaseClient
                .from('bookings')
                .insert([bookingData])
                .select()
                .single();
            if (error) throw error;

            if (window.EmailService) {
                await window.EmailService.sendBookingConfirmation({
                    ...bookingData,
                    id: data.id,
                    class_name: document.getElementById('modalSlotInfo').textContent.split(' — ')[0]
                });
            }

            form.style.display = 'none';
            document.getElementById('bookingSuccess').style.display = 'block';
            setTimeout(() => {
                this.closeModal();
                if (this.selectedDate) this.loadAndShowDayDetail(this.selectedDate);
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
    document.addEventListener('DOMContentLoaded', () => { window.calendarManager = new CalendarManager(); });
} else {
    window.calendarManager = new CalendarManager();
}
