// 在文件开头添加错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error: ' + msg + '\nURL: ' + url + '\nLine: ' + lineNo + '\nColumn: ' + columnNo + '\nError object: ' + JSON.stringify(error));
    alert('抱歉，发生了错误。请查看控制台获取详细信息。');
    return false;
};

// 在页面加载完成后检查环境
window.onload = function() {
    // 检查文件是否正确加载
    if (!document.querySelector('.upload-container')) {
        alert('警告：页面元素未正确加载。请确保所有文件路径正确。');
        return;
    }

    // 添加加载成功提示
    console.log('页面已成功加载');
};

// 获取DOM元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const compressionControls = document.getElementById('compressionControls');
const previewContainer = document.getElementById('previewContainer');
const downloadContainer = document.getElementById('downloadContainer');
const originalPreview = document.getElementById('originalPreview');
const compressedPreview = document.getElementById('compressedPreview');
const originalSize = document.getElementById('originalSize');
const compressedSize = document.getElementById('compressedSize');
const compressionRatio = document.getElementById('compressionRatio');
const ratioValue = document.getElementById('ratioValue');
const downloadBtn = document.getElementById('downloadBtn');

let originalFile = null;

// 处理拖拽上传
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#007AFF';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#ddd';
    const file = e.dataTransfer.files[0];
    if (isValidImage(file)) {
        handleImageUpload(file);
    }
});

// 处理点击上传
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (isValidImage(file)) {
        handleImageUpload(file);
    }
});

// 验证图片格式
function isValidImage(file) {
    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
        alert('请上传 PNG 或 JPG 格式的图片！');
        return false;
    }
    return true;
}

// 处理图片上传
function handleImageUpload(file) {
    originalFile = file;
    
    // 显示原始图片预览
    const reader = new FileReader();
    reader.onload = (e) => {
        originalPreview.src = e.target.result;
        originalSize.textContent = formatFileSize(file.size);
        
        // 显示控制区域和预览区域
        compressionControls.style.display = 'block';
        previewContainer.style.display = 'grid';
        downloadContainer.style.display = 'block';
        
        // 压缩图片
        compressImage();
    };
    reader.readAsDataURL(file);
}

// 压缩图片
function compressImage() {
    // 显示加载状态
    compressedPreview.style.opacity = '0.5';
    compressedSize.textContent = '压缩中...';
    
    const targetRatio = parseInt(compressionRatio.value);
    const isPNG = originalFile.type === 'image/png';
    
    // 仅在100%时使用原图
    if (targetRatio === 100) {
        console.log('使用原图（100%质量）');
        compressedPreview.src = originalPreview.src;
        compressedSize.textContent = `${formatFileSize(originalFile.size)} (100%)`;
        compressedPreview.style.opacity = '1';
        
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(originalFile);
            link.download = originalFile.name;
            link.click();
        };
        return;
    }
    
    console.log('开始压缩：', {
        目标压缩比: targetRatio + '%',
        原始大小: formatFileSize(originalFile.size),
        文件类型: originalFile.type
    });
    
    const img = new Image();
    
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 计算新尺寸
            let { width, height } = calculateNewDimensions(
                img.width, 
                img.height, 
                targetRatio
            );
            
            canvas.width = width;
            canvas.height = height;
            
            // 使用高质量的缩放
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // 计算压缩质量
            const quality = calculateQuality(targetRatio);
            
            console.log('压缩参数：', {
                目标压缩比: targetRatio + '%',
                尺寸压缩比: ((width * height) / (img.width * img.height) * 100).toFixed(1) + '%',
                质量设置: (quality * 100).toFixed(1) + '%',
                调整后尺寸: `${width}x${height}`,
                原始尺寸: `${img.width}x${img.height}`
            });
            
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        throw new Error('压缩失败');
                    }
                    
                    const ratio = (blob.size / originalFile.size * 100).toFixed(2);
                    console.log('压缩结果：', {
                        原始大小: formatFileSize(originalFile.size),
                        压缩后大小: formatFileSize(blob.size),
                        压缩比例: ratio + '%'
                    });
                    
                    compressedPreview.src = URL.createObjectURL(blob);
                    compressedSize.textContent = `${formatFileSize(blob.size)} (${ratio}%)`;
                    
                    // 更新下载按钮
                    downloadBtn.onclick = () => {
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `compressed_${originalFile.name}`;
                        link.click();
                    };
                    
                    compressedPreview.style.opacity = '1';
                },
                originalFile.type,
                quality
            );
            
        } catch (error) {
            console.error('压缩失败:', error);
            compressedSize.textContent = '压缩失败: ' + error.message;
        }
    };
    
    img.src = originalPreview.src;
}

