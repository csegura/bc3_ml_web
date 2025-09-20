// Shared Tree Utilities for BC3 Budget Calculator
// Common formatting and tree functionality for all pages

// Number formatting utilities
function formatCurrency(value) {
    // Handle various input types and edge cases
    if (value === null || value === undefined || value === '') {
        return '0,00 €';
    }
    
    // Use the same formatting as formatNumber and add € symbol
    const numberFormatted = formatNumber(value);
    return numberFormatted + ' €';
}

function formatNumber(value) {
    // Handle various input types and edge cases
    if (value === null || value === undefined || value === '') {
        return '0,00';
    }
    const num = parseFloat(value) || 0;
    
    // Custom formatting to ensure thousands separator for numbers >= 1000
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1000) {
        // Split into integer and decimal parts
        const fixed = absNum.toFixed(2);
        const [integerPart, decimalPart] = fixed.split('.');
        
        // Add thousands separators manually
        const withSeparators = integerPart.replace(/(\d)(?=(\d{3})+$)/g, '$1.');
        
        return `${sign}${withSeparators},${decimalPart}`;
    } else {
        // For numbers < 1000, use standard Spanish formatting
        return num.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

function formatPercentage(value) {
    // Handle various input types and edge cases
    if (value === null || value === undefined || value === '') {
        return '0,0%';
    }
    const num = parseFloat(value) || 0;
    return (num * 100).toLocaleString('es-ES', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }) + '%';
}

// Alert notification system - floating upper right corner (same as showToast but for important messages)
function showAlert(message, type = 'info') {
    // Use the same floating toast system for consistency
    showToast(message, type);
}

// Toast notification system (for less critical messages) - floating upper right corner
function showToast(message, type = 'success') {
    // Create or get toast container
    let toastContainer = document.getElementById('toast-container-floating');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container-floating';
        toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        toastContainer.style.maxWidth = '400px';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = 'border-l-4 p-4 rounded-lg shadow-lg transition-all duration-800 transform translate-x-full opacity-0';
    
    const iconMap = {
        'success': '✓',
        'error': '✖',
        'warning': '⚠',
        'info': 'ℹ'
    };
    
    const colorMap = {
        'success': 'var(--acr-green2)',
        'error': 'var(--acr-orange)',
        'warning': 'var(--acr--orange)',
        'info': 'var(--acr-black)'
    };
    
    toast.className += ` toast-${type || 'info'}`;
    
    toast.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <span class="mr-3">${iconMap[type] || iconMap.success}</span>
                <span class="text-gray-800 font-medium text-sm">${message}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600 ml-3 text-lg font-bold">×</button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    }, 100);
    
    // Auto remove after 5 seconds for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('translate-x-full', 'opacity-0');
                setTimeout(() => {
                    toast.remove();
                    // Remove container if empty
                    if (toastContainer.children.length === 0) {
                        toastContainer.remove();
                    }
                }, 300);
            }
        }, 6000);
    }
}

// Tree rendering utilities
let nodeIdCounter = 0;

// Generate unique node ID for tree elements
function generateNodeId(code, level, parentId) {
    return 'node-' + (nodeIdCounter++);
}

