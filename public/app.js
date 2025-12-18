// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;
let authToken = localStorage.getItem('authToken');
let currentFirm = JSON.parse(localStorage.getItem('currentFirm'));

// DOM Elements
const loginModal = document.getElementById('loginModal');
const registerInterestModal = document.getElementById('registerInterestModal');
const loginBtn = document.getElementById('loginBtn');
const registerInterestBtn = document.getElementById('registerInterestBtn');
const logoutBtn = document.getElementById('logoutBtn');
const dashboardLink = document.getElementById('dashboardLink');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();

    if (authToken) {
        showDashboard();
    }
});

// Event Listeners
function setupEventListeners() {
    // Modal controls
    loginBtn?.addEventListener('click', () => openModal(loginModal));
    registerInterestBtn?.addEventListener('click', () => openModal(registerInterestModal));
    logoutBtn?.addEventListener('click', logout);

    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeModal(loginModal);
            closeModal(registerInterestModal);
        });
    });

    document.getElementById('switchToRegisterInterest')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(loginModal);
        openModal(registerInterestModal);
    });

    document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal(registerInterestModal);
        openModal(loginModal);
    });

    // Forms
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerInterestForm')?.addEventListener('submit', handleRegisterInterest);
    document.getElementById('profileForm')?.addEventListener('submit', handleProfileUpdate);
    document.getElementById('createDealForm')?.addEventListener('submit', handleCreateDeal);

    // Dashboard navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });

    // Syndicate builder
    document.getElementById('getRecommendationsBtn')?.addEventListener('click', getRecommendations);
    document.getElementById('sendInvitationsBtn')?.addEventListener('click', sendInvitations);

    // Invitation tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchInvitationTab(tab);
        });
    });

    // File upload handlers
    const fileInputs = ['investmentMemo', 'pitchDeck', 'additionalMaterials'];
    fileInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', function() {
                const label = this.parentElement.querySelector('.file-upload-label');
                if (this.files.length > 0) {
                    if (this.files.length === 1) {
                        label.textContent = this.files[0].name;
                    } else {
                        label.textContent = `${this.files.length} files selected`;
                    }
                    label.style.color = 'var(--secondary-color)';
                    label.style.fontWeight = '600';
                }
            });
        }
    });

    // Smooth scroll for navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('href').startsWith('#') && link.getAttribute('href') !== '#dashboard') {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// Modal Functions
function openModal(modal) {
    modal.style.display = 'block';
}

function closeModal(modal) {
    modal.style.display = 'none';
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(text || 'Server returned a non-JSON response');
        }

        if (response.ok) {
            authToken = data.token;
            currentFirm = data.firm;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentFirm', JSON.stringify(currentFirm));
            closeModal(loginModal);
            showDashboard();
            alert('Login successful!');
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error: ' + error.message);
    }
}

