// API Base URL
const API_BASE = window.location.origin + '/api';

// State
let currentView = 'dashboard';
let authToken = localStorage.getItem('adminToken');
let adminInfo = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    // Verify token and load dashboard
    verifyToken();
  } else {
    showLogin();
  }

  setupEventListeners();
});

function setupEventListeners() {
  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('logout', handleLogout);

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });

  // Members
  document.getElementById('refreshMembersBtn')?.addEventListener('click', loadMembers);
  document.getElementById('memberSearch')?.addEventListener('input', debounce(loadMembers, 500));

  // Analytics
  document.getElementById('analyticsTimeframe')?.addEventListener('change', loadAnalytics);

  // Enrichment
  document.getElementById('refreshEnrichmentBtn')?.addEventListener('click', loadEnrichment);
  document.getElementById('triggerBulkEnrichmentBtn')?.addEventListener('click', triggerBulkEnrichment);
}

// Authentication
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');
  const errorDiv = document.getElementById('loginError');

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
  errorDiv.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Check if user is admin
    if (!data.firm.isAdmin && data.firm.role !== 'admin' && data.firm.role !== 'superadmin') {
      throw new Error('Admin access required');
    }

    authToken = data.token;
    adminInfo = data.firm;
    localStorage.setItem('adminToken', authToken);

    showDashboard();
    loadDashboardData();
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
  }
}

async function verifyToken() {
  try {
    const response = await apiCall('/admin/members/stats');
    if (response.ok) {
      showDashboard();
      loadDashboardData();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
  }
}

function handleLogout() {
  localStorage.removeItem('adminToken');
  authToken = null;
  adminInfo = null;
  showLogin();
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';

  if (adminInfo) {
    document.getElementById('adminName').textContent = adminInfo.firmName || adminInfo.email;
  }
}

// View Switching
function switchView(viewName) {
  currentView = viewName;

  // Update navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`${viewName}View`).classList.add('active');

  // Load data for view
  switch (viewName) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'members':
      loadMembers();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'enrichment':
      loadEnrichment();
      break;
  }
}

// Dashboard
async function loadDashboardData() {
  try {
    const [stats, enrichmentStats] = await Promise.all([
      apiCall('/admin/members/stats').then(r => r.json()),
      apiCall('/admin/enrichment/stats').then(r => r.json())
    ]);

    // Update stats
    document.getElementById('statTotalFirms').textContent = stats.firms.total;
    document.getElementById('statActiveFirms').textContent = `${stats.firms.active} active`;
    document.getElementById('statTotalDeals').textContent = stats.deals.total;
    document.getElementById('statActiveDeals').textContent = `${stats.deals.active} active`;
    document.getElementById('statTotalInvitations').textContent = stats.invitations.total;
    document.getElementById('statAcceptanceRate').textContent = `${stats.invitations.acceptanceRate}% acceptance`;
    document.getElementById('statTotalNDAs').textContent = stats.ndas.total;

    // Update enrichment overview
    document.getElementById('enrichmentCompleted').textContent = enrichmentStats.firms.enriched;
    document.getElementById('enrichmentPending').textContent = enrichmentStats.firms.pending;
    document.getElementById('enrichmentFailed').textContent = enrichmentStats.firms.failed;
    document.getElementById('enrichmentRate').textContent = `${enrichmentStats.firms.enrichmentRate}%`;
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showError('Failed to load dashboard data');
  }
}

// Members
let currentMembersPage = 1;

async function loadMembers(page = 1) {
  currentMembersPage = page;
  const search = document.getElementById('memberSearch')?.value || '';

  try {
    const response = await apiCall(`/admin/members/firms?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
    const data = await response.json();

    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '';

    if (data.firms.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No firms found</td></tr>';
      return;
    }

    data.firms.forEach(firm => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${escapeHtml(firm.firmName)}</strong></td>
        <td>${escapeHtml(firm.email)}</td>
        <td><span class="badge badge-info">${firm.role}</span></td>
        <td><span class="badge badge-${getStatusBadge(firm.status)}">${firm.status}</span></td>
        <td>${firm._count.deals}</td>
        <td>${formatDate(firm.createdAt)}</td>
        <td>
          <button class="btn btn-small btn-secondary" onclick="viewFirm('${firm.id}')">
            <i class="fas fa-eye"></i> View
          </button>
          ${firm.status === 'active' ?
            `<button class="btn btn-small btn-danger" onclick="suspendFirm('${firm.id}')">Suspend</button>` :
            `<button class="btn btn-small btn-success" onclick="activateFirm('${firm.id}')">Activate</button>`
          }
        </td>
      `;
      tbody.appendChild(row);
    });

    // Update pagination
    renderPagination('membersPagination', data.pagination, loadMembers);
  } catch (error) {
    console.error('Error loading members:', error);
    showError('Failed to load members');
  }
}

