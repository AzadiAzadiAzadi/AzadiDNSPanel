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
    const dohAddress = await getDohAddress()
    const dnsQuery = await request.text()
    const dnsResponse = await fetch(dohAddress, {
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
      const { dohAddress } = await request.json()
      await SETTINGS.put('dohAddress', dohAddress)
      return new Response('DoH DNS address saved!', { status: 200 })
    } catch (error) {
      return new Response('Failed to save DoH DNS address', { status: 500 })
    }
  } else if (url.pathname === '/') {
    const currentDohAddress = await getDohAddress()
    const origin = `${url.protocol}//${url.host}`
    const htmlContent = html.replace('{{dohAddress}}', currentDohAddress).replace('{{origin}}', origin)
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } else {
    return new Response('Not Found', { status: 404 })
  }
}

async function getDohAddress() {
  try {
    const dohAddress = await SETTINGS.get('dohAddress')
    return dohAddress || 'https://cloudflare-dns.com/dns-query'
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
      <label for="dohAddress">DoH DNS Address:</label>
      <input type="text" id="dohAddress" name="dohAddress" value="{{dohAddress}}" required>
      <button type="submit">Save</button>
    </form>
    <label for="dohEndpoint">DoH DNS Endpoint:</label>
    <input type="text" id="dohEndpoint" name="dohEndpoint" value="{{origin}}/dns-query" readonly>
    <button id="copyEndpoint">Copy</button>
    <div class="version">Version 0.0.2</div>
  </div>

  <script>
    document.getElementById('dohForm').addEventListener('submit', async (event) => {
      event.preventDefault()
      const dohAddress = document.getElementById('dohAddress').value
      const response = await fetch('/set-doh-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dohAddress }),
      })

      if (response.ok) {
        alert('DoH DNS address saved!')
      } else {
        alert('Failed to save DoH DNS address')
      }
    })

    document.getElementById('copyEndpoint').addEventListener('click', () => {
      const dohEndpoint = document.getElementById('dohEndpoint')
      dohEndpoint.select()
      document.execCommand('copy')
      alert('DoH DNS Endpoint copied to clipboard!')
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
