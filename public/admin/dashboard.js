// Admin Dashboard Functionality
let currentUser = null;
let allUsers = [];
let filteredUsers = [];
let currentSport = 'MLB';
let alertSettings = {};
let isLoadingAlerts = false;
let csrfToken = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    
    // Setup search functionality
    const userSearch = document.getElementById('userSearch');
    const roleFilter = document.getElementById('roleFilter');
    
    if (userSearch) {
        userSearch.addEventListener('input', filterUsers);
    }
    
    if (roleFilter) {
        roleFilter.addEventListener('change', filterUsers);
    }
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin-auth/verify', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.user) {
                currentUser = data.user;
                await fetchCSRFToken(); // Fetch CSRF token after authentication
                await initializeDashboard();
                showDashboard();
            } else {
                redirectToLogin();
            }
        } else {
            redirectToLogin();
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        redirectToLogin();
    }
}

async function fetchCSRFToken() {
    try {
        const response = await fetch('/api/admin-auth/csrf-token', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            csrfToken = data.csrfToken;
            console.log('✅ CSRF token refreshed successfully');
        } else if (response.status === 401) {
            console.error('❌ CSRF token fetch failed - not authenticated');
            window.location.href = '/admin/login.html';
        } else {
            console.warn('⚠️ Failed to fetch CSRF token:', response.status);
        }
    } catch (error) {
        console.warn('⚠️ CSRF token fetch error:', error);
    }
}

// Helper function for making authenticated admin requests with CSRF protection
async function adminRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    
    // Add CSRF token for state-changing requests
    if (options.method && options.method !== 'GET' && csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }
    
    const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers
    });
    
    // Handle authentication errors
    if (response.status === 401) {
        console.error('Admin authentication failed - redirecting to login');
        window.location.href = '/admin/login.html';
        throw new Error('Authentication required');
    }
    
    // Handle CSRF token expiration
    if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.message && errorData.message.includes('CSRF')) {
            console.log('CSRF token expired, refreshing...');
            await fetchCSRFToken();
            // Retry request with new token
            if (csrfToken && options.method && options.method !== 'GET') {
                headers['X-CSRF-Token'] = csrfToken;
                return fetch(url, {
                    credentials: 'include',
                    ...options,
                    headers
                });
            }
        } else {
            console.error('Admin access denied:', errorData);
        }
    }
    
    return response;
}

function redirectToLogin() {
    window.location.href = '/admin/login.html';
}

function showDashboard() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';
}

async function initializeDashboard() {
    // Update user info in header
    updateUserInfo();
    
    // Load dashboard data
    await Promise.all([
        loadStatistics(),
        loadUsers(),
        loadSystemInfo()
    ]);
}

function updateUserInfo() {
    if (currentUser) {
        const adminAvatar = document.getElementById('adminAvatar');
        const adminName = document.getElementById('adminName');
        const adminRole = document.getElementById('adminRole');
        
        if (adminAvatar) {
            adminAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        }
        
        if (adminName) {
            adminName.textContent = currentUser.username || 'Administrator';
        }
        
        if (adminRole) {
            adminRole.textContent = currentUser.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Admin';
        }
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/stats', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            // Transform the response data to match what the UI expects
            const stats = {
                totalUsers: data.users.total,
                totalAdmins: data.users.admins,
                totalAlerts: data.alerts.total,
                systemStatus: 'Operational'
            };
            updateStatistics(stats);
        } else {
            // Fallback to basic stats
            updateStatistics({
                totalUsers: allUsers.length,
                totalAdmins: allUsers.filter(u => u.role === 'admin').length,
                totalAlerts: '-',
                systemStatus: 'Operational'
            });
        }
    } catch (error) {
        console.error('Failed to load statistics:', error);
        updateStatistics({
            totalUsers: '-',
            totalAdmins: '-',
            totalAlerts: '-',
            systemStatus: 'Unknown'
        });
    }
}