async function viewFirm(firmId) {
  try {
    const response = await apiCall(`/admin/members/firms/${firmId}`);
    const firm = await response.json();

    alert(`Firm Details:\n\nName: ${firm.firmName}\nEmail: ${firm.email}\nRole: ${firm.role}\nStatus: ${firm.status}\n\nDeals: ${firm._count.deals}\nInvitations Sent: ${firm._count.sentInvitations}\nInvitations Received: ${firm._count.receivedInvitations}\nNDAs: ${firm._count.ndas}\n\nJoined: ${new Date(firm.createdAt).toLocaleDateString()}`);
  } catch (error) {
    showError('Failed to load firm details');
  }
}

async function suspendFirm(firmId) {
  if (!confirm('Are you sure you want to suspend this firm?')) return;

  try {
    const response = await apiCall(`/admin/members/firms/${firmId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'suspended' })
    });

    if (response.ok) {
      showSuccess('Firm suspended successfully');
      loadMembers(currentMembersPage);
    } else {
      throw new Error('Failed to suspend firm');
    }
  } catch (error) {
    showError(error.message);
  }
}

async function activateFirm(firmId) {
  try {
    const response = await apiCall(`/admin/members/firms/${firmId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active' })
    });

    if (response.ok) {
      showSuccess('Firm activated successfully');
      loadMembers(currentMembersPage);
    } else {
      throw new Error('Failed to activate firm');
    }
  } catch (error) {
    showError(error.message);
  }
}

// Analytics
async function loadAnalytics() {
  const timeframe = document.getElementById('analyticsTimeframe').value;

  try {
    const [dealData, invitationData, algorithmData] = await Promise.all([
      apiCall(`/admin/analytics/deals?timeframe=${timeframe}`).then(r => r.json()),
      apiCall(`/admin/analytics/invitations?timeframe=${timeframe}`).then(r => r.json()),
      apiCall(`/admin/analytics/algorithm`).then(r => r.json())
    ]);

    // Render deal analytics
    const dealHtml = `
      <div class="analytics-metric">
        <span class="metric-label">Total Deals:</span>
        <span class="metric-value">${dealData.summary.totalDeals}</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Total Volume:</span>
        <span class="metric-value">$${(dealData.summary.totalVolume / 1000000).toFixed(2)}M</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Average Deal Size:</span>
        <span class="metric-value">$${(dealData.summary.averageDealSize / 1000000).toFixed(2)}M</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Avg Syndicate Size:</span>
        <span class="metric-value">${dealData.summary.averageSyndicateSize} firms</span>
      </div>
    `;
    document.getElementById('dealAnalytics').innerHTML = dealHtml;

    // Render invitation analytics
    const invitationHtml = `
      <div class="analytics-metric">
        <span class="metric-label">Total Invitations:</span>
        <span class="metric-value">${invitationData.summary.total}</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Accepted:</span>
        <span class="metric-value">${invitationData.summary.accepted}</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Acceptance Rate:</span>
        <span class="metric-value">${invitationData.summary.acceptanceRate}%</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Avg Response Time:</span>
        <span class="metric-value">${invitationData.summary.avgResponseTimeHours}h</span>
      </div>
    `;
    document.getElementById('invitationAnalytics').innerHTML = invitationHtml;

    // Render algorithm analytics
    const algorithmHtml = `
      <div class="analytics-metric">
        <span class="metric-label">Overall Accuracy:</span>
        <span class="metric-value">${algorithmData.overall.accuracy}%</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Total Matches:</span>
        <span class="metric-value">${algorithmData.overall.totalInvitations}</span>
      </div>
      <div class="analytics-metric">
        <span class="metric-label">Successful Matches:</span>
        <span class="metric-value">${algorithmData.overall.acceptedInvitations}</span>
      </div>
      ${algorithmData.recommendations.map(rec => `
        <div style="padding: 12px; background: ${rec.type === 'success' ? '#d1fae5' : rec.type === 'warning' ? '#fef3c7' : '#dbeafe'}; border-radius: 6px; margin-top: 8px;">
          <small>${rec.message}</small>
        </div>
      `).join('')}
    `;
    document.getElementById('algorithmAnalytics').innerHTML = algorithmHtml;
  } catch (error) {
    console.error('Error loading analytics:', error);
    showError('Failed to load analytics');
  }
}

