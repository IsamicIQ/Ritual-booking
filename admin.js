(function () {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    function formatTime(t) {
        if (!t) return '';
        const [h, m] = String(t).split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${m || '00'} ${ampm}`;
    }

    function showGate(message, isError) {
        const gate = document.getElementById('adminGate');
        const msgEl = document.getElementById('adminGateMessage');
        if (!gate || !msgEl) return;
        msgEl.textContent = message;
        msgEl.style.color = isError ? '#9b5a5a' : '#6b766b';
    }

    function checkAccess() {
        if (!window.authManager) {
            showGate('Authentication not loaded. Refresh the page.', true);
            return;
        }
        const user = window.authManager.getUser();
        if (!user) {
            showGate('Please log in to access the admin area.', true);
            document.getElementById('adminContent').style.display = 'none';
            return;
        }
        if (!window.authManager.isAdmin(user)) {
            showGate('You do not have permission to access the admin area.', true);
            document.getElementById('adminContent').style.display = 'none';
            return;
        }
        document.getElementById('adminGate').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        initAdmin();
    }

    function initAdmin() {
        setupAuthListeners();
        loadClasses();
        loadSlots();
        populateSlotClassSelect();
        populateAdminBookingClassSelect();
        setupClassForm();
        setupSlotForm();
        setupAdminBookingForm();
        setupCancelSearchForm();
    }

    function setupAuthListeners() {
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            document.getElementById('loginModal').classList.add('active');
        });
        document.getElementById('signupBtn')?.addEventListener('click', () => {
            document.getElementById('signupModal').classList.add('active');
        });
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await window.authManager.signOut();
        });
        document.getElementById('loginModalClose')?.addEventListener('click', () => {
            document.getElementById('loginModal').classList.remove('active');
        });
        document.getElementById('signupModalClose')?.addEventListener('click', () => {
            document.getElementById('signupModal').classList.remove('active');
        });
        document.getElementById('switchToSignup')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginModal').classList.remove('active');
            document.getElementById('signupModal').classList.add('active');
        });
        document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signupModal').classList.remove('active');
            document.getElementById('loginModal').classList.add('active');
        });
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            const result = await window.authManager.signIn(email, password);
            if (result.success) {
                document.getElementById('loginModal').classList.remove('active');
                document.getElementById('loginForm').reset();
                errorDiv.style.display = 'none';
                checkAccess();
            } else {
                errorDiv.textContent = result.message;
                errorDiv.style.display = 'block';
            }
        });
        document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const phone = document.getElementById('signupPhone').value;
            const password = document.getElementById('signupPassword').value;
            const errorDiv = document.getElementById('signupError');
            const successDiv = document.getElementById('signupSuccess');
            const result = await window.authManager.signUp(email, password, name, phone);
            if (result.success) {
                successDiv.textContent = result.message;
                successDiv.style.display = 'block';
                errorDiv.style.display = 'none';
                document.getElementById('signupForm').reset();
                setTimeout(() => {
                    document.getElementById('signupModal').classList.remove('active');
                    successDiv.style.display = 'none';
                    checkAccess();
                }, 2000);
            } else {
                errorDiv.textContent = result.message;
                errorDiv.style.display = 'block';
                successDiv.style.display = 'none';
            }
        });
        window.addEventListener('authChanged', () => checkAccess());
    }

    async function loadClasses() {
        if (!window.supabaseClient) return;
        try {
            const { data, error } = await window.supabaseClient
                .from('classes')
                .select('*')
                .order('name');
            if (error) throw error;
            window.__adminClasses = data || [];
            renderClassesTable();
            populateSlotClassSelect();
            populateAdminBookingClassSelect();
        } catch (err) {
            console.error('Load classes error:', err);
            window.__adminClasses = [];
            renderClassesTable();
        }
    }

    function renderClassesTable() {
        const tbody = document.getElementById('classesTableBody');
        const table = document.getElementById('classesTable');
        const empty = document.getElementById('classesTableEmpty');
        if (!tbody || !table || !empty) return;
        const classes = window.__adminClasses || [];
        if (classes.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            tbody.innerHTML = '';
            return;
        }
        empty.style.display = 'none';
        table.style.display = 'table';
        tbody.innerHTML = classes.map(c => `
            <tr>
                <td>${escapeHtml(c.name)}</td>
                <td>${c.max_capacity != null ? c.max_capacity : '—'}</td>
                <td>${c.active ? 'Yes' : 'No'}</td>
                <td style="text-align:right;">
                    <button type="button" class="btn-outline btn-small" data-edit-class="${c.id}">Edit</button>
                </td>
            </tr>
        `).join('');
        tbody.querySelectorAll('[data-edit-class]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-edit-class');
                const c = (window.__adminClasses || []).find(x => x.id === id);
                if (!c) return;
                document.getElementById('classId').value = c.id;
                document.getElementById('className').value = c.name || '';
                document.getElementById('classDescription').value = c.description || '';
                document.getElementById('classCapacity').value = c.max_capacity != null ? c.max_capacity : '';
                document.getElementById('classActive').checked = c.active !== false;
            });
        });
    }

    function populateSlotClassSelect() {
        const sel = document.getElementById('slotClassSelect');
        if (!sel) return;
        const classes = window.__adminClasses || [];
        const firstId = sel.getAttribute('data-first-id');
        sel.innerHTML = '<option value="">Select class</option>' + classes.map(c =>
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('');
        if (firstId) sel.value = firstId;
    }

    function populateAdminBookingClassSelect() {
        const sel = document.getElementById('adminBookingClass');
        if (!sel) return;
        const classes = window.__adminClasses || [];
        sel.innerHTML = '<option value="">Select class</option>' + classes.map(c =>
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('');
    }

    function setupClassForm() {
        document.getElementById('classForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('classId').value;
            const name = document.getElementById('className').value.trim();
            const description = document.getElementById('classDescription').value.trim();
            const capacity = document.getElementById('classCapacity').value;
            const active = document.getElementById('classActive').checked;
            if (!name) return;
            const payload = {
                name,
                description: description || null,
                max_capacity: capacity ? parseInt(capacity, 10) : null,
                active
            };
            try {
                if (id) {
                    const { error } = await window.supabaseClient.from('classes').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await window.supabaseClient.from('classes').insert([payload]);
                    if (error) throw error;
                }
                document.getElementById('classId').value = '';
                document.getElementById('classForm').reset();
                document.getElementById('classActive').checked = true;
                await loadClasses();
            } catch (err) {
                console.error(err);
                alert('Error saving class: ' + (err.message || 'Unknown error'));
            }
        });
    }

    async function loadSlots() {
        if (!window.supabaseClient) return;
        try {
            const { data, error } = await window.supabaseClient
                .from('time_slots')
                .select('*, classes(id, name, price_single, price_intro, price_monthly, price_3month, price_pack_5, price_pack_8, price_pack_10, price_pack_12)')
                .order('day_of_week')
                .order('start_time');
            if (error) throw error;
            window.__adminSlots = data || [];
            renderSlotsTable();
        } catch (err) {
            console.error('Load slots error:', err);
            window.__adminSlots = [];
            renderSlotsTable();
        }
    }

    function renderSlotsTable() {
        const tbody = document.getElementById('slotsTableBody');
        const table = document.getElementById('slotsTable');
        const empty = document.getElementById('slotsTableEmpty');
        if (!tbody || !table || !empty) return;
        const slots = window.__adminSlots || [];
        if (slots.length === 0) {
            empty.style.display = 'block';
            table.style.display = 'none';
            tbody.innerHTML = '';
            return;
        }
        empty.style.display = 'none';
        table.style.display = 'table';
        tbody.innerHTML = slots.map(s => {
            const className = s.classes?.name || '—';
            const day = DAY_NAMES[s.day_of_week] ?? `Day ${s.day_of_week}`;
            const time = `${formatTime(s.start_time)} – ${formatTime(s.end_time)}`;
            return `
                <tr>
                    <td>${escapeHtml(className)}</td>
                    <td>${day}</td>
                    <td>${time}</td>
                    <td>${escapeHtml(s.instructor_name || '—')}</td>
                    <td>${s.active ? 'Yes' : 'No'}</td>
                    <td style="text-align:right;">
                        <button type="button" class="btn-outline btn-small" data-edit-slot="${s.id}">Edit</button>
                    </td>
                </tr>
            `;
        }).join('');
        tbody.querySelectorAll('[data-edit-slot]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-edit-slot');
                const s = (window.__adminSlots || []).find(x => x.id === id);
                if (!s) return;
                document.getElementById('slotId').value = s.id;
                document.getElementById('slotClassSelect').value = s.class_id;
                document.getElementById('slotDayOfWeek').value = String(s.day_of_week);
                document.getElementById('slotStartTime').value = s.start_time || '';
                document.getElementById('slotEndTime').value = s.end_time || '';
                document.getElementById('slotInstructor').value = s.instructor_name || '';
                document.getElementById('slotActive').checked = s.active !== false;
            });
        });
    }

    function setupSlotForm() {
        document.getElementById('slotForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('slotId').value;
            const classId = document.getElementById('slotClassSelect').value;
            const dayOfWeek = parseInt(document.getElementById('slotDayOfWeek').value, 10);
            const startTime = document.getElementById('slotStartTime').value;
            const endTime = document.getElementById('slotEndTime').value;
            const instructor = document.getElementById('slotInstructor').value.trim();
            const active = document.getElementById('slotActive').checked;
            if (!classId || isNaN(dayOfWeek) || !startTime || !endTime) return;
            const payload = {
                class_id: classId,
                day_of_week: dayOfWeek,
                start_time: startTime,
                end_time: endTime,
                instructor_name: instructor || null,
                active
            };
            try {
                if (id) {
                    const { error } = await window.supabaseClient.from('time_slots').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await window.supabaseClient.from('time_slots').insert([payload]);
                    if (error) throw error;
                }
                document.getElementById('slotId').value = '';
                document.getElementById('slotForm').reset();
                document.getElementById('slotActive').checked = true;
                await loadSlots();
            } catch (err) {
                console.error(err);
                alert('Error saving time slot: ' + (err.message || 'Unknown error'));
            }
        });
    }

    document.getElementById('adminBookingClass')?.addEventListener('change', () => {
        const classId = document.getElementById('adminBookingClass').value;
        const dateStr = document.getElementById('adminBookingDate').value;
        if (!classId || !dateStr) return;
        updateAdminBookingSlots(classId, dateStr);
    });
    document.getElementById('adminBookingDate')?.addEventListener('change', () => {
        const classId = document.getElementById('adminBookingClass').value;
        const dateStr = document.getElementById('adminBookingDate').value;
        if (!classId || !dateStr) return;
        updateAdminBookingSlots(classId, dateStr);
    });

    function updateAdminBookingSlots(classId, dateStr) {
        const sel = document.getElementById('adminBookingSlot');
        if (!sel) return;
        const slots = (window.__adminSlots || []).filter(s => s.class_id === classId && s.active);
        const date = new Date(dateStr + 'T12:00:00');
        const dow = date.getDay();
        const daySlots = slots.filter(s => s.day_of_week === dow);
        sel.innerHTML = '<option value="">Select time slot</option>' + daySlots.map(s =>
            `<option value="${s.id}">${formatTime(s.start_time)} – ${formatTime(s.end_time)}${s.instructor_name ? ' (' + s.instructor_name + ')' : ''}</option>`
        ).join('');
    }

    function setupAdminBookingForm() {
        document.getElementById('adminBookingForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msgEl = document.getElementById('adminBookingMessage');
            const dateStr = document.getElementById('adminBookingDate').value;
            const classId = document.getElementById('adminBookingClass').value;
            const timeSlotId = document.getElementById('adminBookingSlot').value;
            const name = document.getElementById('adminBookingName').value.trim();
            const email = document.getElementById('adminBookingEmail').value.trim();
            const phone = document.getElementById('adminBookingPhone').value.trim();
            const packageType = document.getElementById('adminBookingPackage').value || 'single';
            const notes = document.getElementById('adminBookingNotes').value.trim();
            const markPaid = document.getElementById('adminBookingPaid').checked;
            if (!dateStr || !classId || !timeSlotId || !name || !email || !phone) {
                msgEl.textContent = 'Please fill all required fields.';
                msgEl.className = 'admin-message error';
                msgEl.style.display = 'block';
                return;
            }
            const slot = (window.__adminSlots || []).find(s => s.id === timeSlotId);
            const startTime = slot ? slot.start_time : '09:00';
            let pricePaid = 0;
            if (slot?.classes) {
                const priceMap = {
                    single: 'price_single', intro: 'price_intro', monthly: 'price_monthly',
                    '3month': 'price_3month', pack_5: 'price_pack_5', pack_8: 'price_pack_8',
                    pack_10: 'price_pack_10', pack_12: 'price_pack_12'
                };
                pricePaid = slot.classes[priceMap[packageType]] || slot.classes.price_single || 0;
            }
            const bookingData = {
                customer_name: name,
                customer_email: email,
                customer_phone: phone,
                class_id: classId,
                time_slot_id: timeSlotId,
                booking_date: dateStr,
                booking_time: startTime,
                package_type: packageType,
                special_requests: notes || null,
                status: 'confirmed',
                price_paid: pricePaid,
                payment_status: markPaid ? 'paid' : 'pending',
                payment_reference: markPaid ? 'admin_' + Date.now() : null
            };
            try {
                const { error } = await window.supabaseClient
                    .from('bookings')
                    .insert([bookingData]);
                if (error) throw error;
                msgEl.textContent = 'Booking created successfully.';
                msgEl.className = 'admin-message success';
                msgEl.style.display = 'block';
                document.getElementById('adminBookingForm').reset();
                document.getElementById('adminBookingPaid').checked = false;
            } catch (err) {
                console.error(err);
                msgEl.textContent = 'Error: ' + (err.message || 'Could not create booking');
                msgEl.className = 'admin-message error';
                msgEl.style.display = 'block';
            }
        });
    }

    function setupCancelSearchForm() {
        document.getElementById('adminCancelSearchForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dateStr = document.getElementById('adminCancelDate').value;
            if (!dateStr) return;
            const container = document.getElementById('adminCancelResults');
            container.innerHTML = '<p style="color:#6b766b;">Loading…</p>';
            try {
                const { data: bookings, error: bookErr } = await window.supabaseClient
                    .from('bookings')
                    .select('*, classes(name)')
                    .eq('booking_date', dateStr)
                    .order('booking_time');
                if (bookErr) throw bookErr;
                const slots = window.__adminSlots || [];
                const date = new Date(dateStr + 'T12:00:00');
                const dow = date.getDay();
                const daySlots = slots.filter(s => s.day_of_week === dow && s.active);
                const confirmed = (bookings || []).filter(b => b.status !== 'cancelled');
                let html = `<p style="margin-bottom:0.75rem;"><strong>${date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>`;
                if (daySlots.length === 0) {
                    html += '<p style="color:#6b766b;">No classes scheduled for this day.</p>';
                } else {
                    for (const slot of daySlots.sort((a, b) => String(a.start_time).localeCompare(b.start_time))) {
                        const slotBookings = confirmed.filter(b => b.time_slot_id === slot.id);
                        const className = slot.classes?.name || 'Class';
                        html += `<div style="margin-bottom:1rem; padding:0.75rem; background:#f8f7f4; border-radius:8px; border:1px solid #e5e3df;">`;
                        html += `<p style="margin:0 0 0.5rem 0; font-weight:600;">${escapeHtml(className)} — ${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}</p>`;
                        if (slotBookings.length === 0) {
                            html += '<p style="margin:0; color:#6b766b; font-size:0.9rem;">No bookings.</p>';
                        } else {
                            html += '<ul style="margin:0; padding-left:1.25rem;">';
                            slotBookings.forEach(b => {
                                html += `<li style="margin:0.25rem 0;">${escapeHtml(b.customer_name)} (${escapeHtml(b.customer_email)}) — ${b.status}
                                    <button type="button" class="btn-outline btn-small btn-danger" style="margin-left:0.5rem;" data-cancel-booking="${b.id}">Cancel this booking</button>
                                </li>`;
                            });
                            html += '</ul>';
                            html += `<button type="button" class="btn-outline btn-small btn-danger" style="margin-top:0.5rem;" data-cancel-slot="${slot.id}" data-date="${dateStr}">Cancel entire class (all bookings)</button>`;
                        }
                        html += '</div>';
                    }
                }
                container.innerHTML = html;
                container.querySelectorAll('[data-cancel-booking]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.getAttribute('data-cancel-booking');
                        if (!confirm('Cancel this booking?')) return;
                        try {
                            const { error } = await window.supabaseClient.from('bookings').update({ status: 'cancelled' }).eq('id', id);
                            if (error) throw error;
                            document.getElementById('adminCancelSearchForm').dispatchEvent(new Event('submit'));
                        } catch (err) {
                            alert('Error: ' + (err.message || 'Could not cancel'));
                        }
                    });
                });
                container.querySelectorAll('[data-cancel-slot]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const slotId = btn.getAttribute('data-cancel-slot');
                        const dateStr = btn.getAttribute('data-date');
                        if (!confirm('Cancel ALL bookings for this class time on this date?')) return;
                        try {
                            const { error } = await window.supabaseClient
                                .from('bookings')
                                .update({ status: 'cancelled' })
                                .eq('time_slot_id', slotId)
                                .eq('booking_date', dateStr);
                            if (error) throw error;
                            document.getElementById('adminCancelSearchForm').dispatchEvent(new Event('submit'));
                        } catch (err) {
                            alert('Error: ' + (err.message || 'Could not cancel'));
                        }
                    });
                });
            } catch (err) {
                console.error(err);
                container.innerHTML = '<p style="color:#9b5a5a;">Error loading bookings. ' + escapeHtml(err.message || '') + '</p>';
            }
        });
    }

    function escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(checkAccess, 300);
        });
    } else {
        setTimeout(checkAccess, 300);
    }
})();
