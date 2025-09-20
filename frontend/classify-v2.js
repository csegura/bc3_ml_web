// Classification Editor with enhanced UX

let classifyTable;
let currentCode = '';
// REMOVED: let pendingChanges = {} - no longer needed with immediate saves
let budgetData = null;
let allClasses = [];
let filteredClasses = [];
let selectedItems = new Set();
let isSelectAllChecked = false;
let currentSearchTerm = '';
let matchingItems = [];

// Toast functions are now in tree-utils.js

// Loading functions are now in tree-utils.js

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        code: urlParams.get('code') || ''
    };
}

// Update change counter - REMOVED: No longer needed with immediate saves

// Tree data conversion is now handled by shared tree utilities

// Initialize custom tree table for classification
function initializeTable(data) {
    // Use the enhanced tree utilities with built-in selection support
    initializeTreeTableWithSelection(data, 'classify-table', true, {}, selectedItems);
    
    // Add classification-specific event handlers after table is created
    setTimeout(() => {
        addTreeToggleHandlers();
        addClassificationHandlers();
        addSelectionHandlers();
        updateSelectionDisplay();
    }, 100);
}

// Add click handlers for ML category cells
function addClassificationHandlers() {
    const mlCells = document.querySelectorAll('.ml-prediction');
    
    // Also add row-level handlers as fallback
    const allRows = document.querySelectorAll('tr[data-level]');
    
    mlCells.forEach((cell, index) => {
        cell.style.cursor = 'pointer';
        cell.title = 'Double-click para editar clasificación';
        // cell.style.backgroundColor = '#fef3cd'; // Removed light yellow background
        
        // Remove any existing listeners
        const newCell = cell.cloneNode(true);
        cell.parentNode.replaceChild(newCell, cell);
        
        newCell.addEventListener('dblclick', async function(e) {
            e.stopPropagation();
            await handleCellClick(this);
        });
        
        // Also add single click for testing
        newCell.addEventListener('click', function(e) {
            console.log('Single click on ML cell for testing'); // Debug log
            e.stopPropagation();
        });
    });
    
    // Add handlers to all PARTIDA rows as alternative
    allRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
            const typeCell = cells[4]; // Type column should be at index 4 with ML column
            if (typeCell && typeCell.textContent.trim() === 'PARTIDA') {
                console.log(`Adding row handler for PARTIDA ${index}`); // Debug log
                row.style.cursor = 'pointer';
                row.title = 'Double-click para editar clasificación';
                
                row.addEventListener('dblclick', async function(e) {
                    console.log('Double-click on PARTIDA row'); // Debug log
                    e.stopPropagation();
                    await handleRowClick(this);
                });
            }
        }
    });
    
    console.log('Classification handlers added');
}

// Handle ML cell click
async function handleCellClick(cell) {
    const row = cell.closest('tr');
    if (!row) {
        console.log('No row found from cell'); // Debug log
        return;
    }
    await handleRowClick(row);
}