function renderTreeRows(tree, showPred = false, level = 0, parentId = null, pendingChanges = {}) {
    if (!tree) return '';
    const thisId = 'node-' + (nodeIdCounter++);
    const hasChildren = tree.children && tree.children.length > 0;
    const rowClass =
        level === 0 ? 'group-header' :
        (tree.concept_type === 'SUBCAPITULO' ? 'group-header' :
        (hasChildren ? 'group-header' : 'tree-row-leaf'));
    const toggle = hasChildren
        ? `<button class="tree-toggle" data-target="${thisId}" aria-expanded="true" title="Toggle">▼</button>`
        : '<span class="tree-spacer"></span>';
    
    // Tooltip for concept_type
    const conceptTypeCell = `<td title="${tree.descriptive_text ? String(tree.descriptive_text).replace(/"/g, '&quot;') : ''}" class="text-xs">${tree.concept_type || ''}</td>`;
    
    // Build ML prediction cell (with tooltip) when applicable
    let mlCell = '';
    if (showPred) {
        let label = '';
        let tooltip = '';
        let cellClasses = 'ml-prediction text-xs';
        let cellContent = '';
        
        const pred = tree._prediction;
        const nodePath = tree.code; // Use code as path for simplicity
        const hasChange = pendingChanges && pendingChanges[nodePath];
        
        if (pred) {
            const originalLabel = pred.predicted_label || '';
            const currentLabel = pred.user_label || pred.predicted_label || '';
            const isUserModified = !!(pred.user_label);
            const labs = Array.isArray(pred.topk_labels) ? pred.topk_labels : [];
            const probs = Array.isArray(pred.topk_probas) ? pred.topk_probas : [];
            
            if (hasChange) {
                // Show modified state: ~~Original~~ → New
                const newLabel = pendingChanges[nodePath];
                cellClasses += ' ml-cell-modified';
                cellContent = `<span class="ml-original-struck">${currentLabel}</span><span class="ml-change-arrow">→</span><span class="ml-new-category">${newLabel}</span><span class="ml-modified-indicator"></span>`;
                tooltip = `Current: ${currentLabel}\nNew: ${newLabel}\n\nSuggestions:\n` + 
                    (labs.length ? labs.map((l, i) => {
                        const p = typeof probs[i] === 'number' ? probs[i] : null;
                        return p !== null ? `${l} — ${formatPercentage(p)}` : `${l}`;
                    }).join('\n') : 'No suggestions available');
            } else {
                // Show normal state with user modification indicator if applicable
                label = currentLabel;
                const userModifiedIndicator = isUserModified ? '<span class="user-modified-indicator" title="Manually updated classification">✏️</span> ' : '';
                cellContent = `${userModifiedIndicator}${label}`;
                
                if (labs.length) {
                    tooltip = labs.map((l, i) => {
                        const p = typeof probs[i] === 'number' ? probs[i] : null;
                        return p !== null ? `${l} — ${formatPercentage(p)}` : `${l}`;
                    }).join('\n');
                }
                
                if (isUserModified) {
                    tooltip = `User Modified: ${currentLabel}\nOriginal AI Prediction: ${originalLabel}\n\nAI Suggestions:\n` + tooltip;
                }
            }
        }
        
        const esc = (s) => String(s).replace(/"/g, '&quot;');
        mlCell = `<td title="${esc(tooltip)}" class="${cellClasses}">${cellContent}</td>`;
    }
    
    // Hide unit price for SUBCAPITULOS and ROOT (level 0) items
    const shouldShowUnitPrice = tree.concept_type !== 'SUBCAPITULO' && level !== 0;
    const unitPriceCell = shouldShowUnitPrice ? 
        `<td style="text-align:right;" class="font-mono">${formatNumber(tree.unit_price)}</td>` :
        `<td style="text-align:right;" class="text-gray-400">—</td>`;
    
    let row = `<tr id="${thisId}" class="${rowClass}" data-level="${level}" data-parent="${parentId || ''}" ${hasChildren ? 'data-has-children="true"' : ''}>
        <td class="tree-cell" style="padding-left:${(level * 1.25) + 0.5}em;">${toggle}<span>${tree.code}</span></td>
        <td class="text-xs">${tree.summary || ''}</td>
        ${mlCell}
        <td>${tree.unit || ''}</td>
        ${conceptTypeCell}
        ${unitPriceCell}
        <td style="text-align:right;" class="font-mono">${formatNumber(tree.output)}</td>
        <td style="text-align:right;" class="font-mono font-medium">${formatNumber(tree.total_amount)}</td>
    </tr>`;
    
    if (hasChildren) {
        for (const child of tree.children) {
            row += renderTreeRows(child, showPred, level + 1, thisId, pendingChanges);
        }
    }
    return row;
}

// Tree control functions
function addTreeToggleHandlers() {
    const toggles = document.querySelectorAll('.tree-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const targetId = this.getAttribute('data-target');
            toggleTreeNode(targetId);
        });
    });
}

function toggleTreeNode(nodeId) {
    const row = document.getElementById(nodeId);
    if (!row) return;
    
    const toggle = row.querySelector('.tree-toggle');
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
        collapseNode(nodeId);
    } else {
        expandNode(nodeId);
    }
}

