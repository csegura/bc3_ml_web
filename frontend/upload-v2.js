// Upload interface with enhanced UX

// Toast functions are now in tree-utils.js

// Progress management
function showProgress() {
    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').innerHTML = `
        <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        Processing...
    `;
}

function hideProgress() {
    document.getElementById('progress-section').classList.add('hidden');
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        Upload and Process File
    `;
}

function updateProgress(percent, message) {
    document.getElementById('progress-bar').style.width = `${percent}%`;
    document.getElementById('progress-text').textContent = message;
}

// File validation and info display
function validateFile(file) {
    if (!file) {
        return { valid: false, message: 'Please select a file' };
    }
    
    if (!file.name.toLowerCase().endsWith('.bc3')) {
        return { valid: false, message: 'File must be a .bc3 file' };
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
        return { valid: false, message: 'File size must be less than 50MB' };
    }
    
    return { valid: true };
}

function displayFileInfo(file) {
    const fileInfo = document.getElementById('file-info');
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    
    fileInfo.innerHTML = `
        <div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded p-3">
            <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span class="font-medium">${file.name}</span>
            </div>
            <span class="text-sm text-blue-600">${sizeInMB} MB</span>
        </div>
    `;
    fileInfo.classList.remove('hidden');
}

// Form submission handler
async function submitForm(event) {
    event.preventDefault();
    
    const form = document.getElementById('uploadForm');
    const formData = new FormData(form);
    const file = formData.get('file');
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
        showAlert(validation.message, 'error');
        return;
    }
    
    // Show progress
    showProgress();
    updateProgress(10, 'Validating form data...');
    
    try {
        // Simulate progress steps
        updateProgress(25, 'Uploading file...');
        
        const response = await fetch('http://localhost:8005/uploadfile/', {
            method: 'POST',
            body: formData
        });
        
        updateProgress(75, 'Converting BC3 to JSON...');
        
        if (response.ok) {
            const result = await response.json();
            updateProgress(100, 'Processing complete!');
            
            // Show success message
            showToast(`Archivo subido ¡Ohhh Yeahhh! Código: ${result.code}`, 'success');
            
            // Reset form after short delay
            setTimeout(() => {
                form.reset();
                document.getElementById('file-info').classList.add('hidden');
                hideProgress();
                
                // Optionally redirect to records page
                if (confirm('File uploaded successfully! Would you like to view the records page?')) {
                    window.location.href = '/index-v2.html';
                }
            }, 2000);
            
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        
    } catch (error) {
        hideProgress();
        showAlert(`Upload failed: ${error.message}`, 'error');
    }
}

// Drag and drop functionality
function setupDragAndDrop() {
    const dropZone = document.querySelector('[for="file"]').closest('.border-dashed');
    const fileInput = document.getElementById('file');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropZone.classList.add('border-primary', 'bg-blue-50');
    }
    
    function unhighlight() {
        dropZone.classList.remove('border-primary', 'bg-blue-50');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    }
}

// Auto-fill current year
function setCurrentYear() {
    const yearInput = document.getElementById('year');
    if (!yearInput.value) {
        yearInput.value = new Date().getFullYear();
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    document.getElementById('uploadForm').addEventListener('submit', submitForm);
    
    // File input change handler
    document.getElementById('file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const validation = validateFile(file);
            if (validation.valid) {
                displayFileInfo(file);
            } else {
                showAlert(validation.message, 'error');
                e.target.value = '';
            }
        } else {
            document.getElementById('file-info').classList.add('hidden');
        }
    });
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Set current year
    setCurrentYear();
    
    // Form validation on field changes
    const requiredFields = ['project_name', 'localization', 'email', 'year'];
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        field.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.classList.add('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
            } else {
                this.classList.remove('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
            }
        });
    });
    
    // Email validation
    document.getElementById('email').addEventListener('blur', function() {
        const email = this.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            this.classList.add('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
            showAlert('Please enter a valid email address', 'error');
        } else if (email) {
            this.classList.remove('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
        }
    });
});