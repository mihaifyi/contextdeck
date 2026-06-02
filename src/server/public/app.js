// -------------------------------------------------------------
// ContextDeck Client Application Controller
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // State management
  let filesList = []; // Flat list from API
  let fileTreeRoot = null; // Nested tree structure
  const selectedPaths = new Set(); // Set of checked file relative paths
  const activeExtensions = new Set(); // Filter configurations for file types

  // DOM Elements
  const workspacePathEl = document.getElementById('workspacePath');
  const fileCountBadgeEl = document.getElementById('fileCountBadge');
  const fileTreeEl = document.getElementById('fileTree');
  const searchInput = document.getElementById('fileSearch');
  const extensionFiltersEl = document.getElementById('extensionFilters');
  
  // Controls
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnSelectNone = document.getElementById('btnSelectNone');
  const btnToggleFolders = document.getElementById('btnToggleFolders');
  const toggleClean = document.getElementById('toggleClean');
  const radioFormats = document.getElementsByName('bundleFormat');

  // Stats
  const statGpt = document.getElementById('statGpt');
  const statClaude = document.getElementById('statClaude');
  const statGemini = document.getElementById('statGemini');
  const selectedCountEl = document.getElementById('selectedCount');
  const selectedSizeEl = document.getElementById('selectedSize');

  // Gauges
  const gaugeGpt = document.getElementById('gaugeGpt');
  const gaugeClaude = document.getElementById('gaugeClaude');
  const gaugeGemini = document.getElementById('gaugeGemini');
  const gaugeLabelGpt = document.getElementById('gaugeLabelGpt');
  const gaugeLabelClaude = document.getElementById('gaugeLabelClaude');
  const gaugeLabelGemini = document.getElementById('gaugeLabelGemini');

  // Breakdown Chart
  const breakdownBar = document.getElementById('breakdownBar');
  const breakdownLegend = document.getElementById('breakdownLegend');
  const breakdownText = document.getElementById('breakdownText');

  // Actions
  const btnCopy = document.getElementById('btnCopy');
  const btnDownload = document.getElementById('btnDownload');
  const toast = document.getElementById('toast');

  // Load Workspace Data
  init();

  async function init() {
    try {
      workspacePathEl.textContent = 'Scanning...';
      
      // Load saved settings from LocalStorage
      loadSettings();

      const response = await fetch('/api/files');
      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
        return;
      }
      
      filesList = data.files || [];
      
      // Update badge
      const totalFilesCount = filesList.filter(f => !f.isDirectory).length;
      fileCountBadgeEl.textContent = `${totalFilesCount} files`;
      
      // Set title path
      const rootSample = filesList.length > 0 ? filesList[0].absolutePath : '';
      if (rootSample) {
        const relativePart = filesList[0].relativePath;
        const separator = rootSample.includes('\\') ? '\\' : '/';
        const rootPath = rootSample.substring(0, rootSample.lastIndexOf(relativePart) - 1);
        workspacePathEl.textContent = rootPath || 'Local Directory';
      } else {
        workspacePathEl.textContent = 'Empty Directory';
      }

      // Populate file type filter badges
      renderExtensionFilters();

      // Build Tree
      fileTreeRoot = buildTree(filesList);
      
      // Render Tree
      renderTree(fileTreeRoot, fileTreeEl);

      // Select default files (exclude large files by default, say > 150KB)
      filesList.forEach(file => {
        if (!file.isDirectory && file.size < 150 * 1024) {
          selectedPaths.add(file.relativePath);
        }
      });
      
      updateAllCheckboxes();
      updateStats();
      setupEventListeners();
    } catch (err) {
      showError(`Connection lost to server: ${err.message}`);
    }
  }

  function showError(msg) {
    fileTreeEl.innerHTML = `
      <div class="loading-state" style="color: #ef4444;">
        <span style="font-size: 2rem;">⚠️</span>
        <p>${msg}</p>
      </div>
    `;
  }

  // --- Local Settings Persistence ---

  function loadSettings() {
    const savedFormat = localStorage.getItem('deck_format');
    const savedClean = localStorage.getItem('deck_clean');

    if (savedFormat) {
      Array.from(radioFormats).forEach(radio => {
        radio.checked = radio.value === savedFormat;
      });
    }
    if (savedClean !== null) {
      toggleClean.checked = savedClean === 'true';
    }
  }

  function saveSettings() {
    localStorage.setItem('deck_format', getSelectedFormat());
    localStorage.setItem('deck_clean', toggleClean.checked);
  }

  // --- Dynamic File Type Badges ---

  function renderExtensionFilters() {
    const extensions = new Set();
    filesList.forEach(file => {
      if (!file.isDirectory) {
        const parts = file.relativePath.split('.');
        if (parts.length > 1) {
          extensions.add('.' + parts.pop().toLowerCase());
        } else {
          extensions.add('no-ext');
        }
      }
    });

    extensionFiltersEl.innerHTML = '';
    const sortedExts = Array.from(extensions).sort();

    sortedExts.forEach(ext => {
      const badge = document.createElement('span');
      badge.className = 'extension-badge';
      badge.textContent = ext;
      badge.dataset.ext = ext;
      
      badge.addEventListener('click', () => {
        const isActive = badge.classList.toggle('active');
        if (isActive) {
          activeExtensions.add(ext);
        } else {
          activeExtensions.delete(ext);
        }
        applyFilters();
      });

      extensionFiltersEl.appendChild(badge);
    });
  }

  // Combine search and extension filters
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const nodes = fileTreeEl.querySelectorAll('.tree-node');

    nodes.forEach(node => {
      const path = node.dataset.path.toLowerCase();
      const label = node.querySelector('.tree-label').textContent.toLowerCase();
      
      // Check search match
      const searchMatches = !query || label.includes(query) || path.includes(query);
      
      // Check extension match
      let extMatches = true;
      if (activeExtensions.size > 0) {
        const isDir = !!node.querySelector('.folder-children');
        if (!isDir) {
          const parts = path.split('.');
          const ext = parts.length > 1 ? '.' + parts.pop() : 'no-ext';
          extMatches = activeExtensions.has(ext);
        }
      }

      if (searchMatches && extMatches) {
        node.style.display = 'block';
        
        // Show parents
        let parent = node.parentElement.closest('.tree-node');
        while (parent) {
          parent.style.display = 'block';
          const childContainer = parent.querySelector('.folder-children');
          if (childContainer) childContainer.classList.remove('collapsed');
          const chevron = parent.querySelector('.folder-toggle');
          if (chevron) chevron.classList.remove('collapsed');
          parent = parent.parentElement.closest('.tree-node');
        }
      } else {
        node.style.display = 'none';
      }
    });

    // Make folders visible if they contain matching children
    nodes.forEach(node => {
      const children = node.querySelector('.folder-children');
      if (children) {
        const visibleChildren = Array.from(children.children).some(child => child.style.display !== 'none');
        if (visibleChildren) {
          node.style.display = 'block';
        }
      }
    });
  }

  // --- Tree Processing ---

  function buildTree(flatFiles) {
    const root = {
      name: '.',
      relativePath: '',
      isDirectory: true,
      children: {}
    };

    flatFiles.forEach(file => {
      const parts = file.relativePath.split(/[\/\\]/);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        const isLast = i === parts.length - 1;
        
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            relativePath: parts.slice(0, i + 1).join('/'),
            isDirectory: !isLast || file.isDirectory,
            size: isLast ? file.size : 0,
            children: {}
          };
        }
        current = current.children[part];
      }
    });

    return root;
  }

  function renderTree(node, parentElement) {
    parentElement.innerHTML = '';
    
    const children = Object.values(node.children).sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    children.forEach(child => {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'tree-node';
      nodeEl.dataset.path = child.relativePath;

      const rowEl = document.createElement('div');
      rowEl.className = 'tree-row';

      let toggleHtml = '';
      if (child.isDirectory && Object.keys(child.children).length > 0) {
        toggleHtml = `<span class="folder-toggle">▼</span>`;
      } else {
        toggleHtml = `<span class="folder-toggle" style="opacity: 0; pointer-events: none;">▼</span>`;
      }

      const checkboxHtml = `
        <span class="checkbox-container">
          <input type="checkbox" class="tree-checkbox" data-path="${child.relativePath}">
        </span>
      `;

      const icon = child.isDirectory ? '📁' : getFileIcon(child.name);
      const sizeHtml = child.isDirectory ? '' : `<span class="tree-size">${formatBytes(child.size)}</span>`;
      
      rowEl.innerHTML = `
        ${toggleHtml}
        ${checkboxHtml}
        <span class="tree-icon">${icon}</span>
        <span class="tree-label">${child.name}</span>
        ${sizeHtml}
      `;

      nodeEl.appendChild(rowEl);

      if (child.isDirectory) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'folder-children';
        renderTree(child, childrenContainer);
        nodeEl.appendChild(childrenContainer);

        const toggleBtn = rowEl.querySelector('.folder-toggle');
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const collapsed = childrenContainer.classList.toggle('collapsed');
          toggleBtn.classList.toggle('collapsed', collapsed);
        });
      }

      const checkbox = rowEl.querySelector('.tree-checkbox');
      checkbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        handleCheckboxChange(child, isChecked);
        updateAllCheckboxes();
        updateStats();
      });

      rowEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('tree-checkbox') || e.target.classList.contains('folder-toggle')) return;
        const cb = rowEl.querySelector('.tree-checkbox');
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });

      parentElement.appendChild(nodeEl);
    });
  }

  function handleCheckboxChange(node, isChecked) {
    if (node.isDirectory) {
      function toggleAllChildren(n) {
        if (!n.isDirectory) {
          if (isChecked) selectedPaths.add(n.relativePath);
          else selectedPaths.delete(n.relativePath);
        }
        Object.values(n.children).forEach(toggleAllChildren);
      }
      toggleAllChildren(node);
    } else {
      if (isChecked) {
        selectedPaths.add(node.relativePath);
      } else {
        selectedPaths.delete(node.relativePath);
      }
    }
  }

  function updateAllCheckboxes() {
    const checkboxes = fileTreeEl.querySelectorAll('.tree-checkbox');
    checkboxes.forEach(cb => {
      const path = cb.dataset.path;
      const fileNode = findNodeByPath(fileTreeRoot, path);
      
      if (!fileNode) return;

      if (fileNode.isDirectory) {
        const stats = getFolderSelectionStats(fileNode);
        if (stats.checked === stats.total) {
          cb.checked = true;
          cb.classList.remove('indeterminate');
        } else if (stats.checked > 0) {
          cb.checked = false;
          cb.classList.add('indeterminate');
        } else {
          cb.checked = false;
          cb.classList.remove('indeterminate');
        }
      } else {
        cb.checked = selectedPaths.has(path);
        cb.classList.remove('indeterminate');
      }

      const row = cb.closest('.tree-row');
      if (row) {
        row.classList.toggle('selected', cb.checked || cb.classList.contains('indeterminate'));
      }
    });
  }

  function getFolderSelectionStats(folderNode) {
    let checked = 0;
    let total = 0;

    function count(node) {
      if (!node.isDirectory) {
        total++;
        if (selectedPaths.has(node.relativePath)) checked++;
      }
      Object.values(node.children).forEach(count);
    }
    
    count(folderNode);
    return { checked, total };
  }

  function findNodeByPath(currentNode, targetPath) {
    if (currentNode.relativePath === targetPath) return currentNode;
    
    const parts = targetPath.split('/');
    let node = fileTreeRoot;
    
    for (const part of parts) {
      if (node.children[part]) {
        node = node.children[part];
      } else {
        return null;
      }
    }
    
    return node;
  }

  // --- Real-time statistics & Breakdown ---

  function updateStats() {
    let totalBytes = 0;
    let selectedFiles = 0;
    const breakdown = {};

    filesList.forEach(file => {
      if (!file.isDirectory && selectedPaths.has(file.relativePath)) {
        totalBytes += file.size;
        selectedFiles++;

        // Process extension grouping
        const parts = file.relativePath.split('.');
        const ext = parts.length > 1 ? '.' + parts.pop().toLowerCase() : 'no-ext';
        breakdown[ext] = (breakdown[ext] || 0) + file.size;
      }
    });

    selectedCountEl.textContent = selectedFiles;
    selectedSizeEl.textContent = formatBytes(totalBytes);

    const cleanReduction = toggleClean.checked ? 0.82 : 1.0;
    const estimatedChars = Math.ceil(totalBytes * cleanReduction);

    const tokensGpt = Math.ceil(estimatedChars / 3.7);
    const tokensClaude = Math.ceil(estimatedChars / 3.4);
    const tokensGemini = Math.ceil(estimatedChars / 4.0);

    statGpt.textContent = totalBytes === 0 ? '0' : formatNumber(tokensGpt);
    statClaude.textContent = totalBytes === 0 ? '0' : formatNumber(tokensClaude);
    statGemini.textContent = totalBytes === 0 ? '0' : formatNumber(tokensGemini);

    // Update capacity gauges (Latest 2026 limits: GPT-5 128k, Claude-4 200k, Gemini-3.5 2M)
    const limitGpt = 128000;
    const limitClaude = 200000;
    const limitGemini = 2000000;

    const pctGpt = Math.min((tokensGpt / limitGpt) * 100, 100);
    const pctClaude = Math.min((tokensClaude / limitClaude) * 100, 100);
    const pctGemini = Math.min((tokensGemini / limitGemini) * 100, 100);

    gaugeGpt.style.width = `${pctGpt}%`;
    gaugeClaude.style.width = `${pctClaude}%`;
    gaugeGemini.style.width = `${pctGemini}%`;

    gaugeLabelGpt.textContent = `${pctGpt.toFixed(1)}% of 128k limit`;
    gaugeLabelClaude.textContent = `${pctClaude.toFixed(1)}% of 200k limit`;
    gaugeLabelGemini.textContent = `${pctGemini.toFixed(1)}% of 2M limit`;

    // Render segmented composition bar
    renderBreakdownBar(breakdown, totalBytes);

    const disabled = selectedFiles === 0;
    btnCopy.disabled = disabled;
    btnDownload.disabled = disabled;
  }

  // Segmented multi-color language progress bar and legends
  function renderBreakdownBar(breakdown, totalBytes) {
    breakdownBar.innerHTML = '';
    breakdownLegend.innerHTML = '';

    if (totalBytes === 0) {
      breakdownText.textContent = '0% mapped';
      return;
    }

    breakdownText.textContent = 'Composition calculated';

    const sortedBreakdowns = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    
    // Core extensions configurations
    const themeColors = {
      '.ts': '#007acc',
      '.tsx': '#3178c6',
      '.js': '#f7df1e',
      '.jsx': '#f1e05a',
      '.html': '#e34c26',
      '.css': '#563d7c',
      '.json': '#8c8c8c',
      '.md': '#083fa6',
      'no-ext': '#4f46e5'
    };

    let mappedPercentage = 0;

    sortedBreakdowns.forEach(([ext, size]) => {
      const pct = (size / totalBytes) * 100;
      if (pct < 1) return; // Skip tiny elements for visual precision

      const color = themeColors[ext] || '#8b5cf6';

      // Bar segment
      const segment = document.createElement('div');
      segment.className = 'breakdown-segment';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.title = `${ext}: ${pct.toFixed(1)}% (${formatBytes(size)})`;
      breakdownBar.appendChild(segment);

      // Legend Item
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `
        <span class="legend-dot" style="background-color: ${color};"></span>
        <span><strong>${ext}</strong> (${pct.toFixed(0)}%)</span>
      `;
      breakdownLegend.appendChild(legendItem);

      mappedPercentage += pct;
    });

    if (mappedPercentage === 0) {
      breakdownText.textContent = 'No text files selected';
    }
  }

  // --- Event Handlers & Subscriptions ---

  function setupEventListeners() {
    searchInput.addEventListener('input', () => {
      applyFilters();
    });

    btnSelectAll.addEventListener('click', () => {
      filesList.forEach(f => {
        if (!f.isDirectory) selectedPaths.add(f.relativePath);
      });
      updateAllCheckboxes();
      updateStats();
    });

    btnSelectNone.addEventListener('click', () => {
      selectedPaths.clear();
      updateAllCheckboxes();
      updateStats();
    });

    let allCollapsed = false;
    btnToggleFolders.addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      const containers = fileTreeEl.querySelectorAll('.folder-children');
      const chevrons = fileTreeEl.querySelectorAll('.folder-toggle');
      
      containers.forEach(container => {
        container.classList.toggle('collapsed', allCollapsed);
      });
      
      chevrons.forEach(chevron => {
        chevron.classList.toggle('collapsed', allCollapsed);
      });

      btnToggleFolders.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
    });

    toggleClean.addEventListener('change', () => {
      updateStats();
      saveSettings();
    });

    Array.from(radioFormats).forEach(radio => {
      radio.addEventListener('change', () => {
        updateStats();
        saveSettings();
      });
    });

    btnCopy.addEventListener('click', async () => {
      const bundleData = await generateBundle();
      if (!bundleData) return;

      try {
        await navigator.clipboard.writeText(bundleData.bundle);
        showToast('Copied context successfully!');
        
        const preciseStats = bundleData.tokenStats;
        statGpt.textContent = formatNumber(preciseStats.gpt);
        statClaude.textContent = formatNumber(preciseStats.claude);
        statGemini.textContent = formatNumber(preciseStats.gemini);
      } catch (err) {
        alert('Failed to copy to clipboard: ' + err.message);
      }
    });

    btnDownload.addEventListener('click', async () => {
      const bundleData = await generateBundle();
      if (!bundleData) return;

      const format = getSelectedFormat();
      const filename = `context-deck-bundle.${format === 'xml' ? 'xml' : 'md'}`;
      
      const blob = new Blob([bundleData.bundle], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast(`Downloaded ${filename}!`);
    });
  }

  async function generateBundle() {
    setLoadingState(true);

    try {
      const format = getSelectedFormat();
      const removeEmptyLines = toggleClean.checked;

      const response = await fetch('/api/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: Array.from(selectedPaths),
          format,
          removeEmptyLines
        })
      });

      const data = await response.json();
      if (data.error) {
        alert('Error compiling bundle: ' + data.error);
        return null;
      }
      return data;
    } catch (err) {
      alert('Error connecting to compiler service: ' + err.message);
      return null;
    } finally {
      setLoadingState(false);
    }
  }

  function getSelectedFormat() {
    let val = 'xml';
    Array.from(radioFormats).forEach(radio => {
      if (radio.checked) val = radio.value;
    });
    return val;
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      btnCopy.disabled = true;
      btnDownload.disabled = true;
      btnCopy.querySelector('.btn-text-content').textContent = 'Processing Codebase...';
    } else {
      btnCopy.disabled = false;
      btnDownload.disabled = false;
      btnCopy.querySelector('.btn-text-content').textContent = 'Copy Context to Clipboard';
    }
  }

  // --- Toast ---

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // --- Formatting Helpers ---

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return '🟦';
      case 'js':
      case 'jsx':
      case 'json':
        return '🟨';
      case 'html':
        return '🟧';
      case 'css':
        return '🎨';
      case 'md':
        return '📝';
      case 'sh':
      case 'bash':
        return '🐚';
      default:
        return '📄';
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
});