function expandNode(nodeId) {
    const row = document.getElementById(nodeId);
    if (!row) return;
    
    const toggle = row.querySelector('.tree-toggle');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.innerHTML = '▼';
    
    // Show all direct children
    const children = document.querySelectorAll(`tr[data-parent="${nodeId}"]`);
    children.forEach(child => {
        child.style.display = '';
    });
}

function collapseNode(nodeId) {
    const row = document.getElementById(nodeId);
    if (!row) return;
    
    const toggle = row.querySelector('.tree-toggle');
    toggle.setAttribute('aria-expanded', 'false');
    //toggle.innerHTML = '▶';
    
    // Hide all descendants recursively
    function hideDescendants(parentId) {
        const children = document.querySelectorAll(`tr[data-parent="${parentId}"]`);
        children.forEach(child => {
            child.style.display = 'none';
            // Also collapse any expanded children
            const childToggle = child.querySelector('.tree-toggle');
            if (childToggle) {
                childToggle.setAttribute('aria-expanded', 'false');
                //schildToggle.innerHTML = '▶';
            }
            // Recursively hide their children
            hideDescendants(child.id);
        });
    }
    
    hideDescendants(nodeId);
}

function expandAllNodes() {
    console.log('=== EXPAND ALL NODES (Custom Tree) ===');
    
    const allToggles = document.querySelectorAll('.tree-toggle');
    let expandedCount = 0;
    
    allToggles.forEach(toggle => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        if (!isExpanded) {
            const targetId = toggle.getAttribute('data-target');
            expandNode(targetId);
            expandedCount++;
        }
    });
    
    console.log(`Expanded ${expandedCount} nodes`);
    showToast(`Expandidos ${expandedCount} nodos`);
}

function collapseAllNodes() {
    console.log('=== COLLAPSE ALL NODES (Custom Tree) ===');
    
    const allToggles = document.querySelectorAll('.tree-toggle');
    let collapsedCount = 0;
    
    // Collapse from deepest level first
    const togglesArray = Array.from(allToggles);
    togglesArray.sort((a, b) => {
        const levelA = parseInt(a.closest('tr').getAttribute('data-level')) || 0;
        const levelB = parseInt(b.closest('tr').getAttribute('data-level')) || 0;
        return levelB - levelA; // Descending order
    });
    
    togglesArray.forEach(toggle => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            const targetId = toggle.getAttribute('data-target');
            collapseNode(targetId);
            collapsedCount++;
        }
    });
    
    console.log(`Collapsed ${collapsedCount} nodes`);
    showToast(`Colapsados ${collapsedCount} nodos`);
}

function expandToLevel(maxLevel) {
    console.log(`=== EXPAND TO LEVEL ${maxLevel} ===`);
    
    const allToggles = document.querySelectorAll('.tree-toggle');
    let expandedCount = 0;
    
    allToggles.forEach(toggle => {
        const row = toggle.closest('tr');
        const level = parseInt(row.getAttribute('data-level')) || 0;
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        
        if (level < maxLevel && !isExpanded) {
            const targetId = toggle.getAttribute('data-target');
            expandNode(targetId);
            expandedCount++;
        }
    });
    
    console.log(`Expanded ${expandedCount} nodes to level ${maxLevel}`);
    showToast(`Expandido hasta nivel ${maxLevel} (${expandedCount} nodos)`);
}

function collapseToLevel(maxLevel) {
    console.log(`=== COLLAPSE TO LEVEL ${maxLevel} ===`);
    
    const allToggles = document.querySelectorAll('.tree-toggle');
    let collapsedCount = 0;
    
    // Collapse from deepest level first
    const togglesArray = Array.from(allToggles);
    togglesArray.sort((a, b) => {
        const levelA = parseInt(a.closest('tr').getAttribute('data-level')) || 0;
        const levelB = parseInt(b.closest('tr').getAttribute('data-level')) || 0;
        return levelB - levelA; // Descending order
    });
    
    togglesArray.forEach(toggle => {
        const row = toggle.closest('tr');
        const level = parseInt(row.getAttribute('data-level')) || 0;
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        
        if (level >= maxLevel && isExpanded) {
            const targetId = toggle.getAttribute('data-target');
            collapseNode(targetId);
            collapsedCount++;
        }
    });
    
    console.log(`Collapsed ${collapsedCount} nodes at level ${maxLevel}+`);
    showToast(`Colapsado hasta nivel ${maxLevel} (${collapsedCount} nodos)`);
}

