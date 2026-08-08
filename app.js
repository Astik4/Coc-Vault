/* ==========================================================================
   STATE DATABASE UTILITY (LocalStorage Wrapper)
   ========================================================================== */
const DB = {
  getCases() {
    return JSON.parse(localStorage.getItem('coc_cases')) || [];
  },
  
  saveCases(cases) {
    localStorage.setItem('coc_cases', JSON.stringify(cases));
  },
  
  getEvidence() {
    return JSON.parse(localStorage.getItem('coc_evidence')) || [];
  },
  
  saveEvidence(evidence) {
    localStorage.setItem('coc_evidence', JSON.stringify(evidence));
  },
  
  getActiveCaseId() {
    return localStorage.getItem('coc_active_case_id') || '';
  },
  
  setActiveCaseId(caseId) {
    localStorage.setItem('coc_active_case_id', caseId);
  },

  createCase(caseData) {
    const cases = this.getCases();
    cases.push({
      ...caseData,
      dateCreated: new Date().toISOString()
    });
    this.saveCases(cases);
    this.setActiveCaseId(caseData.id);
  },

  createEvidence(evidenceData) {
    const evidence = this.getEvidence();
    
    // Add initial custody record (acquisition logging)
    const initialCustody = {
      sequence: 1,
      timestamp: new Date().toISOString(),
      releasedBy: evidenceData.collectedBy,
      releasedSig: 'ACQUISITION', // Text placeholder or special marker
      receivedBy: evidenceData.collectedBy,
      receivedSig: 'ACQUISITION',
      location: evidenceData.location,
      purpose: 'Initial acquisition and sealing of evidence package',
      notes: 'Logged directly in CoC Vault at scene of recovery.'
    };

    evidence.push({
      ...evidenceData,
      dateLogged: new Date().toISOString(),
      custodyHistory: [initialCustody]
    });
    
    this.saveEvidence(evidence);
  },

  transferEvidence(caseId, itemId, transferData) {
    const evidence = this.getEvidence();
    const itemIndex = evidence.findIndex(e => e.caseId === caseId && e.itemId === itemId);
    
    if (itemIndex > -1) {
      const item = evidence[itemIndex];
      const nextSequence = item.custodyHistory.length + 1;
      
      item.custodyHistory.push({
        sequence: nextSequence,
        timestamp: new Date().toISOString(),
        ...transferData
      });
      
      evidence[itemIndex] = item;
      this.saveEvidence(evidence);
      return true;
    }
    return false;
  }
};

/* ==========================================================================
   SIGNATURE PAD CLASS
   ========================================================================== */
class SignaturePad {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    
    // Initialize styles
    this.ctx.strokeStyle = '#0f172a'; // Navy Blue ink
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 2.5;

