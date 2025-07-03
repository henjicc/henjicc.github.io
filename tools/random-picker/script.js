class NamePicker {
    constructor() {
        this.names = [];
        this.isRunning = false;
        this.currentInterval = null;
        this.settings = {
            backgroundColor: '#ffffff',
            textColor: '#000000',
            fontSizeRatio: 1.0
        };
        this.setupEventListeners();
        this.loadData();
        this.addBackgroundOverlay();
        this.setupEasterEgg();
        this.setupResponsiveFont();
        this.setupResizeObserver();
        this.setupSettingsTip();
    }

    setupEventListeners() {
        // 设置按钮点击事件
        document.getElementById('settingsButton').addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = document.getElementById('settingsPanel');
            panel.classList.toggle('show');
        });

        // 点击其他地方关闭设置面板
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settingsPanel');
            const settingsButton = document.getElementById('settingsButton');
            if (!panel.contains(e.target) && e.target !== settingsButton) {
                panel.classList.remove('show');
            }
        });

        // 导入按钮点击事件
        document.getElementById('importButton').addEventListener('click', () => {
            const modal = document.getElementById('importModal');
            const namesInput = document.getElementById('namesInput');
            namesInput.value = this.names.join('\n');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        });

        // 关闭按钮和点击空白区域关闭模态窗口
        const closeModal = () => {
            const modal = document.getElementById('importModal');
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // 等待动画完成
        };

        document.querySelector('.close').addEventListener('click', closeModal);
        
        // 确认导入按钮点击事件
        document.getElementById('confirmImport').addEventListener('click', () => {
            const namesText = document.getElementById('namesInput').value;
            this.names = namesText.split('\n')
                .map(name => name.trim())
                .filter(name => name);
            
            if (this.names.length > 0) {
                document.getElementById('nameDisplay').textContent = '准备开始';
                closeModal();
                this.saveData();
            } else {
                alert('请输入有效的名单！');
            }
        });

        // 文字颜色选择器事件
        document.getElementById('textColorPicker').addEventListener('input', (e) => {
            document.getElementById('nameDisplay').style.color = e.target.value;
            this.settings.textColor = e.target.value;
            this.saveData();
        });

        // 背景颜色选择器事件
        document.getElementById('bgColorPicker').addEventListener('input', (e) => {
            document.body.style.backgroundColor = e.target.value;
            this.settings.backgroundColor = e.target.value;
            this.saveData();
        });

        // 修改字体大小滑块事件，添加双击恢复默认值功能
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        
        // 原有的input事件
        fontSizeSlider.addEventListener('input', (e) => {
            const ratio = parseFloat(e.target.value) / 100;
            const baseSize = this.calculateBaseFontSize();
            const actualSize = Math.floor(baseSize * ratio);
            
            document.getElementById('fontSizeValue').textContent = `${Math.floor(ratio * 100)}%`;
            document.getElementById('nameDisplay').style.fontSize = `${actualSize}px`;
            this.settings.fontSizeRatio = ratio;
            this.saveData();
        });

        // 添加双击事件
        fontSizeSlider.addEventListener('dblclick', () => {
            // 设置默认值 100%
            fontSizeSlider.value = 100;
            this.settings.fontSizeRatio = 1.0;
            
            // 更新显示
            const baseSize = this.calculateBaseFontSize();
            document.getElementById('nameDisplay').style.fontSize = `${baseSize}px`;
            document.getElementById('fontSizeValue').textContent = '100%';
            
            // 添加一个简单的动画效果
            fontSizeSlider.style.transition = 'transform 0.2s';
            fontSizeSlider.style.transform = 'scale(1.1)';
            setTimeout(() => {
                fontSizeSlider.style.transform = 'scale(1)';
            }, 200);
            
            // 保存设置
            this.saveData();
        });

        // 开始/停止按钮处理
        document.getElementById('toggleButton').addEventListener('click', () => {
            if (this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
        });

        // 添加重置按钮事件
        document.getElementById('resetButton').addEventListener('click', () => {
            this.showResetConfirm();
        });

        // 添加清空按钮事件
        document.getElementById('clearNames').addEventListener('click', () => {
            this.showClearConfirm();
        });

        // 添加全屏按钮事件
        const fullscreenButton = document.getElementById('fullscreenButton');
        fullscreenButton.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 监听全屏状态变化
        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenButtonText();
        });
    }

    saveData() {
        const data = {
            names: this.names,
            settings: this.settings
        };
        localStorage.setItem('namePickerData', JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem('namePickerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.names = data.names || [];
            this.settings = data.settings || this.settings;
            
            // 确保有 fontSizeRatio 设置
            if (typeof this.settings.fontSizeRatio === 'undefined') {
                this.settings.fontSizeRatio = 1.0;
            }

            // 应用保存的设置
            document.body.style.backgroundColor = this.settings.backgroundColor;
            document.getElementById('nameDisplay').style.color = this.settings.textColor;
            
            // 更新设置面板的值
            document.getElementById('bgColorPicker').value = this.settings.backgroundColor;
            document.getElementById('textColorPicker').value = this.settings.textColor;
            document.getElementById('fontSizeSlider').value = this.settings.fontSizeRatio * 100;
            
            // 计算并设置实际字体大小
            const baseSize = this.calculateBaseFontSize();
            const actualSize = Math.floor(baseSize * this.settings.fontSizeRatio);
            document.getElementById('nameDisplay').style.fontSize = `${actualSize}px`;
            document.getElementById('fontSizeValue').textContent = `${Math.floor(this.settings.fontSizeRatio * 100)}%`;

            // 如果有名单，更新显示
            if (this.names.length > 0) {
                document.getElementById('nameDisplay').textContent = '准备开始';
            }
        }
    }

    addBackgroundOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'background-overlay';
        document.body.appendChild(overlay);
    }

    start() {
        if (this.names.length === 0) {
            alert('请先导入名单！');
            return;
        }

        this.isRunning = true;
        const toggleButton = document.getElementById('toggleButton');
        const controlPanel = document.querySelector('.control-panel');
        const nameDisplay = document.getElementById('nameDisplay');
        const overlay = document.querySelector('.background-overlay');
        
        toggleButton.textContent = '停止';
        toggleButton.classList.add('running');
        nameDisplay.classList.add('rolling');
        overlay.classList.add('active');
        
        controlPanel.style.opacity = '0';
        controlPanel.style.visibility = 'hidden';
        
        this.currentInterval = setInterval(() => {
            const randomName = this.names[Math.floor(Math.random() * this.names.length)];
            nameDisplay.textContent = randomName;
            
            // 使用视口单位计算动画大小
            const baseSize = parseFloat(getComputedStyle(nameDisplay).fontSize);
            const randomSize = baseSize + (Math.random() * baseSize * 0.1 - baseSize * 0.05);
            nameDisplay.style.fontSize = `${randomSize}px`;
        }, 50);
    }

    stop() {
        this.isRunning = false;
        const toggleButton = document.getElementById('toggleButton');
        const controlPanel = document.querySelector('.control-panel');
        const nameDisplay = document.getElementById('nameDisplay');
        const overlay = document.querySelector('.background-overlay');
        
        toggleButton.textContent = '开始';
        toggleButton.classList.remove('running');
        nameDisplay.classList.remove('rolling');
        overlay.classList.remove('active');
        
        // 修正这里：使用正确的方式计算和恢复字体大小
        const baseSize = this.calculateBaseFontSize();
        const actualSize = Math.floor(baseSize * this.settings.fontSizeRatio);
        nameDisplay.style.fontSize = `${actualSize}px`;
        
        // 添加选中效果
        nameDisplay.classList.add('selected');
        setTimeout(() => nameDisplay.classList.remove('selected'), 500);
        
        controlPanel.style.opacity = '1';
        controlPanel.style.visibility = 'visible';
        
        clearInterval(this.currentInterval);
        
        // 修正传递给 fireConfetti 的参数
        this.fireConfetti(actualSize);
    }

    fireConfetti(fontSize) {
        const scaleFactor = fontSize / 200;
        
        // 修改发射位置和角度，让礼花朝上发射
        const origins = [
            { 
                x: 0.2, y: 0.6,    // 左侧位置
                angle: 45,          // 右上方向 (45度)
                spread: 60          // 较小的扩散范围
            },
            { 
                x: 0.8, y: 0.6,    // 右侧位置
                angle: 135,         // 左上方向 (135度)
                spread: 60          // 较小的扩散范围
            }
        ];
        
        // 同时发射两侧的礼花
        origins.forEach(origin => {
            confetti({
                particleCount: 60,          // 粒子数量
                spread: origin.spread,      // 使用定制的扩散范围
                origin: { x: origin.x, y: origin.y }, // 发射位置
                angle: origin.angle,        // 发射角度
                gravity: 0.6,               // 重力效果
                ticks: 100,                 // 持续时间
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'],
                scalar: scaleFactor,        // 大小缩放
                startVelocity: 50          // 初始速度
            });
        });
    }

    setupEasterEgg() {
        // 添加右键菜单事件监听
        document.getElementById('settingsButton').addEventListener('contextmenu', (e) => {
            e.preventDefault(); // 阻止默认右键菜单
            this.showAuthorInfo();
        });
    }

    showAuthorInfo() {
        const modal = document.createElement('div');
        modal.className = 'modal author-modal';
        
        modal.innerHTML = `
            <div class="modal-content author-info">
                <span class="close">&times;</span>
                <div class="author-header">
                    <h2>关于本项目</h2>
                    <div class="author-avatar">
                        <span class="emoji">👨‍💻</span>
                    </div>
                </div>
                <div class="author-details">
                    <p class="author-name">作者：<span>痕继痕迹 & AI</span></p>
                    <p class="author-links">
                        <a href="https://space.bilibili.com/39337803" target="_blank">B站主页</a>
                    </p>
                    <div class="project-info">
                        <h3>项目简介</h3>
                        <p>这是一个有趣的随机抽取系统，使用 Cursor 编写，具有以下特点：</p>
                        <ul>
                            <li>支持自定义名单导入</li>
                            <li>炫酷的动画效果</li>
                            <li>自定义界面样式</li>
                            <li>数据本地保存</li>
                        </ul>
                        <p class="version">版本：1.0.0</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 使用 requestAnimationFrame 确保 DOM 更新后再添加动画类
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.classList.add('show');
            });
        });

        // 添加关闭功能
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        };

        modal.querySelector('.close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    calculateBaseFontSize() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return Math.min(vw * 0.15, vh * 0.12); // 使用视口的较小值作为基准
    }

    setupResponsiveFont() {
        // 更新字体大小滑块的范围
        const updateSliderRange = () => {
            const slider = document.getElementById('fontSizeSlider');
            slider.min = 50;  // 最小50%
            slider.max = 200; // 最大200%
            slider.value = this.settings.fontSizeRatio * 100;
            
            const baseSize = this.calculateBaseFontSize();
            const actualSize = Math.floor(baseSize * this.settings.fontSizeRatio);
            
            document.getElementById('fontSizeValue').textContent = `${Math.floor(this.settings.fontSizeRatio * 100)}%`;
            document.getElementById('nameDisplay').style.fontSize = `${actualSize}px`;
        };

        // 初始设置
        updateSliderRange();
        
        // 添加防抖的窗口调整监听
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const baseSize = this.calculateBaseFontSize();
                const actualSize = Math.floor(baseSize * this.settings.fontSizeRatio);
                document.getElementById('nameDisplay').style.fontSize = `${actualSize}px`;
            }, 100);
        });
    }

    setupResizeObserver() {
        // 监听容器大小变化
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const container = entry.target;
                const height = entry.contentRect.height;
                // 根据容器高度调整间距
                const gap = Math.min(height * 0.05, 30);
                container.style.gap = `${gap}px`;
            }
        });

        // 观察主容器
        observer.observe(document.querySelector('.container'));
    }

    setupSettingsTip() {
        if (!localStorage.getItem('hasVisited')) {
            const tip = document.createElement('div');
            tip.className = 'settings-tip';
            tip.textContent = '点击这里可以整颜色和字体大小';
            
            // 创建关闭按钮
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tip-close';
            closeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <circle cx="12" cy="12" r="11" fill="rgba(255, 255, 255, 0.1)"/>
                    <path d="M8 8L16 16M8 16L16 8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;
            
            tip.appendChild(closeBtn);
            
            const settingsButton = document.getElementById('settingsButton');
            document.body.appendChild(tip);
            
            const updatePosition = () => {
                const buttonRect = settingsButton.getBoundingClientRect();
                tip.style.position = 'fixed';
                tip.style.left = `${buttonRect.left + buttonRect.width/2}px`;
                tip.style.top = `${buttonRect.top - 10}px`;
            };
            
            // 关闭提示的函数
            const closeTip = () => {
                tip.classList.remove('show');
                setTimeout(() => {
                    tip.remove();
                    window.removeEventListener('resize', updatePosition);
                    document.removeEventListener('click', handleClickOutside);
                }, 500);
                localStorage.setItem('hasVisited', 'true');
            };
            
            // 处理点击外部的函数
            const handleClickOutside = (e) => {
                if (!tip.contains(e.target) && 
                    !settingsButton.contains(e.target)) {
                    closeTip();
                }
            };
            
            // 初始定位和显示
            updatePosition();
            tip.classList.add('show');
            document.addEventListener('click', handleClickOutside);
            
            // 监听窗口大小变
            window.addEventListener('resize', updatePosition);
            
            // 关闭按钮点击事件
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTip();
            });
            
            // 阻止提示框本身的点击事件冒泡
            tip.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // 添加隐藏重置确认弹窗的方法
    hideResetConfirm() {
        const resetConfirm = document.getElementById('resetConfirm');
        const overlay = document.querySelector('.reset-overlay');
        resetConfirm.classList.remove('show');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    showResetConfirm() {
        const popup = document.querySelector('.reset-confirm-popup');
        const resetButton = document.getElementById('resetButton');
        
        // 计算弹窗位置
        const updatePosition = () => {
            const buttonRect = resetButton.getBoundingClientRect();
            const popupRect = popup.getBoundingClientRect();
            
            popup.style.left = `${buttonRect.left + (buttonRect.width / 2) - (popupRect.width / 2)}px`;
            popup.style.top = `${buttonRect.top - popupRect.height - 15}px`;
        };

        updatePosition();
        popup.classList.add('show');

        const resizeHandler = () => {
            if (popup.classList.contains('show')) {
                updatePosition();
            }
        };
        window.addEventListener('resize', resizeHandler);

        const handleOutsideClick = (e) => {
            if (!popup.contains(e.target) && !resetButton.contains(e.target)) {
                cleanup();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 0);

        const confirmButton = popup.querySelector('.reset-confirm-ok');
        const cancelButton = popup.querySelector('.reset-confirm-cancel');

        const cleanup = () => {
            popup.classList.remove('show');
            document.removeEventListener('click', handleOutsideClick);
            window.removeEventListener('resize', resizeHandler);
            confirmButton.removeEventListener('click', handleConfirm);
            cancelButton.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            // 清除本地存储
            localStorage.removeItem('namePickerData');
            localStorage.removeItem('hasVisited');
            
            // 重置所有设置
            this.names = [];
            this.settings = {
                backgroundColor: '#ffffff',
                textColor: '#000000',
                fontSizeRatio: 1.0
            };
            
            // 重置UI
            document.body.style.backgroundColor = '#ffffff';
            document.getElementById('nameDisplay').style.color = '#000000';
            document.getElementById('nameDisplay').textContent = '请导入名单';
            document.getElementById('bgColorPicker').value = '#ffffff';
            document.getElementById('textColorPicker').value = '#000000';
            document.getElementById('fontSizeSlider').value = 100;
            document.getElementById('fontSizeValue').textContent = '100%';
            
            // 重新计算并设置字体大小
            const baseSize = this.calculateBaseFontSize();
            document.getElementById('nameDisplay').style.fontSize = `${baseSize}px`;
            
            // 关闭设置面板
            document.getElementById('settingsPanel').classList.remove('show');
        };

        const handleCancel = () => {
            cleanup();
        };

        confirmButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);
    }

    // 添加显示清空确认弹窗的方法
    showClearConfirm() {
        const popup = document.querySelector('.clear-confirm-popup');
        const clearButton = document.getElementById('clearNames');
        
        // 计算弹窗位置
        const updatePosition = () => {
            const buttonRect = clearButton.getBoundingClientRect();
            const popupRect = popup.getBoundingClientRect();
            
            popup.style.left = `${buttonRect.left + (buttonRect.width / 2) - (popupRect.width / 2)}px`;
            popup.style.top = `${buttonRect.top - popupRect.height - 15}px`;
        };

        updatePosition();
        popup.classList.add('show');

        const resizeHandler = () => {
            if (popup.classList.contains('show')) {
                updatePosition();
            }
        };
        window.addEventListener('resize', resizeHandler);

        const handleOutsideClick = (e) => {
            if (!popup.contains(e.target) && !clearButton.contains(e.target)) {
                cleanup();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 0);

        const confirmButton = popup.querySelector('.reset-confirm-ok');
        const cancelButton = popup.querySelector('.reset-confirm-cancel');

        const cleanup = () => {
            popup.classList.remove('show');
            document.removeEventListener('click', handleOutsideClick);
            window.removeEventListener('resize', resizeHandler);
            confirmButton.removeEventListener('click', handleConfirm);
            cancelButton.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            // 清空输入框
            document.getElementById('namesInput').value = '';
        };

        const handleCancel = () => {
            cleanup();
        };

        confirmButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);
    }

    // 添加切换全屏的方法
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            // 进入全屏
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`全屏请求失败: ${err.message}`);
            });
        } else {
            // 退出全屏
            document.exitFullscreen();
        }
    }

    // 更新全屏按钮文字
    updateFullscreenButtonText() {
        const fullscreenButton = document.getElementById('fullscreenButton');
        if (document.fullscreenElement) {
            fullscreenButton.textContent = '退出全屏';
        } else {
            fullscreenButton.textContent = '全屏';
        }
    }
}

// 初始化应用
const namePicker = new NamePicker(); 

// 在文件末尾添加
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker 注册成功:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker 注册失败:', error);
            });
    });
}