// Default DNS over HTTPS address
const defaultdoh = 'https://cloudflare-dns.com/dns-query';

// Fetch event listener
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Main request handler
async function handleRequest(request) {
  const url = new URL(request.url);

  // Check for SETTINGS object
  // @ts-ignore
  if (typeof SETTINGS !== 'object') {
    return new Response(errorHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
      status: 500,
    });
  }

  // Security headers
  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': csp,
  };

  // Session token handling
  const sessionToken = request.headers.get('cookie')?.match(/sessionToken=([^;]+)/)?.[1];
  // @ts-ignore
  const storedSessionToken = await SETTINGS.get('sessionToken');

  // Route handling
  if (url.pathname === '/dns-query') {
    const dohaddress = await getdohaddress();
    const dnsQuery = await request.text();
    const dnsResponse = await fetch(dohaddress, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/dns-message',
      },
      body: dnsQuery,
    });

    return new Response(dnsResponse.body, {
      headers: {
        'Content-Type': 'application/dns-message',
        ...securityHeaders,
      },
    });

  } else if (url.pathname === '/set-doh-address' && request.method === 'POST') {
    try {
      const { dohaddress } = await request.json();
      if (!isValidUrl(dohaddress)) {
        return new Response('Invalid DNS over HTTPS Address', { status: 400, headers: securityHeaders });
      }
      // @ts-ignore
      await SETTINGS.put('dohaddress', dohaddress);
      return new Response('DNS over HTTPS Address saved!', { status: 200, headers: securityHeaders });
    } catch (error) {
      return new Response('Failed to save DNS over HTTPS Address', { status: 500, headers: securityHeaders });
    }

  } else if (url.pathname === '/reset-doh-address' && request.method === 'POST') {
    try {
      // @ts-ignore
      await SETTINGS.put('dohaddress', defaultdoh);
      return new Response('DNS over HTTPS Address reset to default!', { status: 200, headers: securityHeaders });
    } catch (error) {
      return new Response('Failed to reset DNS over HTTPS Address', { status: 500, headers: securityHeaders });
    }

  } else if (url.pathname === '/set-password' && request.method === 'GET') {
    const storedPassword = await SETTINGS.get('password');
    if (storedPassword) {
      const origin = `${url.protocol}//${url.host}`;
      return Response.redirect(`${origin}/`, 302);
    }
    return new Response(setPasswordHtml, {
      headers: {
        'Content-Type': 'text/html',
        ...securityHeaders,
      },
    });

  } else if (url.pathname === '/set-password' && request.method === 'POST') {
    const storedPassword = await SETTINGS.get('password');
    if (storedPassword) {
      return new Response('Password already set', { status: 400, headers: securityHeaders });
    }
    try {
      const { password, confirmPassword } = await request.json();
      if (password !== confirmPassword) {
        return new Response('Passwords do not match', { status: 400, headers: securityHeaders });
      }
      // @ts-ignore
      await SETTINGS.put('password', password);
      return new Response('Password set!', { status: 200, headers: securityHeaders });
    } catch (error) {
      return new Response('Failed to set password', { status: 500, headers: securityHeaders });
    }

  } else if (url.pathname === '/change-password' && request.method === 'GET') {
    if (!sessionToken || sessionToken !== storedSessionToken) {
      const origin = `${url.protocol}//${url.host}`;
      return Response.redirect(`${origin}/login`, 302);
    }
    return new Response(changePasswordHtml, {
      headers: {
        'Content-Type': 'text/html',
        ...securityHeaders,
      },
    });

  } else if (url.pathname === '/change-password' && request.method === 'POST') {
    if (!sessionToken || sessionToken !== storedSessionToken) {
      const origin = `${url.protocol}//${url.host}`;
      return Response.redirect(`${origin}/login`, 302);
    }
    try {
      const { currentPassword, newPassword, confirmNewPassword } = await request.json();
      const storedPassword = await SETTINGS.get('password');
      if (currentPassword !== storedPassword) {
        return new Response('Current password is incorrect', { status: 400, headers: securityHeaders });
      }
      if (newPassword !== confirmNewPassword) {
        return new Response('New passwords do not match', { status: 400, headers: securityHeaders });
      }
      // @ts-ignore
      await SETTINGS.put('password', newPassword);
      return new Response('Password changed!', { status: 200, headers: securityHeaders });
    } catch (error) {
      return new Response('Failed to change password', { status: 500, headers: securityHeaders });
    }

  } else if (url.pathname === '/login' && request.method === 'GET') {
    const sessionToken = request.headers.get('cookie')?.match(/sessionToken=([^;]+)/)?.[1];
    const storedPassword = await SETTINGS.get('password');
    if (!storedPassword) {
      return Response.redirect(`${url.protocol}//${url.host}/set-password`, 302);
    }
    if (sessionToken && sessionToken === storedSessionToken) {
      const origin = `${url.protocol}//${url.host}`;
      return Response.redirect(`${origin}/`, 302);
    }
    return new Response(loginHtml, {
      headers: {
        'Content-Type': 'text/html',
        ...securityHeaders,
      },
    });

  } else if (url.pathname === '/login' && request.method === 'POST') {
    const sessionToken = request.headers.get('cookie')?.match(/sessionToken=([^;]+)/)?.[1];
    if (sessionToken && sessionToken === storedSessionToken) {
      const origin = `${url.protocol}//${url.host}`;
      return Response.redirect(`${origin}/`, 302);
    }
    try {
      const { password } = await request.json();
      const storedPassword = await SETTINGS.get('password');
      if (password === storedPassword) {
        const sessionToken = generateSessionToken();
        // @ts-ignore
        await SETTINGS.put('sessionToken', sessionToken);
        const origin = `${url.protocol}//${url.host}`;
        return new Response('Login successful', {
          status: 200,
          headers: {
            'Set-Cookie': `sessionToken=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict`,
            ...securityHeaders,
          },
        });
      } else {
        return new Response('Invalid password', { status: 401, headers: securityHeaders });
      }
    } catch (error) {
      return new Response('Failed to login', { status: 500, headers: securityHeaders });
    }

  } else if (url.pathname === '/logout' && request.method === 'POST') {
    try {
      // @ts-ignore
      await SETTINGS.delete('sessionToken');
      return new Response('Logout successful', {
        status: 200,
        headers: {
          'Set-Cookie': 'sessionToken=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
          ...securityHeaders,
        },
      });
    } catch (error) {
      return new Response('Failed to logout', { status: 500, headers: securityHeaders });
    }

  } else if (url.pathname === '/') {
    const sessionToken = request.headers.get('cookie')?.match(/sessionToken=([^;]+)/)?.[1];
    const storedPassword = await SETTINGS.get('password');
    if (!storedPassword) {
      return new Response(setPasswordHtml, {
        headers: {
          'Content-Type': 'text/html',
          ...securityHeaders,
        },
      });
    } else if (!sessionToken || sessionToken !== storedSessionToken) {
      const origin = `${url.protocol}//${url.host}`;
      return Response.redirect(`${origin}/login`, 302);
    }
    const currentdohaddress = await getdohaddress();
    const origin = `${url.protocol}//${url.host}`;
    const htmlContent = html.replace('{{dohaddress}}', currentdohaddress).replace('{{origin}}', origin);
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        ...securityHeaders,
      },
    });

  } else {
    return new Response(notFoundHtml, {
      headers: {
        'Content-Type': 'text/html',
        ...securityHeaders,
      },
      status: 404,
    });
  }
}