    this.setupListeners();
    this.resizeCanvas();
  }

  setupListeners() {
    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

    // Touch Events for Tablets/Phones
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.isDrawing = true;
      this.lastX = touch.clientX - rect.left;
      this.lastY = touch.clientY - rect.top;
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isDrawing) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.lastX = x;
      this.lastY = y;
    });

    this.canvas.addEventListener('touchend', () => this.stopDrawing());
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    // Account for canvas internal coordinate vs client dimensions
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  draw(e) {
    if (!this.isDrawing) return;
    const pos = this.getMousePos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  isEmpty() {
    // Check if the canvas contains any drawing other than transparent pixels
    const buffer = new Uint32Array(
      this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  }

  toDataURL() {
    return this.canvas.toDataURL();
  }

  resizeCanvas() {
    // Dynamic canvas internal pixel resolution sizing to fit styling
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width || 250;
    this.canvas.height = rect.height || 120;
    // Re-apply stroke parameters after dimensions change
    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 2.5;
  }
}

/* ==========================================================================
   APP CONTROLLER & FLOW
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Page State Variable
  let activeTab = 'dashboard-tab';
  let releasedSigPad = null;
  let receivedSigPad = null;

  // Initialize Icon Library
  lucide.createIcons();

  // Initialize Signature Pads when modals are displayed
  const initSignaturePads = () => {
    const canvasReleased = document.getElementById('canvas-released-sig');
    const canvasReceived = document.getElementById('canvas-received-sig');
    
    if (canvasReleased && canvasReceived) {
      releasedSigPad = new SignaturePad(canvasReleased);
      receivedSigPad = new SignaturePad(canvasReceived);
    }
  };

  // Re-size canvasses on screen adjust
  window.addEventListener('resize', () => {
    if (releasedSigPad) releasedSigPad.resizeCanvas();
    if (receivedSigPad) receivedSigPad.resizeCanvas();
  });

  /* ==========================================
     CORE TAB NAVIGATION
     ========================================== */
  const menuItems = document.querySelectorAll('.menu-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      
      // Update sidebar state
      menuItems.forEach(mi => mi.classList.remove('active'));
      item.classList.add('active');

      // Update panes
      tabPanes.forEach(tp => tp.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');
      
      activeTab = tabId;
      
      // Page title metadata updates
      updatePageTitle(tabId);
      
      // Tab-specific rendering hooks
      renderTabContent(tabId);
    });
  });

  function updatePageTitle(tabId) {
    const titleEl = document.getElementById('current-page-title');
    const subEl = document.getElementById('current-page-subtitle');
    
    switch (tabId) {
      case 'dashboard-tab':
        titleEl.textContent = 'Dashboard Overview';
        subEl.textContent = 'Forensic summary & statistics';
        break;
      case 'cases-tab':
        titleEl.textContent = 'Case Management';
        subEl.textContent = 'Forensic case repository & meta documentation';
        break;
      case 'evidence-tab':
        titleEl.textContent = 'Evidence Vault';
        subEl.textContent = 'Cryptographic hashes and storage indexing';
        break;
      case 'ledger-tab':
        titleEl.textContent = 'Custody Ledger';
        subEl.textContent = 'Chronological audit tracking and signatures';
        break;
      case 'integrity-tab':
        titleEl.textContent = 'Integrity Checker';
        subEl.textContent = 'Tamper checking and verification engine';
        break;
    }
  }

  /* ==========================================
     GLOBAL CASE STATE SWITCHER
     ========================================== */
  const caseSelect = document.getElementById('global-case-select');
  
  caseSelect.addEventListener('change', (e) => {
    DB.setActiveCaseId(e.target.value);
    renderActiveCaseDropdowns();
    renderTabContent(activeTab);
  });

  function renderActiveCaseDropdowns() {
    const cases = DB.getCases();
    const activeCaseId = DB.getActiveCaseId();
    
    // Clear & Populate Main Header Dropdown
    caseSelect.innerHTML = '<option value="" disabled>Select a Case</option>';
    if (cases.length === 0) {
      caseSelect.innerHTML += '<option value="" disabled selected>No active cases</option>';
    } else {
      cases.forEach(c => {
        const selectedAttr = c.id === activeCaseId ? 'selected' : '';
        caseSelect.innerHTML += `<option value="${c.id}" ${selectedAttr}>${c.id} - ${c.investigator}</option>`;
      });
    }
    
    // Synchronize Integrity Suite case dropdown
    const integrityCaseSelect = document.getElementById('integrity-case-select');
    if (integrityCaseSelect) {
      integrityCaseSelect.innerHTML = '<option value="" disabled selected>Choose Case...</option>';
      cases.forEach(c => {
        const selectedAttr = c.id === activeCaseId ? 'selected' : '';
        integrityCaseSelect.innerHTML += `<option value="${c.id}" ${selectedAttr}>${c.id}</option>`;
      });
    }
  }

  /* ==========================================
     MODALS MANAGEMENT
     ========================================== */
  // Case Modal
  const btnOpenCaseModal = document.getElementById('btn-open-case-modal');
  const caseModalOverlay = document.getElementById('new-case-modal-overlay');
  const caseModalClose = document.getElementById('new-case-modal-close');
  const btnCancelCase = document.getElementById('btn-cancel-case');
  const newCaseForm = document.getElementById('new-case-form');

  const openCaseModal = () => {
    // Pre-fill incident date to local time
    const localDateStr = new Date().toISOString().split('T')[0];
    document.getElementById('case-date').value = localDateStr;
    caseModalOverlay.classList.add('active');
  };

  const closeCaseModal = () => {
    newCaseForm.reset();
    caseModalOverlay.classList.remove('active');
  };

  btnOpenCaseModal.addEventListener('click', openCaseModal);
  caseModalClose.addEventListener('click', closeCaseModal);
  btnCancelCase.addEventListener('click', closeCaseModal);

  newCaseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newCase = {
      id: document.getElementById('case-id').value.trim(),
      investigator: document.getElementById('case-investigator').value.trim(),
      badge: document.getElementById('case-badge').value.trim(),
      agency: document.getElementById('case-agency').value.trim(),
      suspect: document.getElementById('case-target').value.trim() || 'UNKNOWN/UNSPECIFIED',
      date: document.getElementById('case-date').value,
      notes: document.getElementById('case-notes').value.trim() || 'No incident notes provided.'
    };

    // Validation: Case IDs should be unique
    const existing = DB.getCases().find(c => c.id.toLowerCase() === newCase.id.toLowerCase());
    if (existing) {
      alert(`Error: A case file with ID "${newCase.id}" already exists.`);
      return;
    }

    DB.createCase(newCase);
    closeCaseModal();
    renderActiveCaseDropdowns();
    renderTabContent(activeTab);
    alert(`Case "${newCase.id}" has been initialized successfully.`);
  });

  // Transfer Modal
  const transferModalOverlay = document.getElementById('transfer-modal-overlay');
  const transferModalClose = document.getElementById('transfer-modal-close');
  const btnCancelTransfer = document.getElementById('btn-cancel-transfer');
  const transferForm = document.getElementById('transfer-form');
  const btnOpenTransferModal = document.getElementById('btn-open-transfer-modal');
  const ledgerEvidenceSelect = document.getElementById('ledger-evidence-select');

  const openTransferModal = () => {
    const activeCaseId = DB.getActiveCaseId();
    const selectedItem = ledgerEvidenceSelect.value;
    
    if (!activeCaseId || !selectedItem) return;

    // Fetch the evidence
    const ev = DB.getEvidence().find(item => item.caseId === activeCaseId && item.itemId === selectedItem);
    if (!ev) return;

    // Current custodian is the receiver of the last record in ledger history
    const lastTransfer = ev.custodyHistory[ev.custodyHistory.length - 1];
    document.getElementById('trans-released-by').value = lastTransfer.receivedBy;
    
    transferModalOverlay.classList.add('active');
    
    // Defer signature pad generation until UI finishes opening
    setTimeout(() => {
      if (!releasedSigPad || !receivedSigPad) {
        initSignaturePads();
      } else {
        releasedSigPad.clear();
        receivedSigPad.clear();
        releasedSigPad.resizeCanvas();
        receivedSigPad.resizeCanvas();
      }
    }, 100);
  };

  const closeTransferModal = () => {
    transferForm.reset();
    if (releasedSigPad) releasedSigPad.clear();
    if (receivedSigPad) receivedSigPad.clear();
    transferModalOverlay.classList.remove('active');
  };

  btnOpenTransferModal.addEventListener('click', openTransferModal);
  transferModalClose.addEventListener('click', closeTransferModal);
  btnCancelTransfer.addEventListener('click', closeTransferModal);

  document.getElementById('btn-clear-release-sig').addEventListener('click', () => releasedSigPad && releasedSigPad.clear());
  document.getElementById('btn-clear-receive-sig').addEventListener('click', () => receivedSigPad && receivedSigPad.clear());

  transferForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const activeCaseId = DB.getActiveCaseId();
    const selectedItem = ledgerEvidenceSelect.value;

    if (!releasedSigPad || releasedSigPad.isEmpty() || !receivedSigPad || receivedSigPad.isEmpty()) {
      alert("Signatures are required for both the Releasing and Receiving officers.");
      return;
    }

    const transferData = {
      releasedBy: document.getElementById('trans-released-by').value,
      releasedSig: releasedSigPad.toDataURL(),
      receivedBy: document.getElementById('trans-received-by').value.trim(),
      receivedSig: receivedSigPad.toDataURL(),
      purpose: document.getElementById('trans-purpose').value,
      location: document.getElementById('trans-location').value.trim(),
      notes: document.getElementById('trans-notes').value.trim() || 'N/A'
    };

    const success = DB.transferEvidence(activeCaseId, selectedItem, transferData);
    
    if (success) {
      closeTransferModal();
      renderTabContent('ledger-tab');
      alert(`Custody handoff logged successfully.`);
    } else {
      alert("Database error: Could not append transfer sequence.");
    }
  });

  /* ==========================================
     DRAG-AND-DROP FILE HASH CALCULATION
     ========================================== */
  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('evidence-file-input');
  const hashField = document.getElementById('evidence-hash');
  const hashCalcStatus = document.getElementById('hash-calc-status');

  const setupDropzone = (dz, input, outputField, loaderEl) => {
    if (!dz) return;
    
    dz.addEventListener('click', () => input.click());

    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    });

    dz.addEventListener('dragleave', () => {
      dz.classList.remove('dragover');
    });

    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFileForHash(files[0], outputField, loaderEl);
      }
    });

    input.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        processFileForHash(files[0], outputField, loaderEl);
      }
    });
  };

  async function processFileForHash(file, outputField, loaderEl) {
    if (loaderEl) loaderEl.style.display = 'block';
    outputField.value = "Calculating crypto hash value...";
    
    try {
      const hash = await calculateFileSHA256(file);
      outputField.value = hash;
    } catch (err) {
      console.error(err);
      outputField.value = "Hashing error. Try uploading manually.";
    } finally {
      if (loaderEl) loaderEl.style.display = 'none';
    }
  }

  // Cryptographic browser native WebCrypto API
  async function calculateFileSHA256(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  setupDropzone(dropzone, fileInput, hashField, hashCalcStatus);

  // Set up the drag-and-drop for the Integrity Validation Page
  const verifyDropzone = document.getElementById('verify-dropzone');
  const verifyFileInput = document.getElementById('integrity-file-input');
  const verifyCalcHash = document.getElementById('integrity-calc-hash');
  const verifyCalcStatus = document.getElementById('verify-calc-status');

  setupDropzone(verifyDropzone, verifyFileInput, verifyCalcHash, verifyCalcStatus);

  // Monitor changes on the integrity calc hash to execute direct comparisons
  const observer = new MutationObserver(() => {
    runIntegrityCheck();
  });
  if (verifyCalcHash) {
    // Since input values changed by scripts don't trigger native change events, we poll/check manually when hash field changes
    // Alternatively, just call it from processFileForHash.
  }

  // Wrap processFileForHash to handle the integrity tab comparison automatically
  if (verifyFileInput) {
    verifyFileInput.addEventListener('change', async () => {
      setTimeout(runIntegrityCheck, 300); // Small timeout to ensure hash is updated
    });
  }
  if (verifyDropzone) {
    verifyDropzone.addEventListener('drop', async () => {
      setTimeout(runIntegrityCheck, 300);
    });
  }

  /* ==========================================
     TAB RENDERING ROUTINES
     ========================================== */
  function renderTabContent(tabId) {
    const activeCaseId = DB.getActiveCaseId();
    const cases = DB.getCases();
    const evidence = DB.getEvidence();

    switch (tabId) {
      case 'dashboard-tab':
        renderDashboard(activeCaseId, cases, evidence);
        break;
      case 'cases-tab':
        renderCases(cases, evidence);
        break;
      case 'evidence-tab':
        renderEvidence(activeCaseId, evidence);
        break;
      case 'ledger-tab':
        renderLedger(activeCaseId, evidence);
        break;
      case 'integrity-tab':
        renderIntegrityTab(activeCaseId, cases, evidence);
        break;
    }
    
    // Refresh icons dynamically on new elements
    lucide.createIcons();
  }

  /* --- Render Dashboard --- */
  function renderDashboard(activeCaseId, cases, evidence) {
    // Populate stats
    document.getElementById('stat-cases').textContent = cases.length;
    
    const activeCaseEvidence = evidence.filter(e => e.caseId === activeCaseId);
    document.getElementById('stat-evidence').textContent = activeCaseEvidence.length;
    
    let totalTransfers = 0;
    activeCaseEvidence.forEach(item => {
      totalTransfers += (item.custodyHistory.length - 1); // Exclude acquisition event
    });
    document.getElementById('stat-transfers').textContent = totalTransfers;
    
    // Active Case Overview Content
    const overviewContainer = document.getElementById('dashboard-active-case-content');
    const activeCase = cases.find(c => c.id === activeCaseId);
    
    if (activeCase) {
      overviewContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.95rem;">
          <p><strong>Case Number:</strong> <span style="font-family: monospace; font-weight: 700; color: var(--primary);">${activeCase.id}</span></p>
          <p><strong>Lead Investigator:</strong> ${activeCase.investigator} (${activeCase.badge})</p>
          <p><strong>Agency:</strong> ${activeCase.agency}</p>
          <p><strong>Suspect/Target:</strong> ${activeCase.suspect}</p>
          <p><strong>Incident Initiated:</strong> ${activeCase.date}</p>
          <p><strong>Security Status:</strong> <span class="badge badge-success">Encrypted / Local</span></p>
        </div>
        <div style="margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <p><strong>Case Scope / Description:</strong></p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px; line-height: 1.5; font-style: italic;">
            "${activeCase.notes}"
          </p>
        </div>
      `;
    } else {
      overviewContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
          <i data-lucide="folder-symlink" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 12px; color: var(--text-light);"></i>
          <p>No active case selected. Choose one from the header drop-down or create a new case profile.</p>
        </div>
      `;
    }

    // Dashboard Recent Transfer History
    const transfersContainer = document.getElementById('dashboard-recent-transfers');
    
    // Extract recent handoffs across active case
    let allHandoffs = [];
    activeCaseEvidence.forEach(item => {
      // Exclude sequence 1 (Initial acquisition) for general transfers visualization
      const transfers = item.custodyHistory.filter(c => c.sequence > 1);
      transfers.forEach(t => {
        allHandoffs.push({
          itemId: item.itemId,
          itemType: item.type,
          ...t
        });
      });
    });

    // Sort by timestamp desc
    allHandoffs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (allHandoffs.length > 0) {
      transfersContainer.innerHTML = allHandoffs.slice(0, 5).map(t => {
        const localTime = new Date(t.timestamp).toLocaleString();
        return `
          <div style="padding: 12px 16px; border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); margin-bottom: 10px; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--primary); font-family: monospace;">${t.itemId} (${t.itemType})</span>
              <span style="color: var(--text-light); font-size: 0.75rem;">${localTime}</span>
            </div>
            <p>Released by <strong>${t.releasedBy}</strong> &rarr; Received by <strong>${t.receivedBy}</strong></p>
            <p style="margin-top: 4px; font-size: 0.8rem; color: var(--text-muted);"><i data-lucide="map-pin" style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 2px;"></i> Facility: ${t.location} | Purpose: ${t.purpose}</p>
          </div>
        `;
      }).join('');
    } else {
      transfersContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
          <i data-lucide="history" style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 12px; color: var(--text-light);"></i>
          <p>No transfers have been completed for this case yet.</p>
        </div>
      `;
    }
  }

  /* --- Render Cases Directory --- */
  function renderCases(cases, evidence) {
    const tableBody = document.getElementById('case-table-body');
    
    if (cases.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
            <i data-lucide="folder" style="width: 32px; height: 32px; stroke-width: 1.5; margin-bottom: 8px; color: var(--text-light); display: block; margin-left: auto; margin-right: auto;"></i>
            No forensic cases logged in system.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = cases.map(c => {
      const itemsCount = evidence.filter(e => e.caseId === c.id).length;
      const isActive = c.id === DB.getActiveCaseId();
      const statusBtn = isActive 
        ? `<span class="badge badge-success"><i data-lucide="check" style="width: 12px; height: 12px; margin-right: 2px;"></i> Active</span>`
        : `<button class="btn btn-secondary btn-sm btn-activate-case" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.8rem;">Select</button>`;
      
      return `
        <tr style="${isActive ? 'background-color: var(--primary-light);' : ''}">
          <td style="font-family: monospace; font-weight: 700;">${c.id}</td>
          <td>${c.date}</td>
          <td>${c.investigator} (${c.badge})</td>
          <td>${c.agency}</td>
          <td>${c.suspect}</td>
          <td style="text-align: center; font-weight: 700;">${itemsCount}</td>
          <td>
            <div style="display: flex; gap: 8px; align-items: center;">
              ${statusBtn}
              <button class="btn btn-danger btn-sm btn-delete-case" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.8rem;"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach activation handlers
    document.querySelectorAll('.btn-activate-case').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        DB.setActiveCaseId(id);
        renderActiveCaseDropdowns();
        renderTabContent('cases-tab');
      });
    });

    // Attach deletion handlers
    document.querySelectorAll('.btn-delete-case').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm(`WARNING: Are you sure you want to permanently delete Case File "${id}"? All associated evidence ledger records will be lost.`)) {
          const cases = DB.getCases().filter(c => c.id !== id);
          const evidence = DB.getEvidence().filter(e => e.caseId !== id);
          
          DB.saveCases(cases);
          DB.saveEvidence(evidence);
          
          if (DB.getActiveCaseId() === id) {
            DB.setActiveCaseId(cases.length > 0 ? cases[0].id : '');
          }
          
          renderActiveCaseDropdowns();
          renderTabContent('cases-tab');
        }
      });
    });
  }

  /* --- Render Evidence Vault --- */
  const evidenceForm = document.getElementById('evidence-form');
  if (evidenceForm) {
    evidenceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeCaseId = DB.getActiveCaseId();
      
      const newEvidence = {
        caseId: activeCaseId,
        itemId: document.getElementById('evidence-id').value.trim(),
        type: document.getElementById('evidence-type').value,
        serial: document.getElementById('evidence-serial').value.trim() || 'N/A',
        location: document.getElementById('evidence-location').value.trim(),
        collectedBy: document.getElementById('evidence-collected-by').value.trim(),
        description: document.getElementById('evidence-description').value.trim() || 'No additional packaging info.',
        hash: document.getElementById('evidence-hash').value.trim()
      };

      // Validator: IDs must be unique per Case
      const existing = DB.getEvidence().find(item => item.caseId === activeCaseId && item.itemId.toLowerCase() === newEvidence.itemId.toLowerCase());
      if (existing) {
        alert(`Error: Evidence item "${newEvidence.itemId}" is already registered under this case file.`);
        return;
      }

      DB.createEvidence(newEvidence);
      evidenceForm.reset();
      
      // Clear hash input
      document.getElementById('evidence-hash').value = '';
      
      renderTabContent('evidence-tab');
      alert(`Evidence Item "${newEvidence.itemId}" securely logged and hash signed.`);
    });
  }

  function renderEvidence(activeCaseId, evidence) {
    const noCaseAlert = document.getElementById('evidence-no-case-alert');
    const activeContainer = document.getElementById('evidence-active-container');
    
    if (!activeCaseId) {
      noCaseAlert.style.display = 'block';
      activeContainer.style.display = 'none';
      
      document.getElementById('btn-evidence-select-case').onclick = () => {
        openCaseModal();
      };
      return;
    }

    noCaseAlert.style.display = 'none';
    activeContainer.style.display = 'grid';

    const tableBody = document.getElementById('evidence-table-body');
    const caseItems = evidence.filter(e => e.caseId === activeCaseId);

    if (caseItems.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
            <i data-lucide="shield-alert" style="width: 32px; height: 32px; stroke-width: 1.5; margin-bottom: 8px; color: var(--text-light); display: block; margin-left: auto; margin-right: auto;"></i>
            No forensic evidence logged for this case. Register an item using the left form.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = caseItems.map(item => {
      const lastCustodian = item.custodyHistory[item.custodyHistory.length - 1].receivedBy;
      const formattedDate = new Date(item.dateLogged).toLocaleString();
      
      return `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: var(--primary);">${item.itemId}</td>
          <td><strong>${item.type}</strong><br><small style="color: var(--text-muted); font-family: monospace;">S/N: ${item.serial}</small></td>
          <td>${item.location}</td>
          <td>
            <div style="font-family: monospace; font-size: 0.75rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.hash}">
              ${item.hash}
            </div>
          </td>
          <td style="font-size: 0.8rem;">${formattedDate}</td>
          <td><span class="badge badge-info"><i data-lucide="user" style="width: 10px; height: 10px; margin-right: 2px;"></i> ${lastCustodian}</span></td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm btn-view-ledger" data-item="${item.itemId}" style="padding: 4px 8px; font-size: 0.8rem;">Audit Ledger</button>
              <button class="btn btn-danger btn-sm btn-delete-evidence" data-item="${item.itemId}" style="padding: 4px 8px; font-size: 0.8rem;"><i data-lucide="trash-2" style="width: 12px; height: 12px;"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners to view ledger buttons
    document.querySelectorAll('.btn-view-ledger').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-item');
        // Route to ledger tab
        document.querySelector('[data-tab="ledger-tab"]').click();
        
        // Wait minor block and select item
        setTimeout(() => {
          ledgerEvidenceSelect.value = itemId;
          ledgerEvidenceSelect.dispatchEvent(new Event('change'));
        }, 100);
      });
    });

    // Delete handler
    document.querySelectorAll('.btn-delete-evidence').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-item');
        if (confirm(`Are you sure you want to delete evidence item "${itemId}"? This will erase all its associated handoff signatures.`)) {
          const list = DB.getEvidence().filter(e => !(e.caseId === activeCaseId && e.itemId === itemId));
          DB.saveEvidence(list);
          renderTabContent('evidence-tab');
        }
      });
    });
  }

  /* --- Render Custody Ledger Tab --- */
  if (ledgerEvidenceSelect) {
    ledgerEvidenceSelect.addEventListener('change', (e) => {
      const activeCaseId = DB.getActiveCaseId();
      const itemId = e.target.value;
      const ev = DB.getEvidence().find(item => item.caseId === activeCaseId && item.itemId === itemId);
      
      const preview = document.getElementById('ledger-evidence-preview');
      const exportCard = document.getElementById('export-card');
      
      if (ev) {
        preview.style.display = 'block';
        exportCard.style.display = 'block';
        document.getElementById('prev-type').textContent = ev.type;
        document.getElementById('prev-serial').textContent = ev.serial;
        document.getElementById('prev-location').textContent = ev.location;
        document.getElementById('prev-hash').textContent = ev.hash;
        
        document.getElementById('btn-open-transfer-modal').removeAttribute('disabled');
        renderTimeline(ev);
      } else {
        preview.style.display = 'none';
        exportCard.style.display = 'none';
        document.getElementById('btn-open-transfer-modal').setAttribute('disabled', 'true');
      }
    });
  }

  function renderLedger(activeCaseId, evidence) {
    const noCaseAlert = document.getElementById('ledger-no-case-alert');
    const activeContainer = document.getElementById('ledger-active-container');
    
    if (!activeCaseId) {
      noCaseAlert.style.display = 'block';
      activeContainer.style.display = 'none';
      return;
    }

    noCaseAlert.style.display = 'none';
    activeContainer.style.display = 'grid';

    // Populate Selector Dropdown
    const caseItems = evidence.filter(e => e.caseId === activeCaseId);
    const savedSelectedVal = ledgerEvidenceSelect.value;
    
    ledgerEvidenceSelect.innerHTML = '<option value="" disabled selected>Choose evidence...</option>';
    caseItems.forEach(item => {
      const isSelected = item.itemId === savedSelectedVal ? 'selected' : '';
      ledgerEvidenceSelect.innerHTML += `<option value="${item.itemId}" ${isSelected}>${item.itemId} - ${item.type}</option>`;
    });

    if (savedSelectedVal && caseItems.some(i => i.itemId === savedSelectedVal)) {
      ledgerEvidenceSelect.value = savedSelectedVal;
      ledgerEvidenceSelect.dispatchEvent(new Event('change'));
    } else {
      document.getElementById('ledger-evidence-preview').style.display = 'none';
      document.getElementById('export-card').style.display = 'none';
      document.getElementById('btn-open-transfer-modal').setAttribute('disabled', 'true');
      document.getElementById('ledger-timeline-container').innerHTML = `
        <div style="text-align: center; padding: 60px 0; color: var(--text-muted);">
          <i data-lucide="scan-eye" style="width: 56px; height: 56px; stroke-width: 1; margin-bottom: 16px; color: var(--text-light);"></i>
          <h4>Select an Evidence Item</h4>
          <p style="font-size: 0.9rem; margin-top: 4px;">Choose an item on the left panel to review its custodial history ledger.</p>
        </div>
      `;
    }
  }

  function renderTimeline(evidenceItem) {
    const container = document.getElementById('ledger-timeline-container');
    
    if (!evidenceItem.custodyHistory || evidenceItem.custodyHistory.length === 0) {
      container.innerHTML = `<p>No timeline records exist.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="timeline">
        ${evidenceItem.custodyHistory.map(h => {
          const isAcquisition = h.sequence === 1;
          const formattedDate = new Date(h.timestamp).toLocaleString();
          
          let sigsHTML = '';
          if (isAcquisition) {
            sigsHTML = `
              <div class="timeline-signatures">
                <div class="timeline-sig-box">
                  <span>Authorized Agent / Acquirer</span>
                  <div style="padding: 8px; border: 1px dashed var(--border-color); background: #ffffff; border-radius: var(--border-radius-sm); font-size: 0.75rem; font-weight: 700; color: var(--success-text);">
                    CRIME SCENE SECURED
                  </div>
                </div>
              </div>
            `;
          } else {
            sigsHTML = `
              <div class="timeline-signatures">
                <div class="timeline-sig-box">
                  <span>Releasing Signature (${h.releasedBy})</span>
                  <img src="${h.releasedSig}" alt="Releasing signature" class="timeline-sig-image">
                </div>
                <div class="timeline-sig-box">
                  <span>Receiving Signature (${h.receivedBy})</span>
                  <img src="${h.receivedSig}" alt="Receiving signature" class="timeline-sig-image">
                </div>
              </div>
            `;
          }

          return `
            <div class="timeline-item">
              <div class="timeline-marker ${isAcquisition ? 'initial' : ''}"></div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-date">${formattedDate} (Seq #${h.sequence})</span>
                  <span class="timeline-operator">Handler: <strong>${h.receivedBy}</strong></span>
                </div>
                <div class="timeline-body">
                  <p><strong>Handoff:</strong> ${isAcquisition ? `Acquired by <strong>${h.releasedBy}</strong>` : `Released by <strong>${h.releasedBy}</strong> to <strong>${h.receivedBy}</strong>`}</p>
                  <p style="margin-top: 4px;"><strong>Facility Location:</strong> ${h.location}</p>
                  <p style="margin-top: 4px;"><strong>Reason / Purpose:</strong> ${h.purpose}</p>
                  ${h.notes ? `<p style="margin-top: 4px; font-size: 0.85rem; font-style: italic; color: var(--text-muted);">Notes: "${h.notes}"</p>` : ''}
                </div>
                ${sigsHTML}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* --- Render Integrity Tab --- */
  const integrityCaseSelect = document.getElementById('integrity-case-select');
  const integrityEvidenceSelect = document.getElementById('integrity-evidence-select');
  const integrityDbHashPreview = document.getElementById('integrity-db-hash-preview');
  const integrityDbHash = document.getElementById('integrity-db-hash');
  
  if (integrityCaseSelect) {
    integrityCaseSelect.addEventListener('change', (e) => {
      const caseId = e.target.value;
      const items = DB.getEvidence().filter(item => item.caseId === caseId);
      
      integrityEvidenceSelect.innerHTML = '<option value="" disabled selected>Select registered item...</option>';
      if (items.length === 0) {
        integrityEvidenceSelect.innerHTML += '<option value="" disabled>No items logged for this case</option>';
        integrityEvidenceSelect.setAttribute('disabled', 'true');
      } else {
        items.forEach(i => {
          integrityEvidenceSelect.innerHTML += `<option value="${i.itemId}">${i.itemId} - ${i.type}</option>`;
        });
        integrityEvidenceSelect.removeAttribute('disabled');
      }
      
      // Hide comparisons on change
      integrityDbHashPreview.style.display = 'none';
      document.getElementById('integrity-result-banner').style.display = 'none';
      document.getElementById('integrity-calc-hash').value = '';
    });
  }

  if (integrityEvidenceSelect) {
    integrityEvidenceSelect.addEventListener('change', (e) => {
      const caseId = integrityCaseSelect.value;
      const itemId = e.target.value;
      const item = DB.getEvidence().find(i => i.caseId === caseId && i.itemId === itemId);
      
      if (item) {
        integrityDbHashPreview.style.display = 'block';
        integrityDbHash.textContent = item.hash;
        runIntegrityCheck(); // Check if file is already dropped
      } else {
        integrityDbHashPreview.style.display = 'none';
      }
    });
  }

  function renderIntegrityTab(activeCaseId, cases, evidence) {
    renderActiveCaseDropdowns();
    
    // Clear check state
    document.getElementById('integrity-file-input').value = '';
    document.getElementById('integrity-calc-hash').value = '';
    document.getElementById('integrity-result-banner').style.display = 'none';
    
    if (activeCaseId) {
      integrityCaseSelect.value = activeCaseId;
      integrityCaseSelect.dispatchEvent(new Event('change'));
    }
  }

  function runIntegrityCheck() {
    const dbHashVal = integrityDbHash.textContent.trim();
    const calcHashVal = document.getElementById('integrity-calc-hash').value.trim();
    const banner = document.getElementById('integrity-result-banner');

    if (!dbHashVal || !calcHashVal || calcHashVal.startsWith("Awaiting") || calcHashVal.startsWith("Calculating")) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';
    if (dbHashVal.toLowerCase() === calcHashVal.toLowerCase()) {
      banner.className = 'integrity-banner integrity-success';
      banner.innerHTML = `
        <i data-lucide="shield-check"></i>
        <div>
          <h4 style="margin: 0; font-size: 1.05rem;">Integrity Secure (MATCHED)</h4>
          <p style="margin: 4px 0 0 0; font-size: 0.8rem; font-weight: normal; opacity: 0.9;">Cryptographic verification matches database entry perfectly. The evidence file has not been altered since collection.</p>
        </div>
      `;
    } else {
      banner.className = 'integrity-banner integrity-failed';
      banner.innerHTML = `
        <i data-lucide="alert-octagon"></i>
        <div>
          <h4 style="margin: 0; font-size: 1.05rem;">Integrity Broken (TAMPERED)</h4>
          <p style="margin: 4px 0 0 0; font-size: 0.8rem; font-weight: normal; opacity: 0.9;">ATTENTION: File hashes do not match. The evidence file has been modified, corrupted, or does not correspond to the logged item.</p>
        </div>
      `;
    }
    lucide.createIcons();
  }

  /* ==========================================================================
     REPORT EXPORT UTILITIES (Print / PDF)
     ========================================================================== */
  const btnPrintReport = document.getElementById('btn-print-report');
  const btnExportPdf = document.getElementById('btn-export-pdf');

  function populatePrintArea() {
    const activeCaseId = DB.getActiveCaseId();
    const itemId = ledgerEvidenceSelect.value;
    
    if (!activeCaseId || !itemId) return false;

    const caseData = DB.getCases().find(c => c.id === activeCaseId);
    const itemData = DB.getEvidence().find(i => i.caseId === activeCaseId && i.itemId === itemId);

    if (!caseData || !itemData) return false;

    // Populate Print Metadata
    document.getElementById('print-report-gen-time').textContent = new Date().toLocaleString();
    
    document.getElementById('print-case-id').textContent = caseData.id;
    document.getElementById('print-case-date').textContent = caseData.date;
    document.getElementById('print-case-investigator').textContent = caseData.investigator;
    document.getElementById('print-case-badge').textContent = caseData.badge;
    document.getElementById('print-case-agency').textContent = caseData.agency;
    document.getElementById('print-case-target').textContent = caseData.suspect;
    document.getElementById('print-case-notes').textContent = caseData.notes;

    // Populate Evidence Table
    document.getElementById('print-item-id').textContent = itemData.itemId;
    document.getElementById('print-item-type').textContent = itemData.type;
    document.getElementById('print-item-serial').textContent = `S/N: ${itemData.serial}`;
    document.getElementById('print-item-location').textContent = itemData.location;
    document.getElementById('print-item-date').textContent = new Date(itemData.dateLogged).toLocaleString();
    document.getElementById('print-item-collected-by').textContent = itemData.collectedBy;
    document.getElementById('print-item-hash').textContent = itemData.hash;
    document.getElementById('print-item-description').textContent = itemData.description;

    // Populate Ledger chronological entries
    const ledgerTableBody = document.getElementById('print-ledger-rows');
    ledgerTableBody.innerHTML = itemData.custodyHistory.map(h => {
      const isAcq = h.sequence === 1;
      const handoffText = isAcq 
        ? `Logged/Acquired by ${h.releasedBy}`
        : `Released by ${h.releasedBy} <br>to ${h.receivedBy}`;
      
      const sigs = isAcq
        ? `<div style="font-size: 7.5pt; font-weight: bold; border: 1px dashed green; padding: 2px; text-align: center; color: green; max-width: 100px;">SCENE SECURE</div>`
        : `<div style="display: flex; gap: 4px; flex-direction: column;">
             <div><small>Rel:</small> <img src="${h.releasedSig}" class="print-signature-img"></div>
             <div style="margin-top: 2px;"><small>Rec:</small> <img src="${h.receivedSig}" class="print-signature-img"></div>
           </div>`;

      return `
        <tr>
          <td style="text-align: center;">${h.sequence}</td>
          <td style="font-size: 8.5pt;">${new Date(h.timestamp).toLocaleString()}</td>
          <td>${h.releasedBy}</td>
          <td>${h.receivedBy}</td>
          <td>${h.location}</td>
          <td style="font-size: 8.5pt;">${h.purpose} <br><small style="color: #666; font-style: italic;">"${h.notes}"</small></td>
          <td>${sigs}</td>
        </tr>
      `;
    }).join('');

    return { caseId: caseData.id, itemId: itemData.itemId };
  }

  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      const valid = populatePrintArea();
      if (valid) {
        window.print();
      } else {
        alert("Failed to compile printing templates. Select a valid case and item first.");
      }
    });
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      const meta = populatePrintArea();
      if (!meta) {
        alert("Failed to generate PDF. Check if case and evidence are active.");
        return;
      }

      // Temporarily display printable area so html2pdf can capture it
      const printArea = document.getElementById('printable-report-area');
      printArea.style.display = 'block';

      const opt = {
        margin:       12, // mm margin
        filename:     `CoC_Forensic_Report_${meta.caseId}_${meta.itemId}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Generate PDF and save
      html2pdf().set(opt).from(printArea).save().then(() => {
        // Reset display state
        printArea.style.display = 'none';
      }).catch(err => {
        console.error("PDF engine crash: ", err);
        printArea.style.display = 'none';
        alert("An error occurred in the PDF generation pipeline.");
      });
    });
  }

  /* ==========================================================================
     DEFAULT DATA SEEDING (For Demo & Verification purposes)
     ========================================================================== */
  function seedDatabase() {
    const cases = DB.getCases();
    if (cases.length === 0) {
      // Seed a default case
      const demoCase = {
        id: 'CASE-2026-F812',
        investigator: 'Agent Sarah Jenkins',
        badge: 'Badge #9482',
        agency: 'Federal Cyber Defence Directorate (FCDD)',
        suspect: 'Marcus Vance (System Administrator)',
        date: '2026-08-01',
        notes: 'Suspected corporate espionage and insider trading. Target is corporate network administrator. Forensic audit authorized under warrant #FCDD-2026-88A.'
      };
      DB.createCase(demoCase);

      // Seed default evidence item
      const demoEvidence = {
        caseId: 'CASE-2026-F812',
        itemId: 'EVD-001-SSD',
        type: 'Solid State Drive (SSD)',
        serial: 'Samsung EVO 980 Pro 1TB, S/N: S62CNX0R49102X',
        location: 'Suspect secondary home workstation (M-12 bay)',
        collectedBy: 'Agent Sarah Jenkins',
        description: 'Samsung M.2 NVMe SSD. Collected in antistatic forensic bag. Write-blocked using Tableau T8u during acquisition verification.',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // empty hash but looks valid
      };
      DB.createEvidence(demoEvidence);
    }
    
    // Select first case as active if none is active
    if (!DB.getActiveCaseId() && DB.getCases().length > 0) {
      DB.setActiveCaseId(DB.getCases()[0].id);
    }
  }

  // Run seeding
  seedDatabase();
  
  // Initial page rendering setup
  renderActiveCaseDropdowns();
  renderTabContent('dashboard-tab');
});
