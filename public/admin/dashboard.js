// Admin Dashboard Functionality
let currentUser = null;
let allUsers = [];
let filteredUsers = [];

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
        const response = await fetch('/api/admin/statistics', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const stats = await response.json();
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
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                    No users found
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = filteredUsers.map(user => `
        <tr class="table-row" data-testid="row-user-${user.id}">
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <h4>${user.username}</h4>
                        <p>Joined ${new Date(user.createdAt || Date.now()).toLocaleDateString()}</p>
                    </div>
                </div>
            </td>
            <td class="user-email">${user.email || 'N/A'}</td>
            <td>
                <select class="role-select" onchange="updateUserRole('${user.id}', this.value)" data-testid="select-role-${user.id}">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="analyst" ${user.role === 'analyst' ? 'selected' : ''}>Analyst</option>
                    <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td class="user-auth">${user.authProvider || 'local'}</td>
            <td>
                <span class="telegram-badge ${user.telegramEnabled ? 'enabled' : 'disabled'}" data-testid="telegram-${user.id}">
                    ${user.telegramEnabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <button class="role-select" onclick="deleteUser('${user.id}')" data-testid="button-delete-${user.id}" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border-color: rgba(239, 68, 68, 0.3);">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function updateUserRole(userId, newRole) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
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
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
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
    
    systemInfoElement.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.6); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="color: #f8fafc; margin-bottom: 15px;">Environment Status</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div>
                    <strong style="color: #94a3b8;">Environment:</strong>
                    <span style="color: #f8fafc;">${data.analysis?.likelyEnvironment || 'Unknown'}</span>
                </div>
                <div>
                    <strong style="color: #94a3b8;">Database:</strong>
                    <span style="color: ${data.database?.connected ? '#22c55e' : '#ef4444'};">
                        ${data.database?.connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div>
                    <strong style="color: #94a3b8;">Users in DB:</strong>
                    <span style="color: #f8fafc;">${data.database?.userCount || 0}</span>
                </div>
                <div>
                    <strong style="color: #94a3b8;">Session Working:</strong>
                    <span style="color: ${data.session?.authenticated ? '#22c55e' : '#ef4444'};">
                        ${data.session?.authenticated ? 'Yes' : 'No'}
                    </span>
                </div>
            </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 20px; border-radius: 12px;">
            <h3 style="color: #f8fafc; margin-bottom: 15px;">System Timestamp</h3>
            <p style="color: #94a3b8; margin: 0;">${data.timestamp || new Date().toISOString()}</p>
        </div>
    `;
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
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked nav tab
    event.target.classList.add('active');
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
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}