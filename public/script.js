// script.js — frontend-only logic using localStorage
// Keys:
//   clinic_staff_users  => array of staff {id,name,hospital,mobile,email,password}
//   clinic_logged_staff => id of logged staff
//   clinic_doctors      => array of doctors {id,name,specialization,in,out,avg}
//   clinic_appointments => array of appointments {id,patient, mobile, doctorId, date, time, note}

(function(){
  // helpers
  function idGen(prefix){ return prefix + '_' + Date.now().toString(36).slice(-6); }
  function q(id){ return document.querySelector(id); }
  function qAll(sel){ return Array.from(document.querySelectorAll(sel)); }
  function get(key){ return JSON.parse(localStorage.getItem(key) || '[]'); }
  function set(key,val){ localStorage.setItem(key, JSON.stringify(val)); }

  // ensure default arrays exist
  if(!localStorage.getItem('clinic_staff_users')) set('clinic_staff_users', []);
  if(!localStorage.getItem('clinic_doctors')) set('clinic_doctors', []);
  if(!localStorage.getItem('clinic_appointments')) set('clinic_appointments', []);

  // Simple "hash" replacement for password in demo (DO NOT use in production)
  function simpleHash(str){ return btoa(str).slice(0, 40); }

  // ---------- AUTH: register + login
  const registerForm = q('#registerForm');
  if(registerForm){
    registerForm.addEventListener('submit', function(e){
      e.preventDefault();
      const name = q('#regName').value.trim();
      const hospital = q('#regHospital').value.trim();
      const mobile = q('#regMobile').value.trim();
      const email = q('#regEmail').value.trim().toLowerCase();
      const password = q('#regPassword').value;
      const users = get('clinic_staff_users');

      if(users.find(u => u.email === email)){
        const a = q('#regAlert'); a.textContent = 'Email already registered'; a.classList.remove('d-none'); return;
      }
      const user = {
        id: idGen('staff'),
        name, hospital, mobile, email,
        password: simpleHash(password)
      };
      users.push(user); set('clinic_staff_users', users);
      // clear and close modal
      registerForm.reset();
      const modal = bootstrap.Modal.getInstance(q('#registerModal'));
      if(modal) modal.hide();
      alert('Registered successfully. Please login.');
    });
  }

  const loginForm = q('#loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', function(e){
      e.preventDefault();
      const email = q('#loginEmail').value.trim().toLowerCase();
      const password = q('#loginPassword').value;
      const users = get('clinic_staff_users');
      const user = users.find(u => u.email === email && u.password === simpleHash(password));
      const alertEl = q('#loginAlert');
      if(!user){ alertEl.textContent = 'Invalid email or password'; alertEl.classList.remove('d-none'); return; }
      alertEl.classList.add('d-none');
      localStorage.setItem('clinic_logged_staff', user.id);
      // go to dashboard
      location.href = 'dashboard.html';
    });
  }

  // ---------- DASHBOARD: show basic stats and name
  if(q('#navStaffName') || q('#welcomeTitle')){
    const loggedId = localStorage.getItem('clinic_logged_staff');
    if(!loggedId){ location.href = 'staff.html'; return; }
    const users = get('clinic_staff_users');
    const me = users.find(u => u.id === loggedId);
    if(me){
      const nameShort = me.name.split(' ')[0] || me.name;
      if(q('#navStaffName')) q('#navStaffName').textContent = nameShort;
      if(q('#welcomeTitle')) q('#welcomeTitle').textContent = `Welcome, ${me.name}`;
      if(q('#welcomeSub')) q('#welcomeSub').textContent = `${me.hospital} • ${me.email}`;
    }
    // stats
    const docs = get('clinic_doctors'); const appts = get('clinic_appointments');
    if(q('#statDoctors')) q('#statDoctors').textContent = docs.length;
    if(q('#statAppointments')) q('#statAppointments').textContent = appts.length;
    const logoutBtn = q('#logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', function(){ localStorage.removeItem('clinic_logged_staff'); location.href='staff.html'; });
  }

  // ---------- DOCTORS: list and add
  function renderDoctorsTable(){
    const arr = get('clinic_doctors');
    const tbody = q('#doctorsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(arr.length === 0){
      q('#noDoctors').classList.remove('d-none');
      return;
    } else q('#noDoctors').classList.add('d-none');

    arr.forEach((d,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${d.name}</td>
        <td>${d.specialization}</td>
        <td>${d.in} - ${d.out}</td>
        <td>${d.avg}</td>
        <td>
          <button class="btn btn-sm btn-danger btn-del" data-id="${d.id}" title="Delete">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    qAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', function(){
        if(!confirm('Delete this doctor?')) return;
        const id = this.getAttribute('data-id');
        const list = get('clinic_doctors').filter(x=>x.id!==id);
        set('clinic_doctors', list);
        renderDoctorsTable();
        if(location.pathname.endsWith('dashboard.html') || location.pathname.endsWith('/')) {
          // update stats if on dashboard
          const st = q('#statDoctors'); if(st) st.textContent = list.length;
        }
      });
    });
  }
  if(q('#doctorsTable')) renderDoctorsTable();

  const addDoctorForm = q('#addDoctorForm');
  if(addDoctorForm){
    addDoctorForm.addEventListener('submit', function(e){
      e.preventDefault();
      const name = q('#docName').value.trim();
      const spec = q('#docSpec').value.trim();
      const tin = q('#docIn').value;
      const tout = q('#docOut').value;
      const avg = q('#docAvg').value;
      if(!name || !spec){ q('#addDocAlert').textContent='Please enter required fields'; q('#addDocAlert').classList.remove('d-none'); return; }
      const doctors = get('clinic_doctors');
      const doc = { id: idGen('doc'), name, specialization: spec, in: tin, out: tout, avg: Number(avg) };
      doctors.push(doc); set('clinic_doctors', doctors);
      addDoctorForm.reset();
      bootstrap.Modal.getInstance(q('#addDoctorModal')).hide();
      renderDoctorsTable();
    });
  }

  // ---------- APPOINTMENTS: render and book
  function renderAppointments(){
    const appts = get('clinic_appointments');
    const tbody = q('#appointmentsTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(appts.length === 0){ q('#noAppointments').classList.remove('d-none'); return; } else q('#noAppointments').classList.add('d-none');

    appts.forEach((a,i) => {
      const docs = get('clinic_doctors');
      const doc = docs.find(d=>d.id===a.doctorId) || {name:'—'};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${a.patient} <div class="small text-muted">${a.mobile}</div></td>
        <td>${doc.name}</td>
        <td>${a.date}</td>
        <td>${a.time}</td>
        <td>${a.note || ''}</td>
        <td>
          <button class="btn btn-sm btn-danger btn-del-appt" data-id="${a.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    qAll('.btn-del-appt').forEach(b=>{
      b.addEventListener('click', function(){
        if(!confirm('Delete appointment?')) return;
        const id = this.getAttribute('data-id');
        const arr = get('clinic_appointments').filter(x=>x.id!==id);
        set('clinic_appointments', arr);
        renderAppointments();
      });
    });
  }
  if(q('#appointmentsTable')) renderAppointments();

  // populate doctor select in booking modal
  function populateDoctorSelect(){
    const sel = q('#patDoctor');
    if(!sel) return;
    sel.innerHTML = '';
    const docs = get('clinic_doctors');
    if(docs.length===0) { sel.innerHTML = '<option value="">No doctors available</option>'; return; }
    docs.forEach(d => {
      const opt = document.createElement('option'); opt.value = d.id; opt.textContent = `${d.name} — ${d.specialization}`; sel.appendChild(opt);
    });
  }
  if(q('#bookModal')) q('#bookModal').addEventListener('show.bs.modal', populateDoctorSelect);

  const bookForm = q('#bookForm');
  if(bookForm){
    bookForm.addEventListener('submit', function(e){
      e.preventDefault();
      const patient = q('#patName').value.trim();
      const mobile = q('#patMobile').value.trim();
      const doctorId = q('#patDoctor').value;
      const date = q('#patDate').value;
      const time = q('#patTime').value;
      const note = q('#patNote').value.trim();
      if(!patient || !doctorId || !date || !time){ q('#bookAlert').textContent='Please fill required fields'; q('#bookAlert').classList.remove('d-none'); return; }
      const appts = get('clinic_appointments');
      const a = { id: idGen('apt'), patient, mobile, doctorId, date, time, note };
      appts.push(a); set('clinic_appointments', appts);
      bookForm.reset();
      bootstrap.Modal.getInstance(q('#bookModal')).hide();
      renderAppointments();
    });
  }

  // ---------- PROFILE: display and edit for logged user
  if(q('#pfName') || q('#editProfileForm') || q('#changePwdForm')){
    const loggedId = localStorage.getItem('clinic_logged_staff');
    if(!loggedId){ /* not logged, redirect to staff portal */ if(location.pathname.endsWith('profile.html')) location.href='staff.html'; }
    const users = get('clinic_staff_users');
    const me = users.find(u => u.id === loggedId);
    if(me){
      if(q('#pfName')) q('#pfName').textContent = me.name;
      if(q('#pfHospital')) q('#pfHospital').textContent = me.hospital;
      if(q('#pfEmail')) q('#pfEmail').textContent = me.email;
      if(q('#pfMobile')) q('#pfMobile').textContent = me.mobile;
      // prefill edit form
      if(q('#editName')) q('#editName').value = me.name;
      if(q('#editHospital')) q('#editHospital').value = me.hospital;
      if(q('#editMobile')) q('#editMobile').value = me.mobile;
    }

    const editForm = q('#editProfileForm');
    if(editForm){
      editForm.addEventListener('submit', function(e){
        e.preventDefault();
        const name = q('#editName').value.trim();
        const hospital = q('#editHospital').value.trim();
        const mobile = q('#editMobile').value.trim();
        if(!name){ q('#editAlert').textContent='Name required'; q('#editAlert').classList.remove('d-none'); return; }
        const users = get('clinic_staff_users');
        const idx = users.findIndex(u=>u.id===loggedId);
        if(idx>=0){
          users[idx].name = name; users[idx].hospital = hospital; users[idx].mobile = mobile;
          set('clinic_staff_users', users);
        }
        bootstrap.Modal.getInstance(q('#editProfileModal')).hide();
        location.reload();
      });
    }

    const changeForm = q('#changePwdForm');
    if(changeForm){
      changeForm.addEventListener('submit', function(e){
        e.preventDefault();
        const cur = q('#curPwd').value;
        const nw = q('#newPwd').value;
        const users = get('clinic_staff_users');
        const idx = users.findIndex(u=>u.id===loggedId);
        if(idx<0) return;
        if(users[idx].password !== simpleHash(cur)){ q('#pwdAlert').textContent='Current password incorrect'; q('#pwdAlert').classList.remove('d-none'); return; }
        users[idx].password = simpleHash(nw); set('clinic_staff_users', users);
        bootstrap.Modal.getInstance(q('#changePwdModal')).hide();
        alert('Password updated');
      });
    }
  }

  // On doctors or appointments pages populate doctor select when page loads too
  populateDoctorSelect();
  renderDoctorsTable();
  renderAppointments();

})();
