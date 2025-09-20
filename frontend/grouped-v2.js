// Grouped ML Category View for BC3 Budget Calculator

let currentCode = '';
let budgetData = null;
let groupedData = null;
let allClasses = [];
let filteredClasses = [];
let pendingChanges = {};
let selectedItems = new Set();
let isSelectAllChecked = false;
let currentSearchTerm = '';
let matchingItems = [];

// Loading functions are now in tree-utils.js

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        code: urlParams.get('code') || ''
    };
}

// Group tree data by ML category
function groupByMLCategory(tree, allItems = []) {
    console.log('groupByMLCategory called with tree:', tree);
    
    // Collect all items with ML predictions recursively
    function collectItems(node, parentPath = '') {
        const path = parentPath ? `${parentPath}/${node.code}` : node.code;
        
        console.log('Processing node:', node.code, 'concept_type:', node.concept_type, 'has_prediction:', !!node._prediction);
        
        if (node._prediction && node.concept_type === 'PARTIDA') {
            console.log('Found PARTIDA with prediction:', node.code, node._prediction);
            allItems.push({
                ...node,
                _path: path,
                _originalParent: parentPath
            });
        }
        
        if (node.children) {
            console.log('Processing', node.children.length, 'children for node:', node.code);
            node.children.forEach(child => collectItems(child, path));
        }
    }
    
    collectItems(tree);
    console.log('Collected items with predictions:', allItems.length, allItems);
    
    // Group items by ML category
    const groups = {};
    let totalAmount = 0;
    let totalItems = 0;
    
    allItems.forEach(item => {
        const prediction = item._prediction;
        const category = prediction?.user_label || prediction?.predicted_label || 'Uncategorized';
        const isUserModified = !!(prediction?.user_label);
        
        console.log('Grouping item:', item.code, 'into category:', category, 'user modified:', isUserModified);
        
        if (!groups[category]) {
            groups[category] = {
                category: category,
                items: [],
                totalAmount: 0,
                count: 0,
                confidence: 0,
                hasUserModified: false
            };
        }
        
        // Mark the group as having user-modified items if any item has user_label
        if (isUserModified) {
            groups[category].hasUserModified = true;
        }
        
        // Add user modification flag to the item
        item._isUserModified = isUserModified;
        
        groups[category].items.push(item);
        groups[category].totalAmount += parseFloat(item.total_amount || 0);
        groups[category].count++;
        groups[category].confidence += parseFloat(prediction?.predicted_proba || 0);
        
        totalAmount += parseFloat(item.total_amount || 0);
        totalItems++;
    });
    
    console.log('Created groups:', Object.keys(groups), groups);
    
    // Calculate average confidence for each group
    Object.values(groups).forEach(group => {
        group.confidence = group.confidence / group.count;
    });
    
    // Sort groups by total amount (descending)
    const sortedGroups = Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
    
    const result = {
        groups: sortedGroups,
        totalAmount: totalAmount,
        totalItems: totalItems
    };
    
    console.log('Final grouping result:', result);
    return result;
}

