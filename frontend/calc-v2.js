// BC3 Calculator with custom tree implementation

let showPredictions = false;

// Loading functions are now in tree-utils.js

// Get URL parameters
function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        source: urlParams.get('source') || 'processed',
        file: urlParams.get('file') || ''
    };
}

let nodeCounter = 0;

// Convert tree data to Tabulator's native tree format
function convertToTabulatorTree(node, level = 0) {
    const treeNode = {
        id: ++nodeCounter,
        code: node.code || '',
        summary: node.summary || '',
        unit: node.unit || '',
        concept_type: node.concept_type || '',
        unit_price: node.unit_price || 0,
        output: node.output || 0,
        total_amount: node.total_amount || 0,
        descriptive_text: node.descriptive_text || '',
        _prediction: node._prediction || null,
        _level: level
    };
    
    // Determine row class based on level and type
    if (level === 0) {
        treeNode._rowClass = 'tree-node-root';
    } else if (node.concept_type === 'SUBCAPITULO' || (level === 1 && node.children && node.children.length > 0)) {
        treeNode._rowClass = 'tree-node-chapter';
    } else {
        treeNode._rowClass = 'tree-node-leaf';
    }
    
    // Convert children recursively - ONLY add _children if there are actual children
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        treeNode._children = node.children.map(child => convertToTabulatorTree(child, level + 1));
        console.log(`Node ${treeNode.code} converted with ${treeNode._children.length} children`);
    }
    // Don't add _children property at all if no children (let Tabulator handle it)
    
    return treeNode;
}

// Tree functionality is now in tree-utils.js

function initializeTable(data) {
    showPredictions = initializeTreeTable(data, 'budget-table', false);
}

// Load budget data
async function loadBudgetData() {
    showLoading('Cargando datos del presupuesto...');
    
    try {
        const params = getUrlParams();
        console.log('URL Params:', params); // Debug log
        
        if (!params.file) {
            throw new Error('No file parameter provided in URL');
        }
        
        // Use the calc_tree API endpoint like the original calc.js
        const apiParams = new URLSearchParams({ source: params.source || 'processed' });
        const url = `${window.location.protocol}//${window.location.hostname}:8005/calc_tree/${encodeURIComponent(params.file)}?${apiParams.toString()}`;
        console.log('Fetching URL:', url); // Debug log
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Data loaded:', data); // Debug log
        
        if (!data.tree) {
            throw new Error('No tree data returned from API');
        }
        
        // Update breadcrumb
        document.getElementById('currentFile').textContent = params.file;
        
        // Initialize table with the tree data
        console.log('Tree data structure:', data.tree); // Debug log
        initializeTable(data.tree);
        
        showAlert('Datos del presupuesto cargados', 'success');
        
    } catch (error) {
        console.error('Load error:', error); // Debug log
        showAlert(`Failed to load budget: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// All tree functions are now in tree-utils.js

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check URL parameters
    const params = getUrlParams();
    console.log('DOMContentLoaded - URL Params:', params); // Debug log
    
    if (!params.file) {
        showAlert('No file specified in URL parameters', 'error');
        console.error('Missing file parameter in URL'); // Debug log
        return;
    }
    
    // Load data
    loadBudgetData();
    
    // Setup tree controls
    setupTreeControls();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            expandAllNodes();
        } else if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            collapseAllNodes();
        }
    });
});