// Initialize tree table with standard controls
function initializeTreeTable(data, containerId, showPredictions = false, pendingChanges = {}) {
    nodeIdCounter = 0; // Reset counter
    console.log('Creating custom HTML tree for:', data.code);
    
    // Check for ML predictions
    function checkForPredictions(node) {
        if (node._prediction) return true;
        if (node.children) {
            return node.children.some(child => checkForPredictions(child));
        }
        return false;
    }
    showPredictions = showPredictions || checkForPredictions(data);
    
    // Build table HTML
    let tableHTML = '<div class="overflow-x-auto">';
    const tableClass = showPredictions ? 'tree-table w-full border-collapse text-sm table-auto has-predictions' : 'tree-table w-full border-collapse text-sm table-auto';
    tableHTML += `<table class="${tableClass}">`;
    
    // Header
    tableHTML += '<thead><tr class="bg-gray-100 border-b">';
    tableHTML += '<th style="width: 12%;">Código</th>';
    tableHTML += '<th style="width: 40%;">Descripción</th>';
    if (showPredictions) {
        tableHTML += '<th style="width: 20%;">Categoría ML</th>';
    }
    tableHTML += '<th style="width: 8%;">Unidad</th>';
    tableHTML += '<th style="width: 10%;">Tipo</th>';
    tableHTML += '<th style="width: 12%; text-align: right;">Precio Unitario</th>';
    tableHTML += '<th style="width: 8%; text-align: right;">Cantidad</th>';
    tableHTML += '<th style="width: 15%; text-align: right;">Importe Total</th>';
    tableHTML += '</tr></thead>';
    
    // Body
    tableHTML += '<tbody>';
    tableHTML += renderTreeRows(data, showPredictions, 0, null, pendingChanges);
    tableHTML += '</tbody>';
    tableHTML += '</table>';
    tableHTML += '</div>';
    
    // Insert into DOM
    document.getElementById(containerId).innerHTML = tableHTML;
    
    // Add click handlers for tree toggles
    addTreeToggleHandlers();
    
    console.log('Custom tree table created successfully');
    return showPredictions;
}

