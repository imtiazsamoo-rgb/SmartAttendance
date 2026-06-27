<style>
  .leave-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
  .leave-table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 15px; }
  .leave-table th, .leave-table td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
  .status-badge-leave { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  .status-pending { background: #f39c12; color: white; }
  .status-approved { background: #2ecc71; color: white; }
  .status-rejected { background: #e74c3c; color: white; }
  .status-cancelled { background: #95a5a6; color: white; }
</style>

<!-- Teacher Leave View -->
<section id="view-teacher-leave" class="view">
  <div class="card fade-in">
    <h2>Apply for Leave</h2>
    <div class="leave-form">
      <label>Leave Type</label>
      <select id="leave-type-select" class="input-field">
        <option value="CL">Casual Leave (CL)</option>
        <option value="Medical Leave">Medical Leave</option>
        <option value="Without Pay Leave">Without Pay Leave</option>
        <option value="Official Duty">Official Duty</option>
        <option value="Other">Other</option>
      </select>
      
      <div style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label>Date From</label>
          <input type="date" id="leave-date-from" class="input-field">
        </div>
        <div style="flex:1;">
          <label>Date To</label>
          <input type="date" id="leave-date-to" class="input-field">
        </div>
      </div>
      
      <label>Reason</label>
      <textarea id="leave-reason" class="input-field" rows="3"></textarea>
      
      <button class="btn primary-btn" onclick="app.submitLeave()">Submit Application</button>
    </div>
  </div>
  
  <div class="card fade-in" style="margin-top: 20px;">
    <h2>My Leave History</h2>
    <div style="overflow-x:auto;">
      <table class="leave-table">
        <thead>
          <tr>
            <th>Dates</th>
            <th>Type</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="teacher-leave-history">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>
    <button class="btn outline-btn" onclick="app.showView('view-dashboard')" style="margin-top:20px;">Back to Dashboard</button>
  </div>
</section>

<!-- Principal Leave View -->
<section id="view-principal-leave" class="view">
  <div class="header">
    <button class="icon-btn" onclick="app.showView('view-admin-dashboard')">
      <span class="material-icons-round">arrow_back</span>
    </button>
    <h2>Leave Approvals</h2>
  </div>
  
  <div class="card fade-in" style="margin-top: 20px;">
    <div style="overflow-x:auto;">
      <table class="leave-table">
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Dates</th>
            <th>Type</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="principal-leave-list">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- Admin Leave & Holiday View -->
<section id="view-admin-leave" class="view">
  <div class="header">
    <button class="icon-btn" onclick="app.showView('view-admin-dashboard')">
      <span class="material-icons-round">arrow_back</span>
    </button>
    <h2>Global Leaves & Holidays</h2>
  </div>
  
  <div class="card fade-in" style="margin-top: 20px;">
    <h2>Manage Holidays</h2>
    <div class="leave-form">
      <div style="display:flex; gap:10px;">
        <input type="date" id="holiday-date" class="input-field" style="flex:1;">
        <select id="holiday-type" class="input-field" style="flex:1;">
          <option value="Government Holiday">Government Holiday</option>
          <option value="Local Holiday">Local Holiday</option>
          <option value="Special Working Day">Special Working Day</option>
        </select>
      </div>
      <input type="text" id="holiday-desc" class="input-field" placeholder="Description (e.g. Eid-ul-Fitr)">
      <button class="btn outline-btn" onclick="app.manageHoliday()">Add Holiday</button>
    </div>
    <hr style="margin:20px 0; border:0; border-top:1px solid #ddd;">
    
    <h2>All Leave Requests (Overrides)</h2>
    <div style="overflow-x:auto;">
      <table class="leave-table">
        <thead>
          <tr>
            <th>School / Teacher</th>
            <th>Dates</th>
            <th>Status</th>
            <th>Override</th>
          </tr>
        </thead>
        <tbody id="admin-leave-list">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>
  </div>