// 计算的尺寸
function calculateNewDimensions(originalWidth, originalHeight, targetRatio) {
    // 基础最大尺寸限制
    const MAX_SIZE = 4096;
    let width = originalWidth;
    let height = originalHeight;
    
    // 如果原始尺寸超过最大限制，先进行等比缩放
    if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }
    
    // 使用线性比例计算缩放
    const scale = 0.3 + (targetRatio / 100) * 0.7;
    
    // 计算新尺寸，确保最小尺寸
    width = Math.max(50, Math.floor(width * scale));
    height = Math.max(50, Math.floor(height * scale));
    
    console.log('尺寸计算：', {
        原始尺寸: `${originalWidth}x${originalHeight}`,
        目标比例: targetRatio + '%',
        缩放比例: (scale * 100).toFixed(1) + '%',
        最终尺寸: `${width}x${height}`
    });
    
    return { width, height };
}

// 修改压缩质量计算函数,使压缩更线性平滑
function calculateQuality(targetRatio) {
    // 将压缩比例直接映射到0.3-1.0的质量区间
    const quality = 0.3 + (targetRatio / 100) * 0.7;
    
    console.log('质量计算：', {
        目标比例: targetRatio + '%',
        实际质量: (quality * 100).toFixed(1) + '%'
    });
    
    return quality;
}

// 检查图片是否包含透明像素
function hasTransparency(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < imageData.length; i += 4) {
        if (imageData[i] < 255) {
            return true;
        }
    }
    return false;
}

// 处理压缩后的图片
function handleCompressedImage(blob, note = '') {
    compressedPreview.style.opacity = '1';
    const ratio = (blob.size / originalFile.size * 100).toFixed(2);
    const compressedUrl = URL.createObjectURL(blob);
    
    console.log('压缩结果：', {
        原始大小: formatFileSize(originalFile.size),
        压缩后大小: formatFileSize(blob.size),
        压缩比例: ratio + '%',
        备注: note
    });
    
    // 更新预览
    compressedPreview.src = compressedUrl;
    compressedSize.textContent = `${formatFileSize(blob.size)} (${ratio}%) ${note}`;
    
    // 更新下载按钮
    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = compressedUrl;
        const ext = blob.type === 'image/jpeg' ? '.jpg' : '.png';
        link.download = `compressed_${originalFile.name.replace(/\.[^/.]+$/, '')}${ext}`;
        link.click();
    };
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 监听压缩比例变化
compressionRatio.addEventListener('input', (e) => {
    const value = e.target.value;
    // 添加质量说明
    if (value === '100') {
        ratioValue.textContent = value + ' (最高质量)';
    } else if (value === '1') {
        ratioValue.textContent = value + ' (最低质量)';
    } else {
        ratioValue.textContent = value;
    }
    compressImage();
});

// 添加一个试按钮
const testButton = document.createElement('button');
testButton.textContent = '测试压缩效果';
testButton.style.cssText = 'margin: 10px; padding: 5px 10px;';
downloadContainer.appendChild(testButton);

testButton.onclick = () => {
    console.clear(); // 清除之前的日志
    console.log('开始压缩测试...');
    
    // 测试不同的压缩比例
    [100, 80, 60, 40, 20].forEach((value, index) => {
        setTimeout(() => {
            console.log(`\n测试压缩比例: ${value}%`);
            compressionRatio.value = value;
            ratioValue.textContent = value;
            compressImage();
        }, index * 1500);
    });
}; 
