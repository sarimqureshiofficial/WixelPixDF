/**
 * Wixel PixDF - Application Controller & Router
 */
import { compressImage, resizeImage, convertImage, cropImage } from './imageTools.js';
import { mergePDFs, splitPDF, imagesToPDF, rotatePDF, getPDFPageCount } from './pdfTools.js';

// Global variables for tool states
let compressFile = null;
let resizeFile = null;
let resizeOrigDimensions = { w: 0, h: 0 };
let convertFile = null;
let cropFile = null;
let cropOrigDimensions = { w: 0, h: 0 };
let mergeFiles = [];
let splitFile = null;
let img2pdfFiles = [];
let rotateFile = null;

// Crop Box Draggable State
let isDraggingCrop = false;
let activeCropHandle = null; // 'nw', 'ne', 'sw', 'se' or null for drag move
let cropDragStart = { x: 0, y: 0 };
let cropBoxPosStart = { x: 0, y: 0, w: 0, h: 0 };

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Icons
  lucide.createIcons();
  
  // 2. Set up SPA Routing / Tab switching
  initNavigation();

  // 3. Set up mobile toggle
  initMobileMenu();

  // 4. Set up individual tools
  initCompressTool();
  initResizeTool();
  initConvertTool();
  initCropTool();
  initMergePDFTool();
  initSplitPDFTool();
  initImg2PdfTool();
  initRotatePDFTool();
});

/* ==========================================================================
   ROUTING & NAVIGATION
   ========================================================================== */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tool-panel');
  const currentTitle = document.getElementById('current-tool-title');
  const currentDesc = document.getElementById('current-tool-desc');

  const toolMetadata = {
    'compress-image': {
      title: 'Compress Image',
      desc: 'Reduce image file size with optimal quality compression.'
    },
    'resize-image': {
      title: 'Resize Image',
      desc: 'Modify width and height dimensions of images.'
    },
    'convert-image': {
      title: 'Format Converter',
      desc: 'Convert images between JPG, PNG, and WebP formats.'
    },
    'crop-image': {
      title: 'Crop Image',
      desc: 'Select and trim specific areas of your image.'
    },
    'merge-pdf': {
      title: 'Merge PDF',
      desc: 'Combine multiple PDF documents into a single file.'
    },
    'split-pdf': {
      title: 'Split PDF',
      desc: 'Extract specific pages or page ranges from a PDF.'
    },
    'images-to-pdf': {
      title: 'Images to PDF',
      desc: 'Convert single or multiple images into a clean PDF document.'
    },
    'rotate-pdf': {
      title: 'Rotate PDF',
      desc: 'Rotate individual pages or all pages in a PDF document.'
    },
    'privacy-policy': {
      title: 'Privacy Policy',
      desc: 'How we handle your files and data (Wixel PixDF Privacy Standard).'
    },
    'terms-of-service': {
      title: 'Terms of Service',
      desc: 'The terms governing the use of Wixel PixDF.'
    }
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const tool = item.getAttribute('data-tool');
      
      // Update nav active state
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Update Header Text
      if (toolMetadata[tool]) {
        currentTitle.textContent = toolMetadata[tool].title;
        currentDesc.textContent = toolMetadata[tool].desc;
      }

      // Toggle Panels
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `panel-${tool}`) {
          panel.classList.add('active');
        }
      });

      // Close mobile menu on click
      document.querySelector('.nav-menu').classList.remove('mobile-open');
    });
  });

  // Handle direct url hashes on load
  if (window.location.hash) {
    const hashTarget = window.location.hash.substring(1);
    const matchedItem = document.querySelector(`.nav-item[data-tool="${hashTarget}"]`);
    if (matchedItem) matchedItem.click();
  }
}

function initMobileMenu() {
  const toggle = document.getElementById('mobile-toggle');
  const menu = document.querySelector('.nav-menu');
  toggle.addEventListener('click', () => {
    menu.classList.toggle('mobile-open');
  });
}

/* ==========================================================================
   COMMON DRAG-AND-DROP INITIALIZER
   ========================================================================== */