// Handle row click
async function handleRowClick(row) {
    console.log('Handling row click...'); // Debug log
    console.log('Row HTML:', row.outerHTML.substring(0, 200)); // Debug log
    
    // Method 1: Get code from data-item-code attribute (preferred method)
    const itemCode = row.getAttribute('data-item-code');
    console.log('Method 1 - Code from data-item-code attribute:', itemCode); // Debug log
    
    let code = itemCode;
    
    // Fallback methods if data-item-code is not available
    if (!code) {
        console.log('data-item-code not found, trying fallback methods'); // Debug log
        
        // Method 2: Look for span in tree-cell (after selection column addition)
        const spanInTreeCell = row.querySelector('td.tree-cell span');
        if (spanInTreeCell) {
            code = spanInTreeCell.textContent.trim();
            console.log('Method 2 - Code from tree-cell span:', code); // Debug log
        }
        
        // Method 3: Look for span in second cell (tree-cell is now second after selection column)
        if (!code) {
            const secondCell = row.querySelectorAll('td')[1];
            if (secondCell) {
                const spanInSecondCell = secondCell.querySelector('span');
                if (spanInSecondCell) {
                    code = spanInSecondCell.textContent.trim();
                    console.log('Method 3 - Code from second cell span:', code); // Debug log
                }
            }
        }
        
        // Method 4: Get text content from second cell and extract code
        if (!code) {
            const secondCell = row.querySelectorAll('td')[1];
            if (secondCell) {
                const cellText = secondCell.textContent.trim();
                console.log('Method 4 - Second cell text:', cellText); // Debug log
                // Extract code pattern (like "01.01" or "02#")
                const codeMatch = cellText.match(/^[▼▶\s]*([^\s]+)/);
                if (codeMatch) {
                    code = codeMatch[1];
                    console.log('Method 4 - Extracted code:', code); // Debug log
                }
            }
        }
    }
    
    console.log('Final extracted code:', code); // Debug log
    
    if (!code) {
        console.log('No code found in row after all methods'); // Debug log
        showToast('No se puede identificar el código del elemento', 'error');
        return;
    }
    
    // Find the node directly in budgetData
    const nodeData = findNodeInTree(budgetData, code);
    console.log('Found node:', nodeData); // Debug log
    
    if (!nodeData) {
        console.log('Node not found in budget data'); // Debug log
        showToast('Elemento no encontrado en los datos', 'error');
        return;
    }
    
    if (nodeData.concept_type !== 'PARTIDA') {
        console.log('Not a PARTIDA item:', nodeData.concept_type); // Debug log
        showToast('Solo los elementos PARTIDA pueden ser editados', 'warning');
        return;
    }
    
    if (!nodeData._prediction) {
        console.log('No prediction data found'); // Debug log
        showToast('No hay predicción ML disponible para este elemento', 'warning');
        return;
    }
    
    console.log('Opening modal for valid PARTIDA node'); // Debug log
    await openEditModalLegacy(nodeData);
}

// Extract node data from a table row
function extractNodeDataFromRow(row) {
    const cells = row.querySelectorAll('td');
    console.log('Row cells found:', cells.length); // Debug log
    if (cells.length < 5) {
        console.log('Not enough cells in row'); // Debug log
        return null;
    }
    
    const codeCell = cells[0].querySelector('span');
    const code = codeCell ? codeCell.textContent.trim() : '';
    console.log('Extracted code:', code); // Debug log
    
    // Check if we have ML predictions column (column layout differs)
    const hasMlColumn = document.querySelector('.ml-prediction') !== null;
    const conceptTypeIndex = hasMlColumn ? 4 : 3; // Type column shifts if ML column is present
    
    console.log('Has ML column:', hasMlColumn, 'Concept type index:', conceptTypeIndex); // Debug log
    
    if (cells.length <= conceptTypeIndex) {
        console.log('Not enough cells for concept type'); // Debug log
        return null;
    }
    
    const conceptType = cells[conceptTypeIndex].textContent.trim();
    console.log('Extracted concept type:', conceptType); // Debug log
    
    // Find the original node data from budgetData
    const nodeData = findNodeInTree(budgetData, code);
    console.log('Found node data:', nodeData); // Debug log
    
    return nodeData;
}

// Find a node in the tree by code
function findNodeInTree(tree, targetCode) {
    if (tree.code === targetCode) {
        return tree;
    }
    if (tree.children) {
        for (const child of tree.children) {
            const found = findNodeInTree(child, targetCode);
            if (found) return found;
        }
    }
    return null;
}

// Load all classes from API
async function loadAllClasses() {
    try {
        const response = await fetch(`${window.location.protocol}//${window.location.hostname}:8005/api/classes`);
        if (!response.ok) {
            throw new Error(`Failed to load classes: ${response.status}`);
        }
        
        const data = await response.json();
        allClasses = data.classes || [];
        filteredClasses = [...allClasses];
        
        console.log(`Loaded ${allClasses.length} classes from API`);
        return allClasses;
    } catch (error) {
        console.error('Failed to load all classes:', error);
        showToast('Error al cargar las clases de clasificación', 'error');
        return [];
    }
}

// Filter classes based on search input
function filterClasses(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        filteredClasses = [...allClasses];
    } else {
        const term = searchTerm.toLowerCase().trim();
        filteredClasses = allClasses.filter(className => 
            className.toLowerCase().includes(term)
        );
    }
    
    console.log(`Filtered ${filteredClasses.length} classes from ${allClasses.length} total`);
    // Update the all classes select
    populateAllClassesSelect();
}

