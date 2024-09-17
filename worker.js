addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  if (typeof SETTINGS !== 'object') {
    return new Response(errorHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
      status: 500
    })
  }

  if (url.pathname === '/dns-query') {
    const dohaddress = await getdohaddress()
    const dnsQuery = await request.text()
    const dnsResponse = await fetch(dohaddress, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/dns-message',
      },
      body: dnsQuery,
    })

    return new Response(dnsResponse.body, {
      headers: {
        'Content-Type': 'application/dns-message',
      },
    })
  } else if (url.pathname === '/set-doh-address' && request.method === 'POST') {
    try {
      const { dohaddress } = await request.json()
      await SETTINGS.put('dohaddress', dohaddress)
      return new Response('DNS over HTTPS Address saved!', { status: 200 })
    } catch (error) {
      return new Response('Failed to save DNS over HTTPS Address', { status: 500 })
    }
  } else if (url.pathname === '/') {
    const currentdohaddress = await getdohaddress()
    const origin = `${url.protocol}//${url.host}`
    const htmlContent = html.replace('{{dohaddress}}', currentdohaddress).replace('{{origin}}', origin)
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } else {
    return new Response('Not Found', { status: 404 })
  }
}

async function getdohaddress() {
  try {
    const dohaddress = await SETTINGS.get('dohaddress')
    return dohaddress || 'https://cloudflare-dns.com/dns-query'
  } catch (error) {
    return 'https://cloudflare-dns.com/dns-query'
  }
}

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
    #copyEndpoint {
      margin-top: 10px;
    }
    .version {
      margin-top: 20px;
      font-size: 0.9em;
      color: #999;
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
    </form>
    <label for="azadidoh">Azadi DoH:</label>
    <input type="text" id="azadidoh" name="azadidoh" value="{{origin}}/dns-query" readonly>
    <button id="copyEndpoint">Copy</button>
    <div class="version">Version 0.0.3</div>
  </div>

  <script>
    document.getElementById('dohForm').addEventListener('submit', async (event) => {
      event.preventDefault()
      const dohaddress = document.getElementById('dohaddress').value
      const response = await fetch('/set-doh-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dohaddress }),
      })

      if (response.ok) {
        alert('DNS over HTTPS Address saved!')
      } else {
        alert('Failed to save DNS over HTTPS Address')
      }
    })

    document.getElementById('copyEndpoint').addEventListener('click', () => {
      const azadidoh = document.getElementById('azadidoh')
      azadidoh.select()
      document.execCommand('copy')
      alert('Azadi DoH copied to clipboard!')
    })
  </script>
</body>
</html>
`

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
`