function setupDragAndDrop(dropZoneId, inputId, onFileLoaded) {
  const dropZone = document.getElementById(dropZoneId);
  const input = document.getElementById(inputId);

  dropZone.addEventListener('click', () => input.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (input.multiple) {
        onFileLoaded(e.dataTransfer.files);
      } else {
        onFileLoaded(e.dataTransfer.files[0]);
      }
    }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (input.multiple) {
        onFileLoaded(e.target.files);
      } else {
        onFileLoaded(e.target.files[0]);
      }
    }
  });
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* ==========================================================================
   TOOL 1: COMPRESS IMAGE
   ========================================================================== */
function initCompressTool() {
  const settings = document.getElementById('settings-compress');
  const fileInfo = document.getElementById('info-compress');
  const nameLabel = document.getElementById('name-compress');
  const sizeLabel = document.getElementById('size-compress');
  
  const qualityInput = document.getElementById('quality-compress');
  const qualityVal = document.getElementById('val-quality-compress');
  const btnAction = document.getElementById('btn-compress');
  
  const previewEmpty = document.getElementById('preview-card-compress');
  const previewContent = document.getElementById('preview-content-compress');
  const imgOrig = document.getElementById('img-orig-compress');
  const imgComp = document.getElementById('img-comp-compress');
  
  const statReduction = document.getElementById('stat-reduction-compress');
  const statNewSize = document.getElementById('stat-new-size-compress');
  const btnDownload = document.getElementById('download-compress');

  qualityInput.addEventListener('input', () => {
    qualityVal.textContent = `${qualityInput.value}%`;
  });

  setupDragAndDrop('drop-zone-compress', 'input-compress', (file) => {
    if (!file.type.startsWith('image/')) return;
    compressFile = file;
    
    // UI update
    nameLabel.textContent = file.name;
    sizeLabel.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    settings.classList.remove('disabled-state');

    // Load original image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      imgOrig.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  btnAction.addEventListener('click', async () => {
    if (!compressFile) return;
    
    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Compressing...';

    try {
      const q = qualityInput.value / 100;
      const result = await compressImage(compressFile, q);
      
      imgComp.src = result.url;
      statNewSize.textContent = formatBytes(result.size);
      
      const reduction = Math.max(0, ((compressFile.size - result.size) / compressFile.size) * 100);
      statReduction.textContent = `${reduction.toFixed(1)}%`;
      
      btnDownload.href = result.url;
      btnDownload.download = `compressed_${compressFile.name}`;

      previewEmpty.classList.remove('empty');
      previewContent.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error compressing image.');
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="sparkles"></i> Compress Image';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 2: RESIZE IMAGE
   ========================================================================== */
function initResizeTool() {
  const settings = document.getElementById('settings-resize');
  const fileInfo = document.getElementById('info-resize');
  const nameLabel = document.getElementById('name-resize');
  const sizeLabel = document.getElementById('size-resize');
  
  const widthInput = document.getElementById('width-resize');
  const heightInput = document.getElementById('height-resize');
  const aspectCheck = document.getElementById('aspect-resize');
  const btnAction = document.getElementById('btn-resize');
  
  const previewEmpty = document.getElementById('preview-card-resize');
  const previewContent = document.getElementById('preview-content-resize');
  const imgOut = document.getElementById('img-out-resize');
  const btnDownload = document.getElementById('download-resize');

  setupDragAndDrop('drop-zone-resize', 'input-resize', (file) => {
    if (!file.type.startsWith('image/')) return;
    resizeFile = file;

    nameLabel.textContent = file.name;
    sizeLabel.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    settings.classList.remove('disabled-state');

    // Get original image width and height
    const img = new Image();
    img.onload = () => {
      resizeOrigDimensions.w = img.naturalWidth;
      resizeOrigDimensions.h = img.naturalHeight;
      widthInput.value = img.naturalWidth;
      heightInput.value = img.naturalHeight;
    };
    img.src = URL.createObjectURL(file);
  });

  // Handle locked aspect ratio changes
  widthInput.addEventListener('input', () => {
    if (aspectCheck.checked && resizeOrigDimensions.w > 0) {
      const ratio = resizeOrigDimensions.h / resizeOrigDimensions.w;
      heightInput.value = Math.round(widthInput.value * ratio);
    }
  });

  heightInput.addEventListener('input', () => {
    if (aspectCheck.checked && resizeOrigDimensions.h > 0) {
      const ratio = resizeOrigDimensions.w / resizeOrigDimensions.h;
      widthInput.value = Math.round(heightInput.value * ratio);
    }
  });

  btnAction.addEventListener('click', async () => {
    if (!resizeFile) return;

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Resizing...';

    try {
      const w = parseInt(widthInput.value);
      const h = parseInt(heightInput.value);
      
      const result = await resizeImage(resizeFile, w, h);
      imgOut.src = result.url;
      
      btnDownload.href = result.url;
      btnDownload.download = `resized_${resizeFile.name}`;

      previewEmpty.classList.remove('empty');
      previewContent.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error resizing image.');
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="maximize-2"></i> Resize Image';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 3: FORMAT CONVERTER
   ========================================================================== */
function initConvertTool() {
  const settings = document.getElementById('settings-convert');
  const fileInfo = document.getElementById('info-convert');
  const nameLabel = document.getElementById('name-convert');
  const sizeLabel = document.getElementById('size-convert');
  
  const formatSelect = document.getElementById('format-convert');
  const btnAction = document.getElementById('btn-convert');
  
  const previewEmpty = document.getElementById('preview-card-convert');
  const previewContent = document.getElementById('preview-content-convert');
  const imgOut = document.getElementById('img-out-convert');
  const btnDownload = document.getElementById('download-convert');

  setupDragAndDrop('drop-zone-convert', 'input-convert', (file) => {
    if (!file.type.startsWith('image/')) return;
    convertFile = file;

    nameLabel.textContent = file.name;
    sizeLabel.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    settings.classList.remove('disabled-state');
  });

  btnAction.addEventListener('click', async () => {
    if (!convertFile) return;

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Converting...';

    try {
      const format = formatSelect.value;
      const result = await convertImage(convertFile, format);
      imgOut.src = result.url;
      
      const ext = format === 'image/webp' ? 'webp' : (format === 'image/png' ? 'png' : 'jpg');
      const baseName = convertFile.name.substring(0, convertFile.name.lastIndexOf('.'));
      
      btnDownload.href = result.url;
      btnDownload.download = `${baseName}_converted.${ext}`;

      previewEmpty.classList.remove('empty');
      previewContent.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error converting format.');
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="refresh-cw"></i> Convert Format';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 4: CROP IMAGE (Custom Drag/Select Interface)
   ========================================================================== */
function initCropTool() {
  const settings = document.getElementById('settings-crop');
  const fileInfo = document.getElementById('info-crop');
  const nameLabel = document.getElementById('name-crop');
  const sizeLabel = document.getElementById('size-crop');
  
  const previewEmpty = document.getElementById('preview-card-crop');
  const previewContent = document.getElementById('preview-content-crop');
  const imgSource = document.getElementById('img-crop-source');
  const cropBox = document.getElementById('crop-selection-box');
  const cropWrapper = document.getElementById('crop-wrapper');
  
  const btnAction = document.getElementById('btn-crop');
  const cropResultBox = document.getElementById('crop-result-box');
  const imgOut = document.getElementById('img-out-crop');
  const btnDownload = document.getElementById('download-crop');

  setupDragAndDrop('drop-zone-crop', 'input-crop', (file) => {
    if (!file.type.startsWith('image/')) return;
    cropFile = file;

    nameLabel.textContent = file.name;
    sizeLabel.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    settings.classList.remove('disabled-state');

    // Load crop interface
    const imgUrl = URL.createObjectURL(file);
    imgSource.src = imgUrl;

    imgSource.onload = () => {
      cropOrigDimensions.w = imgSource.naturalWidth;
      cropOrigDimensions.h = imgSource.naturalHeight;
      
      // Reset cropbox to 60% centered
      cropBox.style.width = '60%';
      cropBox.style.height = '60%';
      cropBox.style.left = '20%';
      cropBox.style.top = '20%';
      
      previewEmpty.classList.remove('empty');
      previewContent.classList.remove('hidden');
      cropResultBox.classList.add('hidden');
    };
  });

  // Dragging event listeners for Custom Cropper
  cropBox.addEventListener('mousedown', startCropDrag);
  cropBox.addEventListener('touchstart', startCropDrag, { passive: false });

  document.querySelectorAll('.crop-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startCropResize(e, handle.classList[1]);
    });
    handle.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      startCropResize(e, handle.classList[1]);
    }, { passive: false });
  });

  function getEventCoords(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function startCropDrag(e) {
    e.preventDefault();
    isDraggingCrop = true;
    activeCropHandle = null;
    const coords = getEventCoords(e);
    cropDragStart.x = coords.x;
    cropDragStart.y = coords.y;
    
    cropBoxPosStart.x = parseFloat(cropBox.offsetLeft);
    cropBoxPosStart.y = parseFloat(cropBox.offsetTop);
    cropBoxPosStart.w = parseFloat(cropBox.offsetWidth);
    cropBoxPosStart.h = parseFloat(cropBox.offsetHeight);
    
    document.addEventListener('mousemove', onCropDragMove);
    document.addEventListener('touchmove', onCropDragMove, { passive: false });
    document.addEventListener('mouseup', stopCropDrag);
    document.addEventListener('touchend', stopCropDrag);
  }

  function startCropResize(e, handleCode) {
    e.preventDefault();
    isDraggingCrop = true;
    activeCropHandle = handleCode;
    const coords = getEventCoords(e);
    cropDragStart.x = coords.x;
    cropDragStart.y = coords.y;
    
    cropBoxPosStart.x = parseFloat(cropBox.offsetLeft);
    cropBoxPosStart.y = parseFloat(cropBox.offsetTop);
    cropBoxPosStart.w = parseFloat(cropBox.offsetWidth);
    cropBoxPosStart.h = parseFloat(cropBox.offsetHeight);

    document.addEventListener('mousemove', onCropDragMove);
    document.addEventListener('touchmove', onCropDragMove, { passive: false });
    document.addEventListener('mouseup', stopCropDrag);
    document.addEventListener('touchend', stopCropDrag);
  }

  function onCropDragMove(e) {
    if (!isDraggingCrop) return;
    e.preventDefault();
    
    const coords = getEventCoords(e);
    const deltaX = coords.x - cropDragStart.x;
    const deltaY = coords.y - cropDragStart.y;
    
    const wrapperWidth = cropWrapper.offsetWidth;
    const wrapperHeight = cropWrapper.offsetHeight;

    if (activeCropHandle === null) {
      // Move crop box
      let newLeft = cropBoxPosStart.x + deltaX;
      let newTop = cropBoxPosStart.y + deltaY;
      
      // Constrain inside wrapper boundary
      newLeft = Math.max(0, Math.min(newLeft, wrapperWidth - cropBoxPosStart.w));
      newTop = Math.max(0, Math.min(newTop, wrapperHeight - cropBoxPosStart.h));
      
      cropBox.style.left = `${newLeft}px`;
      cropBox.style.top = `${newTop}px`;
    } else {
      // Resize crop box using active handle
      let left = cropBoxPosStart.x;
      let top = cropBoxPosStart.y;
      let w = cropBoxPosStart.w;
      let h = cropBoxPosStart.h;

      if (activeCropHandle.includes('w')) {
        const potentialWidth = cropBoxPosStart.w - deltaX;
        if (potentialWidth > 40) {
          left = Math.max(0, cropBoxPosStart.x + deltaX);
          w = cropBoxPosStart.w + (cropBoxPosStart.x - left);
        }
      }
      if (activeCropHandle.includes('e')) {
        w = Math.max(40, Math.min(cropBoxPosStart.w + deltaX, wrapperWidth - left));
      }
      if (activeCropHandle.includes('n')) {
        const potentialHeight = cropBoxPosStart.h - deltaY;
        if (potentialHeight > 40) {
          top = Math.max(0, cropBoxPosStart.y + deltaY);
          h = cropBoxPosStart.h + (cropBoxPosStart.y - top);
        }
      }
      if (activeCropHandle.includes('s')) {
        h = Math.max(40, Math.min(cropBoxPosStart.h + deltaY, wrapperHeight - top));
      }

      cropBox.style.left = `${left}px`;
      cropBox.style.top = `${top}px`;
      cropBox.style.width = `${w}px`;
      cropBox.style.height = `${h}px`;
    }
  }

  function stopCropDrag() {
    isDraggingCrop = false;
    document.removeEventListener('mousemove', onCropDragMove);
    document.removeEventListener('touchmove', onCropDragMove);
    document.removeEventListener('mouseup', stopCropDrag);
    document.removeEventListener('touchend', stopCropDrag);
  }

  btnAction.addEventListener('click', async () => {
    if (!cropFile) return;

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Cropping...';

    try {
      // Calculate normalized percentages based on visual dimensions
      const visualLeft = cropBox.offsetLeft;
      const visualTop = cropBox.offsetTop;
      const visualWidth = cropBox.offsetWidth;
      const visualHeight = cropBox.offsetHeight;
      
      const containerWidth = cropWrapper.offsetWidth;
      const containerHeight = cropWrapper.offsetHeight;
      
      const cropRect = {
        x: visualLeft / containerWidth,
        y: visualTop / containerHeight,
        width: visualWidth / containerWidth,
        height: visualHeight / containerHeight
      };

      const result = await cropImage(cropFile, cropRect);
      imgOut.src = result.url;
      
      btnDownload.href = result.url;
      btnDownload.download = `cropped_${cropFile.name}`;

      cropResultBox.classList.remove('hidden');
      
      // Scroll crop result into view
      cropResultBox.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      alert('Error cropping image.');
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="crop"></i> Crop Image';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 5: MERGE PDF
   ========================================================================== */
function initMergePDFTool() {
  const listContainer = document.getElementById('list-container-merge');
  const fileList = document.getElementById('file-list-merge');
  const btnAction = document.getElementById('btn-merge-action');
  const downloadLink = document.getElementById('download-merge');

  setupDragAndDrop('drop-zone-merge', 'input-merge', (files) => {
    for (const file of files) {
      if (file.type !== 'application/pdf') continue;
      mergeFiles.push(file);
    }
    
    renderMergeList();
  });

  function renderMergeList() {
    fileList.innerHTML = '';
    
    if (mergeFiles.length === 0) {
      listContainer.classList.add('hidden');
      return;
    }
    
    listContainer.classList.remove('hidden');
    downloadLink.classList.add('hidden'); // Reset output on new upload

    mergeFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="file-list-item-info">
          <i data-lucide="file-text"></i>
          <span class="file-name">${file.name}</span>
          <span class="file-size">(${formatBytes(file.size)})</span>
        </div>
        <div class="file-list-actions">
          <button class="file-list-btn up" data-index="${index}"><i data-lucide="arrow-up"></i></button>
          <button class="file-list-btn down" data-index="${index}"><i data-lucide="arrow-down"></i></button>
          <button class="btn-danger-icon delete" data-index="${index}"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      fileList.appendChild(li);
    });

    lucide.createIcons();
    attachListEventListeners();
  }

  function attachListEventListeners() {
    fileList.querySelectorAll('.file-list-btn.up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        if (idx > 0) {
          const temp = mergeFiles[idx];
          mergeFiles[idx] = mergeFiles[idx - 1];
          mergeFiles[idx - 1] = temp;
          renderMergeList();
        }
      });
    });

    fileList.querySelectorAll('.file-list-btn.down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        if (idx < mergeFiles.length - 1) {
          const temp = mergeFiles[idx];
          mergeFiles[idx] = mergeFiles[idx + 1];
          mergeFiles[idx + 1] = temp;
          renderMergeList();
        }
      });
    });

    fileList.querySelectorAll('.btn-danger-icon.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        mergeFiles.splice(idx, 1);
        renderMergeList();
      });
    });
  }

  btnAction.addEventListener('click', async () => {
    if (mergeFiles.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Merging PDFs...';

    try {
      const mergedBlob = await mergePDFs(mergeFiles);
      const url = URL.createObjectURL(mergedBlob);
      
      downloadLink.href = url;
      downloadLink.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error merging PDFs: ' + err.message);
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="file-plus-2"></i> Merge PDFs';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 6: SPLIT PDF
   ========================================================================== */
function initSplitPDFTool() {
  const settings = document.getElementById('settings-split');
  const fileInfo = document.getElementById('info-split');
  const nameLabel = document.getElementById('name-split');
  const sizeLabel = document.getElementById('size-split');
  
  const pageCountLabel = document.getElementById('split-page-count-info');
  const splitRangeInput = document.getElementById('split-ranges');
  const btnAction = document.getElementById('btn-split');
  
  const previewEmpty = document.getElementById('preview-card-split');
  const previewContent = document.getElementById('preview-content-split');
  const outputsList = document.getElementById('split-outputs-list');

  setupDragAndDrop('drop-zone-split', 'input-split', async (file) => {
    if (file.type !== 'application/pdf') return;
    splitFile = file;

    nameLabel.textContent = file.name;
    sizeLabel.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    
    // Fetch PDF total page count
    try {
      const pageCount = await getPDFPageCount(file);
      pageCountLabel.textContent = `This document contains ${pageCount} pages.`;
      settings.classList.remove('disabled-state');
    } catch (err) {
      console.error(err);
      alert('Failed to read PDF pages.');
    }
  });

  btnAction.addEventListener('click', async () => {
    if (!splitFile) return;
    
    const range = splitRangeInput.value.trim();
    if (!range) {
      alert('Please specify page range (e.g. 1-3, 5).');
      return;
    }

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Extracting Pages...';

    try {
      const splitBlob = await splitPDF(splitFile, range);
      const url = URL.createObjectURL(splitBlob);
      
      outputsList.innerHTML = `
        <div class="split-output-item">
          <div>
            <strong>extracted_pages.pdf</strong>
            <p style="font-size:0.8rem;color:var(--text-muted)">Selected pages: ${range}</p>
          </div>
          <a class="btn btn-success" href="${url}" download="extracted_${range.replace(/[\s,]+/g, '_')}_${splitFile.name}">
            <i data-lucide="download"></i> Download
          </a>
        </div>
      `;

      previewEmpty.classList.remove('empty');
      previewContent.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error splitting PDF: ' + err.message);
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="scissors"></i> Split PDF';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 7: IMAGES TO PDF
   ========================================================================== */
function initImg2PdfTool() {
  const listContainer = document.getElementById('list-container-img2pdf');
  const imageList = document.getElementById('image-list-img2pdf');
  const btnAction = document.getElementById('btn-img2pdf');
  const downloadLink = document.getElementById('download-img2pdf');
  
  const pageSizeSelect = document.getElementById('img2pdf-page-size');
  const orientationSelect = document.getElementById('img2pdf-orientation');
  const marginSelect = document.getElementById('img2pdf-margin');

  setupDragAndDrop('drop-zone-img2pdf', 'input-img2pdf', (files) => {
    for (const file of files) {
      if (file.type !== 'image/png' && file.type !== 'image/jpeg') continue;
      img2pdfFiles.push(file);
    }
    
    renderImg2PdfList();
  });

  function renderImg2PdfList() {
    imageList.innerHTML = '';
    
    if (img2pdfFiles.length === 0) {
      listContainer.classList.add('hidden');
      return;
    }
    
    listContainer.classList.remove('hidden');
    downloadLink.classList.add('hidden'); // Reset output on new upload

    img2pdfFiles.forEach((file, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="file-list-item-info">
          <i data-lucide="image"></i>
          <span class="file-name">${file.name}</span>
          <span class="file-size">(${formatBytes(file.size)})</span>
        </div>
        <div class="file-list-actions">
          <button class="file-list-btn up" data-index="${index}"><i data-lucide="arrow-up"></i></button>
          <button class="file-list-btn down" data-index="${index}"><i data-lucide="arrow-down"></i></button>
          <button class="btn-danger-icon delete" data-index="${index}"><i data-lucide="trash-2"></i></button>
        </div>
      `;
      imageList.appendChild(li);
    });

    lucide.createIcons();
    attachImg2PdfListListeners();
  }

  function attachImg2PdfListListeners() {
    imageList.querySelectorAll('.file-list-btn.up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        if (idx > 0) {
          const temp = img2pdfFiles[idx];
          img2pdfFiles[idx] = img2pdfFiles[idx - 1];
          img2pdfFiles[idx - 1] = temp;
          renderImg2PdfList();
        }
      });
    });

    imageList.querySelectorAll('.file-list-btn.down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        if (idx < img2pdfFiles.length - 1) {
          const temp = img2pdfFiles[idx];
          img2pdfFiles[idx] = img2pdfFiles[idx + 1];
          img2pdfFiles[idx + 1] = temp;
          renderImg2PdfList();
        }
      });
    });

    imageList.querySelectorAll('.btn-danger-icon.delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'));
        img2pdfFiles.splice(idx, 1);
        renderImg2PdfList();
      });
    });
  }

  btnAction.addEventListener('click', async () => {
    if (img2pdfFiles.length === 0) {
      alert('Please add at least 1 image.');
      return;
    }

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Generating PDF...';

    try {
      const options = {
        pageSize: pageSizeSelect.value,
        orientation: orientationSelect.value,
        margin: marginSelect.value
      };
      
      const pdfBlob = await imagesToPDF(img2pdfFiles, options);
      const url = URL.createObjectURL(pdfBlob);
      
      downloadLink.href = url;
      downloadLink.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error converting images to PDF.');
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="file-image"></i> Convert to PDF';
      lucide.createIcons();
    }
  });
}

/* ==========================================================================
   TOOL 8: ROTATE PDF
   ========================================================================== */
function initRotatePDFTool() {
  const settings = document.getElementById('settings-rotate');
  const fileInfo = document.getElementById('info-rotate');
  const nameLabel = document.getElementById('name-rotate');
  const sizeLabel = document.getElementById('size-rotate');
  
  const pageCountLabel = document.getElementById('rotate-page-count-info');
  const rotateAngleSelect = document.getElementById('rotate-angle');
  const rotatePagesInput = document.getElementById('rotate-pages');
  const btnAction = document.getElementById('btn-rotate');
  
  const previewEmpty = document.getElementById('preview-card-rotate');
  const previewContent = document.getElementById('preview-content-rotate');
  const btnDownload = document.getElementById('download-rotate');

  setupDragAndDrop('drop-zone-rotate', 'input-rotate', async (file) => {
    if (file.type !== 'application/pdf') return;
    rotateFile = file;

    nameLabel.textContent = file.name;
    sizeLabel.textContent = formatBytes(file.size);
    fileInfo.classList.remove('hidden');
    
    // Fetch PDF total page count
    try {
      const pageCount = await getPDFPageCount(file);
      pageCountLabel.textContent = `This document contains ${pageCount} pages.`;
      settings.classList.remove('disabled-state');
    } catch (err) {
      console.error(err);
      alert('Failed to read PDF pages.');
    }
  });

  btnAction.addEventListener('click', async () => {
    if (!rotateFile) return;

    btnAction.disabled = true;
    btnAction.innerHTML = '<span class="loading-spinner"></span> Rotating Pages...';

    try {
      const angle = parseInt(rotateAngleSelect.value);
      const pages = rotatePagesInput.value.trim();
      
      const rotatedBlob = await rotatePDF(rotateFile, angle, pages);
      const url = URL.createObjectURL(rotatedBlob);
      
      btnDownload.href = url;
      btnDownload.download = `rotated_${rotateFile.name}`;

      previewEmpty.classList.remove('empty');
      previewContent.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error rotating PDF: ' + err.message);
    } finally {
      btnAction.disabled = false;
      btnAction.innerHTML = '<i data-lucide="rotate-cw"></i> Rotate PDF Pages';
      lucide.createIcons();
    }
  });
}