// Render grouped tree table
function renderGroupedTree(groupedData) {
    console.log('Rendering grouped tree with data:', groupedData);
    
    if (!groupedData || !groupedData.groups || groupedData.groups.length === 0) {
        console.log('No groups to render, showing empty state');
        document.getElementById('grouped-table').innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-500">No ML categories found for grouping.</p>
                <p class="text-sm text-gray-400 mt-2">This record may not have been processed with ML classifications yet.</p>
            </div>
        `;
        document.getElementById('totalItems').textContent = '0 elementos en 0 categorías';
        document.getElementById('totalAmount').textContent = '0,00';
        return;
    }
    
    console.log('Rendering', groupedData.groups.length, 'categories');
    
    let tableHTML = '<div class="overflow-x-auto">';
    tableHTML += '<table class="tree-table w-full border-collapse text-sm table-auto">';
    
    // Header
    tableHTML += '<thead><tr class="bg-gray-100 border-b">';
    tableHTML += '<th class="p-2 text-left"><input type="checkbox" id="selectAllItems" class="h-4 w-4 text-blue-600 rounded focus:ring-blue-500" title="Seleccionar todos los elementos" style="margin-right: 8px;"> Código</th>';
    tableHTML += '<th class="p-2 text-left">Descripción</th>';
    tableHTML += '<th class="p-2 text-left">Categoría ML</th>';
    tableHTML += '<th class="p-2 text-left">Unidad</th>';
    tableHTML += '<th class="p-2 text-left">Tipo</th>';
    tableHTML += '<th class="p-2 text-right">Precio Unitario</th>';
    tableHTML += '<th class="p-2 text-right">Cantidad</th>';
    tableHTML += '<th class="p-2 text-right">Importe Total</th>';
    tableHTML += '</tr></thead>';
    
    tableHTML += '<tbody>';
    
    let nodeIdCounter = 0;
    
    groupedData.groups.forEach((group, groupIndex) => {
        const groupId = `group-${groupIndex}`;
        const hasItems = group.items.length > 0;
        
        // Group header row
        tableHTML += `<tr id="${groupId}" class="group-header" data-level="0" data-has-children="${hasItems}">`;
        tableHTML += `<td class="tree-cell"><input type="checkbox" class="group-select h-4 w-4 text-blue-600 rounded focus:ring-blue-500" data-group="${groupIndex}" title="Seleccionar todos los elementos de este grupo" style="margin-right: 8px;">`;
        if (hasItems) {
            tableHTML += `<button class="tree-toggle" data-target="${groupId}" aria-expanded="true" title="Toggle">▼</button>`;
        } else {
            tableHTML += '<span class="tree-spacer"></span>';
        }
        
        // Add user modification indicator to group header if any items are user-modified
        const userModifiedIndicator = group.hasUserModified ? '<span class="user-modified-indicator" title="Contains manually updated classifications">✏️</span> ' : '';
        tableHTML += `<span class="font-bold">${userModifiedIndicator}${group.category}</span></td>`;
        tableHTML += `<td class="text-xs">${group.count} elementos</td>`;
        tableHTML += `<td class="text-xs">Conf. promedio: ${formatPercentage(group.confidence)}</td>`;
        tableHTML += `<td></td>`;
        tableHTML += `<td class="text-xs">GRUPO</td>`;
        tableHTML += `<td></td>`;
        tableHTML += `<td></td>`;
        tableHTML += `<td style="text-align:right;" class="font-mono font-bold">${formatNumber(group.totalAmount)}</td>`;
        tableHTML += '</tr>';
        
        // Group items
        group.items.forEach((item, itemIndex) => {
            const itemId = `item-${groupIndex}-${itemIndex}`;
            
            // Get the actual label for this specific item (user_label or predicted_label)
            const prediction = item._prediction;
            const actualLabel = prediction?.user_label || prediction?.predicted_label || 'Uncategorized';
            
            // Add user modification indicator for individual items
            const itemUserModifiedIndicator = item._isUserModified ? '<span class="user-modified-indicator" title="Manually updated classification">✏️</span> ' : '';
            const mlCategoryDisplay = `${itemUserModifiedIndicator}${actualLabel}`;
            
            const isSelected = selectedItems.has(item.code);
            const rowClasses = `tree-row-leaf ${isSelected ? 'selected-row' : ''}`;
            
            tableHTML += `<tr id="${itemId}" class="${rowClasses}" data-level="1" data-parent="${groupId}" data-item-code="${item.code}" data-group="${groupIndex}">`;
            tableHTML += `<td class="tree-cell" style="padding-left:1.75em;"><span class="tree-spacer"></span><input type="checkbox" class="item-select h-4 w-4 text-blue-600 rounded focus:ring-blue-500" data-item-code="${item.code}" ${isSelected ? 'checked' : ''} style="margin-right: 8px;"><span class="text-sm">${item.code}</span></td>`;
            tableHTML += `<td class="text-xs">${item.summary || ''}</td>`;
            tableHTML += `<td class="text-xs ml-prediction" style="cursor: pointer;" title="Double-click para editar">${mlCategoryDisplay}</td>`;
            tableHTML += `<td class="text-xs">${item.unit || ''}</td>`;
            tableHTML += `<td class="text-xs">${item.concept_type || ''}</td>`;
            tableHTML += `<td style="text-align:right;" class="font-mono">${formatNumber(item.unit_price)}</td>`;
            tableHTML += `<td style="text-align:right;" class="font-mono">${formatNumber(item.output)}</td>`;
            tableHTML += `<td style="text-align:right;" class="font-mono font-medium">${formatNumber(item.total_amount)}</td>`;
            tableHTML += '</tr>';
        });
    });
    
    tableHTML += '</tbody></table></div>';
    
    document.getElementById('grouped-table').innerHTML = tableHTML;
    
    // Add tree toggle handlers
    addTreeToggleHandlers();
    
    // Add classification edit handlers
    addClassificationHandlers();
    
    // Add selection handlers
    addSelectionHandlers();
    
    // Update summary info
    document.getElementById('totalItems').textContent = `${groupedData.totalItems} elementos en ${groupedData.groups.length} categorías`;
    document.getElementById('totalAmount').textContent = formatNumber(groupedData.totalAmount);
}

// Load and process data
async function loadGroupedData() {
    showLoading('Cargando datos agrupados por categoría...');
    
    try {
        console.log('Loading grouped data for code:', currentCode);
        
        // Use the calc_tree API endpoint to get the processed tree structure
        const filename = `${currentCode}.json`;
        const apiParams = new URLSearchParams({ source: 'categorized' });
        const url = `${window.location.protocol}//${window.location.hostname}:8005/calc_tree/${encodeURIComponent(filename)}?${apiParams.toString()}`;
        console.log('Fetching URL:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Raw API response:', data);
        
        if (!data.tree) {
            console.error('No tree data in response:', data);
            throw new Error('No tree data returned from API');
        }
        
        budgetData = data.tree;
        console.log('Budget data extracted:', budgetData);
        
        // Group the data by ML category
        console.log('Starting grouping process...');
        groupedData = groupByMLCategory(budgetData);
        console.log('Grouped data result:', groupedData);
        
        if (!groupedData || !groupedData.groups || groupedData.groups.length === 0) {
            console.warn('No groups found in grouped data');
            showToast('No se encontraron categorías ML para agrupar', 'info');
        }
        
        // Update record info
        document.getElementById('recordInfo').textContent = `Código: ${currentCode} - Elementos del presupuesto agrupados por predicciones ML`;
        
        // Render the grouped tree
        console.log('Starting render...');
        renderGroupedTree(groupedData);
        
        showToast('Datos agrupados cargados');
        
    } catch (error) {
        console.error('Grouped data load error:', error);
        showAlert(`Failed to load data: ${error.message}`, 'error');
        
        // Show empty state or error message
        document.getElementById('recordInfo').textContent = `Error cargando datos para código: ${currentCode}`;
    } finally {
        hideLoading();
    }
}