// Enrichment
let currentEnrichmentPage = 1;

async function loadEnrichment(page = 1) {
  currentEnrichmentPage = page;

  try {
    const [enrichments, stats] = await Promise.all([
      apiCall(`/admin/enrichment?page=${page}&limit=20`).then(r => r.json()),
      apiCall('/admin/enrichment/stats').then(r => r.json())
    ]);

    // Update stats
    document.getElementById('enrichmentTotalFirms').textContent = stats.firms.total;
    document.getElementById('enrichmentEnrichedCount').textContent = stats.firms.enriched;
    document.getElementById('enrichmentPendingCount').textContent = stats.firms.pending;
    document.getElementById('enrichmentFailedCount').textContent = stats.firms.failed;

    // Update table
    const tbody = document.getElementById('enrichmentTableBody');
    tbody.innerHTML = '';

    if (enrichments.enrichments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">No enrichment data</td></tr>';
      return;
    }

    enrichments.enrichments.forEach(enrichment => {
      const row = document.createElement('tr');
      const dataSources = [];
      if (enrichment.companiesHouseData) dataSources.push('Companies House');
      if (enrichment.linkedinData) dataSources.push('LinkedIn');
      if (enrichment.webData) dataSources.push('Web');

      row.innerHTML = `
        <td><strong>${escapeHtml(enrichment.firm.firmName)}</strong></td>
        <td><span class="badge badge-${getEnrichmentStatusBadge(enrichment.enrichmentStatus)}">${enrichment.enrichmentStatus}</span></td>
        <td>${enrichment.lastEnriched ? formatDate(enrichment.lastEnriched) : 'Never'}</td>
        <td>${dataSources.join(', ') || 'None'}</td>
        <td>
          <button class="btn btn-small btn-primary" onclick="triggerEnrichment('${enrichment.firmId}')">
            <i class="fas fa-sync"></i> Enrich
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Update pagination
    renderPagination('enrichmentPagination', enrichments.pagination, loadEnrichment);
  } catch (error) {
    console.error('Error loading enrichment:', error);
    showError('Failed to load enrichment data');
  }
}

async function triggerEnrichment(firmId) {
  try {
    const response = await apiCall(`/admin/enrichment/trigger/${firmId}`, {
      method: 'POST'
    });

    if (response.ok) {
      showSuccess('Enrichment job queued');
      setTimeout(() => loadEnrichment(currentEnrichmentPage), 1000);
    } else {
      throw new Error('Failed to trigger enrichment');
    }
  } catch (error) {
    showError(error.message);
  }
}

async function triggerBulkEnrichment() {
  if (!confirm('This will queue enrichment jobs for all firms that need it. Continue?')) return;

  const btn = document.getElementById('triggerBulkEnrichmentBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Queueing...';

  try {
    const response = await apiCall('/admin/enrichment/trigger-bulk', {
      method: 'POST',
      body: JSON.stringify({ onlyStale: true, maxDaysOld: 30 })
    });

    const data = await response.json();

    if (response.ok) {
      showSuccess(`Queued ${data.jobsCreated} enrichment jobs`);
      setTimeout(() => loadEnrichment(1), 1000);
    } else {
      throw new Error(data.error || 'Failed to trigger bulk enrichment');
    }
  } catch (error) {
    showError(error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play"></i> Trigger Bulk Enrichment';
  }
}

// Utility Functions
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });

  if (response.status === 401 || response.status === 403) {
    handleLogout();
    throw new Error('Unauthorized');
  }

  return response;
}

function renderPagination(containerId, pagination, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, totalPages } = pagination;
  let html = '';

  if (page > 1) {
    html += `<button onclick="${callback.name}(${page - 1})">Previous</button>`;
  }

  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    html += `<button class="${i === page ? 'active' : ''}" onclick="${callback.name}(${i})">${i}</button>`;
  }

  if (page < totalPages) {
    html += `<button onclick="${callback.name}(${page + 1})">Next</button>`;
  }

  container.innerHTML = html;
}

function getStatusBadge(status) {
  const badges = {
    active: 'success',
    suspended: 'danger',
    inactive: 'warning'
  };
  return badges[status] || 'info';
}

function getEnrichmentStatusBadge(status) {
  const badges = {
    completed: 'success',
    pending: 'warning',
    processing: 'info',
    failed: 'danger'
  };
  return badges[status] || 'info';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showError(message) {
  alert('Error: ' + message);
}

function showSuccess(message) {
  alert('Success: ' + message);
}
