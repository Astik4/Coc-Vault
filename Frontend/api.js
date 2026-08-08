/* ==========================================================================
   API CLIENT — talks to the CoC Vault backend instead of LocalStorage
   ==========================================================================
   Set API_BASE below to wherever your backend is running. For local dev
   with the backend on port 4000, the default already works. Once you
   deploy the backend (Render/Railway/etc), change this to that URL.
   ========================================================================== */

const API_BASE = 'http://localhost:4000/api';

// Token lives in memory + sessionStorage (cleared when the tab closes).
// LocalStorage is avoided for the token since it persists indefinitely and
// is readable by any script on the page — sessionStorage at least limits
// the exposure window. Neither is fully XSS-proof; a production app would
// use an httpOnly cookie instead.
let authToken = sessionStorage.getItem('coc_auth_token') || null;
let currentUser = JSON.parse(sessionStorage.getItem('coc_current_user') || 'null');

function setSession(token, user) {
  authToken = token;
  currentUser = user;
  sessionStorage.setItem('coc_auth_token', token);
  sessionStorage.setItem('coc_current_user', JSON.stringify(user));
}

function clearSession() {
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem('coc_auth_token');
  sessionStorage.removeItem('coc_current_user');
}

function hasSession() {
  return !!authToken;
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token missing/expired — force back to login rather than showing a
    // confusing half-broken app state.
    clearSession();
    if (typeof window.onSessionExpired === 'function') window.onSessionExpired();
    throw new Error('Session expired. Please log in again.');
  }

  let body = null;
  try { body = await res.json(); } catch (_) { /* no JSON body */ }

  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return body;
}

/* --------------------------------------------------------------------------
   Field mapping helpers — the backend uses snake_case / different names
   than the original LocalStorage prototype. These keep the rest of the
   frontend code close to its original shape so render functions don't all
   need rewriting field-by-field.
   -------------------------------------------------------------------------- */
function mapCaseFromApi(row) {
  return {
    backendId: row.id,          // real UUID — used for API calls (evidence linkage)
    id: row.case_number,        // human case number — used for display, matches old UI
    investigator: row.lead_investigator,
    badge: row.badge_id || 'N/A',
    agency: row.agency || 'N/A',
    suspect: row.suspect || 'UNKNOWN/UNSPECIFIED',
    date: row.incident_date || '',
    notes: row.notes || 'No incident notes provided.',
    dateCreated: row.date_created
  };
}

function mapCustodyFromApi(row) {
  return {
    sequence: row.sequence,
    timestamp: row.timestamp,
    releasedBy: row.released_by,
    receivedBy: row.received_by,
    releasedSig: row.released_sig,
    receivedSig: row.received_sig,
    location: row.location,
    purpose: row.purpose,
    notes: row.notes
  };
}

function mapEvidenceFromApi(row) {
  return {
    backendId: row.id,          // real UUID — used for transfer/verify-chain calls
    caseId: row.case_id,        // backend case UUID (not the display case number)
    itemId: row.item_id,
    type: row.evidence_type,
    serial: row.make_model || 'N/A',
    location: row.location_found,
    collectedBy: row.collected_by,
    hash: row.file_hash,
    dateLogged: row.date_logged,
    custodyHistory: (row.custodyHistory || []).map(mapCustodyFromApi)
  };
}

/* --------------------------------------------------------------------------
   Public API — Auth
   -------------------------------------------------------------------------- */
const Auth = {
  async register(username, password, displayName) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName })
    });
    setSession(data.token, data.user);
    return data.user;
  },

  async login(username, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setSession(data.token, data.user);
    return data.user;
  },

  logout() {
    clearSession();
  },

  isLoggedIn() {
    return hasSession();
  },

  currentUser() {
    return currentUser;
  }
};

/* --------------------------------------------------------------------------
   Public API — Cases & Evidence (mirrors the shape of the old DB object
   where practical, but every method is now async since it hits the network)
   -------------------------------------------------------------------------- */
const Api = {
  async getCases() {
    const rows = await apiFetch('/cases');
    return rows.map(mapCaseFromApi);
  },

  async createCase({ id, investigator, badge, agency, suspect, date, notes }) {
    const row = await apiFetch('/cases', {
      method: 'POST',
      body: JSON.stringify({
        caseNumber: id,
        leadInvestigator: investigator,
        badgeId: badge,
        agency,
        suspect,
        incidentDate: date,
        notes
      })
    });
    return mapCaseFromApi(row);
  },

  async getEvidence(caseBackendId) {
    const query = caseBackendId ? `?caseId=${encodeURIComponent(caseBackendId)}` : '';
    const rows = await apiFetch(`/evidence${query}`);
    return rows.map(mapEvidenceFromApi);
  },

  async createEvidence({ caseId, itemId, type, serial, location, collectedBy, hash }) {
    const row = await apiFetch('/evidence', {
      method: 'POST',
      body: JSON.stringify({
        caseId,
        itemId,
        evidenceType: type,
        makeModel: serial,
        locationFound: location,
        collectedBy,
        fileHash: hash
      })
    });
    return mapEvidenceFromApi(row);
  },

  async transferEvidence(evidenceBackendId, transferData) {
    const row = await apiFetch(`/evidence/${evidenceBackendId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(transferData)
    });
    return mapEvidenceFromApi(row);
  },

  async verifyChain(evidenceBackendId) {
    return apiFetch(`/evidence/${evidenceBackendId}/verify-chain`);
  }
};