// === TEXT SEARCH AND SELECTION FUNCTIONS ===

// Search for items containing specific text
function searchItems(searchTerm) {
    if (!groupedData) {
        console.log('No data loaded yet for search');
        updateSearchResults(0);
        return [];
    }
    
    if (!searchTerm || searchTerm.trim() === '') {
        matchingItems = [];
        updateSearchResults(0);
        return [];
    }
    
    const term = searchTerm.toLowerCase().trim();
    matchingItems = [];
    
    // Search through all items in all groups
    groupedData.groups.forEach(group => {
        group.items.forEach(item => {
            const summary = (item.summary || '').toLowerCase();
            const description = (item.descriptive_text || '').toLowerCase();
            
            if (summary.includes(term) || description.includes(term)) {
                matchingItems.push({
                    code: item.code,
                    group: group.category,
                    summary: item.summary,
                    description: item.descriptive_text
                });
            }
        });
    });
    
    console.log(`Found ${matchingItems.length} items matching "${searchTerm}"`);
    updateSearchResults(matchingItems.length);
    return matchingItems;
}

// Update search results display
function updateSearchResults(count) {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        if (count === 0) {
            searchResults.textContent = currentSearchTerm ? 'No matches found' : '';
        } else {
            searchResults.textContent = `${count} item${count !== 1 ? 's' : ''} found`;
        }
    }
}

