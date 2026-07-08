let loopActive = false;
let segments = [];
let currentSegmentIdx = 0;

// Converts "MM:SS" or "HH:MM:SS" strings to total seconds
function parseTimestamp(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return null;
}

// Converts seconds to a readable "MM:SS" string format
function formatSeconds(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (num) => String(num).padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

// Injects the Loop button into the YouTube toolbar
function injectLoopButton() {
  if (document.getElementById('yt-custom-loop-btn')) return;

  const btnContainer = document.querySelector('#top-level-buttons-computed, ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed');
  if (!btnContainer) return;

  const loopBtn = document.createElement('button');
  loopBtn.id = 'yt-custom-loop-btn';
  loopBtn.style.cssText = `
    background: var(--yt-spec-badge-chip-background, rgba(255, 255, 255, 0.1));
    color: var(--yt-spec-text-primary, #fff);
    border: none;
    padding: 0 16px;
    margin-right: 8px;
    border-radius: 18px;
    height: 36px;
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.2s;
  `;
  
  // Assegnazione HTML statica, senza variabili (sicura per il linter)
  loopBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
    <span>Multi-Loop</span>
  `;

  loopBtn.addEventListener('mouseover', () => {
    if (!loopActive) loopBtn.style.background = 'var(--yt-spec-button-chip-background-hover, rgba(255, 255, 255, 0.2))';
  });
  
  loopBtn.addEventListener('mouseout', () => {
    if (!loopActive) {
      loopBtn.style.background = 'var(--yt-spec-badge-chip-background, rgba(255, 255, 255, 0.1))';
    } else {
      loopBtn.style.background = '#3ea6ff';
    }
  });

  btnContainer.insertBefore(loopBtn, btnContainer.firstChild);
  loopBtn.addEventListener('click', toggleLoopPanel);
}

// Adds an input row for a segment in the panel
function addSegmentRow(startVal = "", endVal = "") {
  const container = document.getElementById('yt-segments-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'yt-segment-row';
  row.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  `;

  // Assegnazione HTML statica per superare i controlli di sicurezza di Mozilla.
  // Nessuna variabile inserita tramite interpolazione.
  row.innerHTML = `
    <div style="display:flex; align-items:center; background:#121212; border:1px solid #444; border-radius:6px; padding:2px 4px; flex:1;">
      <input type="text" class="yt-start-input" placeholder="Start" style="width:100%; background:transparent; border:none; color:#fff; font-size:13px; outline:none; padding:4px;">
      <button class="yt-cap-start-btn" title="Capture current time" style="background:transparent; border:none; color:#3ea6ff; cursor:pointer; font-size:14px; padding:2px;">📍</button>
    </div>
    <span style="color:#aaa; font-size:12px;">to</span>
    <div style="display:flex; align-items:center; background:#121212; border:1px solid #444; border-radius:6px; padding:2px 4px; flex:1;">
      <input type="text" class="yt-end-input" placeholder="End" style="width:100%; background:transparent; border:none; color:#fff; font-size:13px; outline:none; padding:4px;">
      <button class="yt-cap-end-btn" title="Capture current time" style="background:transparent; border:none; color:#3ea6ff; cursor:pointer; font-size:14px; padding:2px;">📍</button>
    </div>
    <button class="yt-del-seg-btn" style="background:transparent; border:none; color:#ff4f4f; cursor:pointer; font-size:18px; padding:0 4px; line-height:1;">&times;</button>
  `;

  // I valori vengono assegnati programmaticamente in un secondo momento (sicuro)
  row.querySelector('.yt-start-input').value = startVal;
  row.querySelector('.yt-end-input').value = endVal;

  container.appendChild(row);

  // Captures the video's current time for the start point
  row.querySelector('.yt-cap-start-btn').addEventListener('click', () => {
    const video = document.querySelector('video');
    if (video) row.querySelector('.yt-start-input').value = formatSeconds(video.currentTime);
  });

  // Captures the video's current time for the end point
  row.querySelector('.yt-cap-end-btn').addEventListener('click', () => {
    const video = document.querySelector('video');
    if (video) row.querySelector('.yt-end-input').value = formatSeconds(video.currentTime);
  });

  // Removes the current input row
  row.querySelector('.yt-del-seg-btn').addEventListener('click', () => {
    row.remove();
  });
}

// Generates the main user interface panel
function createLoopPanel() {
  if (document.getElementById('yt-custom-loop-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'yt-custom-loop-panel';
  panel.style.cssText = `
    display: none;
    position: absolute;
    z-index: 9999;
    background: var(--yt-spec-raised-background, #212121);
    color: var(--yt-spec-text-primary, #fff);
    border: 1px solid var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 16px;
    width: 320px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-family: Roboto, Arial, sans-serif;
  `;

  panel.innerHTML = `
    <div style="margin-bottom: 12px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
      <span>Configure Multiple Segments</span>
      <span id="yt-loop-close" style="cursor:pointer; font-size: 18px; line-height: 1;">&times;</span>
    </div>
    
    <div id="yt-segments-container" style="max-height: 220px; overflow-y: auto; margin-bottom: 12px; padding-right: 4px;">
      <!-- Dynamic rows container -->
    </div>

    <button id="yt-loop-add-seg" style="width:100%; background:rgba(255,255,255,0.05); color:var(--yt-spec-text-primary, #fff); border:1px dashed #555; padding:8px; border-radius:6px; cursor:pointer; margin-bottom:12px; font-weight:500; font-size:13px;">
      + Add Segment
    </button>
    
    <div style="display:flex; gap: 8px;">
      <button id="yt-loop-btn-start" style="flex:1; background:#3ea6ff; color:#000; border:none; padding:8px; font-weight:bold; border-radius:6px; cursor:pointer;">Start</button>
      <button id="yt-loop-btn-stop" style="flex:1; background:#444; color:#fff; border:none; padding:8px; font-weight:bold; border-radius:6px; cursor:pointer;">Stop</button>
    </div>
    <div id="yt-loop-status" style="margin-top:12px; font-size:12px; color:#3ea6ff; text-align:center; display:none; font-weight:500;"></div>
  `;

  document.body.appendChild(panel);

  document.getElementById('yt-loop-close').addEventListener('click', () => { panel.style.display = 'none'; });
  document.getElementById('yt-loop-add-seg').addEventListener('click', () => { addSegmentRow(); });

  // Inserts an initial empty row for user convenience
  addSegmentRow();

  // Logic for activating the loop sequence
  document.getElementById('yt-loop-btn-start').addEventListener('click', () => {
    const rows = document.querySelectorAll('.yt-segment-row');
    const tempSegments = [];
    
    rows.forEach(row => {
      const startVal = row.querySelector('.yt-start-input').value;
      const endVal = row.querySelector('.yt-end-input').value;
      const tStart = parseTimestamp(startVal);
      const tEnd = parseTimestamp(endVal);
      
      if (tStart !== null && tEnd !== null && tStart < tEnd) {
        tempSegments.push({ start: tStart, end: tEnd });
      }
    });

    const video = document.querySelector('video');
    if (video && tempSegments.length > 0) {
      // Sort segments chronologically
      tempSegments.sort((a, b) => a.start - b.start);
      
      segments = tempSegments;
      currentSegmentIdx = 0;
      loopActive = true;
      
      video.currentTime = segments[0].start;
      video.play();
      
      const statusDiv = document.getElementById('yt-loop-status');
      statusDiv.style.display = 'block';
      statusDiv.innerText = `Loop active on ${segments.length} segment(s)`;
      
      document.getElementById('yt-custom-loop-btn').style.background = '#3ea6ff';
    } else {
      alert('Please configure at least one valid segment with a Start time before the End time.');
    }
  });

  document.getElementById('yt-loop-btn-stop').addEventListener('click', () => {
    loopActive = false;
    document.getElementById('yt-loop-status').style.display = 'none';
    document.getElementById('yt-custom-loop-btn').style.background = 'var(--yt-spec-badge-chip-background, rgba(255, 255, 255, 0.1))';
  });
}

// Displays the panel and aligns it with the native button
function toggleLoopPanel(e) {
  createLoopPanel();
  const panel = document.getElementById('yt-custom-loop-panel');
  if (!panel) return;

  if (panel.style.display === 'block') {
    panel.style.display = 'none';
  } else {
    const rect = e.currentTarget.getBoundingClientRect();
    panel.style.top = `${rect.bottom + window.scrollY + 8}px`;
    panel.style.left = `${rect.left + window.scrollX}px`;
    panel.style.display = 'block';
  }
}

// Constantly monitors video time progression to apply sequence jumps
document.addEventListener('timeupdate', (e) => {
  if (loopActive && segments.length > 0 && e.target && e.target.tagName === 'VIDEO') {
    const video = e.target;
    const currentSeg = segments[currentSegmentIdx];
    
    // If playback exceeds the active segment's end time, jump to the next one
    if (video.currentTime >= currentSeg.end) {
      currentSegmentIdx = (currentSegmentIdx + 1) % segments.length;
      video.currentTime = segments[currentSegmentIdx].start;
    } 
    // Safety check if the cursor is placed outside the active track (e.g., initial start)
    else if (video.currentTime < currentSeg.start) {
      const matchingIdx = segments.findIndex(s => video.currentTime >= s.start && video.currentTime < s.end);
      if (matchingIdx !== -1) {
        currentSegmentIdx = matchingIdx;
      } else {
        video.currentTime = currentSeg.start;
      }
    }
  }
}, true);

// Polling interval to ensure the interface remains stable across page changes
setInterval(() => {
  if (window.location.pathname === '/watch') {
    injectLoopButton();
  } else {
    loopActive = false;
    const panel = document.getElementById('yt-custom-loop-panel');
    if (panel) panel.style.display = 'none';
  }
}, 1000);