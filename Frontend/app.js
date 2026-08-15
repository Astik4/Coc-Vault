/* ==========================================================================
   SIGNATURE PAD CLASS  (unchanged from the original prototype)
   ========================================================================== */
class SignaturePad {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;

    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 2.5;

    this.setupListeners();
    this.resizeCanvas();
  }

  setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

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
    const buffer = new Uint32Array(
      this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  }

  toDataURL() {
    return this.canvas.toDataURL();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width || 250;
    this.canvas.height = rect.height || 120;
    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 2.5;
  }
}

/* ==========================================================================
   AUTH GATE — shows login/register until a valid session exists
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Lucide icons are loaded from a CDN (see index.html). If that CDN is
  // ever slow, blocked (ad-blocker, restrictive network), or offline, the
  // rest of the app must not break — icons are cosmetic, not functional —
  // so every icon refresh in this file goes through this guarded helper
  // instead of calling lucide.createIcons() directly.
  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  // Render icons immediately so the auth screen's icons show up even
  // before a successful login — previously this only ran after initApp(),
  // so the login screen's icon never actually appeared.
  refreshIcons();

  const authOverlay = document.getElementById('auth-overlay');
  const appContainer = document.getElementById('app-container');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const authModeToggle = document.getElementById('auth-mode-toggle');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authTitle = document.getElementById('auth-title');
  const authDisplayNameGroup = document.getElementById('auth-displayname-group');

  let authMode = 'login'; // or 'register'
  let appInitialized = false;

  function showApp() {
    authOverlay.style.display = 'none';
    appContainer.style.display = 'flex';
    if (!appInitialized) {
      appInitialized = true;
      initApp();
    }
  }

  function showAuthOverlay() {
    appContainer.style.display = 'none';
    authOverlay.style.display = 'flex';
  }

  window.onSessionExpired = () => {
    showAuthOverlay();
    authError.textContent = 'Your session expired. Please log in again.';
    authError.style.display = 'block';
  };

  authModeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    authMode = authMode === 'login' ? 'register' : 'login';
    authTitle.textContent = authMode === 'login' ? 'Sign In to CoC Vault' : 'Create Investigator Account';
    authSubmitBtn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    authModeToggle.textContent = authMode === 'login' ? "Need an account? Register" : "Already have an account? Sign in";
    authDisplayNameGroup.style.display = authMode === 'register' ? 'block' : 'none';
    authError.style.display = 'none';
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.style.display = 'none';
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const displayName = document.getElementById('auth-displayname').value.trim();

    authSubmitBtn.disabled = true;
    try {
      if (authMode === 'login') {
        await Auth.login(username, password);
      } else {
        await Auth.register(username, password, displayName || username);
      }
      authForm.reset();
      showApp();
    } catch (err) {
      authError.textContent = err.message;
      authError.style.display = 'block';
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  // Entry point: skip straight to the app if a session token already exists.
  if (Auth.isLoggedIn()) {
    showApp();
  } else {
    showAuthOverlay();
  }

  /* ========================================================================
     MAIN APP (only runs after a successful login)
     ======================================================================== */
  function initApp() {
    let activeTab = 'dashboard-tab';
    let activeCaseBackendId = ''; // backend UUID of the selected case (used for API calls)
    let releasedSigPad = null;
    let receivedSigPad = null;

    // Local caches — refreshed from the API whenever data changes, rather
    // than being the source of truth themselves (the backend is now that).
    let casesCache = [];
    let evidenceCache = [];

    refreshIcons();

    // Logout button (added to the sidebar in index.html)
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Auth.logout();
        location.reload();
      });
    }
    const currentUserLabel = document.getElementById('current-user-label');
    if (currentUserLabel && Auth.currentUser()) {
      currentUserLabel.textContent = Auth.currentUser().displayName || Auth.currentUser().username;
    }

    const initSignaturePads = () => {
      const canvasReleased = document.getElementById('canvas-released-sig');
      const canvasReceived = document.getElementById('canvas-received-sig');
      if (canvasReleased && canvasReceived) {
        releasedSigPad = new SignaturePad(canvasReleased);
        receivedSigPad = new SignaturePad(canvasReceived);
      }
    };

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
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const tabId = item.getAttribute('data-tab');

        menuItems.forEach(mi => mi.classList.remove('active'));
        item.classList.add('active');

        tabPanes.forEach(tp => tp.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');

        activeTab = tabId;
        updatePageTitle(tabId);
        await renderTabContent(tabId);
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

    caseSelect.addEventListener('change', async (e) => {
      activeCaseBackendId = e.target.value;
      await renderActiveCaseDropdowns();
      await renderTabContent(activeTab);
    });

    async function refreshCaches() {
      casesCache = await Api.getCases();
      evidenceCache = await Api.getEvidence(); // all evidence; filtered client-side per case
    }

    async function renderActiveCaseDropdowns() {
      caseSelect.innerHTML = '<option value="" disabled>Select a Case</option>';
      if (casesCache.length === 0) {
        caseSelect.innerHTML += '<option value="" disabled selected>No active cases</option>';
      } else {
        casesCache.forEach(c => {
          const selectedAttr = c.backendId === activeCaseBackendId ? 'selected' : '';
          caseSelect.innerHTML += `<option value="${c.backendId}" ${selectedAttr}>${c.id} - ${c.investigator}</option>`;
        });
      }

      const integrityCaseSelect = document.getElementById('integrity-case-select');
      if (integrityCaseSelect) {
        integrityCaseSelect.innerHTML = '<option value="" disabled selected>Choose Case...</option>';
        casesCache.forEach(c => {
          const selectedAttr = c.backendId === activeCaseBackendId ? 'selected' : '';
          integrityCaseSelect.innerHTML += `<option value="${c.backendId}" ${selectedAttr}>${c.id}</option>`;
        });
      }
    }

    /* ==========================================
       MODALS MANAGEMENT
       ========================================== */
    const btnOpenCaseModal = document.getElementById('btn-open-case-modal');
    const caseModalOverlay = document.getElementById('new-case-modal-overlay');
    const caseModalClose = document.getElementById('new-case-modal-close');
    const btnCancelCase = document.getElementById('btn-cancel-case');
    const newCaseForm = document.getElementById('new-case-form');

    const openCaseModal = () => {
      const localDateStr = new Date().toISOString().split('T')[0];
      document.getElementById('case-date').value = localDateStr;
      caseModalOverlay.classList.add('active');
    };

    const closeCaseModal = () => {
      newCaseForm.reset();
      caseModalOverlay.classList.remove('active');
    };

    btnOpenCaseModal.addEventListener('click', openCaseModal);
    // Second "New Case File" button lives in the Case Management card header
    const btnOpenCaseModal2 = document.getElementById('btn-open-case-modal-2');
    if (btnOpenCaseModal2) btnOpenCaseModal2.addEventListener('click', openCaseModal);
    caseModalClose.addEventListener('click', closeCaseModal);
    btnCancelCase.addEventListener('click', closeCaseModal);

    newCaseForm.addEventListener('submit', async (e) => {
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

      try {
        const created = await Api.createCase(newCase);
        closeCaseModal();
        activeCaseBackendId = created.backendId;
        await refreshCaches();
        await renderActiveCaseDropdowns();
        await renderTabContent(activeTab);
        alert(`Case "${newCase.id}" has been initialized successfully.`);
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });

    // Transfer Modal
    const transferModalOverlay = document.getElementById('transfer-modal-overlay');
    const transferModalClose = document.getElementById('transfer-modal-close');
    const btnCancelTransfer = document.getElementById('btn-cancel-transfer');
    const transferForm = document.getElementById('transfer-form');
    const btnOpenTransferModal = document.getElementById('btn-open-transfer-modal');
    const ledgerEvidenceSelect = document.getElementById('ledger-evidence-select');

    let selectedEvidenceBackendId = null;

    const openTransferModal = () => {
      const selectedItemId = ledgerEvidenceSelect.value;
      if (!activeCaseBackendId || !selectedItemId) return;

      const ev = evidenceCache.find(item => item.caseId === activeCaseBackendId && item.itemId === selectedItemId);
      if (!ev) return;
      selectedEvidenceBackendId = ev.backendId;

      const lastTransfer = ev.custodyHistory[ev.custodyHistory.length - 1];
      document.getElementById('trans-released-by').value = lastTransfer.receivedBy;

      transferModalOverlay.classList.add('active');

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

    transferForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!releasedSigPad || releasedSigPad.isEmpty() || !receivedSigPad || receivedSigPad.isEmpty()) {
        alert("Signatures are required for both the Releasing and Receiving officers.");
        return;
      }
      if (!selectedEvidenceBackendId) {
        alert("No evidence item selected.");
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

      try {
        await Api.transferEvidence(selectedEvidenceBackendId, transferData);
        closeTransferModal();
        await refreshCaches();
        await renderTabContent('ledger-tab');
        alert(`Custody handoff logged successfully.`);
      } catch (err) {
        alert(`Database error: ${err.message}`);
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
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) processFileForHash(files[0], outputField, loaderEl);
      });
      input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) processFileForHash(files[0], outputField, loaderEl);
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

    async function calculateFileSHA256(file) {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    setupDropzone(dropzone, fileInput, hashField, hashCalcStatus);

    const verifyDropzone = document.getElementById('verify-dropzone');
    const verifyFileInput = document.getElementById('integrity-file-input');
    const verifyCalcHash = document.getElementById('integrity-calc-hash');
    const verifyCalcStatus = document.getElementById('verify-calc-status');

    setupDropzone(verifyDropzone, verifyFileInput, verifyCalcHash, verifyCalcStatus);

    if (verifyFileInput) {
      verifyFileInput.addEventListener('change', () => setTimeout(runIntegrityCheck, 300));
    }
    if (verifyDropzone) {
      verifyDropzone.addEventListener('drop', () => setTimeout(runIntegrityCheck, 300));
    }

    /* ==========================================
       TAB RENDERING ROUTINES
       ========================================== */
    async function renderTabContent(tabId) {
      switch (tabId) {
        case 'dashboard-tab':
          renderDashboard();
          break;
        case 'cases-tab':
          renderCases();
          break;
        case 'evidence-tab':
          renderEvidence();
          break;
        case 'ledger-tab':
          renderLedger();
          break;
        case 'integrity-tab':
          await renderIntegrityTab();
          break;
      }
      refreshIcons();
    }

    /* --- Render Dashboard --- */
    function renderDashboard() {
      document.getElementById('stat-cases').textContent = casesCache.length;

      const activeCaseEvidence = evidenceCache.filter(e => e.caseId === activeCaseBackendId);
      document.getElementById('stat-evidence').textContent = activeCaseEvidence.length;

      let totalTransfers = 0;
      activeCaseEvidence.forEach(item => { totalTransfers += (item.custodyHistory.length - 1); });
      document.getElementById('stat-transfers').textContent = totalTransfers;

      const overviewContainer = document.getElementById('dashboard-active-case-content');
      const activeCase = casesCache.find(c => c.backendId === activeCaseBackendId);

      if (activeCase) {
        overviewContainer.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.95rem;">
            <p><strong>Case Number:</strong> <span style="font-family: monospace; font-weight: 700; color: var(--primary);">${activeCase.id}</span></p>
            <p><strong>Lead Investigator:</strong> ${activeCase.investigator} (${activeCase.badge})</p>
            <p><strong>Agency:</strong> ${activeCase.agency}</p>
            <p><strong>Suspect/Target:</strong> ${activeCase.suspect}</p>
            <p><strong>Incident Initiated:</strong> ${activeCase.date}</p>
            <p><strong>Security Status:</strong> <span class="badge badge-success">Server-side / Hash-chained</span></p>
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

      const transfersContainer = document.getElementById('dashboard-recent-transfers');
      let allHandoffs = [];
      activeCaseEvidence.forEach(item => {
        const transfers = item.custodyHistory.filter(c => c.sequence > 1);
        transfers.forEach(t => allHandoffs.push({ itemId: item.itemId, itemType: item.type, ...t }));
      });
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

    /* --- Render Cases Directory ---
       Deletion is allowed for correcting data-entry mistakes (e.g. a case
       opened by accident, or clearing demo data) — it cascades to that
       case's evidence and custody logs on the backend. In a real
       production CoC deployment you'd typically close/void a case rather
       than erase it, to preserve the audit trail; this project keeps hard
       delete because it's the more useful behaviour for a student/demo
       build, and the confirm dialog below makes sure it's intentional. */
    function renderCases() {
      const tableBody = document.getElementById('case-table-body');

      if (casesCache.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
              <i data-lucide="folder" style="width: 32px; height: 32px; stroke-width: 1.5; margin-bottom: 8px; color: var(--text-light); display: block; margin-left: auto; margin-right: auto;"></i>
              No forensic cases logged in system.
            </td>
          </tr>
        `;
        refreshIcons();
        return;
      }

      tableBody.innerHTML = casesCache.map(c => {
        const itemsCount = evidenceCache.filter(e => e.caseId === c.backendId).length;
        const isActive = c.backendId === activeCaseBackendId;
        const statusBtn = isActive
          ? `<span class="badge badge-success"><i data-lucide="check" style="width: 12px; height: 12px; margin-right: 2px;"></i> Active</span>`
          : `<button class="btn btn-secondary btn-sm btn-activate-case" data-id="${c.backendId}" style="padding: 4px 8px; font-size: 0.8rem;">Select</button>`;

        return `
          <tr style="${isActive ? 'background-color: var(--primary-light);' : ''}">
            <td style="font-family: monospace; font-weight: 700;">${c.id}</td>
            <td>${c.date}</td>
            <td>${c.investigator} (${c.badge})</td>
            <td>${c.agency}</td>
            <td>${c.suspect}</td>
            <td style="text-align: center; font-weight: 700;">${itemsCount}</td>
            <td>
              <div style="display: flex; gap: 6px; align-items: center;">
                ${statusBtn}
                <button class="btn-icon-danger btn-delete-case" data-id="${c.backendId}" data-label="${c.id}" data-count="${itemsCount}" title="Delete case">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      refreshIcons();

      document.querySelectorAll('.btn-activate-case').forEach(btn => {
        btn.addEventListener('click', async () => {
          activeCaseBackendId = btn.getAttribute('data-id');
          await renderActiveCaseDropdowns();
          await renderTabContent('cases-tab');
        });
      });

      document.querySelectorAll('.btn-delete-case').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const label = btn.getAttribute('data-label');
          const count = btn.getAttribute('data-count');
          const extra = Number(count) > 0 ? ` This will also permanently delete its ${count} evidence item(s) and their full custody logs.` : '';
          if (!confirm(`Delete case "${label}"?${extra}\n\nThis cannot be undone.`)) return;

          try {
            await Api.deleteCase(id);
            if (activeCaseBackendId === id) activeCaseBackendId = '';
            await refreshCaches();
            await renderActiveCaseDropdowns();
            await renderTabContent(activeTab);
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
        });
      });
    }

    /* --- Render Evidence Vault --- */
    const evidenceForm = document.getElementById('evidence-form');
    if (evidenceForm) {
      evidenceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newEvidence = {
          caseId: activeCaseBackendId,
          itemId: document.getElementById('evidence-id').value.trim(),
          type: document.getElementById('evidence-type').value,
          serial: document.getElementById('evidence-serial').value.trim() || 'N/A',
          location: document.getElementById('evidence-location').value.trim(),
          collectedBy: document.getElementById('evidence-collected-by').value.trim(),
          hash: document.getElementById('evidence-hash').value.trim()
        };

        const existing = evidenceCache.find(item => item.caseId === activeCaseBackendId && item.itemId.toLowerCase() === newEvidence.itemId.toLowerCase());
        if (existing) {
          alert(`Error: Evidence item "${newEvidence.itemId}" is already registered under this case file.`);
          return;
        }

        try {
          await Api.createEvidence(newEvidence);
          evidenceForm.reset();
          document.getElementById('evidence-hash').value = '';
          await refreshCaches();
          await renderTabContent('evidence-tab');
          alert(`Evidence Item "${newEvidence.itemId}" securely logged and hash signed.`);
        } catch (err) {
          alert(`Error: ${err.message}`);
        }
      });
    }

    function renderEvidence() {
      const noCaseAlert = document.getElementById('evidence-no-case-alert');
      const activeContainer = document.getElementById('evidence-active-container');

      if (!activeCaseBackendId) {
        noCaseAlert.style.display = 'block';
        activeContainer.style.display = 'none';
        document.getElementById('btn-evidence-select-case').onclick = () => openCaseModal();
        return;
      }

      noCaseAlert.style.display = 'none';
      // display: flex here (not 'grid') — #evidence-active-container is
      // styled as a flex column in style.css so the evidence table always
      // gets the tab's full width instead of squeezing into a grid column
      // next to the form. Setting an inline style value that doesn't match
      // the stylesheet's display mode would silently win over it (inline
      // styles always beat CSS selectors), so this has to stay in sync
      // with the '#evidence-active-container' rule in style.css.
      activeContainer.style.display = 'flex';

      const tableBody = document.getElementById('evidence-table-body');
      const caseItems = evidenceCache.filter(e => e.caseId === activeCaseBackendId);

      if (caseItems.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
              <i data-lucide="shield-alert" style="width: 32px; height: 32px; stroke-width: 1.5; margin-bottom: 8px; color: var(--text-light); display: block; margin-left: auto; margin-right: auto;"></i>
              No forensic evidence logged for this case. Register an item using the left form.
            </td>
          </tr>
        `;
        refreshIcons();
        return;
      }

      tableBody.innerHTML = caseItems.map(item => {
        const lastCustodian = item.custodyHistory[item.custodyHistory.length - 1].receivedBy;
        const loggedDate = new Date(item.dateLogged);
        // Short date only in the table (full timestamp still available via
        // the title tooltip) — this is one of several columns competing
        // for space in a fairly narrow table, so being economical here
        // keeps the Actions/delete column from needing a horizontal
        // scroll to reach on a typical laptop screen.
        const formattedDate = loggedDate.toLocaleDateString();

        return `
          <tr>
            <td style="font-family: monospace; font-weight: 700; color: var(--primary);">${item.itemId}</td>
            <td><strong>${item.type}</strong><br><small style="color: var(--text-muted); font-family: monospace;">S/N: ${item.serial}</small></td>
            <td><span title="${item.location}" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; max-width: 150px;">${item.location}</span></td>
            <td>
              <div style="font-family: monospace; font-size: 0.75rem; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.hash}">
                ${item.hash}
              </div>
            </td>
            <td style="font-size: 0.8rem; white-space: nowrap;" title="${loggedDate.toLocaleString()}">${formattedDate}</td>
            <td><span class="badge badge-info" style="max-width: 130px;" title="${lastCustodian}"><i data-lucide="user" style="width: 10px; height: 10px; margin-right: 2px; flex-shrink: 0;"></i><span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${lastCustodian}</span></span></td>
            <td>
              <button class="btn-icon-danger btn-delete-evidence" data-id="${item.backendId}" data-label="${item.itemId}" title="Delete evidence item">
                <i data-lucide="trash-2"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      refreshIcons();

      document.querySelectorAll('.btn-delete-evidence').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const label = btn.getAttribute('data-label');
          if (!confirm(`Delete evidence item "${label}"?\n\nThis permanently removes it and its full custody log. This cannot be undone.`)) return;

          try {
            await Api.deleteEvidence(id);
            await refreshCaches();
            await renderTabContent(activeTab);
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
        });
      });
    }

    /* --- Render Custody Ledger Tab --- */
    if (ledgerEvidenceSelect) {
      ledgerEvidenceSelect.addEventListener('change', (e) => {
        const itemId = e.target.value;
        const ev = evidenceCache.find(item => item.caseId === activeCaseBackendId && item.itemId === itemId);

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

    function renderLedger() {
      const noCaseAlert = document.getElementById('ledger-no-case-alert');
      const activeContainer = document.getElementById('ledger-active-container');

      if (!activeCaseBackendId) {
        noCaseAlert.style.display = 'block';
        activeContainer.style.display = 'none';
        return;
      }

      noCaseAlert.style.display = 'none';
      activeContainer.style.display = 'grid';

      const caseItems = evidenceCache.filter(e => e.caseId === activeCaseBackendId);
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
    const chainVerifyBtn = document.getElementById('btn-verify-chain');
    const chainVerifyBanner = document.getElementById('chain-verify-banner');

    let integritySelectedEvidenceBackendId = null;

    if (integrityCaseSelect) {
      integrityCaseSelect.addEventListener('change', (e) => {
        const caseBackendId = e.target.value;
        const items = evidenceCache.filter(item => item.caseId === caseBackendId);

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

        integrityDbHashPreview.style.display = 'none';
        document.getElementById('integrity-result-banner').style.display = 'none';
        if (chainVerifyBanner) chainVerifyBanner.style.display = 'none';
        document.getElementById('integrity-calc-hash').value = '';
      });
    }

    if (integrityEvidenceSelect) {
      integrityEvidenceSelect.addEventListener('change', (e) => {
        const caseBackendId = integrityCaseSelect.value;
        const itemId = e.target.value;
        const item = evidenceCache.find(i => i.caseId === caseBackendId && i.itemId === itemId);

        if (item) {
          integritySelectedEvidenceBackendId = item.backendId;
          integrityDbHashPreview.style.display = 'block';
          integrityDbHash.textContent = item.hash;
          runIntegrityCheck();
        } else {
          integritySelectedEvidenceBackendId = null;
          integrityDbHashPreview.style.display = 'none';
        }
        if (chainVerifyBanner) chainVerifyBanner.style.display = 'none';
      });
    }

    if (chainVerifyBtn) {
      chainVerifyBtn.addEventListener('click', async () => {
        if (!integritySelectedEvidenceBackendId) {
          alert('Select a case and evidence item first.');
          return;
        }
        chainVerifyBtn.disabled = true;
        chainVerifyBtn.textContent = 'Verifying...';
        try {
          const result = await Api.verifyChain(integritySelectedEvidenceBackendId);
          chainVerifyBanner.style.display = 'flex';
          if (result.intact) {
            chainVerifyBanner.className = 'integrity-banner integrity-success';
            chainVerifyBanner.innerHTML = `
              <i data-lucide="link-2"></i>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem;">Custody Chain Intact</h4>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; font-weight: normal; opacity: 0.9;">${result.message}</p>
              </div>
            `;
          } else {
            chainVerifyBanner.className = 'integrity-banner integrity-failed';
            chainVerifyBanner.innerHTML = `
              <i data-lucide="link-2-off"></i>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem;">Custody Chain Broken</h4>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; font-weight: normal; opacity: 0.9;">${result.message}</p>
              </div>
            `;
          }
          refreshIcons();
        } catch (err) {
          alert(`Chain verification failed: ${err.message}`);
        } finally {
          chainVerifyBtn.disabled = false;
          chainVerifyBtn.textContent = 'Verify Custody Chain Integrity';
        }
      });
    }

    async function renderIntegrityTab() {
      await renderActiveCaseDropdowns();

      document.getElementById('integrity-file-input').value = '';
      document.getElementById('integrity-calc-hash').value = '';
      document.getElementById('integrity-result-banner').style.display = 'none';
      if (chainVerifyBanner) chainVerifyBanner.style.display = 'none';

      if (activeCaseBackendId) {
        integrityCaseSelect.value = activeCaseBackendId;
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
      refreshIcons();
    }

    /* ==========================================================================
       REPORT EXPORT UTILITIES (Print / PDF)
       ========================================================================== */
    const btnPrintReport = document.getElementById('btn-print-report');
    const btnExportPdf = document.getElementById('btn-export-pdf');

    function populatePrintArea() {
      const itemId = ledgerEvidenceSelect.value;
      if (!activeCaseBackendId || !itemId) return false;

      const caseData = casesCache.find(c => c.backendId === activeCaseBackendId);
      const itemData = evidenceCache.find(i => i.caseId === activeCaseBackendId && i.itemId === itemId);

      if (!caseData || !itemData) return false;

      document.getElementById('print-report-gen-time').textContent = new Date().toLocaleString();

      document.getElementById('print-case-id').textContent = caseData.id;
      document.getElementById('print-case-date').textContent = caseData.date;
      document.getElementById('print-case-investigator').textContent = caseData.investigator;
      document.getElementById('print-case-badge').textContent = caseData.badge;
      document.getElementById('print-case-agency').textContent = caseData.agency;
      document.getElementById('print-case-target').textContent = caseData.suspect;
      document.getElementById('print-case-notes').textContent = caseData.notes;

      document.getElementById('print-item-id').textContent = itemData.itemId;
      document.getElementById('print-item-type').textContent = itemData.type;
      document.getElementById('print-item-serial').textContent = `S/N: ${itemData.serial}`;
      document.getElementById('print-item-location').textContent = itemData.location;
      document.getElementById('print-item-date').textContent = new Date(itemData.dateLogged).toLocaleString();
      document.getElementById('print-item-collected-by').textContent = itemData.collectedBy;
      document.getElementById('print-item-hash').textContent = itemData.hash;
      document.getElementById('print-item-description').textContent = itemData.type;

      const ledgerTableBody = document.getElementById('print-ledger-rows');
      ledgerTableBody.innerHTML = itemData.custodyHistory.map(h => {
        const isAcq = h.sequence === 1;
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
        if (valid) window.print();
        else alert("Failed to compile printing templates. Select a valid case and item first.");
      });
    }

    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', () => {
        const meta = populatePrintArea();
        if (!meta) {
          alert("Failed to generate PDF. Check if case and evidence are active.");
          return;
        }

        const printArea = document.getElementById('printable-report-area');
        printArea.style.display = 'block';

        const opt = {
          margin: 12,
          filename: `CoC_Forensic_Report_${meta.caseId}_${meta.itemId}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(printArea).save().then(() => {
          printArea.style.display = 'none';
        }).catch(err => {
          console.error("PDF engine crash: ", err);
          printArea.style.display = 'none';
          alert("An error occurred in the PDF generation pipeline.");
        });
      });
    }

    /* ==========================================================================
       INITIAL LOAD
       ========================================================================== */
    (async function bootstrap() {
      try {
        await refreshCaches();
        if (!activeCaseBackendId && casesCache.length > 0) {
          activeCaseBackendId = casesCache[0].backendId;
        }
        await renderActiveCaseDropdowns();
        await renderTabContent('dashboard-tab');
      } catch (err) {
        console.error('Failed to load initial data:', err);
        alert(`Could not load data from the server: ${err.message}\n\nMake sure the backend is running (npm start in the Backend folder) and API_BASE in api.js points to it.`);
      }
    })();
  }
});