// Helper functions
async function getdohaddress() {
  try {
    // @ts-ignore
    const dohaddress = await SETTINGS.get('dohaddress');
    return dohaddress || defaultdoh;
  } catch (error) {
    return defaultdoh;
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

const setPasswordHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set Password</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-bottom: 20px;
    }
    form {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    input[type="password"] {
      width: calc(100% - 20px);
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #333;
      border-radius: 4px;
      background-color: #2e2e2e;
      color: #ffffff;
    }
    button {
      padding: 10px 20px;
      background-color: #007bff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      max-width: 200px;
      margin: 10px auto;
    }
    button:hover {
      background-color: #0056b3;
    }
    .message {
      margin-top: 20px;
      color: #ff0000;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Set Password</h1>
    <form id="passwordForm">
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required>
      <label for="confirmPassword">Confirm Password:</label>
      <input type="password" id="confirmPassword" name="confirmPassword" required>
      <button type="submit">Set Password</button>
    </form>
    <div class="message" id="message"></div>
  </div>

  <script>
    document.getElementById('passwordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const response = await fetch('/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password, confirmPassword }),
      });

      const message = document.getElementById('message');
      if (response.ok) {
        message.textContent = 'Password set!';
        message.style.color = '#00ff00';
        window.location.href = '/login';
      } else if (response.status === 400) {
        const errorText = await response.text();
        message.textContent = errorText;
        document.getElementById('password').value = ''; // Clear the password input field
        document.getElementById('confirmPassword').value = ''; // Clear the confirm password input field
      } else {
        message.textContent = 'Failed to set password';
        document.getElementById('password').value = ''; // Clear the password input field
        document.getElementById('confirmPassword').value = ''; // Clear the confirm password input field
      }
    });
  </script>
</body>
</html>
`;

// Login HTML
const loginHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-bottom: 20px;
    }
    form {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    input[type="password"] {
      width: calc(100% - 20px);
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #333;
      border-radius: 4px;
      background-color: #2e2e2e;
      color: #ffffff;
    }
    button {
      padding: 10px 20px;
      background-color: #007bff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      max-width: 200px;
      margin: 10px auto;
    }
    button:hover {
      background-color: #0056b3;
    }
    .message {
      margin-top: 20px;
      color: #ff0000;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Login</h1>
    <form id="loginForm">
      <label for="password">Password:</label>
      <input type="password" id="password" name="password" required>
      <button type="submit">Login</button>
    </form>
    <div class="message" id="message"></div>
  </div>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('password').value;
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const message = document.getElementById('message');
      if (response.ok) {
        message.textContent = 'Login successful';
        message.style.color = '#00ff00';
        window.location.href = '/';
      } else {
        message.textContent = 'Invalid password';
        document.getElementById('password').value = ''; // Clear the input field
      }
    });
  </script>
</body>
</html>
`;