// Populate the all classes select with filtered results
function populateAllClassesSelect() {
    const allClassesSelect = document.getElementById('modalAllClasses');
    allClassesSelect.innerHTML = '';
    
    if (filteredClasses.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = allClasses.length > 0 ? 'No classes match your filter' : 'Loading classes...';
        allClassesSelect.appendChild(option);
        return;
    }
    
    // Add a placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = `Seleccionar de ${filteredClasses.length} clases...`;
    allClassesSelect.appendChild(placeholderOption);
    
    filteredClasses.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        allClassesSelect.appendChild(option);
    });
}

// Legacy function to maintain compatibility with existing calls
async function openEditModalLegacy(nodeData) {
    // Call new openEditModal function in single-edit mode
    await openEditModal(nodeData, false);
}

// These functions are now implemented at the end of the file as part of the new bulk edit system

// Revert to predicted label
async function revertModalChanges() {
    const modal = document.getElementById('editModal');
    const nodeCode = modal.getAttribute('data-node-code') || window.currentEditNode?.code;
    
    if (!nodeCode) {
        showAlert('No se puede identificar el elemento a revertir', 'error');
        return;
    }
    
    closeEditModal();
    showLoading('Revirtiendo a clasificación predicha...');
    
    try {
        const response = await fetch(`${window.location.protocol}//${window.location.hostname}:8005/records/${currentCode}/label`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                node_code: nodeCode,
                user_label: null, // null reverts to predicted label
                apply_to_subtree: false
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to revert classification');
        }
        
        showToast('Revertido a clasificación predicha');
        
        // Reload data to reflect server state
        setTimeout(() => loadClassificationData(), 1000);
        
    } catch (error) {
        showAlert(`Error revirtiendo cambios: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// REMOVED: saveAllChanges function - no longer needed with immediate saves

// Load classification data
async function loadClassificationData() {
    console.log('=== Starting loadClassificationData function ===');
    console.log('Current code:', currentCode);
    showLoading('Cargando datos de clasificación...');
    console.log('Loading spinner should now be visible');
    
    try {
        console.log('Loading classification data for code:', currentCode); // Debug log
        
        // Use the calc_tree API endpoint to get the processed tree structure
        const filename = `${currentCode}.json`;
        const apiParams = new URLSearchParams({ source: 'categorized' });
        const url = `${window.location.protocol}//${window.location.hostname}:8005/calc_tree/${encodeURIComponent(filename)}?${apiParams.toString()}`;
        console.log('Fetching URL:', url); // Debug log
        console.log('Current hostname:', window.location.hostname);
        console.log('Full URL being fetched:', url);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        console.log('Response received:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Failed to load classification data: ${response.status} ${response.statusText}`);
        }
        
        console.log('Starting to parse JSON response...');
        const data = await response.json();
        console.log('JSON parsing completed:', data);
        console.log('Classification data loaded:', data); // Debug log
        
        if (!data.tree) {
            throw new Error('No tree data returned from API');
        }
        
        budgetData = data.tree;
        
        // Update record info
        document.getElementById('recordInfo').textContent = `Código: ${currentCode} - Editar clasificaciones ML a continuación`;
        
        // Initialize table
        initializeTable(budgetData);
        
        showToast('Datos de clasificación cargados');
        
    } catch (error) {
        console.error('Classification load error:', error); // Debug log
        if (error.name === 'AbortError') {
            showAlert('La carga de datos tardó demasiado tiempo y fue cancelada', 'error');
        } else {
            showAlert(`Error al cargar datos: ${error.message}`, 'error');
        }
    } finally {
        hideLoading();
    }
}

// Table control functions are now in tree-utils.js and accessed via shared functions

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const params = getUrlParams();
    currentCode = params.code;
    
    if (!currentCode) {
        showAlert('No se especificó código en los parámetros de URL', 'error');
        return;
    }
    
    // Load data
    loadClassificationData();
    
    // Setup tree controls
    setupTreeControls();
    
    // Set grouped view link with current code
    const groupedLink = document.getElementById('groupedViewLink');
    if (groupedLink) {
        groupedLink.href = `grouped-v2.html?code=${encodeURIComponent(currentCode)}`;
    }
    
    // REMOVED: Save changes button functionality - no longer needed with immediate saves
    
    // Modal controls
    const modalCancel = document.getElementById('modalCancel');
    const modalSave = document.getElementById('modalSave');
    const modalRevert = document.getElementById('modalRevert');
    
    if (modalCancel) modalCancel.addEventListener('click', closeEditModal);
    if (modalSave) modalSave.addEventListener('click', saveModalChanges);
    if (modalRevert) modalRevert.addEventListener('click', revertModalChanges);
    
    // Modal suggestion selection
    const modalSuggestions = document.getElementById('modalSuggestions');
    const modalAllClasses = document.getElementById('modalAllClasses');
    const modalCustomInput = document.getElementById('modalCustomInput');
    const modalClassFilter = document.getElementById('modalClassFilter');
    
    if (modalSuggestions && modalCustomInput && modalAllClasses) {
        modalSuggestions.addEventListener('change', function() {
            if (this.value) {
                modalCustomInput.value = this.value;
                // Clear other selections when one is made
                modalAllClasses.selectedIndex = 0;
            }
        });
    }
    
    // All classes selection
    if (modalAllClasses && modalCustomInput && modalSuggestions) {
        modalAllClasses.addEventListener('change', function() {
            if (this.value) {
                modalCustomInput.value = this.value;
                // Clear other selections when one is made
                modalSuggestions.selectedIndex = 0;
            }
        });
    }
    
    // Class filter input
    if (modalClassFilter) {
        modalClassFilter.addEventListener('input', function() {
            filterClasses(this.value);
        });
        
        // Add keyboard navigation for the class filter
        modalClassFilter.addEventListener('keydown', function(e) {
            if (modalAllClasses) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    modalAllClasses.focus();
                    if (modalAllClasses.options.length > 0) {
                        modalAllClasses.selectedIndex = 0;
                    }
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (modalAllClasses.options.length > 0) {
                        modalAllClasses.selectedIndex = 0;
                        // Trigger change event
                        modalAllClasses.dispatchEvent(new Event('change'));
                    }
                }
            }
        });
    }
    
    // Add double-click to select from all classes list
    if (modalAllClasses && modalCustomInput && modalSuggestions) {
        modalAllClasses.addEventListener('dblclick', function() {
            if (this.value) {
                modalCustomInput.value = this.value;
                modalSuggestions.selectedIndex = 0;
                // Auto-save if double-clicked
                saveModalChanges();
            }
        });
    }
    
    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });
    
    // Close modal on backdrop click
    const editModal = document.getElementById('editModal');
    if (editModal) {
        editModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeEditModal();
            }
        });
    }
    
    // REMOVED: updateChangeCounter initialization - no longer needed with immediate saves
});

