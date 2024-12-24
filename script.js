document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.querySelector('.main-container');
    const navButtons = document.querySelectorAll('.nav-button');
    const modals = document.querySelectorAll('.modal');
    let activeModal = null;

    // 打开模态框
    function openModal(modalId) {
        const modal = document.getElementById(`${modalId}Modal`);
        if (modal) {
            modal.classList.add('active');
            mainContainer.classList.add('modal-open');
            activeModal = modal;
        }
    }

    // 关闭模态框
    function closeModal() {
        if (activeModal) {
            activeModal.classList.remove('active');
            mainContainer.classList.remove('modal-open');
            activeModal = null;
        }
    }

    // 生成软件列表
    function generateSoftwareList() {
        const softwareList = document.getElementById('softwareList');
        if (!softwareList) return;
        
        softwareList.innerHTML = '';

        for (const [category, items] of Object.entries(softwareData)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'software-category';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'category-title';
            titleDiv.textContent = category;
            
            const gridDiv = document.createElement('div');
            gridDiv.className = 'software-grid';
            
            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'software-item';
                
                const titleRow = document.createElement('div');
                titleRow.className = 'software-title-row';
                
                const nameDiv = document.createElement('div');
                nameDiv.className = 'software-name';
                nameDiv.textContent = item.name;
                
                const downloadIcon = document.createElement('div');
                downloadIcon.className = 'download-icon';
                downloadIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-5 4h10v-2H7v2z"/>
                    </svg>
                `;
                
                downloadIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.open(item.downloadUrl, '_blank');
                });
                
                const description = document.createElement('div');
                description.className = 'software-description';
                description.textContent = item.description;
                
                titleRow.appendChild(nameDiv);
                titleRow.appendChild(downloadIcon);
                
                itemDiv.appendChild(titleRow);
                itemDiv.appendChild(description);
                gridDiv.appendChild(itemDiv);

                itemDiv.addEventListener('click', () => {
                    window.open(item.url, '_blank');
                });
            });
            
            categoryDiv.appendChild(titleDiv);
            categoryDiv.appendChild(gridDiv);
            softwareList.appendChild(categoryDiv);
        }
    }

    // 初始生成软件列表
    generateSoftwareList();

    // 绑定导航按钮点击事件
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalType = button.getAttribute('data-modal');
            openModal(modalType);
        });
    });

    // 点击遮罩层关闭模态框
    modals.forEach(modal => {
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    });

    // 绑定关闭按钮事件
    document.querySelectorAll('.close-button').forEach(button => {
        button.addEventListener('click', closeModal);
    });

    // 阻止模态框内容点击事件冒泡
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // 添加工具链接点击事件
    document.querySelectorAll('.tool-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const toolId = link.getAttribute('data-tool');
            openToolFrame(toolId);
        });
    });

    // 打开工具iframe
    function openToolFrame(toolId) {
        const toolFrame = document.querySelector('.tool-frame');
        const toolFrameModal = document.getElementById('toolFrameModal');
        const toolFrameContainer = document.querySelector('.tool-frame-container');
        
        toolFrameContainer.classList.add('loading');
        
        let toolUrl = '';
        switch(toolId) {
            case 'sjdm':
                toolUrl = './sjdm/index.html';
                break;
            case 'tool2':
                toolUrl = './tool2/index.html';
                break;
        }
        
        toolFrame.onload = () => {
            setTimeout(() => {
                toolFrameContainer.classList.remove('loading');
                toolFrameContainer.classList.add('loaded');
            }, 100);
        };
        
        toolFrame.src = toolUrl;
        closeModal();
        toolFrameModal.classList.add('active');
        mainContainer.classList.add('modal-open');
        activeModal = toolFrameModal;
    }

    // 添加鼠标移动光效
    document.querySelector('.glass-card').addEventListener('mousemove', (e) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });

    // 鼠标离开时重置光效位置到中心
    document.querySelector('.glass-card').addEventListener('mouseleave', (e) => {
        const card = e.currentTarget;
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');
    });

    // 加载背景图片
    function loadBackgroundImage() {
        const mainBg = document.querySelector('.background-image.main');
        const img = new Image();
        
        img.onload = function() {
            mainBg.classList.add('loaded');
        };
        
        img.src = 'imgs/BG01.jpg';
    }

    loadBackgroundImage();
}); 