// Select all items that match the current search
function selectMatchingItems() {
    const searchTerm = document.getElementById('textSearch')?.value?.trim();
    
    if (!searchTerm) {
        showToast('Por favor ingresa texto de búsqueda para encontrar elementos coincidentes', 'warning');
        return;
    }
    
    if (!groupedData) {
        showToast('Por favor espera a que se carguen los datos antes de buscar', 'warning');
        return;
    }
    
    // Perform search
    const matches = searchItems(searchTerm);
    
    if (matches.length === 0) {
        showToast('No se encontraron elementos que coincidan con tu búsqueda', 'info');
        return;
    }
    
    // Show confirmation for large selections
    if (matches.length > 20) {
        const confirmed = confirm(`Esto seleccionará ${matches.length} elementos. ¿Estás seguro de que quieres continuar?`);
        if (!confirmed) {
            return;
        }
    }
    
    // Add all matching items to selection
    let newSelections = 0;
    matches.forEach(match => {
        if (!selectedItems.has(match.code)) {
            selectedItems.add(match.code);
            newSelections++;
        }
    });
    
    // Update UI
    updateCheckboxStates();
    updateSelectionDisplay();
    
    // Show success message
    const message = newSelections > 0 
        ? `Seleccionados ${newSelections} elemento${newSelections !== 1 ? 's' : ''} nuevo${newSelections !== 1 ? 's' : ''} (${matches.length} encontrados en total)`
        : `Todos los ${matches.length} elementos coincidentes ya estaban seleccionados`;
    
    showToast(message, 'success');
}

// Clear search and results
function clearSearch() {
    const searchInput = document.getElementById('textSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    
    currentSearchTerm = '';
    matchingItems = [];
    updateSearchResults(0);
    
    showToast('Búsqueda limpiada', 'info');
}

// Real-time search as user types
function handleSearchInput() {
    const searchTerm = document.getElementById('textSearch')?.value?.trim();
    currentSearchTerm = searchTerm;
    
    if (searchTerm) {
        searchItems(searchTerm);
    } else {
        matchingItems = [];
        updateSearchResults(0);
    }
}

// === SELECTION MANAGEMENT FUNCTIONS ===

// Add selection event handlers
function addSelectionHandlers() {
    console.log('Adding selection handlers...');
    
    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllItems');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAll);
    }
    
    // Group checkboxes
    const groupCheckboxes = document.querySelectorAll('.group-select');
    groupCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleGroupSelect);
    });
    
    // Item checkboxes
    const itemCheckboxes = document.querySelectorAll('.item-select');
    itemCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleItemSelect);
    });
    
    // Update selection display
    updateSelectionDisplay();
    
    console.log('Selection handlers added');
}

// Handle select all checkbox
function handleSelectAll(event) {
    isSelectAllChecked = event.target.checked;
    
    if (isSelectAllChecked) {
        // Select all items
        if (groupedData && groupedData.groups) {
            groupedData.groups.forEach(group => {
                group.items.forEach(item => {
                    if (item.concept_type === 'PARTIDA' && item._prediction) {
                        selectedItems.add(item.code);
                    }
                });
            });
        }
    } else {
        // Clear all selections
        selectedItems.clear();
    }
    
    // Update UI
    updateCheckboxStates();
    updateSelectionDisplay();
}

// Handle group checkbox selection
function handleGroupSelect(event) {
    const groupIndex = parseInt(event.target.getAttribute('data-group'));
    const isChecked = event.target.checked;
    
    if (groupedData && groupedData.groups[groupIndex]) {
        const group = groupedData.groups[groupIndex];
        
        group.items.forEach(item => {
            if (item.concept_type === 'PARTIDA' && item._prediction) {
                if (isChecked) {
                    selectedItems.add(item.code);
                } else {
                    selectedItems.delete(item.code);
                }
            }
        });
    }
    
    // Update UI
    updateCheckboxStates();
    updateSelectionDisplay();
}

// Handle individual item selection
function handleItemSelect(event) {
    const itemCode = event.target.getAttribute('data-item-code');
    const isChecked = event.target.checked;
    
    if (isChecked) {
        selectedItems.add(itemCode);
    } else {
        selectedItems.delete(itemCode);
    }
    
    // Update UI
    updateCheckboxStates();
    updateSelectionDisplay();
}