// Selection Management Functions

function addSelectionHandlers() {
    // Master checkbox handler
    document.getElementById('selectAllCheckbox')?.addEventListener('change', function() {
        const isChecked = this.checked;
        isSelectAllChecked = isChecked;
        
        document.querySelectorAll('.item-select').forEach(checkbox => {
            const itemCode = checkbox.getAttribute('data-item-code');
            checkbox.checked = isChecked;
            
            if (isChecked) {
                selectedItems.add(itemCode);
            } else {
                selectedItems.delete(itemCode);
            }
        });
        
        updateSelectionDisplay();
        updateSelectionHighlighting();
    });
    
    // Individual checkbox handlers
    document.querySelectorAll('.item-select').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const itemCode = this.getAttribute('data-item-code');
            
            if (this.checked) {
                selectedItems.add(itemCode);
            } else {
                selectedItems.delete(itemCode);
            }
            
            updateMasterCheckbox();
            updateSelectionDisplay();
            updateSelectionHighlighting();
        });
    });
    
    // Text search handlers
    document.getElementById('textSearch')?.addEventListener('input', handleSearchInput);
    document.getElementById('selectMatchingBtn')?.addEventListener('click', selectMatchingItems);
    document.getElementById('clearSearchBtn')?.addEventListener('click', clearSearch);
    
    // Bulk action handlers
    document.getElementById('editSelectedBtn')?.addEventListener('click', openBulkEditModal);
    document.getElementById('clearSelectionBtn')?.addEventListener('click', clearSelection);
}

