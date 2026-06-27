<!-- Contains UI for the Teacher Import Wizard -->

<style>
.wizard-container {
  max-width: 800px;
  margin: 0 auto;
  background: var(--surface-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 2rem;
}

.wizard-step {
  display: none;
}
.wizard-step.active {
  display: block;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.mapping-table th, .mapping-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.mapping-table th {
  background-color: #f8fafc;
  font-weight: 600;
  color: var(--text-secondary);
}

.report-box {
  background: #f8fafc;
  border-radius: var(--radius-md);
  padding: 1.5rem;
  margin-top: 1rem;
  border: 1px solid var(--border-color);
}

.report-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px dashed #cbd5e1;
}

.report-item:last-child {
  border-bottom: none;
}
</style>

<section id="view-import-wizard" class="view">
  <div class="wizard-container">
    <h2><span class="material-icons-round" style="vertical-align: middle;">upload_file</span> Import Teachers</h2>
    
    <!-- Step 1: Select Source and Target -->
    <div id="import-step-1" class="wizard-step active">
      <p class="text-secondary" style="margin-bottom: 1.5rem;">Select your data source and target destination.</p>
      
      <div class="form-group">
        <label>Data Source</label>
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
          <label><input type="radio" name="import-source-type" value="internal" checked onchange="app.importToggleSource()"> Current Spreadsheet</label>
          <label><input type="radio" name="import-source-type" value="external" onchange="app.importToggleSource()"> External Spreadsheet</label>
        </div>
        <input type="text" id="import-source-id" class="input-field" placeholder="Paste Spreadsheet ID here..." style="display: none; margin-bottom: 0.5rem;">
        <button class="btn outline-btn" id="btn-fetch-sheets" onclick="app.importFetchSheets()" style="width: 100%;">Fetch Source Sheets</button>
      </div>

      <div class="form-group" style="margin-top: 1rem;">
        <label>Source Sheet</label>
        <select id="import-sheet-select" class="input-field">
          <option value="">-- Fetch sheets first --</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Target Sheet (Destination)</label>
        <select id="import-target-select" class="input-field">
          <option value="Teachers">Teachers</option>
          <option value="Schools">Schools</option>
          <option value="Users_Roles">Users_Roles</option>
          <option value="Holidays_WorkingDays">Holidays_WorkingDays</option>
          <option value="Leave_Requests">Leave_Requests</option>
        </select>
      </div>
      
      <div style="margin-top: 2rem; display: flex; justify-content: space-between;">
        <button class="btn outline-btn" onclick="app.showView('view-admin-dashboard')">Cancel</button>
        <button class="btn primary-btn" onclick="app.importLoadHeaders()">Next &rarr;</button>
      </div>
    </div>
    
    <!-- Step 2: Column Mapping -->
    <div id="import-step-2" class="wizard-step">
      <p class="text-secondary" style="margin-bottom: 1rem;">Map the columns from your source sheet to the target fields.</p>
      
      <div class="form-group" style="background: #eef2ff; padding: 1rem; border-radius: var(--radius-md);">
        <label style="color: var(--bfs-primary);">Upsert Key Column (Required for Updates)</label>
        <select id="import-upsert-key" class="input-field" style="border-color: var(--bfs-primary);">
          <!-- Populated dynamically -->
        </select>
        <small class="text-secondary">Rows with matching keys will be updated. New keys will be inserted.</small>
      </div>

      <div id="import-override-container" style="display: none; margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: var(--radius-md);">
        <label style="display: flex; gap: 0.5rem; align-items: center; color: #856404; margin: 0; font-weight: 500;">
          <input type="checkbox" id="import-override-rules"> Allow overwriting protected fields (e.g., GPS, Timing)
        </label>
      </div>
      
      <table class="mapping-table">
        <thead>
          <tr>
            <th>Target Field (BFS)</th>
            <th>Source Sheet Column</th>
          </tr>
        </thead>
        <tbody id="import-mapping-body">
          <!-- Populated by JS -->
        </tbody>
      </table>
      
      <div style="margin-top: 2rem; display: flex; justify-content: space-between;">
        <button class="btn outline-btn" onclick="app.importShowStep(1)">&larr; Back</button>
        <button class="btn primary-btn" id="btn-run-import" onclick="app.importExecute()">Run Import</button>
      </div>
    </div>
    
    <!-- Step 3: Result Report -->
    <div id="import-step-3" class="wizard-step">
      <h3 style="color: var(--bfs-secondary);">Import Complete</h3>
      
      <div class="report-box">
        <div class="report-item">
          <span>New Teachers Imported:</span>
          <strong id="import-res-imported" style="color: var(--bfs-secondary);">0</strong>
        </div>
        <div class="report-item">
          <span>Existing Profiles Updated:</span>
          <strong id="import-res-updated" style="color: var(--bfs-primary);">0</strong>
        </div>
        <div class="report-item">
          <span>Rows Skipped (No ID):</span>
          <strong id="import-res-skipped" style="color: var(--bfs-warning);">0</strong>
        </div>
        <div class="report-item">
          <span>Errors:</span>
          <strong id="import-res-errors" style="color: var(--bfs-danger);">0</strong>
        </div>
      </div>
      
      <div id="import-error-list" style="margin-top: 1rem; color: var(--bfs-danger); font-size: 0.85rem; max-height: 150px; overflow-y: auto;">
        <!-- Error logs go here -->
      </div>
      
      <div style="margin-top: 2rem; text-align: center;">
        <button class="btn primary-btn" onclick="app.showView('view-admin-dashboard')">Back to Dashboard</button>
      </div>
    </div>
    
  </div>