function updateStatistics(stats) {
    const elements = {
        totalUsers: document.getElementById('totalUsers'),
        totalAdmins: document.getElementById('totalAdmins'),
        totalAlerts: document.getElementById('totalAlerts'),
        systemStatus: document.getElementById('systemStatus')
    };
    
    Object.keys(elements).forEach(key => {
        if (elements[key] && stats[key] !== undefined) {
            elements[key].textContent = stats[key];
        }
    });
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            credentials: 'include'
        });
        
        if (response.ok) {
            allUsers = await response.json();
            filteredUsers = [...allUsers];
            renderUsers();
        } else {
            console.error('Failed to load users');
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const roleFilter = document.getElementById('roleFilter')?.value || '';
    
    filteredUsers = allUsers.filter(user => {
        const matchesSearch = !searchTerm || 
            user.username.toLowerCase().includes(searchTerm) || 
            user.email?.toLowerCase().includes(searchTerm);
        
        const matchesRole = !roleFilter || user.role === roleFilter;
        
        return matchesSearch && matchesRole;
    });
    
    renderUsers();
}

function renderUsers() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;
    
    if (filteredUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">No users found</td></tr>';
        return;
    }
    
    tableBody.innerHTML = filteredUsers.map(function(user) {
        return '<tr class="table-row" data-testid="row-user-' + user.id + '">' +
            '<td>' +
                '<div class="user-info">' +
                    '<div class="user-avatar">' + user.username.charAt(0).toUpperCase() + '</div>' +
                    '<div class="user-details">' +
                        '<h4>' + user.username + '</h4>' +
                        '<p>Joined ' + new Date(user.createdAt || Date.now()).toLocaleDateString() + '</p>' +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td class="user-email">' + (user.email || 'N/A') + '</td>' +
            '<td>' +
                '<select class="role-select" onchange="updateUserRole(\'' + user.id + '\', this.value)" data-testid="select-role-' + user.id + '">' +
                    '<option value="user"' + (user.role === 'user' ? ' selected' : '') + '>User</option>' +
                    '<option value="analyst"' + (user.role === 'analyst' ? ' selected' : '') + '>Analyst</option>' +
                    '<option value="manager"' + (user.role === 'manager' ? ' selected' : '') + '>Manager</option>' +
                    '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
                '</select>' +
            '</td>' +
            '<td class="user-auth">' + (user.authProvider || 'local') + '</td>' +
            '<td>' +
                '<span class="telegram-badge ' + (user.telegramEnabled ? 'enabled' : 'disabled') + '" data-testid="telegram-' + user.id + '">' +
                    (user.telegramEnabled ? 'Enabled' : 'Disabled') +
                '</span>' +
            '</td>' +
            '<td>' +
                '<button class="role-select" onclick="deleteUser(\'' + user.id + '\')" data-testid="button-delete-' + user.id + '" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3);">' +
                    'Delete' +
                '</button>' +
            '</td>' +
        '</tr>';
    }).join('');
}

