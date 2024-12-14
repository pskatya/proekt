document.addEventListener('DOMContentLoaded', () => {
    // Регистрация пользователя
    document.getElementById('registerBtn').addEventListener('click', async() => {
        const name = document.getElementById('name').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = '';
        if (!name || !password) {
            errorMessage.textContent = 'Name and password are required.';
            return;
        }
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, role: 'user' }),
            });
            const data = await response.json();
            if (response.ok) {
                errorMessage.style.color = 'green';
                errorMessage.textContent = 'Registration successful! You can now log in.';
                localStorage.setItem('token', data.token);
                setTimeout(() => window.location.href = '/notes.html', 2000);
            } else {
                errorMessage.style.color = 'red';
                errorMessage.textContent = data.message;
            }
        } catch (error) {
            console.error('Error during registration:', error);
            errorMessage.style.color = 'red';
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    });

    // Логин пользователя
    document.getElementById('loginBtn').addEventListener('click', async() => {
        const name = document.getElementById('name').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = '';
        if (!name || !password) {
            errorMessage.textContent = 'Name and password are required.';
            return;
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password }),
            });
            const data = await response.json();
            if (response.ok) {
                errorMessage.style.color = 'green';
                errorMessage.textContent = 'Login successful!';
                localStorage.setItem('token', data.token);
                setTimeout(() => window.location.href = '/notes.html', 2000);
            } else {
                errorMessage.style.color = 'red';
                errorMessage.textContent = data.message;
            }
        } catch (error) {
            console.error('Error during login:', error);
            errorMessage.style.color = 'red';
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    });

    // Загрузка системной информации
    (async() => {
        try {
            const response = await fetch('/system-info');
            const { fileData, systemInfo } = await response.json();
            document.getElementById('fileData').textContent = fileData;
            document.getElementById('hostname').textContent = systemInfo.hostname;
            document.getElementById('platform').textContent = systemInfo.platform;
            document.getElementById('architecture').textContent = systemInfo.architecture;
            document.getElementById('cpuCount').textContent = systemInfo.cpuCount;
            document.getElementById('freeMemory').textContent = `${(systemInfo.freeMemory / (1024 * 1024)).toFixed(2)} MB`;
            document.getElementById('totalMemory').textContent = `${(systemInfo.totalMemory / (1024 * 1024)).toFixed(2)} MB`;
        } catch (error) {
            console.error('Error loading system info:', error);
        }
    })();
});