function updateMasterCheckbox() {
    const masterCheckbox = document.getElementById('selectAllCheckbox');
    if (!masterCheckbox) return;
    
    const allCheckboxes = document.querySelectorAll('.item-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.item-checkbox:checked');
    
    if (checkedCheckboxes.length === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    } else if (checkedCheckboxes.length === allCheckboxes.length) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
    }
}

function updateSelectionDisplay() {
    // Use shared utility for standardized display
    updateStandardSelectionDisplay(selectedItems);
    
    // Also update totalItems field for classify view compatibility
    const totalItems = document.getElementById('totalItems');
    if (totalItems) {
        const allSelectableItems = document.querySelectorAll('.item-select').length;
        totalItems.textContent = `${allSelectableItems} elementos`;
    }
}

function updateSelectionHighlighting() {
    // Use the shared utility from tree-utils.js
    updateRowHighlighting(selectedItems);
}

function clearSelection() {
    selectedItems.clear();
    isSelectAllChecked = false;
    
    document.querySelectorAll('.item-select').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    const masterCheckbox = document.getElementById('selectAllCheckbox');
    if (masterCheckbox) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    }
    
    updateSelectionDisplay();
    updateRowHighlighting(selectedItems);
}

// Text Search Functions
function handleSearchInput() {
    const searchTerm = document.getElementById('textSearch').value.trim();
    currentSearchTerm = searchTerm;
    
    if (searchTerm === '') {
        document.getElementById('searchResults').textContent = '';
        return;
    }
    
    const matches = searchItems(searchTerm);
    matchingItems = matches;
    
    const resultText = matches.length > 0 
        ? `${matches.length} elemento${matches.length !== 1 ? 's' : ''} encontrado${matches.length !== 1 ? 's' : ''}`
        : 'No se encontraron coincidencias';
    
    document.getElementById('searchResults').textContent = resultText;
}