// Update all checkbox states based on current selection
function updateCheckboxStates() {
    // Update item checkboxes
    const itemCheckboxes = document.querySelectorAll('.item-select');
    itemCheckboxes.forEach(checkbox => {
        const itemCode = checkbox.getAttribute('data-item-code');
        checkbox.checked = selectedItems.has(itemCode);
        
        // Update row highlighting
        const row = checkbox.closest('tr');
        if (row) {
            if (selectedItems.has(itemCode)) {
                row.classList.add('selected-row');
            } else {
                row.classList.remove('selected-row');
            }
        }
    });
    
    // Update group checkboxes
    const groupCheckboxes = document.querySelectorAll('.group-select');
    groupCheckboxes.forEach(checkbox => {
        const groupIndex = parseInt(checkbox.getAttribute('data-group'));
        
        if (groupedData && groupedData.groups[groupIndex]) {
            const group = groupedData.groups[groupIndex];
            const selectableItems = group.items.filter(item => 
                item.concept_type === 'PARTIDA' && item._prediction
            );
            const selectedInGroup = selectableItems.filter(item => 
                selectedItems.has(item.code)
            );
            
            if (selectedInGroup.length === 0) {
                checkbox.checked = false;
                checkbox.indeterminate = false;
            } else if (selectedInGroup.length === selectableItems.length) {
                checkbox.checked = true;
                checkbox.indeterminate = false;
            } else {
                checkbox.checked = false;
                checkbox.indeterminate = true;
            }
        }
    });
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllItems');
    if (selectAllCheckbox && groupedData) {
        const allSelectableItems = [];
        groupedData.groups.forEach(group => {
            group.items.forEach(item => {
                if (item.concept_type === 'PARTIDA' && item._prediction) {
                    allSelectableItems.push(item.code);
                }
            });
        });
        
        const selectedCount = allSelectableItems.filter(code => selectedItems.has(code)).length;
        
        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === allSelectableItems.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
}

// Update selection display and bulk action controls
function updateSelectionDisplay() {
    const selectedCount = selectedItems.size;
    
    // Show/hide bulk action controls
    let bulkActions = document.getElementById('bulkActions');
    
    if (selectedCount > 0) {
        if (!bulkActions) {
            // Create bulk actions bar
            bulkActions = createBulkActionsBar();
            document.body.appendChild(bulkActions);
        }
        
        // Update count
        const countElement = bulkActions.querySelector('#selectedCount');
        if (countElement) {
            countElement.textContent = `${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected`;
        }
        
        bulkActions.style.display = 'flex';
    } else {
        if (bulkActions) {
            bulkActions.style.display = 'none';
        }
    }
}

// Create bulk actions floating bar using shared utility
function createBulkActionsBar() {
    const bulkActions = createStandardBulkActionsBar({
        position: 'bottom-6 left-6', // Different position for grouped view
        backgroundColor: 'var(--acr-dust)'
    });
    
    // Update styling to match grouped view requirements
    bulkActions.style.backgroundColor = 'var(--acr-dust)';
    bulkActions.style.display = 'flex';
    bulkActions.style.alignItems = 'center';
    
    // Update button IDs to match grouped view expectations
    const editBtn = bulkActions.querySelector('#editSelectedBtn');
    const clearBtn = bulkActions.querySelector('#clearSelectionBtn');
    
    if (editBtn) {
        editBtn.id = 'bulkEditBtn';
        editBtn.className = 'btn-primary btn-sm';
    }
    if (clearBtn) {
        clearBtn.id = 'clearSelectionBtn';
        clearBtn.className = 'btn-secondary btn-sm';
    }
    
    // Add event listeners
    bulkActions.querySelector('#bulkEditBtn').addEventListener('click', openBulkEditModal);
    bulkActions.querySelector('#clearSelectionBtn').addEventListener('click', clearSelection);
    
    return bulkActions;
}

// Clear all selections
function clearSelection() {
    selectedItems.clear();
    updateCheckboxStates();
    updateSelectionDisplay();
}

// Open bulk edit modal
function openBulkEditModal() {
    if (selectedItems.size === 0) {
        showToast('No hay elementos seleccionados', 'warning');
        return;
    }
    
    console.log('Abriendo modal de edición masiva para', selectedItems.size, 'elementos');
    
    // Find one item to get prediction data for the modal
    let sampleItem = null;
    if (groupedData && groupedData.groups) {
        for (const group of groupedData.groups) {
            sampleItem = group.items.find(item => selectedItems.has(item.code));
            if (sampleItem) break;
        }
    }
    
    if (!sampleItem) {
        showToast('No se pueden encontrar los elementos seleccionados', 'error');
        return;
    }
    
    // Open modal in bulk mode
    openEditModal(sampleItem, true);
}

// === CLASSIFICATION EDITING FUNCTIONS ===

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
    placeholderOption.textContent = `Select from ${filteredClasses.length} classes...`;
    allClassesSelect.appendChild(placeholderOption);
    
    filteredClasses.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        option.textContent = className;
        allClassesSelect.appendChild(option);
    });
}

