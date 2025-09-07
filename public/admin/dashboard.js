// Admin Dashboard

let globalUsers = [];
let globalAlertSettings = {};

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status first
    checkAuthentication();
});

// Check authentication and load dashboard if authenticated
async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin-auth/verify', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Admin authenticated:', data.user?.username);
            
            // Load dashboard data
            loadDashboardData();
            loadStatistics();
            loadSystemStatus();
            
            // Set up sport selector if it exists
            const sportSelector = document.getElementById('sportSelector');
            if (sportSelector) {
                loadSportAlertSettings();
                sportSelector.addEventListener('change', () => {
                    loadSportAlertSettings();
                });
            }
            
            // Set up logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }
        } else {
            // Not authenticated, redirect to login
            console.log('🔒 Not authenticated, redirecting to login...');
            window.location.href = '/admin/login.html';
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        window.location.href = '/admin/login.html';
    }
}

// Dashboard data loading functions
async function loadDashboardData() {
    try {
        await loadUsers();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Failed to load users');
            return;
        }
        
        const users = await response.json();
        globalUsers = users;
        
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        usersList.innerHTML = users.map(user => `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-info">
                    <h3>${user.username} ${user.role === 'admin' ? '<span class="role-badge">Admin</span>' : ''}</h3>
                    <p>Created: ${new Date(user.createdAt).toLocaleDateString()}</p>
                    <p>Monitored Teams: ${user.monitoredTeamsCount || 0}</p>
                    <p>Telegram: ${user.telegramUsername || 'Not connected'}</p>
                </div>
                <div class="user-actions">
                    <button class="action-btn" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn danger" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="action-btn secondary" onclick="viewUserAlerts('${user.id}')">
                        <i class="fas fa-bell"></i> Alert Settings
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/admin/stats', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Failed to load statistics');
            return;
        }
        
        const stats = await response.json();
        
        // Map backend structure to frontend elements
        document.getElementById('totalUsers').textContent = stats.users?.total || 0;
        document.getElementById('activeAlerts').textContent = stats.alerts?.total || 0;
        document.getElementById('todayAlerts').textContent = stats.alerts?.today || 0;
        document.getElementById('monitoredTeams').textContent = stats.monitoredTeams || 0;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadSystemStatus() {
    try {
        const response = await fetch('/api/admin/system-status', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Failed to load system status');
            return;
        }
        
        const status = await response.json();
        
        const statusHtml = `
            <div class="status-item">
                <span>Alert Engine:</span>
                <span class="${status.alertEngine ? 'status-active' : 'status-inactive'}">
                    ${status.alertEngine ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div class="status-item">
                <span>Database:</span>
                <span class="${status.database ? 'status-active' : 'status-inactive'}">
                    ${status.database ? 'Connected' : 'Disconnected'}
                </span>
            </div>
            <div class="status-item">
                <span>OpenAI Integration:</span>
                <span class="${status.openai ? 'status-active' : 'status-inactive'}">
                    ${status.openai ? 'Enabled' : 'Disabled'}
                </span>
            </div>
            <div class="status-item">
                <span>Telegram Bot:</span>
                <span class="${status.telegram ? 'status-active' : 'status-inactive'}">
                    ${status.telegram ? 'Connected' : 'Not configured'}
                </span>
            </div>
        `;
        
        const systemStatusEl = document.getElementById('systemStatus');
        if (systemStatusEl) {
            systemStatusEl.innerHTML = statusHtml;
        }
    } catch (error) {
        console.error('Error loading system status:', error);
    }
}

async function loadSportAlertSettings() {
    const sport = document.getElementById('sportSelector')?.value || 'MLB';
    
    try {
        const response = await fetch(`/api/admin/global-alert-settings/${sport}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Failed to load alert settings');
            return;
        }
        
        const settings = await response.json();
        globalAlertSettings = settings;
        
        const alertsContainer = document.getElementById('alertSettingsList');
        if (!alertsContainer) return;
        
        alertsContainer.innerHTML = settings.map(setting => `
            <div class="alert-setting-card">
                <div class="alert-info">
                    <h4>${setting.key}</h4>
                    <p>${setting.description || 'No description available'}</p>
                </div>
                <div class="alert-toggle">
                    <label class="switch">
                        <input type="checkbox" 
                               ${setting.enabled ? 'checked' : ''} 
                               onchange="toggleAlertSetting('${setting.key}', this.checked, '${sport}')">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading alert settings:', error);
    }
}

async function toggleAlertSetting(alertKey, enabled, sport) {
    try {
        const response = await fetch('/api/admin/global-alert-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                sport,
                alertType: alertKey,
                enabled
            })
        });
        
        if (response.ok) {
            showNotification(`${alertKey} ${enabled ? 'enabled' : 'disabled'} for ${sport}`, 'success');
        } else {
            showNotification('Failed to update alert setting', 'error');
        }
    } catch (error) {
        console.error('Error toggling alert setting:', error);
        showNotification('Error updating alert setting', 'error');
    }
}

async function editUser(userId) {
    const user = globalUsers.find(u => u.id === userId);
    if (!user) return;
    
    const newUsername = prompt('Enter new username:', user.username);
    if (!newUsername) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username: newUsername })
        });
        
        if (response.ok) {
            showNotification('User updated successfully', 'success');
            loadUsers();
        } else {
            showNotification('Failed to update user', 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showNotification('User deleted successfully', 'success');
            loadUsers();
        } else {
            showNotification('Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user', 'error');
    }
}

async function viewUserAlerts(userId) {
    window.location.href = `/user-settings.html?userId=${userId}`;
}

function handleLogout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/admin/login.html';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Tab switching
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
        
        if (targetTab === 'alerts') {
            loadSportAlertSettings();
        }
    });
});

// Sport selector change
const sportSelector = document.getElementById('sportSelector');
if (sportSelector) {
    sportSelector.addEventListener('change', () => {
        loadSportAlertSettings();
    });
}