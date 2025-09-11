// Admin Login Functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    // Check if already authenticated
    checkAuthentication();

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleLogin();
    });

    // Show/hide password functionality
    window.togglePassword = function() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleIcon.className = 'fas fa-eye';
        }
    };

    async function checkAuthentication() {
        try {
            const response = await fetch('/api/admin-auth/verify', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    // Already authenticated, redirect to dashboard
                    window.location.href = '/admin/dashboard.html';
                    return;
                }
            }
        } catch (error) {
            console.log('Authentication check failed:', error);
        }
    }

    async function handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Please enter both username and password');
            return;
        }

        // Show loading state
        setLoadingState(true);
        hideError();

        try {
            const response = await fetch('/api/admin-auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Login successful
                console.log('Login successful, redirecting to dashboard...');
                window.location.href = '/admin/dashboard.html';
            } else {
                // Login failed
                showError(data.message || 'Invalid credentials. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Connection error. Please try again.');
        } finally {
            setLoadingState(false);
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function setLoadingState(loading) {
        if (loading) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    }
});