// Add click handlers for classification editing
function addClassificationHandlers() {
    console.log('Adding classification handlers for grouped view...');
    const mlCells = document.querySelectorAll('.ml-prediction');
    console.log('Found ML prediction cells:', mlCells.length);
    
    mlCells.forEach((cell, index) => {
        console.log(`Setting up cell ${index}:`, cell.textContent);
        cell.addEventListener('dblclick', function(e) {
            console.log('Double-click detected on ML cell in grouped view');
            e.stopPropagation();
            handleCellClick(this);
        });
    });
    
    console.log('Classification handlers added for grouped view');
}

// Handle ML cell click
function handleCellClick(cell) {
    const row = cell.closest('tr');
    if (!row) {
        console.log('No row found from cell');
        return;
    }
    
    const itemCode = row.getAttribute('data-item-code');
    console.log('Extracted item code from row:', itemCode);
    
    if (!itemCode) {
        showToast('No se puede identificar el código del elemento', 'error');
        return;
    }
    
    // Find the item data in the grouped data
    let itemData = null;
    if (groupedData && groupedData.groups) {
        for (const group of groupedData.groups) {
            itemData = group.items.find(item => item.code === itemCode);
            if (itemData) break;
        }
    }
    
    console.log('Found item data:', itemData);
    
    if (!itemData) {
        showToast('Elemento no encontrado en los datos', 'error');
        return;
    }
    
    if (itemData.concept_type !== 'PARTIDA') {
        showToast('Solo los elementos PARTIDA pueden ser editados', 'warning');
        return;
    }
    
    if (!itemData._prediction) {
        showToast('No hay predicción ML disponible para este elemento', 'warning');
        return;
    }
    
    console.log('Opening modal for valid PARTIDA item');
    openEditModal(itemData);
}

