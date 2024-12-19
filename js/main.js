// 声明全局变量
let originalFile = null;
const compressionRatio = document.getElementById('compressionRatio');
const compressedPreview = document.getElementById('compressedPreview');
const compressedSize = document.getElementById('compressedSize');
const downloadBtn = document.getElementById('downloadBtn');

// 修改压缩质量计算函数
function calculateQuality(targetRatio) {
    // 直接使用线性映射，确保压缩比例和质量直接对应
    return Math.max(0.05, targetRatio / 100);
}

// 修改压缩图片处理逻辑
async function compressImage() {
    if (!originalFile) return;

    // 显示加载状态
    compressedPreview.style.opacity = '0.5';
    compressedSize.textContent = '压缩中...';
    
    const targetRatio = parseInt(compressionRatio.value);
    
    // 如果是100%质量，直接使用原图
    if (targetRatio === 100) {
        const originalUrl = URL.createObjectURL(originalFile);
        compressedPreview.src = originalUrl;
        compressedSize.textContent = `${formatFileSize(originalFile.size)} (100%)`;
        compressedPreview.style.opacity = '1';
        
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = originalUrl;
            link.download = originalFile.name;
            link.click();
        };
        return;
    }
    
    try {
        // 创建图片对象并等待加载完成
        const img = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(originalFile);
        });
        
        // 创建canvas并绘制图片
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        // 计算目标文件大小
        const targetSize = originalFile.size * (targetRatio / 100);
        
        // 根据目标比例调整质量范围和误差容忍度
        let minQuality, maxQuality, errorTolerance;
        
        if (targetRatio > 50) {
            // 51-100%使用更精确的质量范围
            minQuality = (targetRatio - 10) / 100; // 比目标低10%开始
            maxQuality = Math.min(1.0, (targetRatio + 10) / 100); // 比目标高10%结束
            errorTolerance = 0.01; // 1%的误差容忍度
        } else {
            // 1-50%使用原来的范围
            minQuality = 0.01;
            maxQuality = 0.5;
            errorTolerance = 0.02; // 2%的误差容忍度
        }
        
        let bestBlob = null;
        let bestQuality = null;
        let attempts = 0;
        const maxAttempts = targetRatio > 50 ? 10 : 8; // 高比例时多尝试几次
        
        while (attempts < maxAttempts) {
            attempts++;
            const quality = (minQuality + maxQuality) / 2;
            
            // 尝试当前质量值
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', quality);
            });
            
            if (!blob) continue;
            
            const ratio = blob.size / originalFile.size;
            console.log(`尝试 #${attempts}: quality=${quality.toFixed(3)}, ratio=${(ratio * 100).toFixed(1)}%`);
            
            // 更新最佳结果
            if (!bestBlob || Math.abs(blob.size - targetSize) < Math.abs(bestBlob.size - targetSize)) {
                bestBlob = blob;
                bestQuality = quality;
            }
            
            // 如果已经足够接近目标大小，就停止尝试
            if (Math.abs(ratio - targetRatio / 100) < errorTolerance) {
                break;
            }
            
            // 调整质量范围
            if (blob.size > targetSize) {
                maxQuality = quality;
            } else {
                minQuality = quality;
            }
        }
        
        if (!bestBlob) {
            throw new Error('压缩失败');
        }
        
        console.log('最终结果：', {
            目标比例: targetRatio + '%',
            目标大小: formatFileSize(targetSize),
            实际大小: formatFileSize(bestBlob.size),
            实际比例: ((bestBlob.size / originalFile.size) * 100).toFixed(1) + '%',
            质量: (bestQuality * 100).toFixed(1) + '%'
        });
        
        handleCompressedBlob(bestBlob, targetRatio);
        
    } catch (error) {
        console.error('图片处理出错：', error);
        compressedSize.textContent = '压缩失败';
        compressedPreview.style.opacity = '1';
    }
}

// PNG压缩函数
function compressAsPNG(canvas, targetRatio) {
    // PNG转换为JPEG进行压缩以获得更精确的控制
    compressAsJPEG(canvas, targetRatio);
}