// Change Password HTML
const changePasswordHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Change Password</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-bottom: 20px;
    }
    form {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    input[type="password"] {
      width: calc(100% - 20px);
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #333;
      border-radius: 4px;
      background-color: #2e2e2e;
      color: #ffffff;
    }
    button {
      padding: 10px 20px;
      background-color: #007bff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      max-width: 200px;
      margin: 10px auto;
    }
    button:hover {
      background-color: #0056b3;
    }
    .message {
      margin-top: 20px;
      color: #ff0000;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Change Password</h1>
    <form id="changePasswordForm">
      <label for="currentPassword">Current Password:</label>
      <input type="password" id="currentPassword" name="currentPassword" required>
      <label for="newPassword">New Password:</label>
      <input type="password" id="newPassword" name="newPassword" required>
      <label for="confirmNewPassword">Confirm New Password:</label>
      <input type="password" id="confirmNewPassword" name="confirmNewPassword" required>
      <button type="submit">Change Password</button>
    </form>
    <div class="message" id="message"></div>
  </div>

  <script>
    document.getElementById('changePasswordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmNewPassword = document.getElementById('confirmNewPassword').value;
      const response = await fetch('/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      });

      const message = document.getElementById('message');
      if (response.ok) {
        message.textContent = 'Password changed!';
        message.style.color = '#00ff00';
        window.location.href = '/';
      } else {
        message.textContent = 'Failed to change password';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
      }
    });
  </script>
</body>
</html>
`;

// Main Application HTML
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Azadi DNS Panel</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-bottom: 20px;
    }
    form {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    input[type="text"] {
      width: calc(100% - 20px);
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #333;
      border-radius: 4px;
      background-color: #2e2e2e;
      color: #ffffff;
    }
    button {
      padding: 10px 20px;
      background-color: #007bff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      max-width: 200px;
      margin: 10px auto;
    }
    button:hover {
      background-color: #0056b3;
    }
    .version {
      margin-top: 20px;
      font-size: 0.9em;
      color: #999;
    }
    .panel-container {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 20px;
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .panel-container button {
      background-color: #2E2E2E;
      width: 100%;
    }
    @media (max-width: 600px) {
      .container {
        padding: 15px;
      }
      h1 {
        font-size: 1.5em;
      }
      input[type="text"] {
        padding: 8px;
      }
      button {
        padding: 8px 16px;
        font-size: 0.9em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Azadi DNS Panel</h1>
    <form id="dohForm">
      <label for="dohaddress">DNS over HTTPS Address:</label>
      <input type="text" id="dohaddress" name="dohaddress" value="{{dohaddress}}" required>
      <button type="submit">Save</button>
      <button type="button" id="resetButton">Reset to Default</button>
    </form>
    <label for="azadidoh">Azadi DoH:</label>
    <input type="text" id="azadidoh" name="azadidoh" value="{{origin}}/dns-query" readonly>
    <button id="copyazadidoh">Copy</button>
  </div>
  <div class="panel-container">
    <button id="changePasswordButton">Change Password</button>
    <button id="logoutButton">Logout</button>
  </div>
  <div class="version">Version 0.0.5</div>

  <script>
    document.getElementById('dohForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const dohaddress = document.getElementById('dohaddress').value;
      const response = await fetch('/set-doh-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dohaddress }),
      });

      if (response.ok) {
        alert('DNS over HTTPS Address saved!');
      } else {
        alert('Failed to save DNS over HTTPS Address');
      }
    });

    document.getElementById('copyazadidoh').addEventListener('click', () => {
      const azadidoh = document.getElementById('azadidoh');
      azadidoh.select();
      document.execCommand('copy');
      alert('Azadi DoH copied to clipboard!');
    });

    document.getElementById('resetButton').addEventListener('click', async () => {
      const response = await fetch('/reset-doh-address', {
        method: 'POST',
      });

      if (response.ok) {
        alert('DNS over HTTPS Address reset to default!');
        document.getElementById('dohaddress').value = '${defaultdoh}';
      } else {
        alert('Failed to reset DNS over HTTPS Address');
      }
    });

    document.getElementById('changePasswordButton').addEventListener('click', () => {
      window.location.href = '/change-password';
    });

    document.getElementById('logoutButton').addEventListener('click', async () => {
      const response = await fetch('/logout', {
        method: 'POST',
      });

      if (response.ok) {
        // Clear the browser history and replace the current state with the login page
        history.replaceState(null, '', '/login');
        window.location.href = '/login';
      } else {
        alert('Failed to logout');
      }
    });
  </script>
</body>
</html>
`;

// Error Page HTML
const errorHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-bottom: 20px;
    }
    p {
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Error</h1>
    <p>KV namespace does not exist. Please configure it.</p>
  </div>
</body>
</html>
`;

// Not Found Page HTML
const notFoundHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .container {
      background-color: #1e1e1e;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    h1 {
      margin-bottom: 20px;
    }
    p {
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Not Found</h1>
    <p>The page you are looking for does not exist.</p>
  </div>
</body>
</html>
`;
