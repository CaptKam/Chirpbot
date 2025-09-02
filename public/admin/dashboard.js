// Admin Dashboard JavaScript
let currentUsers = [];
let currentStats = {};

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuthentication();
    
    // Initialize dashboard
    initializeDashboard();
    
    // Load initial data
    loadDashboardData();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/admin-auth/verify', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            redirectToLogin();
            return;
        }

        const data = await response.json();
        if (!data.authenticated) {
            redirectToLogin();
            return;
        }

        // Update admin info
        updateAdminInfo(data.user);
    } catch (error) {
        console.error('Auth check error:', error);
        redirectToLogin();
    }
}

function redirectToLogin() {
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
    window.location.href = '/admin/login.html';
}

function updateAdminInfo(user) {
    const adminUsername = document.getElementById('adminUsername');
    const adminAvatar = document.getElementById('adminAvatar');
    
    if (adminUsername && user.username) {
        adminUsername.textContent = user.username;
    }
    
    if (adminAvatar && user.username) {
        adminAvatar.textContent = user.username.charAt(0).toUpperCase();
    }
}

function initializeDashboard() {
    // Set up event listeners and initial state
    console.log('Dashboard initialized');
}

async function loadDashboardData() {
    await Promise.all([
        loadStats(),
        loadUsers()
    ]);
}

async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentStats = await response.json();
            updateStatsDisplay();
        } else {
            console.error('Failed to load stats');
        }
    } catch (error) {
        console.error('Stats loading error:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentUsers = await response.json();
            updateUsersTable();
        } else {
            console.error('Failed to load users');
        }
    } catch (error) {
        console.error('Users loading error:', error);
    }
}

function updateStatsDisplay() {
    const totalUsersEl = document.getElementById('totalUsers');
    const totalAdminsEl = document.getElementById('totalAdmins');
    const todayAlertsEl = document.getElementById('todayAlerts');
    const totalAlertsEl = document.getElementById('totalAlerts');

    if (totalUsersEl) totalUsersEl.textContent = currentStats.users?.total || 0;
    if (totalAdminsEl) totalAdminsEl.textContent = currentStats.users?.admins || 0;
    if (todayAlertsEl) todayAlertsEl.textContent = currentStats.alerts?.today || 0;
    if (totalAlertsEl) totalAlertsEl.textContent = currentStats.alerts?.total || 0;
}

function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (currentUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #94a3b8; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <br>No users found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentUsers.map(user => `
        <tr class="table-row">
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
                    <div class="user-details">
                        <h4>${user.username || 'Unknown'}</h4>
                        <p>Joined ${new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-envelope" style="color: #64748b; font-size: 12px;"></i>
                    <span>${user.email || 'No email'}</span>
                </div>
            </td>
            <td>
                <span class="role-badge ${user.role || 'user'}">${(user.role || 'user').toUpperCase()}</span>
            </td>
            <td>
                <span style="text-transform: capitalize; color: #94a3b8;">${user.authMethod || 'Local'}</span>
            </td>
            <td>
                <span class="status-badge ${user.telegramEnabled ? 'enabled' : 'disabled'}">
                    ${user.telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <select class="role-select" onchange="updateUserRole('${user.id}', this.value)" value="${user.role || 'user'}">
                        <option value="user" ${(user.role || 'user') === 'user' ? 'selected' : ''}>User</option>
                        <option value="analyst" ${user.role === 'analyst' ? 'selected' : ''}>Analyst</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="action-btn edit" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateUserRole(userId, newRole) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ role: newRole })
        });

        if (response.ok) {
            // Update local data
            const userIndex = currentUsers.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                currentUsers[userIndex].role = newRole;
                updateUsersTable();
            }
            
            // Reload stats to reflect changes
            await loadStats();
            
            showNotification('User role updated successfully', 'success');
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to update user role', 'error');
        }
    } catch (error) {
        console.error('Role update error:', error);
        showNotification('Failed to update user role', 'error');
    }
}

function editUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;

    // For now, just show user details
    alert(`User Details:\n\nUsername: ${user.username}\nEmail: ${user.email}\nRole: ${user.role}\nCreated: ${new Date(user.createdAt).toLocaleDateString()}`);
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = currentUsers.filter(user => 
        (user.username || '').toLowerCase().includes(searchTerm) ||
        (user.email || '').toLowerCase().includes(searchTerm) ||
        (user.role || '').toLowerCase().includes(searchTerm)
    );

    // Temporarily update the display with filtered users
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #94a3b8; padding: 40px;">
                    <i class="fas fa-search" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <br>No users match your search
                </td>
            </tr>
        `;
        return;
    }

    // Use the same logic as updateUsersTable but with filtered data
    tbody.innerHTML = filteredUsers.map(user => `
        <tr class="table-row">
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
                    <div class="user-details">
                        <h4>${user.username || 'Unknown'}</h4>
                        <p>Joined ${new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-envelope" style="color: #64748b; font-size: 12px;"></i>
                    <span>${user.email || 'No email'}</span>
                </div>
            </td>
            <td>
                <span class="role-badge ${user.role || 'user'}">${(user.role || 'user').toUpperCase()}</span>
            </td>
            <td>
                <span style="text-transform: capitalize; color: #94a3b8;">${user.authMethod || 'Local'}</span>
            </td>
            <td>
                <span class="status-badge ${user.telegramEnabled ? 'enabled' : 'disabled'}">
                    ${user.telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <select class="role-select" onchange="updateUserRole('${user.id}', this.value)" value="${user.role || 'user'}">
                        <option value="user" ${(user.role || 'user') === 'user' ? 'selected' : ''}>User</option>
                        <option value="analyst" ${user.role === 'analyst' ? 'selected' : ''}>Analyst</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="action-btn edit" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function refreshUsers() {
    const refreshBtn = document.querySelector('[onclick="refreshUsers()"]');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
    }

    await loadUsers();
    
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-sync"></i> Refresh';
        refreshBtn.disabled = false;
    }
    
    showNotification('User data refreshed', 'success');
}

function showTab(tabName) {
    // Hide all tab contents
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.style.display = 'none');
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content
    const targetContent = document.getElementById(tabName + 'Content');
    if (targetContent) {
        targetContent.style.display = 'block';
    }
    
    // Add active class to clicked tab
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
}

async function handleLogout() {
    try {
        const response = await fetch('/api/admin-auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        // Clear local storage regardless of response
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminUser');
        
        // Redirect to login
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Still redirect on error
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminUser');
        window.location.href = '/admin/login.html';
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}