function searchItems(searchTerm) {
    if (!budgetData || !searchTerm) return [];
    
    const matches = [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    function searchInNode(node) {
        if (node.concept_type === 'PARTIDA' && node._prediction) {
            const summary = (node.summary || '').toLowerCase();
            const description = (node.descriptive_text || '').toLowerCase();
            
            if (summary.includes(lowerSearchTerm) || description.includes(lowerSearchTerm)) {
                matches.push({
                    code: node.code,
                    summary: node.summary || 'No summary',
                    description: node.descriptive_text || 'No description'
                });
            }
        }
        
        if (node.children) {
            node.children.forEach(child => searchInNode(child));
        }
    }
    
    searchInNode(budgetData);
    return matches;
}

function selectMatchingItems() {
    if (!currentSearchTerm) {
        showToast('Ingresa un término de búsqueda primero', 'warning');
        return;
    }
    
    if (!budgetData) {
        showToast('Los datos no están cargados todavía', 'warning');
        return;
    }
    
    const matches = searchItems(currentSearchTerm);
    
    if (matches.length === 0) {
        showToast('No se encontraron elementos que coincidan', 'info');
        return;
    }
    
    // Confirmation for large selections
    if (matches.length > 20) {
        if (!confirm(`¿Estás seguro de que quieres seleccionar ${matches.length} elementos?`)) {
            return;
        }
    }
    
    let newSelections = 0;
    matches.forEach(match => {
        if (!selectedItems.has(match.code)) {
            selectedItems.add(match.code);
            newSelections++;
        }
    });
    
    // Update checkboxes
    document.querySelectorAll('.item-select').forEach(checkbox => {
        const itemCode = checkbox.getAttribute('data-item-code');
        if (selectedItems.has(itemCode)) {
            checkbox.checked = true;
        }
    });
    
    updateMasterCheckbox();
    updateSelectionDisplay();
    updateRowHighlighting(selectedItems);
    
    const message = newSelections > 0 
        ? `${newSelections} elemento${newSelections !== 1 ? 's' : ''} seleccionado${newSelections !== 1 ? 's' : ''} (${matches.length - newSelections} ya estaba${matches.length - newSelections !== 1 ? 'n' : ''} seleccionado${matches.length - newSelections !== 1 ? 's' : ''})`
        : `Todos los ${matches.length} elementos ya estaban seleccionados`;
    
    showToast(message, 'success');
}

function clearSearch() {
    document.getElementById('textSearch').value = '';
    document.getElementById('searchResults').textContent = '';
    currentSearchTerm = '';
    matchingItems = [];
}

// Bulk Edit Functions
async function openBulkEditModal() {
    if (selectedItems.size === 0) {
        showToast('No hay elementos seleccionados', 'warning');
        return;
    }
    
    console.log('Abriendo modal de edición masiva para', selectedItems.size, 'elementos');
    
    // Get sample item for predictions
    let sampleItem = null;
    for (const code of selectedItems) {
        sampleItem = findNodeByCode(budgetData, code);
        if (sampleItem?._prediction) break;
    }
    
    if (!sampleItem) {
        showAlert('No se pueden editar los elementos seleccionados', 'error');
        return;
    }
    
    // Open modal in bulk mode
    await openEditModal(sampleItem, true);
}

async function openEditModal(node, isBulkMode = false) {
    if (!node) return;
    
    console.log('Opening edit modal for node:', node, 'bulk mode:', isBulkMode);
    
    const modal = document.getElementById('editModal');
    const itemInfo = document.getElementById('modalItemInfo');
    const itemDescription = document.getElementById('modalItemDescription');
    const suggestions = document.getElementById('modalSuggestions');
    const customInput = document.getElementById('modalCustomInput');
    const applySubtree = document.getElementById('modalApplySubtree');
    
    if (!modal || !itemInfo || !itemDescription || !suggestions || !customInput) {
        console.error('Modal elements not found');
        return;
    }
    
    // Update modal title and info for bulk vs single edit
    const modalTitle = modal.querySelector('h3');
    if (isBulkMode) {
        modalTitle.textContent = `Edición Masiva - ${selectedItems.size} elementos seleccionados`;
        
        // Show list of selected items
        const selectedCodes = Array.from(selectedItems);
        const selectedItemsList = [];
        
        selectedCodes.forEach(code => {
            const item = findNodeByCode(budgetData, code);
            if (item) {
                selectedItemsList.push(`${item.code} - ${item.summary || 'No summary'}`);
            }
        });
        
        const maxDisplay = 5;
        let displayText = selectedItemsList.slice(0, maxDisplay).join('<br>');
        if (selectedItemsList.length > maxDisplay) {
            displayText += `<br>... y ${selectedItemsList.length - maxDisplay} elementos más`;
        }
        
        itemInfo.innerHTML = `<strong>Elementos seleccionados (${selectedItems.size}):</strong><br>${displayText}`;
        itemDescription.textContent = 'La edición masiva aplicará la misma clasificación a todos los elementos seleccionados';
    } else {
        modalTitle.textContent = 'Editar Clasificación';
        itemInfo.textContent = `${node.code} - ${node.summary || 'No summary'}`;
        itemDescription.textContent = node.descriptive_text || 'No hay descripción disponible';
    }
    
    // Load suggestions from ML predictions
    suggestions.innerHTML = '<option value="">Elige de las sugerencias ML...</option>';
    if (node._prediction && node._prediction.topk_labels) {
        node._prediction.topk_labels.forEach((label, index) => {
            const prob = node._prediction.topk_probas?.[index];
            const confidence = prob ? ` (${formatPercentage(prob)})` : '';
            const option = document.createElement('option');
            option.value = label;
            option.textContent = `${label}${confidence}`;
            suggestions.appendChild(option);
        });
    }
    
    // Load and populate all classes if not already loaded
    if (allClasses.length === 0) {
        await loadAllClasses();
    }
    populateAllClassesSelect();
    
    // Reset filter and ensure all classes are shown
    const classFilter = document.getElementById('modalClassFilter');
    classFilter.value = '';
    // Force reload all classes to clear any filter persistence
    filteredClasses = [...allClasses];
    populateAllClassesSelect();
    
    // Reset form
    suggestions.value = '';
    customInput.value = '';
    applySubtree.checked = false;
    
    // Show subtree option only for non-bulk mode
    applySubtree.parentElement.style.display = isBulkMode ? 'none' : 'block';
    
    // Store current edit context
    window.currentEditNode = node;
    window.isBulkEditMode = isBulkMode;
    
    // Show modal
    console.log('Showing modal...');
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    
    // Focus on custom input
    setTimeout(() => {
        document.getElementById('modalCustomInput').focus();
    }, 100);
}

function saveModalChanges() {
    const selectedValue = getSelectedModalValue();
    if (!selectedValue) {
        showAlert('Por favor selecciona una clasificación', 'warning');
        return;
    }
    
    if (window.isBulkEditMode) {
        saveBulkChanges(selectedValue);
    } else {
        saveSingleChange(selectedValue);
    }
}

function saveBulkChanges(newLabel) {
    if (selectedItems.size === 0) {
        showAlert('No hay elementos seleccionados', 'error');
        return;
    }
    
    console.log('Guardando cambios masivos:', newLabel, 'a', selectedItems.size, 'elementos');
    
    const selectedCodes = Array.from(selectedItems);
    let savedCount = 0;
    let errors = [];
    
    showLoading('Guardando cambios masivos...');
    
    // Sequential save with progress feedback
    const saveNext = async (index) => {
        if (index >= selectedCodes.length) {
            hideLoading();
            
            if (errors.length === 0) {
                showToast(`${savedCount} clasificaciones guardadas correctamente`, 'success');
                // Clear selection and reload
                clearSelection();
                closeEditModal();
                setTimeout(() => {
                    loadClassificationData();
                }, 500);
            } else if (savedCount > 0) {
                showAlert(`${savedCount} guardadas, ${errors.length} fallidas: ${errors.join(', ')}`, 'warning');
            } else {
                showAlert(`Error guardando cambios: ${errors.join(', ')}`, 'error');
            }
            return;
        }
        
        const code = selectedCodes[index];
        const progress = Math.round(((index + 1) / selectedCodes.length) * 100);
        
        // Update loading message with progress
        const loadingElement = document.querySelector('#loadingOverlay .text-lg');
        if (loadingElement) {
            loadingElement.textContent = `Guardando... ${progress}% (${index + 1}/${selectedCodes.length})`;
        }
        
        try {
            const result = await saveToServer(code, newLabel);
            if (result.success) {
                savedCount++;
            } else {
                errors.push(code);
            }
        } catch (error) {
            console.error('Error saving to server:', error);
            errors.push(code);
        }
        
        // Small delay to prevent overwhelming the server
        setTimeout(() => saveNext(index + 1), 100);
    };
    
    saveNext(0);
}

async function saveSingleChange(newLabel) {
    const node = window.currentEditNode;
    if (!node) return;
    
    const nodeCode = node.code;
    const applySubtree = document.getElementById('modalApplySubtree').checked;
    
    closeEditModal();
    showLoading('Guardando cambios de clasificación...');
    
    try {
        const response = await fetch(`${window.location.protocol}//${window.location.hostname}:8005/records/${currentCode}/label`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                node_code: nodeCode,
                user_label: newLabel,
                apply_to_subtree: applySubtree
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save classification');
        }
        
        showToast('¡Clasificación guardada!');
        
        // Reload data to reflect server state
        setTimeout(() => loadClassificationData(), 1000);
        
    } catch (error) {
        showAlert(`Error grabando cambios: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// REMOVED: applyToSubtree function - no longer needed with immediate saves (subtree handling done server-side)

function findNodeByCode(tree, targetCode) {
    if (tree.code === targetCode) {
        return tree;
    }
    
    if (tree.children) {
        for (const child of tree.children) {
            const found = findNodeByCode(child, targetCode);
            if (found) return found;
        }
    }
    
    return null;
}

function getSelectedModalValue() {
    const suggestions = document.getElementById('modalSuggestions').value;
    const allClasses = document.getElementById('modalAllClasses').value;
    const customInput = document.getElementById('modalCustomInput').value.trim();
    
    // Priority: ML suggestions > All classes > Custom input
    return suggestions || allClasses || customInput;
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    
    // Clear modal state
    window.currentEditNode = null;
    window.isBulkEditMode = false;
}

async function saveToServer(nodeCode, newLabel) {
    try {
        const response = await fetch(`${window.location.protocol}//${window.location.hostname}:8005/records/${currentCode}/label`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                node_code: nodeCode,
                user_label: newLabel,
                apply_to_subtree: false
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save classification');
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error saving to server:', error);
        return { success: false, error: error.message };
    }
}