async function updateUserRole(userId, newRole) {
    try {
        const response = await adminRequest('/api/admin/users/' + userId + '/role', {
            method: 'PATCH',
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            showNotification('User role updated successfully', 'success');
            // Update local data
            const userIndex = allUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                allUsers[userIndex].role = newRole;
                filterUsers(); // Refresh display
            }
        } else {
            showNotification('Failed to update user role', 'error');
        }
    } catch (error) {
        console.error('Failed to update user role:', error);
        showNotification('Failed to update user role', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await adminRequest('/api/admin/users/' + userId, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            // Remove from local data
            allUsers = allUsers.filter(u => u.id !== userId);
            filterUsers(); // Refresh display
        } else {
            showNotification('Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Failed to delete user:', error);
        showNotification('Failed to delete user', 'error');
    }
}

async function loadSystemInfo() {
    try {
        const response = await fetch('/api/environment-status', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const systemData = await response.json();
            updateSystemInfo(systemData);
        }
    } catch (error) {
        console.error('Failed to load system info:', error);
    }
}

function updateSystemInfo(data) {
    const systemInfoElement = document.getElementById('systemInfo');
    if (!systemInfoElement) return;
    
    systemInfoElement.innerHTML = 
        '<div style="background: rgba(15, 23, 42, 0.6); padding: 20px; border-radius: 12px; margin-bottom: 20px;">' +
            '<h3 style="color: #f8fafc; margin-bottom: 15px;">Environment Status</h3>' +
            '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">' +
                '<div>' +
                    '<strong style="color: #94a3b8;">Environment:</strong>' +
                    '<span style="color: #f8fafc;">' + (data.analysis && data.analysis.likelyEnvironment ? data.analysis.likelyEnvironment : 'Unknown') + '</span>' +
                '</div>' +
                '<div>' +
                    '<strong style="color: #94a3b8;">Database:</strong>' +
                    '<span style="color: ' + (data.database && data.database.connected ? '#22c55e' : '#ef4444') + ';">' +
                        (data.database && data.database.connected ? 'Connected' : 'Disconnected') +
                    '</span>' +
                '</div>' +
                '<div>' +
                    '<strong style="color: #94a3b8;">Users in DB:</strong>' +
                    '<span style="color: #f8fafc;">' + (data.database && data.database.userCount ? data.database.userCount : 0) + '</span>' +
                '</div>' +
                '<div>' +
                    '<strong style="color: #94a3b8;">Session Working:</strong>' +
                    '<span style="color: ' + (data.session && data.session.authenticated ? '#22c55e' : '#ef4444') + ';">' +
                        (data.session && data.session.authenticated ? 'Yes' : 'No') +
                    '</span>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div style="background: rgba(15, 23, 42, 0.6); padding: 20px; border-radius: 12px;">' +
            '<h3 style="color: #f8fafc; margin-bottom: 15px;">System Timestamp</h3>' +
            '<p style="color: #94a3b8; margin: 0;">' + (data.timestamp ? data.timestamp : new Date().toISOString()) + '</p>' +
        '</div>';
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked nav tab
    event.target.classList.add('active');
    
    // Load alert settings when alerts tab is shown
    if (tabName === 'alerts' && !isLoadingAlerts) {
        loadAlertSettings();
    }
}

async function logout() {
    try {
        const response = await fetch('/api/admin-auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        // Redirect to login regardless of response
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Redirect anyway
        window.location.href = '/admin/login.html';
    }
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// ALERT MANAGEMENT FUNCTIONS

async function loadAlertSettings() {
    if (isLoadingAlerts) return;
    
    isLoadingAlerts = true;
    showAlertLoading(true);
    
    try {
        // Load master alert status and show initial sport settings
        await Promise.all([
            loadMasterAlertStatus(),
            loadAlertStatistics(),
            showSportSettings(currentSport)
        ]);
        showNotification('Alert settings loaded successfully', 'success');
    } catch (error) {
        console.error('Failed to load alert settings:', error);
        showNotification('Failed to load alert settings', 'error');
    } finally {
        isLoadingAlerts = false;
        showAlertLoading(false);
    }
}

function showAlertLoading(show) {
    const loadingElement = document.getElementById('alertsLoading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

async function loadMasterAlertStatus() {
    try {
        const response = await fetch('/api/admin/master-alerts', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const masterToggle = document.getElementById('masterAlertsToggle');
            if (masterToggle) {
                masterToggle.checked = data.enabled;
            }
        }
    } catch (error) {
        console.error('Failed to load master alert status:', error);
    }
}

async function toggleMasterAlerts(enabled) {
    try {
        const response = await adminRequest('/api/admin/master-alerts', {
            method: 'PUT',
            body: JSON.stringify({ enabled })
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification(data.message, 'success');
            // Reload alert statistics to reflect changes
            loadAlertStatistics();
        } else {
            showNotification('Failed to update master alert status', 'error');
            // Revert toggle
            const masterToggle = document.getElementById('masterAlertsToggle');
            if (masterToggle) {
                masterToggle.checked = !enabled;
            }
        }
    } catch (error) {
        console.error('Failed to toggle master alerts:', error);
        showNotification('Failed to update master alert status', 'error');
        // Revert toggle
        const masterToggle = document.getElementById('masterAlertsToggle');
        if (masterToggle) {
            masterToggle.checked = !enabled;
        }
    }
}

async function enableAllAlerts() {
    const button = event.target.closest('.quick-action-btn');
    if (button) button.disabled = true;
    
    try {
        const response = await fetch('/api/admin/enable-all-alerts', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Enabled ' + (data.results && data.results.length ? data.results.length : 0) + ' alert types', 'success');
            // Reload current sport settings and statistics
            await Promise.all([
                showSportSettings(currentSport),
                loadAlertStatistics()
            ]);
        } else {
            showNotification('Failed to enable all alerts', 'error');
        }
    } catch (error) {
        console.error('Failed to enable all alerts:', error);
        showNotification('Failed to enable all alerts', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

async function disableAllAlerts() {
    if (!confirm('Are you sure you want to disable ALL alerts across the entire system? This will affect all users.')) {
        return;
    }
    
    const button = event.target.closest('.quick-action-btn');
    if (button) button.disabled = true;
    
    try {
        const response = await fetch('/api/admin/disable-all-alerts', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Disabled ' + (data.disabledCount ? data.disabledCount : 0) + ' alert types', 'success');
            // Reload current sport settings and statistics
            await Promise.all([
                showSportSettings(currentSport),
                loadAlertStatistics()
            ]);
        } else {
            showNotification('Failed to disable all alerts', 'error');
        }
    } catch (error) {
        console.error('Failed to disable all alerts:', error);
        showNotification('Failed to disable all alerts', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

async function quickEnableMLB() {
    const button = event.target.closest('.quick-action-btn');
    if (button) button.disabled = true;
    
    try {
        const response = await fetch('/api/admin/quick-enable-mlb', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Enabled ' + (data.results && data.results.length ? data.results.length : 0) + ' critical MLB alerts', 'success');
            // Reload MLB settings if currently viewing
            if (currentSport === 'MLB') {
                await showSportSettings('MLB');
            }
            loadAlertStatistics();
        } else {
            showNotification('Failed to enable MLB alerts', 'error');
        }
    } catch (error) {
        console.error('Failed to enable MLB alerts:', error);
        showNotification('Failed to enable MLB alerts', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

async function showSportSettings(sport) {
    currentSport = sport;
    
    // Update active sport tab
    document.querySelectorAll('.sport-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (event && event.target && event.target.classList) {
        event.target.classList.add('active');
    } else {
        var sportsButton = document.querySelector("[onclick=\"showSportSettings('" + sport + "')\"]");
        if (sportsButton) sportsButton.classList.add('active');
    }
    
    const contentElement = document.getElementById('sportSettingsContent');
    if (!contentElement) return;
    
    // Show loading state
    contentElement.innerHTML = `
        <div class="sport-settings-loading">
            <div class="spinner-small"></div>
            <span>Loading ${sport} alert settings...</span>
        </div>
    `;
    
    try {
        // Fetch cylinders which already include globallyEnabled status
        const cylindersResponse = await fetch(`/api/available-alerts/${sport.toLowerCase()}`, {
            credentials: 'include'
        });
        
        if (cylindersResponse.ok) {
            const cylinders = await cylindersResponse.json();
            
            // Build settings object from cylinders data (already includes globallyEnabled)
            const mergedData = {};
            cylinders.forEach(cylinder => {
                mergedData[cylinder.key] = cylinder.globallyEnabled || false;
            });
            
            renderSportSettings(sport, mergedData);
        } else {
            contentElement.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 12px;"></i>
                    <p>Failed to load ${sport} settings</p>
                    <button onclick="showSportSettings('${sport}')" class="quick-action-btn" style="margin-top: 16px;">
                        <i class="fas fa-refresh"></i> Retry
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error(`Failed to load ${sport} settings:`, error);
        contentElement.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 12px;"></i>
                <p>Error loading ${sport} settings</p>
                <button onclick="showSportSettings('${sport}')" class="quick-action-btn" style="margin-top: 16px;">
                    <i class="fas fa-refresh"></i> Retry
                </button>
            </div>
        `;
    }
}

function renderSportSettings(sport, settings) {
    const contentElement = document.getElementById('sportSettingsContent');
    if (!contentElement) return;
    
    // Group alerts by category for better organization
    const alertCategories = {
        'Game Events': [],
        'Scoring Opportunities': [],
        'Critical Moments': [],
        'Other': []
    };
    
    // Categorize alerts based on their names
    Object.keys(settings).forEach(alertKey => {
        const alertName = formatAlertName(alertKey);
        const alertData = { key: alertKey, name: alertName, enabled: settings[alertKey] };
        
        if (alertKey.includes('GAME_START') || alertKey.includes('INNING_STRETCH')) {
            alertCategories['Game Events'].push(alertData);
        } else if (alertKey.includes('BASES_LOADED') || alertKey.includes('RED_ZONE') || alertKey.includes('SCORING')) {
            alertCategories['Scoring Opportunities'].push(alertData);
        } else if (alertKey.includes('TWO_MINUTE') || alertKey.includes('OVERTIME') || alertKey.includes('FINAL') || alertKey.includes('FOURTH')) {
            alertCategories['Critical Moments'].push(alertData);
        } else {
            alertCategories['Other'].push(alertData);
        }
    });
    
    const categoriesHtml = Object.keys(alertCategories)
        .filter(category => alertCategories[category].length > 0)
        .map(category => {
            const alerts = alertCategories[category];
            const categoryId = category.replace(/\s+/g, '-').toLowerCase();
            
            return `
                <div class="alert-category">
                    <div class="alert-category-header" onclick="toggleAlertCategory('${categoryId}')">
                        <div class="alert-category-title">
                            <i class="fas fa-chevron-down" id="chevron-${categoryId}"></i>
                            ${category} (${alerts.length})
                        </div>
                    </div>
                    <div class="alert-category-content" id="category-${categoryId}">
                        ${alerts.map(alert => `
                            <div class="alert-item">
                                <div class="alert-item-info">
                                    <div class="alert-item-name">${alert.name}</div>
                                    <div class="alert-item-description">${getAlertDescription(alert.key)}</div>
                                </div>
                                <div class="alert-item-toggle">
                                    <label class="toggle-switch" data-testid="toggle-${alert.key.toLowerCase()}">
                                        <input type="checkbox" ${alert.enabled ? 'checked' : ''} 
                                               onchange="toggleGlobalAlertSetting('${sport}', '${alert.key}', this.checked)">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    
    contentElement.innerHTML = `
        <div class="sport-alerts-grid">
            ${categoriesHtml}
        </div>
    `;
}

function toggleAlertCategory(categoryId) {
    const content = document.getElementById(`category-${categoryId}`);
    const chevron = document.getElementById(`chevron-${categoryId}`);
    
    if (content && chevron) {
        const isExpanded = content.style.display !== 'none';
        content.style.display = isExpanded ? 'none' : 'block';
        chevron.style.transform = isExpanded ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

function formatAlertName(alertKey) {
    return alertKey
        .replace(/^(MLB_|NFL_|NBA_|NCAAF_|WNBA_|CFL_)/, '')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getAlertDescription(alertKey) {
    const descriptions = {
        'GAME_START': 'Alert when game begins',
        'SEVENTH_INNING_STRETCH': 'Alert at 7th inning stretch',
        'TWO_MINUTE_WARNING': 'Alert at two-minute warning',
        'RED_ZONE': 'Alert when team enters red zone',
        'FOURTH_DOWN': 'Alert on fourth down situations',
        'OVERTIME': 'Alert when game goes to overtime',
        'FINAL_MINUTES': 'Alert in final minutes of game',
        'HIGH_SCORING_QUARTER': 'Alert for high-scoring quarters',
        'LOW_SCORING_QUARTER': 'Alert for low-scoring quarters',
        'CLUTCH_TIME_OPPORTUNITY': 'Alert for clutch time opportunities',
        'COMEBACK_POTENTIAL': 'Alert for comeback scenarios',
        'CRUNCH_TIME_DEFENSE': 'Alert for defensive stands',
        'CHAMPIONSHIP_IMPLICATIONS': 'Alert for games with championship impact',
        // WNBA-specific prefixed versions
        'WNBA_FINAL_MINUTES': 'Alert in final minutes of WNBA game',
        'WNBA_HIGH_SCORING_QUARTER': 'Alert for high-scoring WNBA quarters',
        'WNBA_LOW_SCORING_QUARTER': 'Alert for low-scoring WNBA quarters',
        'WNBA_CLUTCH_TIME_OPPORTUNITY': 'Alert for WNBA clutch time opportunities',
        'WNBA_COMEBACK_POTENTIAL': 'Alert for WNBA comeback scenarios',
        'WNBA_CRUNCH_TIME_DEFENSE': 'Alert for WNBA defensive stands',
        'WNBA_CHAMPIONSHIP_IMPLICATIONS': 'Alert for WNBA games with championship impact',
        'BASES_LOADED_NO_OUTS': 'Alert when bases loaded with no outs',
        'BASES_LOADED_ONE_OUT': 'Alert when bases loaded with one out',
        'RUNNER_ON_THIRD_NO_OUTS': 'Alert with runner on third, no outs',
        'CLUTCH_TIME': 'Alert during clutch time situations',
        'PLAYOFF_INTENSITY': 'Alert for high-intensity playoff moments'
    };
    
    // Find matching description
    for (const [key, desc] of Object.entries(descriptions)) {
        if (alertKey.includes(key)) {
            return desc;
        }
    }
    
    return 'Advanced game situation alert';
}

async function toggleGlobalAlertSetting(sport, alertType, enabled) {
    try {
        // Ensure we have a fresh CSRF token before making the request
        await fetchCSRFToken();
        
        const response = await adminRequest('/api/admin/global-alert-setting', {
            method: 'PUT',
            body: JSON.stringify({ 
                sport: sport.toLowerCase(), 
                alertType: alertType, 
                enabled: enabled 
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification(`${enabled ? 'Enabled' : 'Disabled'} ${formatAlertName(alertType)} for ${sport.toUpperCase()}`, 'success');
            loadAlertStatistics();
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            console.error('Toggle error response:', errorData);
            
            // Check if it's an authentication error
            if (response.status === 401 || response.status === 403) {
                showNotification('Session expired. Please log in again.', 'error');
                setTimeout(() => {
                    window.location.href = '/admin/login.html';
                }, 2000);
                return;
            }
            
            showNotification(`Failed to update ${formatAlertName(alertType)}: ${errorData.message}`, 'error');
            // Revert toggle
            const toggle = document.querySelector(`[onchange*="${alertType}"]`);
            if (toggle) toggle.checked = !enabled;
        }
    } catch (error) {
        console.error('Failed to toggle alert setting:', error);
        showNotification(`Network error: Failed to update ${formatAlertName(alertType)}`, 'error');
        // Revert toggle
        const toggle = document.querySelector(`[onchange*="${alertType}"]`);
        if (toggle) toggle.checked = !enabled;
    }
}

async function loadAlertStatistics() {
    try {
        // Load alert statistics from multiple sources
        const [alertsResponse, usersResponse] = await Promise.all([
            fetch('/api/alerts/stats', { credentials: 'include' }),
            fetch('/api/admin/users', { credentials: 'include' })
        ]);
        
        const alertStats = alertsResponse.ok ? await alertsResponse.json() : {};
        const usersData = usersResponse.ok ? await usersResponse.json() : [];
        
        // Calculate statistics
        const usersWithAlerts = usersData.filter(user => 
            user.telegramEnabled || (user.preferences && Object.keys(user.preferences).length > 0)
        ).length;
        
        // Update statistics display
        updateStatElement('enabledAlertsCount', alertStats.totalAlerts || '-');
        updateStatElement('totalUsersWithAlerts', usersWithAlerts || '-');
        updateStatElement('recentAlertsCount', alertStats.todayAlerts || '-');
        updateStatElement('systemHealthStatus', 'Operational');
        
    } catch (error) {
        console.error('Failed to load alert statistics:', error);
        // Set fallback values
        updateStatElement('enabledAlertsCount', '-');
        updateStatElement('totalUsersWithAlerts', '-');
        updateStatElement('recentAlertsCount', '-');
        updateStatElement('systemHealthStatus', 'Unknown');
    }
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}