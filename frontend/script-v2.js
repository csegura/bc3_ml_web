// BC3 Records interface with custom table

let allRecords = [];
let filteredRecords = [];

// Toast functions are now in tree-utils.js

// Loading functions are now in tree-utils.js

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
}

// Create action buttons for a record
// Get SVG icons from https://tabler.io/icons
function createActionButtons(record) {
    let buttons = `
        <div class="flex space-x-1">
            <button onclick="viewProcessed('${record.processed_filename}')" 
                    title="Ver Presupuestos" 
                    class="action-btn action-btn-primary">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
            </button>
    `;
    
    if (record.ml_processed) {
        buttons += `
            <button onclick="viewCategorized('${record.categorized_filename || record.code + '.json'}')" 
                    title="Ver Presupuesto Categorizado ML" 
                    class="action-btn action-btn-success">
                <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-align-box-left-stretch"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z" /><path d="M9 17h-2" /><path d="M13 12h-6" /><path d="M11 7h-4" /></svg>
            </button>
            <button onclick="openGrouped('${record.code}')" 
                    title="Ver agrupado por ML" 
                    class="action-btn action-btn-purple">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
            </button>
            <button onclick="openClassify('${record.code}')" 
                    title="Edita Clasificaciones" 
                    class="action-btn action-btn-warning">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
            </button>
            <button onclick="reprocessML('${record.code}')" 
                    title="Reprocesar ML" 
                    class="action-btn action-btn-warning">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </button>
        `;
    } else {
        buttons += `
            <button onclick="processML('${record.code}')" 
                    title="Procesar ML" 
                    class="action-btn action-btn-warning">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </button>
        `;
    }
    
    buttons += '</div>';
    return buttons;
}

// Render table with records
function renderTable(records) {
    const tbody = document.getElementById('records-tbody');
    const emptyState = document.getElementById('empty-state');
    const recordsCount = document.getElementById('recordsCount');
    
    if (records.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        recordsCount.textContent = '0 registros';
        return;
    }
    
    emptyState.classList.add('hidden');
    recordsCount.textContent = `${records.length} registro${records.length !== 1 ? 's' : ''}`;
    
    tbody.innerHTML = records.map(record => `
        <tr>
            <td>
                <span class="pill pill-code">${record.code}</span>
            </td>
            <td class="text-sm text-gray-900">${record.project_name || ''}</td>
            <td>
                <span class="pill pill-tag">${record.localization || ''}</span>
            </td>
            <td>
                ${record.email ? `<a href="mailto:${record.email}" class="text-blue-600 hover:underline text-sm">${record.email}</a>` : ''}
            </td>
            <td class="text-sm text-gray-900">${record.year || ''}</td>
            <td class="text-sm text-gray-500">${formatDate(record.uploaded_at)}</td>
            <td>
                ${record.ml_processed 
                    ? '<span class="pill pill-success">ML ✓</span>'
                    : '<span class="pill pill-warning">Pendiente</span>'
                }
            </td>
            <td>${createActionButtons(record)}</td>
        </tr>
    `).join('');
}

// Filter records based on search and filters
function applyFilters() {
    const search = document.getElementById('search').value.toLowerCase();
    const localization = document.getElementById('filter_localization').value;
    const year = document.getElementById('filter_year').value;
    
    filteredRecords = allRecords.filter(record => {
        // Search filter
        const searchMatch = !search || 
            (record.code && record.code.toLowerCase().includes(search)) ||
            (record.project_name && record.project_name.toLowerCase().includes(search)) ||
            (record.email && record.email.toLowerCase().includes(search));
        
        // Localization filter
        const localizationMatch = !localization || record.localization === localization;
        
        // Year filter
        const yearMatch = !year || record.year == year;
        
        return searchMatch && localizationMatch && yearMatch;
    });
    
    renderTable(filteredRecords);
}

// Clear all filters
function clearFilters() {
    document.getElementById('search').value = '';
    document.getElementById('filter_localization').value = '';
    document.getElementById('filter_year').value = '';
    applyFilters();
}

// Load records from server
async function loadRecords() {
    try {
        showLoading('Cargando registros...');
        
        const url = 'http://localhost:8005/records/';
        console.log('Fetching from:', url); // Debug log
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Estado: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data); // Debug log
        allRecords = Array.isArray(data) ? data : (data.records || []);
        filteredRecords = [...allRecords];
        
        console.log('Processed records:', allRecords); // Debug log
        renderTable(filteredRecords);
        
        if (allRecords.length > 0) {
            showToast(`Cargados ${allRecords.length} registros`, 'success');
        } else {
            console.log('No records found in response'); // Debug log
        }
        
    } catch (error) {
        console.error('Error loading records:', error);
        showAlert('Error al cargar: ' + error.message, 'error');
        allRecords = [];
        filteredRecords = [];
        renderTable([]);
    } finally {
        hideLoading();
    }
}

// Action functions
function viewProcessed(filename) {
    window.location.href = `calc-v2.html?file=${encodeURIComponent(filename)}&source=processed`;
}

function viewCategorized(filename) {
    window.location.href = `categorized-v2.html?file=${encodeURIComponent(filename)}`;
}

function openGrouped(code) {
    window.location.href = `grouped-v2.html?code=${encodeURIComponent(code)}`;
}

function openClassify(code) {
    window.location.href = `classify-v2.html?code=${encodeURIComponent(code)}`;
}

async function processML(code) {
    try {
        showLoading('Procesando clasificaciones ML ...');
        showToast('Procesando clasificaciones...', 'info');
        
        const response = await fetch(`/records/${code}/ml`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al procesar x ML');
        }
        
        showToast('Proceso de categorizacioón ML compleatdo con exito!');
        
        // Reload records to update ML status
        setTimeout(loadRecords, 1000);
        
    } catch (error) {
        console.error('Error processing ML:', error);
        showAlert('Error en el proceso ML: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function reprocessML(code) {
    if (!confirm('¿Está seguro de reprocesar el archivo? Se sobreescribirán todas las modificaciones anteriores.')) {
        return;
    }
    
    await processML(code);
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadRecords();
    
    // Setup event listeners
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    
    // Real-time search
    document.getElementById('search').addEventListener('input', applyFilters);
    document.getElementById('filter_localization').addEventListener('change', applyFilters);
    document.getElementById('filter_year').addEventListener('input', applyFilters);
    
    // Auto-refresh 
    setInterval(loadRecords, 300000);
});