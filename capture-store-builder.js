const { spawn } = require('child_process');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const baseDir = 'C:\\Users\\ruhan\\.gemini\\antigravity\\brain\\906704d0-34be-46d6-ba39-4ac9c090f616';
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9234',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--hide-scrollbars'
  ]);

  try {
    let version = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://localhost:9234/json/version');
        if (res.ok) { version = await res.json(); break; }
      } catch (e) {}
      await sleep(250);
    }
    if (!version) throw new Error('Chrome DevTools failed to start on port 9234');

    const targetRes = await fetch('http://localhost:9234/json/new?about:blank', { method: 'PUT' });
    const target = await targetRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (m, p = {}) => new Promise((resolve, reject) => {
      const i = id++;
      const h = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === i) {
          ws.removeEventListener('message', h);
          if (d.error) reject(d.error); else resolve(d.result);
        }
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: i, method: m, params: p }));
    });

    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('Navigating to http://localhost:3001/products/store-builder...');
    await send('Page.navigate', { url: 'http://localhost:3001/products/store-builder' });
    
    // Wait for initial render and animation cycle
    console.log('Waiting for animation to reveal stage...');
    await sleep(4000);

    // Layout info 1920x1080
    const layout = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: '({ scrollHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight), scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), innerWidth: window.innerWidth, innerHeight: window.innerHeight })'
    });
    const layoutVal = layout.result ? layout.result.value : layout.value;
    console.log('1920x1080 page layout:', layoutVal);

    // Screenshot 1: Desktop Viewport (1920x1080)
    const shotViewport = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(baseDir + '\\store_builder_1920x1080.png', Buffer.from(shotViewport.data, 'base64'));
    console.log('Saved store_builder_1920x1080.png (1920x1080)');

    // Screenshot 2: 1440x900 Viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(800);
    const layout1440 = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: '({ scrollHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight), scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), innerWidth: window.innerWidth, innerHeight: window.innerHeight })'
    });
    console.log('1440x900 page layout:', layout1440.result ? layout1440.result.value : layout1440.value);
    const shot1440 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(baseDir + '\\store_builder_1440x900.png', Buffer.from(shot1440.data, 'base64'));
    console.log('Saved store_builder_1440x900.png');

    // Screenshot 3: 1280x800 Viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(800);
    const layout1280 = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: '({ scrollHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight), scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), innerWidth: window.innerWidth, innerHeight: window.innerHeight })'
    });
    console.log('1280x800 page layout:', layout1280.result ? layout1280.result.value : layout1280.value);
    const shot1280 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(baseDir + '\\store_builder_1280x800.png', Buffer.from(shot1280.data, 'base64'));
    console.log('Saved store_builder_1280x800.png');

    console.log('All screenshots captured successfully!');
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
