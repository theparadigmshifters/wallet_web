// SRS UI Management Functions

async function setupSRSManagement() {
    await updateSRSStatus();
    
    document.getElementById('uploadSRSBtn').addEventListener('click', uploadSRSFiles);
    
    const clearBtn = document.getElementById('clearSRSBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSRSFiles);
    }
}

async function updateSRSStatus() {
    const statusEl = document.getElementById('srsStatus');
    const fileListEl = document.getElementById('srsFileList');
    const clearBtn = document.getElementById('clearSRSBtn');
    
    try {
        const status = await window.SRSManager.checkAllSRSFiles();
        const files = await window.SRSManager.getAllSRSFiles();
        
        if (status.all) {
            statusEl.innerHTML = '<span style="color: var(--success)">✓ SRS files loaded</span>';
            if (clearBtn) clearBtn.style.display = 'inline-block';
            
            if (files.length > 0) {
                fileListEl.innerHTML = files.map(f => `
                    <div style="padding: 5px 0;">
                        <strong>${f.name.toUpperCase()}</strong>: ${window.SRSManager.formatSize(f.size)}
                        <span style="color: var(--text-secondary); margin-left: 10px;">
                            (loaded ${new Date(f.uploadedAt).toLocaleDateString()})
                        </span>
                    </div>
                `).join('');
            }
        } else {
            const missing = [];
            if (!status.ck) missing.push('SRS.CK.BIN');
            if (!status.lk) missing.push('SRS.LK.BIN');
            
            statusEl.innerHTML = `<span style="color: var(--warning)">⚠ Missing: ${missing.join(', ')}</span>`;
            if (clearBtn) clearBtn.style.display = 'none';
            fileListEl.innerHTML = '<div style="color: var(--text-secondary);">Auto-downloading missing files...</div>';
        }
    } catch (error) {
        statusEl.innerHTML = `<span style="color: var(--error)">✗ Error: ${error.message}</span>`;
        fileListEl.innerHTML = '';
    }
}

async function checkAndAutoDownloadSRS() {
    try {
        const status = await window.SRSManager.checkAllSRSFiles();
        
        if (!status.all) {
            console.log('[SRS] Files missing, auto-downloading...');
            const results = await window.SRSManager.downloadAllSRSFiles();
            
            let successCount = 0;
            let failedFiles = [];
            
            for (const result of results) {
                if (result.success) {
                    console.log(`[SRS] Downloaded ${result.fileName}: ${window.SRSManager.formatSize(result.data.size)}`);
                    successCount++;
                } else {
                    console.error(`[SRS] Failed to download ${result.fileName}: ${result.error}`);
                    failedFiles.push(result.fileName);
                }
            }
            
            if (successCount === results.length) {
                console.log(`[SRS] All ${successCount} files downloaded successfully`);
            } else if (successCount > 0) {
                console.warn(`[SRS] Downloaded ${successCount}/${results.length} files. Failed: ${failedFiles.join(', ')}`);
            } else {
                console.error('[SRS] Failed to download any SRS files');
            }
        } else {
            console.log('[SRS] All files already present in IndexedDB');
        }
    } catch (error) {
        console.error('[SRS] Auto-download error:', error);
    }
}

function uploadSRSFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.bin,.BIN';
    
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) {
            showNotification('No files selected');
            return;
        }
        
        showNotification('Uploading SRS files...');
        
        try {
            let uploadedCount = 0;
            
            for (const file of files) {
                const fileName = file.name;
                
                if (window.SRSManager.isValidSRSFileName(fileName)) {
                    await window.SRSManager.saveSRSFile(fileName, file);
                    console.log(`Uploaded ${fileName}: ${window.SRSManager.formatSize(file.size)}`);
                    uploadedCount++;
                } else {
                    console.warn(`Skipped ${file.name} - only SRS.CK.BIN and SRS.LK.BIN are accepted`);
                }
            }
            
            await updateSRSStatus();
            
            if (uploadedCount > 0) {
                showNotification(`${uploadedCount} SRS file(s) uploaded successfully!`);
            } else {
                showNotification('No valid SRS files found. Please upload SRS.CK.BIN and SRS.LK.BIN');
            }
        } catch (error) {
            console.error('SRS upload error:', error);
            showNotification('Failed to upload SRS files: ' + error.message);
        }
    };
    
    input.click();
}

async function clearSRSFiles() {
    if (!confirm('Are you sure you want to clear SRS files? They will be auto-downloaded again on next page load.')) {
        return;
    }
    
    try {
        await window.SRSManager.deleteSRSFile('srs.ck.bin');
        await window.SRSManager.deleteSRSFile('srs.lk.bin');
        await updateSRSStatus();
        showNotification('SRS files cleared');
    } catch (error) {
        console.error('SRS clear error:', error);
        showNotification('Failed to clear SRS files: ' + error.message);
    }
}

// Auto-check and download on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        checkAndAutoDownloadSRS();
    });
} else {
    checkAndAutoDownloadSRS();
}

// Make functions globally available
window.setupSRSManagement = setupSRSManagement;
window.updateSRSStatus = updateSRSStatus;
window.checkAndAutoDownloadSRS = checkAndAutoDownloadSRS;