// 将PNG转换为JPEG进行压缩
function compressPNGAsJPEG(canvas, targetRatio) {
    compressAsJPEG(canvas, targetRatio);
}

// JPEG压缩函数
async function compressAsJPEG(canvas, targetRatio) {
    // 直接使用目标比例作为质量值
    const quality = targetRatio / 100;
    
    // 显示压缩状态
    compressedSize.textContent = '压缩中...';
    
    try {
        // 进行压缩
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', quality);
        });
        
        if (!blob) {
            throw new Error('压缩失败');
        }
        
        // 如果压缩后比原图大，使用原图
        if (blob.size >= originalFile.size) {
            handleCompressedBlob(originalFile);
            return;
        }
        
        console.log('压缩结果：', {
            质量: (quality * 100).toFixed(1) + '%',
            原始大小: formatFileSize(originalFile.size),
            压缩后大小: formatFileSize(blob.size),
            压缩比例: ((blob.size / originalFile.size) * 100).toFixed(1) + '%'
        });
        
        handleCompressedBlob(blob);
    } catch (error) {
        console.error('压缩出错：', error);
        handleCompressedBlob(originalFile);
    }
}

// 修改处理压缩后的blob函数
function handleCompressedBlob(blob, targetRatio = 100) {
    const isOriginal = blob === originalFile;
    const size = formatFileSize(blob.size);
    const ratio = isOriginal ? 100 : targetRatio;
    
    // 显示压缩后的图片
    compressedPreview.src = URL.createObjectURL(blob);
    compressedSize.textContent = `${size} (${ratio}%)`;
    compressedPreview.style.opacity = '1';
    
    // 更新下载按钮
    downloadBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        if (isOriginal) {
            link.download = originalFile.name;
        } else {
            const extension = '.jpg';
            link.download = `compressed_${originalFile.name.replace(/\.[^/.]+$/, '')}${extension}`;
        }
        link.click();
    };
}

// 修改压缩比例滑块变化事件
compressionRatio.addEventListener('input', () => {
    const targetRatio = parseInt(compressionRatio.value);
    document.getElementById('ratioValue').textContent = targetRatio;
    
    if (originalFile) {
        // 使用防抖，避免频繁压缩
        clearTimeout(compressionRatio.timeout);
        compressionRatio.timeout = setTimeout(() => {
            if (targetRatio === 100) {
                // 100%时直接使用原图
                const originalUrl = URL.createObjectURL(originalFile);
                compressedPreview.src = originalUrl;
                compressedSize.textContent = `${formatFileSize(originalFile.size)} (100%)`;
                compressedPreview.style.opacity = '1';
                
                downloadBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.href = originalUrl;
                    link.download = originalFile.name;
                    link.click();
                };
            } else {
                // 非100%时进行压缩
                compressImage();
            }
        }, 300); // 300ms的防抖延迟
    }
});

// 获取DOM元素
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const originalPreview = document.getElementById('originalPreview');
const originalSize = document.getElementById('originalSize');
const compressionControls = document.getElementById('compressionControls');
const previewContainer = document.getElementById('previewContainer');
const downloadContainer = document.getElementById('downloadContainer');

// 文件上传处理函数
function handleFileSelect(file) {
    if (!file || !file.type.match('image.*')) {
        alert('请选择图片文件！');
        return;
    }
    
    originalFile = file;
    
    // 显示原图预览
    const originalUrl = URL.createObjectURL(file);
    originalPreview.src = originalUrl;
    originalSize.textContent = formatFileSize(file.size);
    
    // 显示压缩控制和预览区域
    compressionControls.style.display = 'block';
    previewContainer.style.display = 'grid';
    downloadContainer.style.display = 'block';
    
    // 初始显示100%质量的原图
    compressedPreview.src = originalUrl;
    // 传入100%作为目标比例
    handleCompressedBlob(file, 100);
}

// 文件输入框变化事件
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
});

// 点击上传区域触发文件选择
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// 拖拽事件处理
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.borderColor = '#007AFF';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.borderColor = '#ddd';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.style.borderColor = '#ddd';
    
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
});

// 格式化文件大小的辅助函数
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}