// Loading spinner utility - standardized across all pages
function showLoading(message = 'Cargando datos...') {
    // Remove any existing loading overlay
    const existingOverlay = document.getElementById('loading-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create loading overlay
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    overlay.innerHTML = `
        <div class="bg-white rounded-lg p-6 flex flex-col items-center shadow-xl">
            <div class="spinner mb-4"></div>
            <p class="text-gray-700 font-medium">${message}</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Setup standard tree control buttons
function setupTreeControls() {
    // Setup main controls
    const expandAllBtn = document.getElementById('expandAll');
    const collapseAllBtn = document.getElementById('collapseAll');
    
    if (expandAllBtn) expandAllBtn.addEventListener('click', expandAllNodes);
    if (collapseAllBtn) collapseAllBtn.addEventListener('click', collapseAllNodes);
    
    // Setup level-specific expand controls
    const expandLevel1 = document.getElementById('expandLevel1');
    const expandLevel2 = document.getElementById('expandLevel2');
    const expandLevel3 = document.getElementById('expandLevel3');
    const expandLevel4 = document.getElementById('expandLevel4');
    const expandLevel5 = document.getElementById('expandLevel5');
    
    if (expandLevel1) expandLevel1.addEventListener('click', () => expandToLevel(1));
    if (expandLevel2) expandLevel2.addEventListener('click', () => expandToLevel(2));
    if (expandLevel3) expandLevel3.addEventListener('click', () => expandToLevel(3));
    if (expandLevel4) expandLevel4.addEventListener('click', () => expandToLevel(4));
    if (expandLevel5) expandLevel5.addEventListener('click', () => expandToLevel(10)); // L5+ means level 5 and beyond
    
    // Setup level-specific collapse controls
    const collapseToLevel1 = document.getElementById('collapseToLevel1');
    const collapseToLevel2 = document.getElementById('collapseToLevel2');
    const collapseToLevel3 = document.getElementById('collapseToLevel3');
    const collapseToLevel4 = document.getElementById('collapseToLevel4');
    
    if (collapseToLevel1) collapseToLevel1.addEventListener('click', () => collapseToLevel(1));
    if (collapseToLevel2) collapseToLevel2.addEventListener('click', () => collapseToLevel(2));
    if (collapseToLevel3) collapseToLevel3.addEventListener('click', () => collapseToLevel(3));
    if (collapseToLevel4) collapseToLevel4.addEventListener('click', () => collapseToLevel(4));
}

// === SHARED SELECTION UTILITIES ===

// Standard checkbox classes and attributes
const CHECKBOX_CLASSES = {
    ITEM: 'item-select h-4 w-4 text-blue-600 rounded focus:ring-blue-500',
    MASTER: 'h-4 w-4 text-blue-600 rounded focus:ring-blue-500',
    GROUP: 'group-select h-4 w-4 text-blue-600 rounded focus:ring-blue-500'
};

// Create standardized checkbox HTML
function createCheckboxHTML(type, attributes = {}) {
    const classes = CHECKBOX_CLASSES[type.toUpperCase()] || CHECKBOX_CLASSES.ITEM;
    const attrs = Object.entries(attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
    return `<input type="checkbox" class="${classes}" ${attrs}>`;
}

// Create bulk actions floating bar with standardized styling
function createStandardBulkActionsBar(options = {}) {
    const {
        position = 'bottom-6 left-1/2 transform -translate-x-1/2',
        backgroundColor = 'white',
        editButtonText = 'Editar Seleccionados',
        clearButtonText = 'Limpiar Selección'
    } = options;
    
    const bulkActions = document.createElement('div');
    bulkActions.id = 'bulkActions';
    bulkActions.className = `fixed ${position} bg-white border border-gray-300 rounded-lg shadow-lg px-6 py-3 hidden z-40`;
    
    bulkActions.innerHTML = `
        <div class="flex items-center space-x-4">
            <span id="selectionCount" class="text-sm font-medium text-gray-700">0 elementos seleccionados</span>
            <button id="editSelectedBtn" class="btn-primary text-sm px-4 py-2">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                ${editButtonText}
            </button>
            <button id="clearSelectionBtn" class="btn-secondary text-sm px-4 py-2">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                ${clearButtonText}
            </button>
        </div>
    `;
    
    return bulkActions;
}

// Update row highlighting based on selection
function updateRowHighlighting(selectedItems, rowSelector = 'tr[data-item-code]') {
    // Safety check for selectedItems
    if (!selectedItems || typeof selectedItems.has !== 'function') {
        selectedItems = new Set();
    }
    
    document.querySelectorAll(rowSelector).forEach(row => {
        const itemCode = row.getAttribute('data-item-code');
        if (selectedItems.has(itemCode)) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    });
}

// Update selection display with standardized format
function updateStandardSelectionDisplay(selectedItems, bulkActionsId = 'bulkActions') {
    const count = selectedItems.size;
    const selectionCount = document.getElementById('selectionCount');
    const bulkActions = document.getElementById(bulkActionsId);
    
    if (selectionCount) {
        selectionCount.textContent = `${count} elemento${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
    }
    
    if (bulkActions) {
        bulkActions.style.display = count > 0 ? 'block' : 'none';
    }
}

// === SHARED NAVIGATION UTILITIES ===

// Extract current record code from URL parameters
function getCurrentRecordCode() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Try 'code' parameter first
    let code = urlParams.get('code');
    if (code) return code;
    
    // Try 'file' parameter and extract code
    const file = urlParams.get('file');
    if (file) {
        // Remove .json extension if present
        return file.replace(/\.json$/, '');
    }
    
    return null;
}

