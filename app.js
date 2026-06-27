/**
 * BFS Smart Attendance - App.js
 * Testing & Stabilization Phase - Cleaned, Optimized, Error Handled
 */

const app = {
  state: {
    isOnline: navigator.onLine,
    teacher: null,
    adminSession: null,
    settings: { faceMatchThreshold: 0.45 },
    currentAction: null,
    regTarget: null
  },

  async init() {
    this.setupNetworkListeners();
    this.updateClock();
    setInterval(() => this.updateClock(), 60000);

    // Fetch initial settings without blocking the app shell.
    this.callBackend('getInitialData', {})
      .then(initRes => {
        if (initRes.status === 'success' && initRes.data) {
          this.state.settings.faceMatchThreshold = initRes.data.faceMatchThreshold;
        }
      })
      .catch(() => {});

    setTimeout(() => {
      // Always initialize face models in the background
      if (typeof faceAuth !== "undefined" && faceAuth.init) faceAuth.init();

      // Check Admin Session first
      const savedAdmin = sessionStorage.getItem('bfs_admin');
      if (savedAdmin) {
        this.state.adminSession = JSON.parse(savedAdmin);
        this.loadAdminData();
        return;
      }

      // Check Teacher
      const savedTeacher = localStorage.getItem('bfs_teacher');
      if (savedTeacher) {
        this.state.teacher = JSON.parse(savedTeacher);
        this.routeBasedOnProfile();
      } else {
        this.showView('view-login');
      }
    }, 800);
  },

  // ------------- UI Helpers -------------
  showToast(message, type = "error") {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        padding: 12px 24px; border-radius: 8px; color: white; font-weight: 600;
        z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s;
        text-align: center; max-width: 90%;
      `;
      document.body.appendChild(toast);
    }
    toast.style.background = type === "error" ? "#e74c3c" : "#2ecc71";
    toast.textContent = message;
    toast.style.opacity = "1";
    
    setTimeout(() => { toast.style.opacity = "0"; }, 4000);
  },

  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
  },

  setupNetworkListeners() {
    const badge = document.getElementById('network-status');
    const badgeText = badge.querySelector('.status-text');
    const badgeIcon = badge.querySelector('.material-icons-round');

    const updateStatus = () => {
      this.state.isOnline = navigator.onLine;
      if (this.state.isOnline) {
        badge.className = 'status-badge online'; badgeText.textContent = 'Online'; badgeIcon.textContent = 'wifi';
        if (typeof offlineDb !== "undefined" && offlineDb.syncPendingRecords) offlineDb.syncPendingRecords();
      } else {
        badge.className = 'status-badge offline'; badgeText.textContent = 'Offline'; badgeIcon.textContent = 'wifi_off';
      }
    };
    window.addEventListener('online', updateStatus); window.addEventListener('offline', updateStatus); updateStatus(); 
  },

  updateClock() {
    const now = new Date();
    const el = document.getElementById('current-time-display');
    if(el) el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  // ------------- Teacher Login -------------
  login() {
    const btn = document.getElementById('btn-login');
    const idInput = document.getElementById('teacher-id-input').value.trim();
    if (!idInput) { this.showToast("Please enter a Teacher ID."); return; }

    btn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div>`;
    btn.disabled = true;

    this.callBackend('getTeacherProfile', { teacherId: idInput })
      .then(res => {
        if (res.status === 'success') {
          this.state.teacher = res.data;
          localStorage.setItem('bfs_teacher', JSON.stringify(res.data));
          this.routeBasedOnProfile();
        } else this.showToast("Login failed: " + res.message);
      })
      .catch(err => this.showToast("Cannot verify ID while offline. Connect to internet."))
      .finally(() => { btn.innerHTML = `Continue <span class="material-icons-round">arrow_forward</span>`; btn.disabled = false; });
  },

  routeBasedOnProfile() {
    if (!this.state.teacher.faceRegistered) {
      this.showToast("Teacher face not registered. Please contact your Admin.", "error");
      this.showView('view-login');
      localStorage.removeItem('bfs_teacher');
    } else {
      document.getElementById('display-teacher-name').textContent = this.state.teacher.name || this.state.teacher.teacherId;
      document.getElementById('display-school-name').textContent = this.state.teacher.schoolCode;
      this.showView('view-dashboard');
    }
  },

  // ------------- Admin Auth -------------
  showAdminLogin() { this.showView('view-admin-login'); },
  
  async adminLogin() {
    const id = document.getElementById('admin-id-input').value;
    const pass = document.getElementById('admin-pass-input').value;
    if(!id || !pass) return this.showToast("Please enter Admin ID and Password.");

    const btn = document.getElementById('btn-admin-login');
    btn.disabled = true; btn.textContent = "Verifying...";
    
    try {
      const res = await this.callBackend('adminLogin', { username: id, password: pass });
      if (res.status === 'success') {
        this.state.adminSession = res.data;
        sessionStorage.setItem('bfs_admin', JSON.stringify(res.data));
        this.loadAdminData();
      } else { 
        this.showToast("Login failed: " + res.message); 
      }
    } catch(e) { 
      this.showToast("Login failed: " + e.message); 
    }
    btn.disabled = false; btn.textContent = "Login";
  },

  adminLogout() {
    sessionStorage.removeItem('bfs_admin');
    this.state.adminSession = null;
    this.showView('view-login');
  },

  async loadAdminData() {
    this.showView('view-loading');
    document.getElementById('admin-role-display').textContent = `${this.state.adminSession.role} (${this.state.adminSession.schoolCode})`;
    
    const btnImport = document.getElementById('btn-import-wizard');
    if(btnImport) btnImport.style.display = this.state.adminSession.role === 'Principal' ? 'none' : 'inline-block';
    
    try {
      const res = await this.callBackend('getAdminFaceData', {
        adminId: this.state.adminSession.adminId,
        adminToken: this.state.adminSession.token,
        role: this.state.adminSession.role,
        schoolCode: this.state.adminSession.schoolCode
      });
      
      if(res.status === 'success') {
        const tbody = document.getElementById('admin-teacher-list');
        let html = '';
        res.data.forEach(t => {
          const statusHtml = t.isRegistered ? `<span class="status-chip chip-present">Registered (v${t.version})</span>` : `<span class="status-chip chip-absent">Not Registered</span>`;
          const actBtn = t.isRegistered 
            ? `<button onclick="app.startAdminRegistration('${t.teacherId}', '${t.teacherName}')" class="btn outline-btn small-btn">Re-Reg</button>
               <button onclick="app.deleteFace('${t.teacherId}')" class="btn outline-btn small-btn" style="color:red; border-color:red;">Del</button>`
            : `<button onclick="app.startAdminRegistration('${t.teacherId}', '${t.teacherName}')" class="btn primary-btn small-btn">Register</button>`;
          
          html += `<tr>
            <td><strong>${t.teacherName}</strong><br><small>${t.teacherId}</small></td>
            <td>${statusHtml}</td>
            <td style="display:flex; gap:4px; flex-wrap:wrap;">${actBtn}</td>
          </tr>`;
        });
        tbody.innerHTML = html;
        this.showView('view-admin-dashboard');
      } else {
        this.showToast(res.message);
        this.adminLogout();
      }
    } catch(e) { this.showToast(e.message); this.adminLogout(); }
  },

  async deleteFace(teacherId) {
    if(!confirm(`Are you sure you want to delete face data for ${teacherId}?`)) return;
    const res = await this.callBackend('deleteFace', {
      adminId: this.state.adminSession.adminId,
      adminToken: this.state.adminSession.token,
      teacherId: teacherId
    });
    if(res.status === 'success') this.loadAdminData();
    else this.showToast(res.message);
  },

  // ------------- Admin Registration -------------
  async startAdminRegistration(tId, tName) {
    this.state.regTarget = { id: tId, name: tName };
    document.getElementById('reg-target-name').textContent = tName;
    this.showView('view-registration');
    try {
      await faceAuth.startCamera('video-reg', 'overlay-reg');
      await this.loadCameras('camera-select-reg');
      faceAuth.beginRegistrationLoop();
    } catch(err) { 
      if (err.message === "Models loading.") {
        this.showToast("Please wait, face recognition models are still loading...", "error");
        this.showView('view-admin-dashboard'); 
      } else {
        document.getElementById('camera-error-text').textContent = err.message;
        this.showView('view-camera-error');
      }
    }
  },

  cancelRegistration() {
    faceAuth.stopCamera();
    this.showView('view-admin-dashboard');
  },

  async completeRegistration(descriptorsObj) {
    document.getElementById('reg-instruction').textContent = "Saving profile...";
    faceAuth.stopCamera();
    
    const res = await this.callBackend('registerFace', {
      adminId: this.state.adminSession.adminId,
      adminToken: this.state.adminSession.token,
      teacherId: this.state.regTarget.id,
      frontDescriptor: JSON.stringify(Array.from(descriptorsObj.front)),
      leftDescriptor: JSON.stringify(Array.from(descriptorsObj.left)),
      rightDescriptor: JSON.stringify(Array.from(descriptorsObj.right))
    });

    if (res.status === 'success') {
      this.showToast("Registration complete!", "success");
      this.loadAdminData();
    } else {
      this.showToast("Failed to save registration: " + res.message);
      this.showView('view-admin-dashboard');
    }
  },

  // ------------- Daily Attendance -------------
  openCamera(actionType) {
    this.state.currentAction = actionType;
    document.getElementById('verify-type-title').textContent = actionType === 'check-in' ? 'Verifying Check In' : 'Verifying Check Out';
    document.querySelectorAll('.check-list li').forEach(li => { li.className = 'pending'; });
    this.showView('view-camera');
    this.startVerificationSequence();
  },

  closeCamera() { faceAuth.stopCamera(); this.showView('view-dashboard'); },

  async loadCameras(selectId) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const select = document.getElementById(selectId);
      if (videoDevices.length === 0) {
        select.innerHTML = '<option value="">No cameras found</option>';
        return null;
      }
      select.innerHTML = videoDevices.map((d, i) => `<option value="${d.deviceId}">${d.label || 'Camera ' + (i+1)}</option>`).join('');
      return select.value;
    } catch(e) { console.error("Camera enum error:", e); return null; }
  },

  async switchCamera(mode) {
    faceAuth.stopCamera();
    try {
      if (mode === 'reg') {
        const deviceId = document.getElementById('camera-select-reg').value;
        await faceAuth.startCamera('video-reg', 'overlay-reg', deviceId);
        faceAuth.beginRegistrationLoop();
      } else {
        const deviceId = document.getElementById('camera-select-teacher').value;
        await faceAuth.startCamera('video-element', 'overlay-canvas', deviceId);
        // The check-in validation loop runs implicitly or we can just let it restart via startVerificationSequence
      }
    } catch(err) {
      this.showToast("Failed to switch camera: " + err.message, "error");
    }
  },

  async startVerificationSequence() {
    try {
      document.getElementById('liveness-instruction').textContent = "Getting location...";
      this.state.location = await this.getGPSLocation();
      document.getElementById('check-gps').className = 'success';
      
      document.getElementById('liveness-instruction').textContent = "Please look clearly at the camera";
      await faceAuth.startCamera('video-element', 'overlay-canvas');
      await this.loadCameras('camera-select-teacher');
      
      const descs = {
        front: new Float32Array(JSON.parse(this.state.teacher.frontDescriptor)),
        left: new Float32Array(JSON.parse(this.state.teacher.leftDescriptor)),
        right: new Float32Array(JSON.parse(this.state.teacher.rightDescriptor))
      };
      faceAuth.beginPassiveValidationLoop(descs, this.state.settings.faceMatchThreshold);
    } catch (e) { 
      faceAuth.stopCamera();
      if (e.message.includes("GPS disabled")) {
        this.showToast(e.message, "error"); 
        this.showView('view-dashboard'); 
      } else if (e.message === "Models loading.") {
        this.showToast("Please wait, face recognition models are still loading...", "error");
        this.showView('view-dashboard'); 
      } else {
        document.getElementById('camera-error-text').textContent = e.message;
        this.showView('view-camera-error');
      }
    }
  },

  getGPSLocation() {
    return new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), 
        e => rej(new Error("GPS disabled. Please turn on Location Services.")), 
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  },

  async finalizeAttendance(score, liveness) {
    document.getElementById('liveness-instruction').textContent = "Submitting...";
    faceAuth.stopCamera();
    document.getElementById('check-face').className = 'success';
    
    const record = {
      actionType: this.state.currentAction,
      teacherId: this.state.teacher.teacherId,
      timestamp: new Date().toISOString(),
      lat: this.state.location.lat, lng: this.state.location.lng,
      faceMatchScore: score, livenessStatus: liveness, isOffline: !this.state.isOnline
    };

    if (this.state.isOnline) {
      try {
        const res = await this.callBackend('submitAttendance', record);
        if (res.status === 'success') {
          this.showToast(res.data.message || "Attendance recorded successfully", "success");
        } else { 
          // Show friendly duplicate message if thrown from backend
          this.showToast(res.message, "error"); 
        }
      } catch(e) { 
        offlineDb.saveRecord(record); 
        this.showToast("Network error. Saved offline.", "success");
      }
    } else {
      offlineDb.saveRecord(record);
      this.showToast("Saved offline. Will sync when internet is restored.", "success");
    }
    
    this.showView('view-dashboard');
  },

  // ------------- Leave & Holiday Management -------------
  async loadTeacherLeaves() {
    this.showView('view-loading');
    try {
      const res = await this.callBackend('getLeavesData', { role: 'Teacher', teacherId: this.state.teacher.teacherId });
      if(res.status === 'success') {
        const tbody = document.getElementById('teacher-leave-history');
        let html = '';
        res.data.leaves.forEach(l => {
          let badgeCls = l.Status.includes('Approved') ? 'status-approved' : l.Status.includes('Rejected') ? 'status-rejected' : l.Status.includes('Cancelled') ? 'status-cancelled' : 'status-pending';
          let cancelBtn = l.Status.includes('Pending') ? `<button onclick="app.cancelLeave('${l.LeaveID}')" class="btn outline-btn small-btn" style="color:red; border-color:red;">Cancel</button>` : '';
          html += `<tr>
            <td>${new Date(l.DateFrom).toLocaleDateString()} to ${new Date(l.DateTo).toLocaleDateString()}</td>
            <td>${l.LeaveType} (${l.TotalDays}d)</td>
            <td><span class="status-badge-leave ${badgeCls}">${l.Status}</span></td>
            <td>${cancelBtn}</td>
          </tr>`;
        });
        tbody.innerHTML = html;
        this.showView('view-teacher-leave');
      } else {
        this.showToast(res.message);
        this.showView('view-dashboard');
      }
    } catch(e) { this.showToast(e.message); this.showView('view-dashboard'); }
  },

  async submitLeave() {
    const type = document.getElementById('leave-type-select').value;
    const dateFrom = document.getElementById('leave-date-from').value;
    const dateTo = document.getElementById('leave-date-to').value;
    const reason = document.getElementById('leave-reason').value;
    
    if(!dateFrom || !dateTo) return this.showToast("Please select dates.");
    
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    const diffTime = d2 - d1;
    if(diffTime < 0) return this.showToast("Date To cannot be before Date From.");
    
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    this.showToast("Submitting...", "success");
    try {
      const res = await this.callBackend('submitLeave', {
        teacherId: this.state.teacher.teacherId,
        teacherName: this.state.teacher.name,
        schoolCode: this.state.teacher.schoolCode,
        schoolName: this.state.teacher.schoolName || this.state.teacher.schoolCode,
        dateFrom: dateFrom, dateTo: dateTo, totalDays: totalDays,
        leaveType: type, reason: reason
      });
      if(res.status === 'success') {
        this.showToast(res.data.message, "success");
        this.loadTeacherLeaves();
      } else { this.showToast(res.message); }
    } catch(e) { this.showToast(e.message); }
  },

  async cancelLeave(leaveId) {
    if(!confirm("Are you sure you want to cancel this request?")) return;
    try {
      const res = await this.callBackend('cancelLeave', { teacherId: this.state.teacher.teacherId, leaveId: leaveId });
      if(res.status === 'success') {
        this.showToast(res.data.message, "success");
        this.loadTeacherLeaves();
      } else { this.showToast(res.message); }
    } catch(e) { this.showToast(e.message); }
  },

  async loadPrincipalLeaves() {
    this.showView('view-loading');
    try {
      const role = this.state.adminSession.role;
      const res = await this.callBackend('getLeavesData', { 
        role: role === 'SuperAdmin' ? 'Admin' : 'Principal', 
        schoolCode: this.state.adminSession.schoolCode 
      });
      
      if(res.status === 'success') {
        if (role === 'SuperAdmin' || role === 'Admin') {
          const tbody = document.getElementById('admin-leave-list');
          let html = '';
          res.data.leaves.forEach(l => {
            html += `<tr>
              <td><strong>${l.SchoolCode}</strong><br><small>${l.TeacherName}</small></td>
              <td>${new Date(l.DateFrom).toLocaleDateString()} to ${new Date(l.DateTo).toLocaleDateString()}</td>
              <td>${l.Status}</td>
              <td>
                <button onclick="app.overrideLeave('${l.LeaveID}', 'Approved')" class="btn outline-btn small-btn" style="color:green; border-color:green;">Approve</button>
                <button onclick="app.overrideLeave('${l.LeaveID}', 'Rejected')" class="btn outline-btn small-btn" style="color:red; border-color:red;">Reject</button>
              </td>
            </tr>`;
          });
          tbody.innerHTML = html;
          this.showView('view-admin-leave');
        } else {
          const tbody = document.getElementById('principal-leave-list');
          let html = '';
          res.data.leaves.forEach(l => {
            let actBtn = l.Status.includes('Pending') 
              ? `<button onclick="app.processLeave('${l.LeaveID}', 'Approved')" class="btn outline-btn small-btn" style="color:green; border-color:green;">Approve</button>
                 <button onclick="app.processLeave('${l.LeaveID}', 'Rejected')" class="btn outline-btn small-btn" style="color:red; border-color:red;">Reject</button>`
              : '';
            html += `<tr>
              <td>${l.TeacherName}</td>
              <td>${new Date(l.DateFrom).toLocaleDateString()} to ${new Date(l.DateTo).toLocaleDateString()}</td>
              <td>${l.LeaveType} (${l.TotalDays}d)</td>
              <td>${l.Status}</td>
              <td style="display:flex; gap:4px; flex-wrap:wrap;">${actBtn}</td>
            </tr>`;
          });
          tbody.innerHTML = html;
          this.showView('view-principal-leave');
        }
      } else {
        this.showToast(res.message);
        this.showView('view-admin-dashboard');
      }
    } catch(e) { this.showToast(e.message); this.showView('view-admin-dashboard'); }
  },

  async processLeave(leaveId, status) {
    const remarks = prompt(`Enter optional remarks for marking this ${status}:`, "");
    if(remarks === null) return;
    try {
      const res = await this.callBackend('processLeave', {
        adminId: this.state.adminSession.adminId,
        adminToken: this.state.adminSession.token,
        schoolCode: this.state.adminSession.schoolCode,
        leaveId: leaveId, status: status, remarks: remarks
      });
      if(res.status === 'success') {
        this.showToast(res.data.message, "success");
        this.loadPrincipalLeaves();
      } else { this.showToast(res.message); }
    } catch(e) { this.showToast(e.message); }
  },

  async overrideLeave(leaveId, status) {
    const remarks = prompt(`ADMIN OVERRIDE: Enter REQUIRED remarks for marking this ${status}:`, "");
    if(!remarks) { this.showToast("Remarks are required for Admin Overrides."); return; }
    try {
      const res = await this.callBackend('overrideLeave', {
        adminId: this.state.adminSession.adminId,
        adminToken: this.state.adminSession.token,
        leaveId: leaveId, status: `Admin Overridden (${status})`, remarks: remarks
      });
      if(res.status === 'success') {
        this.showToast(res.data.message, "success");
        this.loadPrincipalLeaves();
      } else { this.showToast(res.message); }
    } catch(e) { this.showToast(e.message); }
  },

  async manageHoliday() {
    const date = document.getElementById('holiday-date').value;
    const type = document.getElementById('holiday-type').value;
    const desc = document.getElementById('holiday-desc').value;
    if(!date || !desc) return this.showToast("Date and Description are required.");
    try {
      const res = await this.callBackend('manageHoliday', {
        adminId: this.state.adminSession.adminId,
        adminToken: this.state.adminSession.token,
        role: this.state.adminSession.role,
        schoolCode: this.state.adminSession.schoolCode,
        date: date, type: type, description: desc, isWorkingDay: false
      });
      if(res.status === 'success') {
        this.showToast(res.data.message, "success");
        document.getElementById('holiday-date').value = '';
        document.getElementById('holiday-desc').value = '';
      } else { this.showToast(res.message); }
    } catch(e) { this.showToast(e.message); }
  },

  // ------------- Import Wizard -------------
  async importInit() {
    this.showView('view-import-wizard');
    this.importShowStep(1);
    document.querySelector('input[name="import-source-type"][value="internal"]').checked = true;
    this.importToggleSource();
    this.importFetchSheets(); // Auto fetch internal sheets
  },
  
  importToggleSource() {
    const isExternal = document.querySelector('input[name="import-source-type"]:checked').value === 'external';
    document.getElementById('import-source-id').style.display = isExternal ? 'block' : 'none';
  },
  
  async importFetchSheets() {
    const isExternal = document.querySelector('input[name="import-source-type"]:checked').value === 'external';
    const sourceId = isExternal ? document.getElementById('import-source-id').value : '';
    
    if (isExternal && !sourceId) return this.showToast("Please enter a Spreadsheet ID");
    
    const btn = document.getElementById('btn-fetch-sheets');
    btn.disabled = true; btn.textContent = "Fetching...";
    
    try {
      const res = await this.callBackend('getImportableSheets', { 
        adminToken: this.state.adminSession.token,
        sourceSpreadsheetId: sourceId
      });
      if(res.status === 'success') {
        const select = document.getElementById('import-sheet-select');
        select.innerHTML = '<option value="">-- Select Sheet --</option>' + res.data.sheets.map(s => `<option value="${s}">${s}</option>`).join('');
      } else {
        this.showToast(res.message);
      }
    } catch(e) { this.showToast(e.message); }
    
    btn.disabled = false; btn.textContent = "Fetch Source Sheets";
  },

  importShowStep(step) {
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.getElementById('import-step-' + step).classList.add('active');
  },

  async importLoadHeaders() {
    const sourceSheet = document.getElementById('import-sheet-select').value;
    const targetSheet = document.getElementById('import-target-select').value;
    const isExternal = document.querySelector('input[name="import-source-type"]:checked').value === 'external';
    const sourceId = isExternal ? document.getElementById('import-source-id').value : '';
    
    if(!sourceSheet) return this.showToast("Please select a source sheet.");
    
    this.state.importConfig = { sourceSheet, targetSheet, sourceId };
    this.showToast("Loading mapping data...", "success");
    
    try {
      // 1. Get Source Headers
      const resSrc = await this.callBackend('getSheetHeaders', { adminToken: this.state.adminSession.token, sheetName: sourceSheet, sourceSpreadsheetId: sourceId });
      if(resSrc.status !== 'success') return this.showToast(resSrc.message);
      const srcHeaders = resSrc.data.headers;
      
      // 2. Get Target Schema
      const resTgt = await this.callBackend('getTargetSchema', { adminToken: this.state.adminSession.token, targetSheet: targetSheet });
      if(resTgt.status !== 'success') return this.showToast(resTgt.message);
      const tgtHeaders = resTgt.data.headers;
      
      // 3. Get Saved Mapping
      const resM = await this.callBackend('getSavedMapping', { 
        adminToken: this.state.adminSession.token, 
        sourceSpreadsheetId: sourceId,
        sourceSheet: sourceSheet,
        targetSheet: targetSheet
      });
      const savedMap = (resM.status === 'success') ? resM.data.mapping : {};
      let savedUpsertKey = (resM.status === 'success') ? resM.data.upsertKey : '';
      
      // PRESETS INJECTION
      if (Object.keys(savedMap).length === 0 && sourceSheet === "Employees") {
        if (targetSheet === "Teachers") {
          savedMap['TeacherID'] = 'EmployeeID';
          savedMap['TeacherName'] = 'EmployeeName';
          savedMap['SchoolCode'] = 'SchoolCode';
          savedMap['SchoolName'] = 'CampusName';
          savedMap['FatherName'] = 'FatherName';
          savedMap['Designation'] = 'Designation';
          savedMap['Status'] = 'Status';
          savedUpsertKey = 'TeacherID';
        } else if (targetSheet === "Schools") {
          savedMap['SchoolCode'] = 'SchoolCode';
          savedMap['SchoolName'] = 'CampusName';
          savedMap['Status'] = 'Status';
          savedUpsertKey = 'SchoolCode';
        }
      }
      
      // Show/Hide Override container
      const overrideCont = document.getElementById('import-override-container');
      overrideCont.style.display = (targetSheet === "Schools") ? "block" : "none";
      document.getElementById('import-override-rules').checked = false;
      
      // Build Upsert Key Dropdown
      let keyHtml = '<option value="">-- Select Key Column --</option>';
      tgtHeaders.forEach(th => {
        const sel = (savedUpsertKey === th) ? 'selected' : '';
        keyHtml += `<option value="${th}" ${sel}>${th}</option>`;
      });
      document.getElementById('import-upsert-key').innerHTML = keyHtml;
      
      // Build Mapping UI dynamically
      let html = '';
      tgtHeaders.forEach(th => {
        let options = '<option value="">-- Leave Blank/Default --</option>';
        srcHeaders.forEach(sh => {
          const selected = (savedMap[th] === sh) ? 'selected' : '';
          options += `<option value="${sh}" ${selected}>${sh}</option>`;
        });
        html += `<tr>
          <td>${th}</td>
          <td><select class="input-field import-map-select" data-field="${th}">${options}</select></td>
        </tr>`;
      });
      document.getElementById('import-mapping-body').innerHTML = html;
      this.importShowStep(2);
      
    } catch(e) { this.showToast(e.message); }
  },

  async importExecute() {
    const mapping = {};
    document.querySelectorAll('.import-map-select').forEach(sel => {
      const field = sel.getAttribute('data-field');
      const val = sel.value;
      if (val) mapping[field] = val;
    });
    
    const upsertKey = document.getElementById('import-upsert-key').value;
    if (!upsertKey) return this.showToast("You must select an Upsert Key Column.");
    
    if(!mapping[upsertKey]) return this.showToast(`The selected Upsert Key (${upsertKey}) MUST be mapped to a source column.`);
    
    if(!confirm(`Ready to import into ${this.state.importConfig.targetSheet}. Matching ${upsertKey} records will be updated.`)) return;
    
    const overrideRules = document.getElementById('import-override-rules').checked;
    
    const btn = document.getElementById('btn-run-import');
    btn.textContent = "Importing..."; btn.disabled = true;
    
    try {
      // Save Mapping first
      await this.callBackend('saveMapping', { 
        adminToken: this.state.adminSession.token, 
        sourceSpreadsheetId: this.state.importConfig.sourceId,
        sourceSheet: this.state.importConfig.sourceSheet,
        targetSheet: this.state.importConfig.targetSheet,
        mapping: mapping,
        upsertKey: upsertKey
      });
      
      // Execute
      const res = await this.callBackend('executeImport', { 
        adminId: this.state.adminSession.adminId,
        adminToken: this.state.adminSession.token,
        sourceSpreadsheetId: this.state.importConfig.sourceId,
        sourceSheetName: this.state.importConfig.sourceSheet,
        targetSheetName: this.state.importConfig.targetSheet,
        mapping: mapping,
        upsertKey: upsertKey,
        overrideRules: overrideRules
      });
      
      if(res.status === 'success') {
        document.getElementById('import-res-imported').textContent = res.data.imported;
        document.getElementById('import-res-updated').textContent = res.data.updated;
        document.getElementById('import-res-skipped').textContent = res.data.skipped;
        document.getElementById('import-res-errors').textContent = res.data.errors.length;
        
        const errList = document.getElementById('import-error-list');
        errList.innerHTML = res.data.errors.map(e => `<div>${e}</div>`).join('');
        
        this.importShowStep(3);
      } else {
        this.showToast("Import failed: " + res.message);
      }
    } catch(e) { this.showToast(e.message); }
    
    btn.textContent = "Run Import"; btn.disabled = false;
  },

  // ------------- Clean API Connector -------------
  callBackend(action, data) {
    return new Promise(async (resolve, reject) => {
      if (!window.GAS_WEB_APP_URL || window.GAS_WEB_APP_URL === "YOUR_WEB_APP_URL_HERE") {
        return reject(new Error("GAS_WEB_APP_URL is not configured in index.html."));
      }

      const timer = setTimeout(() => {
        reject(new Error("Server response timed out. Please check your connection and try again."));
      }, 15000);

      try {
        const payload = JSON.stringify({ action: action, data: data });
        const response = await fetch(window.GAS_WEB_APP_URL, {
          method: 'POST',
          // CRITICAL: Using text/plain prevents the browser from sending a CORS preflight OPTIONS request,
          // which Google Apps Script doPost() cannot handle natively.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload
        });
        
        clearTimeout(timer);
        
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const resText = await response.text();
        try {
          resolve(JSON.parse(resText));
        } catch(e) {
          resolve(resText);
        }
      } catch (error) {
        clearTimeout(timer);
        reject(new Error(`Failed to connect to server: ${error.message}`));
      }
    });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => app.init());
} else {
  app.init();
}