async function handleRegisterInterest(e) {
    e.preventDefault();
    const name = document.getElementById('interestName').value;
    const email = document.getElementById('interestEmail').value;
    const company = document.getElementById('interestCompany').value;

    try {
        const response = await fetch(`${API_URL}/interest/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, company })
        });

        const data = await response.json();

        if (response.ok) {
            closeModal(registerInterestModal);
            alert('Thank you for your interest! We will be in touch soon.');
            document.getElementById('registerInterestForm').reset();
        } else {
            alert(data.message || 'Failed to submit interest. Please try again.');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function logout() {
    authToken = null;
    currentFirm = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentFirm');
    hideDashboard();
    alert('Logged out successfully');
}

// Dashboard Functions
function showDashboard() {
    // Don't hide the sections, just scroll to dashboard
    document.getElementById('dashboard').style.display = 'block';

    // Update navigation buttons
    loginBtn.style.display = 'none';
    registerInterestBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    dashboardLink.style.display = 'block';

    // Scroll to dashboard
    document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });

    document.getElementById('firmNameDisplay').textContent = currentFirm.firmName;
    loadDashboardData();
}

function hideDashboard() {
    // Just hide the dashboard, other sections are always visible
    document.getElementById('dashboard').style.display = 'none';

    // Ensure hero section is properly displayed
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'flex';

    loginBtn.style.display = 'block';
    registerInterestBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    dashboardLink.style.display = 'none';
}

function switchView(viewName) {
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetView = document.getElementById(viewName + 'View');
    if (targetView) {
        targetView.classList.add('active');
    }

    const targetMenuItem = document.querySelector(`[data-view="${viewName}"]`);
    if (targetMenuItem) {
        targetMenuItem.classList.add('active');
    }

    // Load data for specific views
    if (viewName === 'deals') {
        loadMyDeals();
    } else if (viewName === 'syndicate') {
        loadDealsForSyndicate();
    } else if (viewName === 'invitations') {
        loadInvitations();
    } else if (viewName === 'profile') {
        loadProfile();
    }
}

// Make switchView globally accessible
window.switchView = switchView;

async function loadDashboardData() {
    try {
        // Load deals count
        const dealsResponse = await fetch(`${API_URL}/deals/my-deals`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const deals = await dealsResponse.json();
        document.getElementById('totalDeals').textContent = deals.length;

        // Load invitations count
        const invitationsResponse = await fetch(`${API_URL}/invitations/received`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const invitations = await invitationsResponse.json();
        const pending = invitations.filter(inv => inv.status === 'pending').length;
        document.getElementById('pendingInvitations').textContent = pending;

        // Calculate syndicate members
        let totalMembers = 0;
        deals.forEach(deal => {
            if (deal.syndicateMembers) {
                totalMembers += deal.syndicateMembers.length;
            }
        });
        document.getElementById('syndicateMembers').textContent = totalMembers;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Profile Management
async function loadProfile() {
    try {
        const response = await fetch(`${API_URL}/firms/profile/${currentFirm.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const firmData = await response.json();

        if (firmData.profile) {
            document.getElementById('profileJurisdictions').value = firmData.profile.jurisdictions?.join(', ') || '';
            document.getElementById('profileDealMin').value = firmData.profile.typicalDealSize?.min || '';
            document.getElementById('profileDealMax').value = firmData.profile.typicalDealSize?.max || '';
            document.getElementById('profileSectors').value = firmData.profile.sectorFocus?.join(', ') || '';
            document.getElementById('profileTransactions').value = firmData.profile.recentTransactions?.join('\n') || '';
            document.getElementById('profileDescription').value = firmData.profile.description || '';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const jurisdictions = document.getElementById('profileJurisdictions').value.split(',').map(s => s.trim()).filter(Boolean);
    const sectorFocus = document.getElementById('profileSectors').value.split(',').map(s => s.trim()).filter(Boolean);
    const recentTransactions = document.getElementById('profileTransactions').value.split('\n').map(s => s.trim()).filter(Boolean);

    const profileData = {
        jurisdictions,
        typicalDealSize: {
            min: parseFloat(document.getElementById('profileDealMin').value) || 0,
            max: parseFloat(document.getElementById('profileDealMax').value) || 0
        },
        sectorFocus,
        recentTransactions,
        description: document.getElementById('profileDescription').value
    };

    try {
        const response = await fetch(`${API_URL}/firms/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(profileData)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Profile updated successfully!');
        } else {
            alert(data.message || 'Failed to update profile');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Deal Management
async function handleCreateDeal(e) {
    e.preventDefault();

    // Collect file names
    const investmentMemoFiles = document.getElementById('investmentMemo').files;
    const pitchDeckFiles = document.getElementById('pitchDeck').files;
    const additionalMaterialsFiles = document.getElementById('additionalMaterials').files;

    const dealData = {
        dealName: document.getElementById('companyName').value,
        sector: document.getElementById('dealSector').value,
        jurisdiction: document.getElementById('dealJurisdiction').value,
        dealType: document.getElementById('dealType').value,
        targetAmount: parseFloat(document.getElementById('dealAmount').value),
        description: document.getElementById('dealDescription').value,
        targetInvestorProfile: document.getElementById('dealInvestorProfile').value
    };

    try {
        const response = await fetch(`${API_URL}/deals/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(dealData)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Deal created successfully!');
            document.getElementById('createDealForm').reset();
            // Reset file upload labels
            document.querySelectorAll('.file-upload-label').forEach(label => {
                label.textContent = label.textContent.includes('multiple') ?
                    'Choose files or drag here (multiple files allowed)' :
                    'Choose file or drag here';
            });
            switchView('deals');
        } else {
            alert(data.message || 'Failed to create deal');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadMyDeals() {
    try {
        const response = await fetch(`${API_URL}/deals/my-deals`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const deals = await response.json();

        const dealsList = document.getElementById('dealsList');
        if (deals.length === 0) {
            dealsList.innerHTML = '<p>No deals yet. Create your first deal to get started!</p>';
            return;
        }

        dealsList.innerHTML = deals.map(deal => `
            <div class="deal-card">
                <div class="deal-header">
                    <h3 class="deal-title">${deal.dealName}</h3>
                    <span class="deal-status ${deal.status}">${deal.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div class="deal-info">
                    <div class="deal-info-item">
                        <span class="deal-info-label">Target Amount</span>
                        <span class="deal-info-value">£${deal.targetAmount.toLocaleString()}</span>
                    </div>
                    <div class="deal-info-item">
                        <span class="deal-info-label">Sector</span>
                        <span class="deal-info-value">${deal.sector}</span>
                    </div>
                    <div class="deal-info-item">
                        <span class="deal-info-label">Type</span>
                        <span class="deal-info-value">${deal.dealType}</span>
                    </div>
                    <div class="deal-info-item">
                        <span class="deal-info-label">Jurisdiction</span>
                        <span class="deal-info-value">${deal.jurisdiction}</span>
                    </div>
                </div>
                <p>${deal.description}</p>
                ${deal.syndicateMembers && deal.syndicateMembers.length > 0 ?
                    `<p class="mt-1"><strong>Syndicate Members:</strong> ${deal.syndicateMembers.length}</p>` : ''}

                <div class="deal-locker-section">
                    <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-dark);"><i class="fas fa-lock"></i> Deal-Locker</h4>
                    <div id="documents-${deal.id}" class="deal-locker-files">
                        <p style="color: #666;">Loading documents...</p>
                    </div>
                    <div class="deal-locker-upload" style="margin-top: 0.5rem;">
                        <input type="file" id="fileInput-${deal.id}" style="display: none;" onchange="handleFileUpload('${deal.id}', this)">
                        <button onclick="document.getElementById('fileInput-${deal.id}').click()" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                            <i class="fas fa-upload"></i> Upload Document
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Load documents for each deal
        deals.forEach(deal => {
            loadDealDocuments(deal.id);
        });
    } catch (error) {
        console.error('Error loading deals:', error);
    }
}

// Deal Locker Document Management
async function loadDealDocuments(dealId) {
    try {
        const response = await fetch(`${API_URL}/documents/deal/${dealId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load documents');
        }

        const documents = await response.json();
        const documentsContainer = document.getElementById(`documents-${dealId}`);

        if (documents.length === 0) {
            documentsContainer.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No documents uploaded yet.</p>';
            return;
        }

        documentsContainer.innerHTML = documents.map(doc => `
            <div class="deal-file" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-file"></i>
                    <a href="${doc.fileUrl}" target="_blank" style="color: var(--primary-color); text-decoration: none;">
                        ${doc.fileName}
                    </a>
                    <span style="color: #999; font-size: 0.85rem;">(${formatFileSize(doc.fileSize)})</span>
                </div>
                <button onclick="deleteDealDocument('${dealId}', '${doc.id}')" class="btn-icon" style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 0.25rem 0.5rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading documents:', error);
        const documentsContainer = document.getElementById(`documents-${dealId}`);
        if (documentsContainer) {
            documentsContainer.innerHTML = '<p style="color: #dc3545; font-size: 0.9rem;">Error loading documents</p>';
        }
    }
}

async function handleFileUpload(dealId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        alert('File size must be less than 50MB');
        inputElement.value = '';
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/documents/upload/${dealId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }

        // Clear the input
        inputElement.value = '';

        // Reload documents
        await loadDealDocuments(dealId);

        alert('Document uploaded successfully!');
    } catch (error) {
        console.error('Error uploading document:', error);
        alert('Error uploading document: ' + error.message);
        inputElement.value = '';
    }
}

async function deleteDealDocument(dealId, documentId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/documents/${documentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Delete failed');
        }

        // Reload documents
        await loadDealDocuments(dealId);

        alert('Document deleted successfully!');
    } catch (error) {
        console.error('Error deleting document:', error);
        alert('Error deleting document: ' + error.message);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Syndicate Building
async function loadDealsForSyndicate() {
    try {
        const response = await fetch(`${API_URL}/deals/my-deals`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const deals = await response.json();

        const select = document.getElementById('syndicateDealSelect');
        select.innerHTML = '<option value="">Choose a deal...</option>' +
            deals.map(deal => `<option value="${deal.id}">${deal.dealName}</option>`).join('');
    } catch (error) {
        console.error('Error loading deals:', error);
    }
}

async function getRecommendations() {
    const dealId = document.getElementById('syndicateDealSelect').value;
    const syndicateSize = parseInt(document.getElementById('syndicateSize').value);

    if (!dealId) {
        alert('Please select a deal');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/syndicate/recommend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ dealId, syndicateSize })
        });

        const data = await response.json();

        if (response.ok) {
            displayRecommendations(data);
        } else {
            alert(data.message || 'Failed to get recommendations');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function displayRecommendations(data) {
    const section = document.getElementById('recommendationsSection');
    const list = document.getElementById('recommendationsList');

    if (data.recommendations.length === 0) {
        list.innerHTML = '<p>No recommendations found. Try updating your profile or deal details.</p>';
        section.style.display = 'block';
        return;
    }

    list.innerHTML = data.recommendations.map(rec => `
        <div class="recommendation-card" data-firm-id="${rec.firmId}">
            <div class="recommendation-header">
                <h3 class="recommendation-firm">${rec.firmName}</h3>
                <div class="match-score">${rec.score}% Match</div>
            </div>
            <ul class="match-reasons">
                ${rec.reasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
            <div class="mt-1">
                <label>
                    <input type="checkbox" class="firm-checkbox" value="${rec.firmId}">
                    Select for syndicate
                </label>
            </div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.recommendation-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = card.querySelector('.firm-checkbox');
                checkbox.checked = !checkbox.checked;
            }
            card.classList.toggle('selected', card.querySelector('.firm-checkbox').checked);
        });
    });

    section.style.display = 'block';
    window.currentDealForSyndicate = document.getElementById('syndicateDealSelect').value;
}

async function sendInvitations() {
    const selectedFirms = Array.from(document.querySelectorAll('.firm-checkbox:checked')).map(cb => cb.value);

    if (selectedFirms.length === 0) {
        alert('Please select at least one firm');
        return;
    }

    try {
        // Send individual invitations
        for (const firmId of selectedFirms) {
            await fetch(`${API_URL}/invitations/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    dealId: window.currentDealForSyndicate,
                    firmId,
                    message: 'You have been invited to join this syndicate based on your expertise and investor base.'
                })
            });
        }

        // Update deal with invited firms
        await fetch(`${API_URL}/syndicate/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                dealId: window.currentDealForSyndicate,
                selectedFirms
            })
        });

        alert(`Invitations sent to ${selectedFirms.length} firms!`);
        document.getElementById('recommendationsSection').style.display = 'none';
    } catch (error) {
        alert('Error sending invitations: ' + error.message);
    }
}

// Invitations
async function loadInvitations() {
    loadReceivedInvitations();
    loadSentInvitations();
}

async function loadReceivedInvitations() {
    try {
        const response = await fetch(`${API_URL}/invitations/received`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const invitations = await response.json();

        const container = document.getElementById('receivedInvitations');

        if (invitations.length === 0) {
            container.innerHTML = '<p>No invitations received yet.</p>';
            return;
        }

        container.innerHTML = invitations.map(inv => `
            <div class="invitation-card">
                <div class="invitation-header">
                    <div>
                        <h3>${inv.deal?.name || 'Deal'}</h3>
                        <p>From: ${inv.fromFirm?.name || 'Unknown Firm'}</p>
                        <p>Sector: ${inv.deal?.sector || 'N/A'}</p>
                    </div>
                    <span class="deal-status ${inv.status}">${inv.status.toUpperCase()}</span>
                </div>
                <p>${inv.message}</p>
                ${inv.status === 'pending' ? `
                    <div class="invitation-actions">
                        <button class="btn btn-success" onclick="respondToInvitation('${inv.id}', 'accepted')">
                            <i class="fas fa-check"></i> Accept & Sign eNDA
                        </button>
                        <button class="btn btn-danger" onclick="respondToInvitation('${inv.id}', 'declined')">
                            <i class="fas fa-times"></i> Decline
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading received invitations:', error);
    }
}

async function loadSentInvitations() {
    try {
        const response = await fetch(`${API_URL}/invitations/sent`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const invitations = await response.json();

        const container = document.getElementById('sentInvitations');

        if (invitations.length === 0) {
            container.innerHTML = '<p>No invitations sent yet.</p>';
            return;
        }

        container.innerHTML = invitations.map(inv => `
            <div class="invitation-card">
                <div class="invitation-header">
                    <div>
                        <h3>${inv.deal?.name || 'Deal'}</h3>
                        <p>To: ${inv.toFirm?.name || 'Unknown Firm'}</p>
                    </div>
                    <span class="deal-status ${inv.status}">${inv.status.toUpperCase()}</span>
                </div>
                <p>${inv.message}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading sent invitations:', error);
    }
}

async function respondToInvitation(invitationId, response) {
    const ndaSigned = response === 'accepted' ? confirm('By accepting, you agree to sign the eNDA for this deal. Continue?') : false;

    if (response === 'accepted' && !ndaSigned) {
        return;
    }

    try {
        const apiResponse = await fetch(`${API_URL}/invitations/respond`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ invitationId, response, ndaSigned })
        });

        const data = await apiResponse.json();

        if (apiResponse.ok) {
            alert(response === 'accepted' ? 'Invitation accepted! You now have access to the deal-locker.' : 'Invitation declined.');
            loadInvitations();
        } else {
            alert(data.message || 'Failed to respond to invitation');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Make respondToInvitation globally accessible
window.respondToInvitation = respondToInvitation;

function switchInvitationTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.invitations-content').forEach(content => {
        content.classList.toggle('active', content.id === tab + 'Invitations');
    });
}