// Build navigation URL with correct parameters for different page types
function buildNavigationURL(page, code) {
    if (!code) return '#';
    
    const baseUrls = {
        calc: '/calc-v2.html',
        categorized: '/categorized-v2.html', 
        grouped: '/grouped-v2.html',
        classify: '/classify-v2.html',
        index: '/index-v2.html'
    };
    
    const baseUrl = baseUrls[page];
    if (!baseUrl) return '#';
    
    // Index page doesn't need parameters
    if (page === 'index') return baseUrl;
    
    // calc and categorized use file parameter
    if (page === 'calc' || page === 'categorized') {
        return `${baseUrl}?file=${code}.json`;
    }
    
    // grouped and classify use code parameter
    return `${baseUrl}?code=${code}`;
}

// Standard navigation icons with SVGs and tooltips
const NAVIGATION_ICONS = {
    calc: {
        tooltip: 'Ver Presupuesto',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>`
    },
    categorized: {
        tooltip: 'Ver Categorizado ML',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" /><path d="M9 17h-2" /><path d="M13 12h-6" /><path d="M11 7h-4" />
              </svg>`
    },
    grouped: {
        tooltip: 'Vista Agrupada',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>`
    },
    classify: {
        tooltip: 'Editar Clasificaciones',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>`
    },
    index: {
        tooltip: 'Volver a Registros',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>`
    }
};

// Generate standard navigation HTML
function generateStandardNavigation(currentPage = '', additionalButtons = '') {
    const currentCode = getCurrentRecordCode();
    const pages = ['calc', 'categorized', 'grouped', 'classify', 'index'];
    
    let navHTML = '<div class="flex items-center space-x-4">';
    
    // Add any additional buttons first (like Save Changes)
    if (additionalButtons) {
        navHTML += additionalButtons;
    }
    
    // Add standard navigation icons
    pages.forEach(page => {
        if (page === currentPage) return; // Skip current page
        
        const icon = NAVIGATION_ICONS[page];
        const url = buildNavigationURL(page, currentCode);
        const isDisabled = (page !== 'index' && !currentCode);
        
        const buttonClass = page === 'index' ? 'nav-btn-secondary' : 'nav-btn-primary';
        const disabledClass = isDisabled ? ' opacity-50 pointer-events-none' : '';
        //  data-toggle="tooltip" title="Some tooltip text!"
        navHTML += `
            <a href="${url}" data-toggle="tooltip" title="${icon.tooltip}" class="${buttonClass} tooltip${disabledClass}" data-tooltip="${icon.tooltip}">
                ${icon.svg}
            </a>
        `;
    });
    
    navHTML += '</div>';
    return navHTML;
}

// Enhanced tree table initialization with built-in selection support
function initializeTreeTableWithSelection(data, containerId, showPredictions = false, pendingChanges = {}, selectedItems = new Set()) {
    nodeIdCounter = 0; // Reset counter
    
    // Check for ML predictions
    function checkForPredictions(node) {
        if (node._prediction) return true;
        if (node.children) {
            return node.children.some(child => checkForPredictions(child));
        }
        return false;
    }
    showPredictions = showPredictions || checkForPredictions(data);
    
    // Build table HTML with selection column
    let tableHTML = '<div class="overflow-x-auto">';
    const tableClass = showPredictions ? 'tree-table w-full border-collapse text-sm table-auto has-predictions' : 'tree-table w-full border-collapse text-sm table-auto';
    tableHTML += `<table class="${tableClass}">`;
    
    // Header with checkbox inside code column
    tableHTML += '<thead><tr class="bg-gray-100 border-b">';
    tableHTML += `<th class="p-2 text-left">${createCheckboxHTML('master', {id: 'selectAllCheckbox', title: 'Seleccionar todos los elementos'})} Código</th>`;
    tableHTML += '<th class="p-2 text-left">Descripción</th>';
    if (showPredictions) {
        tableHTML += '<th class="p-2 text-left">Categoría ML</th>';
    }
    tableHTML += '<th class="p-2 text-left">Unidad</th>';
    tableHTML += '<th class="p-2 text-left">Tipo</th>';
    tableHTML += '<th class="p-2 text-right">Precio Unitario</th>';
    tableHTML += '<th class="p-2 text-right">Cantidad</th>';
    tableHTML += '<th class="p-2 text-right">Importe Total</th>';
    tableHTML += '</tr></thead>';
    
    // Body
    tableHTML += '<tbody>';
    tableHTML += renderTreeRowsWithSelection(data, showPredictions, 0, '', pendingChanges, selectedItems);
    tableHTML += '</tbody></table></div>';
    
    // Insert into container
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = tableHTML;
    }
}

// Enhanced tree row rendering with built-in selection support
function renderTreeRowsWithSelection(tree, showPred = false, level = 0, parentId = '', pendingChanges = {}, selectedItems = new Set()) {
    const thisId = generateNodeId(tree.code, level, parentId);
    const hasChildren = tree.children && tree.children.length > 0;
    const conceptType = tree.concept_type || '';
    
    // Determine if this row should have a checkbox (PARTIDA with ML predictions)
    const shouldShowCheckbox = conceptType === 'PARTIDA' && tree._prediction && tree._prediction.predicted_label;
    const isSelected = shouldShowCheckbox && selectedItems.has(tree.code);
    
    // Row classes
    const baseClasses = hasChildren ? 'group-header' : 'tree-row-leaf';
    const selectedClass = isSelected ? ' selected-row' : '';
    const rowClass = `${baseClasses}${selectedClass}`;
    
    // Toggle button
    const toggle = hasChildren ? 
        `<button class="tree-toggle" data-target="${thisId}" aria-expanded="true" title="Toggle">▼</button>` : 
        '<span class="tree-spacer"></span>';
    
    // Prepare checkbox for code cell integration
    let checkboxHtml = '';
    if (shouldShowCheckbox) {
        const checkboxAttrs = {
            'data-item-code': tree.code,
            ...(isSelected ? {checked: true} : {}),
            style: 'margin-right: 8px;'
        };
        checkboxHtml = createCheckboxHTML('item', checkboxAttrs);
    }
    
    // ML prediction cell
    let mlCell = '';
    if (showPred) {
        let mlContent = '';
        if (tree._prediction) {
            const userLabel = pendingChanges[tree.code] || tree._prediction.user_label;
            const displayLabel = userLabel || tree._prediction.predicted_label;
            const isModified = !!(userLabel || tree._prediction.user_label);
            const modifiedIndicator = isModified ? '<span class="user-modified-indicator" title="Manually updated classification">✏️</span> ' : '';
            
            mlContent = `<span class="ml-prediction-text" style="cursor: pointer;" title="Double-click para editar">${modifiedIndicator}${displayLabel}</span>`;
        }
        mlCell = `<td class="ml-prediction">${mlContent}</td>`;
    }
    
    // Concept type with color coding
    const conceptTypeCell = conceptType === 'PARTIDA' ? 
        '<td class="concept-type-partida">PARTIDA</td>' :
        `<td class="concept-type-other">${conceptType}</td>`;
    
    // Unit price display logic
    const shouldShowUnitPrice = conceptType === 'PARTIDA' && tree.unit_price && tree.unit_price > 0;
    const unitPriceCell = shouldShowUnitPrice ? 
        `<td style="text-align:right;" class="font-mono">${formatNumber(tree.unit_price)}</td>` :
        `<td style="text-align:right;" class="text-gray-400">—</td>`;
    
    // Row data attributes
    const dataAttrs = shouldShowCheckbox ? `data-item-code="${tree.code}"` : '';
    
    let row = `<tr id="${thisId}" class="${rowClass}" data-level="${level}" data-parent="${parentId || ''}" ${hasChildren ? 'data-has-children="true"' : ''} ${dataAttrs}>
        <td class="tree-cell" style="padding-left:${(level * 1.25) + 0.5}em;">${toggle}${checkboxHtml}<span>${tree.code}</span></td>
        <td class="text-xs">${tree.summary || ''}</td>
        ${mlCell}
        <td>${tree.unit || ''}</td>
        ${conceptTypeCell}
        ${unitPriceCell}
        <td style="text-align:right;" class="font-mono">${formatNumber(tree.output)}</td>
        <td style="text-align:right;" class="font-mono font-medium">${formatNumber(tree.total_amount)}</td>
    </tr>`;
    
    if (hasChildren) {
        for (const child of tree.children) {
            row += renderTreeRowsWithSelection(child, showPred, level + 1, thisId, pendingChanges, selectedItems);
        }
    }
    return row;
}