// Open edit modal
async function openEditModal(itemData, isBulkMode = false) {
    console.log('Opening edit modal for:', itemData, 'Bulk mode:', isBulkMode);
    
    const modal = document.getElementById('editModal');
    if (!modal) {
        console.error('Modal element not found');
        showToast('Modal no encontrado', 'error');
        return;
    }
    
    const prediction = itemData._prediction;
    
    if (!prediction) {
        console.log('No prediction data:', itemData);
        showToast('No hay predicción ML disponible para este elemento', 'error');
        return;
    }
    
    // Use code as path for simplicity
    const nodePath = itemData.code;
    console.log('Using node path:', nodePath);
    
    // Set modal data
    modal.setAttribute('data-node-path', nodePath);
    modal.setAttribute('data-node-code', itemData.code);
    modal.setAttribute('data-bulk-mode', isBulkMode.toString());
    
    // Update modal content based on mode
    if (isBulkMode) {
        const selectedCount = selectedItems.size;
        document.getElementById('modalItemInfo').textContent = `Edición Masiva - ${selectedCount} elementos seleccionados`;
        
        // Show list of selected items
        const selectedItemsList = [];
        if (groupedData && groupedData.groups) {
            groupedData.groups.forEach(group => {
                group.items.forEach(item => {
                    if (selectedItems.has(item.code)) {
                        selectedItemsList.push(`${item.code} - ${item.summary || 'No summary'}`);
                    }
                });
            });
        }
        
        const maxDisplay = 5;
        let displayText = selectedItemsList.slice(0, maxDisplay).join('<br>');
        if (selectedItemsList.length > maxDisplay) {
            displayText += `<br>... y ${selectedItemsList.length - maxDisplay} elementos más`;
        }
        
        document.getElementById('modalItemDescription').innerHTML = displayText;
    } else {
        const itemSummary = itemData.summary || 'No summary available';
        document.getElementById('modalItemInfo').textContent = `${itemData.code} - ${itemSummary}`;
        document.getElementById('modalItemDescription').textContent = itemData.descriptive_text || itemSummary;
    }
    
    // Populate ML suggestions
    const suggestionsSelect = document.getElementById('modalSuggestions');
    suggestionsSelect.innerHTML = '<option value="">Elige de las sugerencias ML...</option>';
    
    if (prediction.topk_labels && prediction.topk_probas) {
        prediction.topk_labels.forEach((label, index) => {
            const confidence = prediction.topk_probas[index] ? formatPercentage(prediction.topk_probas[index]) : '';
            const option = document.createElement('option');
            option.value = label;
            option.textContent = `${label} (${confidence})`;
            suggestionsSelect.appendChild(option);
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
    
    // Set current value
    const currentLabel = pendingChanges[nodePath] || prediction.user_label || prediction.predicted_label || '';
    document.getElementById('modalCustomInput').value = currentLabel;
    
    // Clear other controls
    document.getElementById('modalApplySubtree').checked = false;
    
    // Show modal
    console.log('Showing modal...');
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    
    // Focus on custom input
    setTimeout(() => {
        document.getElementById('modalCustomInput').focus();
    }, 100);
}

// Close edit modal
function closeEditModal() {
    const modal = document.getElementById('editModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

// Save modal changes
function saveModalChanges() {
    const modal = document.getElementById('editModal');
    const nodePath = modal.getAttribute('data-node-path');
    const nodeCode = modal.getAttribute('data-node-code');
    const isBulkMode = modal.getAttribute('data-bulk-mode') === 'true';
    
    const selectedSuggestion = document.getElementById('modalSuggestions').value;
    const selectedClass = document.getElementById('modalAllClasses').value;
    const customInput = document.getElementById('modalCustomInput').value.trim();
    const applySubtree = document.getElementById('modalApplySubtree').checked;
    
    // Priority: ML suggestion > All classes selection > Custom input
    const newLabel = selectedSuggestion || selectedClass || customInput;
    
    if (!newLabel) {
        showToast('Por favor selecciona de las sugerencias, elige una clase o ingresa una categoría', 'error');
        return;
    }
    
    closeEditModal();
    
    if (isBulkMode) {
        // Bulk save to all selected items
        const selectedCodes = Array.from(selectedItems);
        showToast(`Actualizando ${selectedCodes.length} elementos con clasificación: ${newLabel}`);
        saveBulkToServer(selectedCodes, newLabel, applySubtree);
    } else {
        // Single item save
        showToast(`Clasificación actualizada: ${newLabel}`);
        saveToServer(nodeCode, newLabel, applySubtree);
    }
}

// Save changes to server
async function saveToServer(nodeCode, newLabel, applySubtree) {
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
        setTimeout(() => loadGroupedData(), 1000);
        
    } catch (error) {
        showAlert(`Error grabando cambios: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Save changes to multiple items (bulk operation)
async function saveBulkToServer(itemCodes, newLabel, applySubtree) {
    showLoading(`Guardando ${itemCodes.length} cambios de clasificación...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    try {
        // Process items sequentially to avoid overwhelming the server
        for (let i = 0; i < itemCodes.length; i++) {
            const nodeCode = itemCodes[i];
            
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
                    throw new Error(error.error || 'Error grabando la clasificación');
                }
                
                successCount++;
                
                // Update loading message with progress
                const progress = Math.round(((i + 1) / itemCodes.length) * 100);
                showLoading(`Guardando cambios de clasificación... ${progress}% (${i + 1}/${itemCodes.length})`);
                
            } catch (error) {
                errorCount++;
                errors.push(`${nodeCode}: ${error.message}`);
                console.error(`Error grabando la clasificación for ${nodeCode}:`, error);
            }
            
            // Small delay to prevent overwhelming the server
            if (i < itemCodes.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // Clear selection after successful bulk operation
        selectedItems.clear();
        updateCheckboxStates();
        updateSelectionDisplay();
        
        // Show results
        if (errorCount === 0) {
            showToast(`¡${successCount} clasificaciones actualizadas!`);
        } else if (successCount > 0) {
            showAlert(`Actualización parcial: ${successCount} actualizados, ${errorCount} fallos. Compruebe la consola.`, 'warning');
        } else {
            showAlert(`Error en la actuaización. Compruebe la consola`, 'error');
        }
        
        // Reload data to reflect server state
        setTimeout(() => loadGroupedData(), 1000);
        
    } catch (error) {
        showAlert(`Actualización masiva con errores: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Revert to predicted label
function revertModalChanges() {
    const modal = document.getElementById('editModal');
    const nodePath = modal.getAttribute('data-node-path');
    const nodeCode = modal.getAttribute('data-node-code');
    
    // Remove from pending changes
    delete pendingChanges[nodePath];
    delete pendingChanges[nodePath + '_subtree'];
    
    closeEditModal();
    showToast('Revertido a clasificación predicha');
    
    // Save empty user_label to server to revert
    saveToServer(nodeCode, null, false);
}

// Setup search control event listeners
function setupSearchControls() {
    console.log('Setting up search controls...');
    
    // Text search input - real-time search feedback
    const textSearchInput = document.getElementById('textSearch');
    if (textSearchInput) {
        textSearchInput.addEventListener('input', handleSearchInput);
        
        // Keyboard shortcuts
        textSearchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                selectMatchingItems();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                clearSearch();
            }
        });
    }
    
    // Select matching button
    const selectMatchingBtn = document.getElementById('selectMatchingBtn');
    if (selectMatchingBtn) {
        selectMatchingBtn.addEventListener('click', selectMatchingItems);
    }
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }
    
    console.log('Search controls setup complete');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const params = getUrlParams();
    console.log('URL Params:', params);
    currentCode = params.code;
    console.log('Current code extracted:', currentCode);
    
    if (!currentCode) {
        console.error('No code parameter found in URL');
        showAlert('No code specified in URL parameters', 'error');
        document.getElementById('recordInfo').textContent = 'Error: No code specified in URL';
        return;
    }
    
    console.log('About to load data for code:', currentCode);
    
    // Update navigation links with current code
    const categorizedLink = document.querySelector('a[href="/categorized-v2.html"]');
    const classifyLink = document.querySelector('a[href="/classify-v2.html"]');
    
    if (categorizedLink) {
        categorizedLink.href = `/categorized-v2.html?file=${encodeURIComponent(currentCode)}.json`;
    }
    if (classifyLink) {
        classifyLink.href = `/classify-v2.html?code=${encodeURIComponent(currentCode)}`;
    }
    
    // Load data
    loadGroupedData();
    
    // Setup tree controls
    setupTreeControls();
    
    // Setup search controls
    setupSearchControls();
    
    // Setup modal controls
    document.getElementById('modalCancel').addEventListener('click', closeEditModal);
    document.getElementById('modalSave').addEventListener('click', saveModalChanges);
    document.getElementById('modalRevert').addEventListener('click', revertModalChanges);
    
    // Modal suggestion selection
    document.getElementById('modalSuggestions').addEventListener('change', function() {
        if (this.value) {
            document.getElementById('modalCustomInput').value = this.value;
            // Clear other selections when one is made
            document.getElementById('modalAllClasses').selectedIndex = 0;
        }
    });
    
    // All classes selection
    document.getElementById('modalAllClasses').addEventListener('change', function() {
        if (this.value) {
            document.getElementById('modalCustomInput').value = this.value;
            // Clear other selections when one is made
            document.getElementById('modalSuggestions').selectedIndex = 0;
        }
    });
    
    // Class filter input
    document.getElementById('modalClassFilter').addEventListener('input', function() {
        filterClasses(this.value);
    });
    
    // Add keyboard navigation for the class filter
    document.getElementById('modalClassFilter').addEventListener('keydown', function(e) {
        const allClassesSelect = document.getElementById('modalAllClasses');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            allClassesSelect.focus();
            if (allClassesSelect.options.length > 0) {
                allClassesSelect.selectedIndex = 0;
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (allClassesSelect.options.length > 0) {
                allClassesSelect.selectedIndex = 0;
                // Trigger change event
                allClassesSelect.dispatchEvent(new Event('change'));
            }
        }
    });
    
    // Add double-click to select from all classes list
    document.getElementById('modalAllClasses').addEventListener('dblclick', function() {
        if (this.value) {
            document.getElementById('modalCustomInput').value = this.value;
            document.getElementById('modalSuggestions').selectedIndex = 0;
            // Auto-save if double-clicked
            saveModalChanges();
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeEditModal();
        }
    });
    
    // Close modal on backdrop click
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeEditModal();
        }
    });
});